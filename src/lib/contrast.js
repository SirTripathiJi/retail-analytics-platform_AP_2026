const clamp = value => Math.min(255, Math.max(0, value))

function channelValue(value) {
  const trimmed = value.trim()
  if (trimmed.endsWith('%')) return clamp(Number.parseFloat(trimmed) * 2.55)
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? clamp(parsed) : null
}

function alphaValue(value) {
  if (value === undefined) return 1
  const trimmed = value.trim()
  const parsed = Number.parseFloat(trimmed)
  if (!Number.isFinite(parsed)) return null
  return Math.min(1, Math.max(0, trimmed.endsWith('%') ? parsed / 100 : parsed))
}

function resolveVariables(value, computedStyle, depth = 0) {
  if (depth > 8) return null
  const variable = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g
  let found = false
  const resolved = value.replace(variable, (_match, name, fallback) => {
    found = true
    const current = computedStyle?.getPropertyValue?.(name)?.trim()
    const replacement = current || fallback?.trim()
    return replacement || ''
  })
  if (!found) return resolved.trim()
  if (resolved === value) return null
  return resolveVariables(resolved, computedStyle, depth + 1)
}

export function parseColor(input, computedStyle) {
  if (typeof input !== 'string') return null
  const value = resolveVariables(input.trim(), computedStyle)
  if (!value) return null

  const hex = value.match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i)
  if (hex) {
    let digits = hex[1]
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map(char => `${char}${char}`).join('')
    const hasAlpha = digits.length === 8
    return {
      r: Number.parseInt(digits.slice(0, 2), 16),
      g: Number.parseInt(digits.slice(2, 4), 16),
      b: Number.parseInt(digits.slice(4, 6), 16),
      a: hasAlpha ? Number.parseInt(digits.slice(6, 8), 16) / 255 : 1,
    }
  }

  const rgb = value.match(/^rgba?\((.*)\)$/i)
  if (!rgb) return null
  const [colorParts, slashAlpha] = rgb[1].split('/')
  const channels = colorParts.includes(',') ? colorParts.split(',').map(part => part.trim()) : colorParts.trim().split(/\s+/)
  const parts = slashAlpha === undefined ? channels : [...channels, slashAlpha.trim()]
  if (parts.length !== 3 && parts.length !== 4) return null
  const [r, g, b] = parts.slice(0, 3).map(channelValue)
  const a = alphaValue(parts[3])
  if ([r, g, b, a].some(channel => channel === null)) return null
  return { r, g, b, a }
}

function composite(foreground, background) {
  if (!foreground || !background || background.a < 1) return null
  const alpha = foreground.a
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1,
  }
}

function opaqueBackground(input, computedStyle) {
  const color = parseColor(input, computedStyle)
  if (!color || color.a === 1) return color
  return composite(color, parseColor('var(--background)', computedStyle))
}

function linearChannel(channel) {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(color) {
  if (!color || color.a < 1) return null
  return 0.2126 * linearChannel(color.r) + 0.7152 * linearChannel(color.g) + 0.0722 * linearChannel(color.b)
}

export function contrastRatio(foregroundInput, backgroundInput, computedStyle) {
  const background = opaqueBackground(backgroundInput, computedStyle)
  const foreground = composite(parseColor(foregroundInput, computedStyle), background)
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  if (foregroundLuminance === null || backgroundLuminance === null) return null
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

export function displayColor(input, computedStyle) {
  const color = parseColor(input, computedStyle)
  if (!color) return null
  const hex = [color.r, color.g, color.b].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()
  return `#${hex}`
}

export function assessContrast(entries, computedStyle) {
  return entries.map(entry => {
    const ratio = contrastRatio(entry.foreground, entry.background, computedStyle)
    const parsedBackground = opaqueBackground(entry.background, computedStyle)
    const parsedForeground = composite(parseColor(entry.foreground, computedStyle), parsedBackground)
    return {
      ...entry,
      ratio,
      foregroundColor: parsedForeground ? `#${[parsedForeground.r, parsedForeground.g, parsedForeground.b].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}` : null,
      backgroundColor: parsedBackground ? `#${[parsedBackground.r, parsedBackground.g, parsedBackground.b].map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()}` : null,
      status: ratio === null ? 'unknown' : ratio >= entry.threshold ? 'pass' : 'fail',
    }
  })
}
