import test from 'node:test'
import assert from 'node:assert/strict'
import { assessContrast, contrastRatio, parseColor } from './contrast.js'

test('WCAG relative luminance contrast returns 21:1 for black and white', () => {
  assert.equal(contrastRatio('#000000', '#FFFFFF'), 21)
})

test('hex shorthand and alpha hex are parsed', () => {
  assert.deepEqual(parseColor('#abc'), { r: 170, g: 187, b: 204, a: 1 })
  assert.equal(parseColor('#0008').a, 0x88 / 255)
})

test('comma and modern rgb/rgba syntax are parsed and alpha is composited on the background', () => {
  assert.deepEqual(parseColor('rgba(255, 0, 128, 25%)'), { r: 255, g: 0, b: 128, a: 0.25 })
  assert.deepEqual(parseColor('rgb(10 20 30 / 50%)'), { r: 10, g: 20, b: 30, a: 0.5 })
  const ratio = contrastRatio('rgba(0, 0, 0, 0.5)', '#fff')
  assert.ok(ratio > 3.9 && ratio < 4.1)
  const style = { getPropertyValue: name => name === '--background' ? '#ffffff' : '' }
  assert.equal(contrastRatio('#000', 'rgba(255, 255, 255, 0.5)', style), 21)
})

test('CSS custom properties resolve from the active computed theme values', () => {
  const tokens = { '--foreground': '#171717', '--background': 'rgb(255 255 255)' }
  const style = { getPropertyValue: name => tokens[name] || '' }
  assert.equal(contrastRatio('var(--foreground)', 'var(--background)', style), contrastRatio('#171717', '#ffffff'))
})

test('unsupported colors are reported as unknown instead of receiving a fabricated ratio', () => {
  assert.equal(contrastRatio('color(display-p3 1 0 0)', '#fff'), null)
  const [result] = assessContrast([{ id: 'unknown', foreground: 'not-a-color', background: '#fff', threshold: 4.5 }])
  assert.equal(result.status, 'unknown')
  assert.equal(result.ratio, null)
})

test('assessment uses each entry threshold to calculate pass and fail results', () => {
  const result = assessContrast([
    { id: 'normal', foreground: '#767676', background: '#ffffff', threshold: 4.5 },
    { id: 'large', foreground: '#999999', background: '#ffffff', threshold: 3 },
  ])
  assert.equal(result[0].status, 'pass')
  assert.equal(result[1].status, 'fail')
})

test('theme token changes recalculate actual pass/fail status instead of preserving a fixed ratio', () => {
  const entry = [{ id: 'link', foreground: 'var(--primary)', background: 'var(--background)', threshold: 4.5 }]
  const style = tokens => ({ getPropertyValue: name => tokens[name] || '' })
  const light = assessContrast(entry, style({ '--primary': '#ff5f64', '--background': '#ffffff' }))[0]
  const dark = assessContrast(entry, style({ '--primary': '#ff5f64', '--background': '#050505' }))[0]
  assert.equal(light.status, 'fail')
  assert.equal(dark.status, 'pass')
  assert.notEqual(light.ratio, dark.ratio)
})
