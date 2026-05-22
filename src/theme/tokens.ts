// TaskBrake デザイントークン（スライド由来のダークテーマ）

export const colors = {
  // 背景グラデ（深ネイビー → インディゴ）
  bgTop: '#0B1020',
  bgBottom: '#1A1740',

  // サーフェス / カード
  surface: '#1C2233',
  surfaceAlt: '#232A3D',
  border: 'rgba(255,255,255,0.08)',

  // アクセント（青 → 紫）
  accentFrom: '#5B6EF5',
  accentTo: '#8B5CF6',

  // 属性カラー
  blue: '#5B8DEF', // 🔵 動ける（松竹梅）
  fireFrom: '#FF5A6E', // 🔥 沼（タイマー）
  fireTo: '#FF8A4C',

  // テキスト
  text: '#E8ECF5',
  textSecondary: '#8A93A8',
  textOnAccent: '#FFFFFF',

  // ステータス
  success: '#3DD68C',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

export const typography = {
  body: 16,
  small: 13,
  caption: 11,
  title: 22,
} as const;

// グラデ用のタプル（expo-linear-gradient の colors prop に渡す）
export const gradients = {
  bg: [colors.bgTop, colors.bgBottom] as const,
  accent: [colors.accentFrom, colors.accentTo] as const,
  fire: [colors.fireFrom, colors.fireTo] as const,
};
