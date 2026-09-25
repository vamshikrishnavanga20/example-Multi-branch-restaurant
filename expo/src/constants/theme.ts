/**
 * Example Project POS — Design Tokens
 *
 * Single source of truth for every color, spacing value, radius, and
 * typographic constant used across the app.  Import from here instead
 * of hardcoding hex values in individual screens.
 */

// ─── Color Palette ───────────────────────────────────────────────────────────
export const Colors = {
  // Backgrounds (dark → light)
  bg:          '#09090B',
  bgCard:      '#111113',
  bgSurface:   '#0D0D0F',
  bgInput:     '#18181B',
  bgElevated:  '#1C1A10',   // active / highlighted card

  // Borders
  border:      '#27272A',
  borderLight: '#1A1A1D',
  borderFocus: '#3F3F46',

  // Brand
  gold:        '#D4AF37',
  goldDim:     'rgba(212,175,55,0.12)',
  goldBorder:  'rgba(212,175,55,0.3)',
  red:         '#EF4444',
  redDim:      'rgba(239,68,68,0.08)',
  redBorder:   'rgba(239,68,68,0.25)',

  // Status
  green:       '#10B981',
  greenDim:    'rgba(16,185,129,0.12)',
  greenBorder: 'rgba(16,185,129,0.3)',
  orange:      '#F97316',
  orangeDim:   'rgba(249,115,22,0.12)',
  orangeBorder:'rgba(249,115,22,0.35)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary:'#E4E4E7',
  textMuted:   '#A1A1AA',
  textDim:     '#71717A',
  textFaint:   '#52525B',
  textGhost:   '#3F3F46',

  // Misc
  white:       '#FFFFFF',
  black:       '#000000',
  transparent: 'transparent',
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const Spacing = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
  huge:40,
} as const;

// ─── Border Radii ────────────────────────────────────────────────────────────
export const Radii = {
  sm:    8,
  md:   10,
  lg:   12,
  xl:   14,
  xxl:  16,
  pill:  20,
  card:  18,
  sheet: 32,
  full:  9999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
export const FontSizes = {
  xs:   10,
  sm:   11,
  body: 13,
  md:   14,
  lg:   15,
  xl:   16,
  xxl:  18,
  title:20,
  hero: 22,
  display:24,
  mega: 26,
  giant:28,
} as const;

export const FontWeights = {
  normal: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
  black: '900' as const,
};

// ─── Layout Constants ────────────────────────────────────────────────────────
export const TABLET_BREAKPOINT = 768;
export const TAB_BAR_HEIGHT_PHONE = 72;
export const TAB_BAR_HEIGHT_TABLET = 82;

// ─── Status Color Map ────────────────────────────────────────────────────────
export const StatusColors = {
  pending: {
    text: Colors.gold,
    bg: Colors.goldDim,
    border: Colors.goldBorder,
    label: 'PENDING',
  },
  in_progress: {
    text: Colors.orange,
    bg: Colors.orangeDim,
    border: Colors.orangeBorder,
    label: 'COOKING',
  },
  completed: {
    text: Colors.green,
    bg: Colors.greenDim,
    border: Colors.greenBorder,
    label: 'SERVED',
  },
  cancelled: {
    text: Colors.red,
    bg: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    label: 'CANCELLED',
  },
} as const;
