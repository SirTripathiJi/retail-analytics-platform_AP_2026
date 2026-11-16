export function cn(...values) {
  return values.flat().filter(value => typeof value === 'string' && value.length > 0).join(' ')
}
