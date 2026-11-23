/**
 * homeTheme.ts
 * Design tokens and theme constants extracted from the Figma CSS specification for the Home Screen redesign.
 */

export const HomeColors = {
  // Backgrounds
  pageBackground: '#FAF3EB',
  bodyBackground: '#F8F1E9',
  cardWhite: '#FFFFFF',
  cardDark: '#252D3A',

  // Brand
  brandOrange: '#FE6700',
  brandOrangeSoft: '#FFF0E6',
  brandOrangeHover: '#E55C00',

  // Borders & Dividers
  borderSubtle: '#E7DED6',
  borderLight: '#FFFFFF',

  // Typography
  textPrimary: '#1F2937',
  textSecondary: '#343B48',
  textMuted: '#667085',
  textSubtle: '#86634E',
  textWhite: '#FFFFFF',
  textWhiteMuted: 'rgba(255, 255, 255, 0.75)',
  textWhiteBody: 'rgba(255, 255, 255, 0.85)',
  textWhiteSubtle: 'rgba(255, 255, 255, 0.65)',

  // Action / Accent Tints
  peachBg: '#FFF0E6',
  peachBorder: '#FE6700',
  yellowBg: '#FFF3D2',
  yellowIcon: '#B76A00',
  blueBg: '#EAF2FF',
  blueText: '#2865C7',
  blueIcon: '#2865C7',
  mintBg: '#E8F7F1',
  mintIcon: '#158263',
  mintText: '#158263',

  // Vitals Status Tints
  vitalsBoxBg: '#F4FAF7',
  vitalsValueGreen: '#176D53',
  vitalsLabelGreen: '#4A625B',
  vitalsUnitGreen: '#729087',

  // Alert / SOS
  sosRed: '#E53E3E',
  sosShadow: 'rgba(229, 62, 62, 0.24)',

  // Wellness / Adherence
  adherenceGreen: '#42BF8A',
  adherenceText: '#80D6B2',
  progressTrack: 'rgba(255, 255, 255, 0.1)',
} as const;

export const HomeShadows = {
  hero: {
    shadowColor: '#FE6700',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.18,
    shadowRadius: 38,
    elevation: 8,
  },
  card: {
    shadowColor: '#513422',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 30,
    elevation: 3,
  },
  floatingBar: {
    shadowColor: '#513422',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  darkCard: {
    shadowColor: '#252D3A',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 6,
  },
  sos: {
    shadowColor: '#E53E3E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 4,
  },
} as const;
