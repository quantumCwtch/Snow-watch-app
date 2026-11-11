// A deliberately limited 32-colour palette in the spirit of VGA-era games.
// Original selection; colours are referred to by name throughout the renderer.
export const P = {
  black: '#0b0b14',
  ink: '#1a1c2c',
  navy: '#29366f',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  cyan: '#73eff7',
  white: '#f4f4f4',
  pale: '#c9d4e0',
  grey: '#94a0b0',
  slate: '#566c86',
  dark: '#333c57',
  stone: '#d8c8a0',
  stoneShade: '#a8987a',
  stoneDark: '#7a6c58',
  sand: '#e8d7a8',
  brown: '#7a4a2a',
  wood: '#a86a3a',
  skin1: '#f2c6a0',
  skin2: '#d49a6a',
  skin3: '#a0663e',
  skin4: '#6b3f24',
  red: '#d6303c',
  darkRed: '#8a1c2c',
  orange: '#ef7d57',
  yellow: '#ffcd75',
  gold: '#e0a020',
  green: '#38b764',
  darkGreen: '#257179',
  lime: '#a7f070',
  purple: '#8b4bb0',
  pink: '#f08ab8',
  bronze: '#5a5a48',
} as const;

export type ColourName = keyof typeof P;

/** Sky gradient bands per weather mood and time of day (top to bottom). */
export const SKIES: Record<string, string[]> = {
  sunny: ['#2f6fd6', '#3b85e6', '#41a6f6', '#62bdf8', '#8fd3fa'],
  hot: ['#3b7de0', '#55a0f2', '#7cc4f8', '#ffd9a0', '#ffe8b8'],
  cold: ['#4a7ec8', '#6a9bd8', '#8fb8e8', '#b8d4f0', '#dbe8f6'],
  partly: ['#3b72c9', '#4f8ad8', '#6aa4e6', '#8cbcef', '#b0d2f4'],
  overcast: ['#7a8494', '#8a94a4', '#98a2b0', '#a6aebb', '#b4bbc6'],
  rain: ['#4a5262', '#566070', '#626c7c', '#6e7888', '#7a8494'],
  storm: ['#22263a', '#2c3248', '#363e56', '#424a62', '#4e566e'],
  fog: ['#a8acb4', '#b4b8bf', '#c0c3c9', '#cbced3', '#d6d8dc'],
  snow: ['#8e98ac', '#9ea8ba', '#aeb6c6', '#bec4d2', '#ced3de'],
  unknown: ['#6a7080', '#767c8c', '#828898', '#8e94a2', '#9aa0ad'],
  night: ['#05060f', '#0a0d20', '#10153a', '#182050', '#202a62'],
  nightCloud: ['#14161f', '#1b1e2a', '#222634', '#2a2e3e', '#323748'],
};
