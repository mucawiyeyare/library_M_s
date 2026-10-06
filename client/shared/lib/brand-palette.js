const white = [255, 255, 255]
const black = [0, 0, 0]
export const defaultColors = { primaryColor: '#29C5E0', secondaryColor: '#F47920' }
function rgb(value, fallback) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
}
function mix(a, b, weight) {
  return a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight))
}
function hex(color) {
  return '#' + color.map((value) => value.toString(16).padStart(2, '0')).join('')
}
function luminance(color) {
  const values = color.map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722
}
export function contrastRatio(a, b) {
  const first = luminance(rgb(a, '#000000')),
    second = luminance(rgb(b, '#ffffff'))
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
function readable(color, backgrounds, dark, target = 5) {
  for (let index = 0; index <= 100; index++) {
    const candidate = mix(color, dark ? white : black, index / 100)
    if (backgrounds.every((background) => contrastRatio(hex(candidate), hex(background)) >= target))
      return candidate
  }
  return dark ? white : black
}
export function brandPalette(primary, secondary, dark) {
  const p = rgb(primary, defaultColors.primaryColor),
    s = rgb(secondary, defaultColors.secondaryColor)
  const bg = dark ? mix([19, 24, 29], s, 0.04) : mix(s, white, 0.98)
  const surface = dark ? mix([28, 34, 40], s, 0.04) : white
  const soft = dark ? mix([38, 45, 52], s, 0.04) : mix(s, white, 0.93)
  const secondarySoft = dark ? mix(soft, s, 0.06) : mix(s, white, 0.9)
  const accentSoft = mix(p, surface, 0.9)
  const backgrounds = [bg, surface, soft, secondarySoft, accentSoft]
  const accent = readable(p, backgrounds, dark)
  const accentHover = readable(mix(accent, dark ? white : black, 0.12), backgrounds, dark)
  // Filled controls have their own dark shade; text accents remain light in dark mode.
  const button = readable(p, [white], false)
  const buttonHover = mix(button, black, 0.15)
  return {
    '--bg': hex(bg),
    '--surface': hex(surface),
    '--soft': hex(soft),
    '--text': dark ? '#f2f5f7' : '#202a32',
    '--muted': dark ? '#b9c3cc' : '#52616d',
    '--line': dark ? '#414c57' : '#d9dfe3',
    '--accent': hex(accent),
    '--accent-hover': hex(accentHover),
    '--accent-soft': hex(accentSoft),
    '--accent-foreground': '#ffffff',
    '--button': hex(button),
    '--button-hover': hex(buttonHover),
    '--secondary': hex(readable(s, backgrounds, dark)),
    '--secondary-soft': hex(secondarySoft),
  }
}
