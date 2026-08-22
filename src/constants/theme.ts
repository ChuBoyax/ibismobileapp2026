

export const Colors = {
  primary: '#1B7A3E',
  primaryDark: '#14562C',
  primaryDeep: '#0E3F21',
  primaryLight: '#E8F5EC',
  accent: '#F2B705',
  text: '#1A1D1A',
  textSecondary: '#46514A',
  muted: '#6B7A6E',
  border: '#DCE5DE',
  divider: '#EDF2EE',
  danger: '#C0392B',
  dangerLight: '#FDECEA',
  info: '#1F5FA8',
  infoLight: '#E7F0FB',
  warning: '#B5860B',
  warningLight: '#FDF3DC',
  surface: '#FFFFFF',
  background: '#F4F7F5',
  onPrimary: '#FFFFFF',
 
  onPrimaryFaded: 'rgba(255, 255, 255, 0.16)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 20,
  header: 36,
  pill: 999,
} as const;

export const FontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 26,
} as const;


export const Shadow = {
  card: {
    shadowColor: '#0A2A18',
    shadowOpacity: 0.07,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  raised: {
    shadowColor: '#0A2A18',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
};
