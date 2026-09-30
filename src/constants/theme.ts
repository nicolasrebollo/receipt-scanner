import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#0b0b0b',
    textSecondary: '#6b6a66',
    textMuted: '#898781',
    background: '#f5f5f3',
    card: '#ffffff',
    fill: '#ececea',
    separator: 'rgba(11,11,11,0.08)',
    accent: '#2a78d6',
    accentText: '#ffffff',
    danger: '#d03b3b',
    gridline: '#e1e0d9',
  },
  dark: {
    text: '#ffffff',
    textSecondary: '#c3c2b7',
    textMuted: '#898781',
    background: '#0d0d0d',
    card: '#1a1a19',
    fill: '#262624',
    separator: 'rgba(255,255,255,0.10)',
    accent: '#3987e5',
    accentText: '#ffffff',
    danger: '#e66767',
    gridline: '#2c2c2a',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? Colors.dark : Colors.light;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
} as const;
