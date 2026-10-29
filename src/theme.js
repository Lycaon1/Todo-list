import { Platform, useColorScheme } from 'react-native';

const light = {
  dark: false,
  bg: '#F0F4F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F4F9',
  text: '#1F1F1F',
  textSecondary: '#444746',
  muted: '#747775',
  outline: '#C4C7C5',
  divider: '#E1E3E1',
  primary: '#0B57D0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#D3E3FD',
  onPrimaryContainer: '#041E49',
  fab: '#C2E7FF',
  fabIcon: '#001D35',
  danger: '#B3261E',
  dangerContainer: '#F9DEDC',
  onDangerContainer: '#410E0B',
  success: '#146C2E',
  successContainer: '#C4EED0',
  onSuccessContainer: '#072711',
  warning: '#8C5000',
  warningContainer: '#FFDDB8',
  onWarningContainer: '#2D1600',
  pressed: 'rgba(31, 31, 31, 0.08)',
  scrim: 'rgba(0, 0, 0, 0.32)',
  snackbar: '#303030',
  snackbarText: '#F2F2F2',
  snackbarAction: '#A8C7FA',
};

const dark = {
  dark: true,
  bg: '#131314',
  surface: '#1E1F20',
  surfaceAlt: '#282A2C',
  text: '#E3E3E3',
  textSecondary: '#C4C7C5',
  muted: '#8E918F',
  outline: '#444746',
  divider: '#333537',
  primary: '#A8C7FA',
  onPrimary: '#062E6F',
  primaryContainer: '#0842A0',
  onPrimaryContainer: '#D3E3FD',
  fab: '#004A77',
  fabIcon: '#C2E7FF',
  danger: '#F2B8B5',
  dangerContainer: '#8C1D18',
  onDangerContainer: '#F9DEDC',
  success: '#6DD58C',
  successContainer: '#0F5223',
  onSuccessContainer: '#C4EED0',
  warning: '#FFB95C',
  warningContainer: '#6B3B00',
  onWarningContainer: '#FFDDB8',
  pressed: 'rgba(227, 227, 227, 0.08)',
  scrim: 'rgba(0, 0, 0, 0.5)',
  snackbar: '#E3E3E3',
  snackbarText: '#1F1F1F',
  snackbarAction: '#0B57D0',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}

// Removes the browser focus ring on text inputs in the web build
export const noOutline = Platform.OS === 'web' ? { outlineStyle: 'none' } : null;
