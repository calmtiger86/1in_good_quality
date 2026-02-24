/**
 * OpenSpec v6.6 — 시스템 상수 및 규칙
 * 카드뉴스 에디터 전체에서 사용되는 디자인 토큰
 */

// ─── 캔버스 규격 ─────────────────────────────────
export const CANVAS = {
  WIDTH: 1080,
  HEIGHT: 1350,
  RATIO: '4:5',
  SAFE_MARGIN: 24,
} as const;

// ─── 컬러 시스템 (§4.2) ────────────────────────────
export const COLORS = {
  background: {
    kraft: '#C4A882',
    white: '#FFFFFF',
    lightBeige: '#E5D3B3',
  },
  text: {
    primary: '#000000',
    secondary: '#333333',
    muted: '#666666',
  },
  accent: {
    illustrationStroke: '#000000',
    illustrationFill: '#000000', // 머리카락 ONLY
    overlayBg: 'rgba(0, 0, 0, 0.45)',
  },
} as const;

// ─── 타이포그래피 (§4.4) ─────────────────────────
export const TYPOGRAPHY = {
  korean: {
    family: 'NanumSquare',
    weights: ['Regular', 'Bold', 'ExtraBold'] as const,
    fallback: 'sans-serif',
  },
  english: {
    family: 'Inter',
    weights: ['Regular', 'SemiBold', 'Bold'] as const,
    fallback: 'sans-serif',
  },
  alignment: 'left' as const,
  constraints: {
    headline: { lines: 1, charsPerLine: [12, 18] },
    body: { lines: 3, charsPerLine: [12, 18] },
  },
  caption: {
    maxLength: 2200,
    warningThreshold: 2000,
  },
} as const;

// ─── 로고 규격 (§4.1 #6) ──────────────────────────
export const LOGO = {
  position: { x: 24, y: 24 },
  width: { min: 60, max: 80 },
  files: {
    white: '/assets/logo/1in_logo_white.png',
    kraft: '/assets/logo/1in_logo_kraft.png',
  },
  // 배경색에 따른 로고 자동 전환
  getLogoForBackground(bg: string): string {
    if (bg === COLORS.background.white) return this.files.kraft;
    return this.files.white;
  },
} as const;

// ─── 슬라이드 타입 ─────────────────────────────────
export type SlideType = 'hook' | 'agitation' | 'solution' | 'photo_card' | 'cta';

export const SLIDE_TYPES: Record<SlideType, { label: string; icon: string }> = {
  hook: { label: 'Hook (표지)', icon: '📰' },
  agitation: { label: 'Agitation (공감)', icon: '💭' },
  solution: { label: 'Solution (정보)', icon: '💡' },
  photo_card: { label: 'Photo Card', icon: '📷' },
  cta: { label: 'CTA', icon: '📢' },
};

// ─── 변주 규칙 (§4.7) ──────────────────────────────
export type TextLayout = 'vertical_keyword' | 'mixed_vh' | 'info_strip';
export type Composition = 'lower_right' | 'center' | 'three_quarter' | 'detail_crop';
export type ProductStyle = 'with_character' | 'standalone' | 'in_environment';

export const VARIATION = {
  textLayouts: ['vertical_keyword', 'mixed_vh', 'info_strip'] as TextLayout[],
  compositions: ['lower_right', 'center', 'three_quarter', 'detail_crop'] as Composition[],
  backgrounds: [COLORS.background.kraft, COLORS.background.white],
  productStyles: ['with_character', 'standalone', 'in_environment'] as ProductStyle[],

  labels: {
    textLayouts: {
      vertical_keyword: 'ⓐ 세로 키워드',
      mixed_vh: 'ⓑ 세로+가로 혼합',
      info_strip: 'ⓒ 정보 스트립',
    },
    compositions: {
      lower_right: '① 우측 하단',
      center: '② 중앙 집중',
      three_quarter: '③ 3/4 측면뷰',
      detail_crop: '④ 디테일 크롭',
    },
    productStyles: {
      with_character: '캐릭터+제품',
      standalone: '제품 단독',
      in_environment: '환경 속 제품',
    },
  },
} as const;

// ─── 프롬프트 (§5) ─────────────────────────────────
export const PROMPT = {
  STYLE_PREFIX: `Noritake-style flat editorial illustration, uniform medium-weight black outlines on {background_color} background. Hair is the ONLY solid black filled area. Body, clothing, and all objects are outlined only with no fill — background color shows through. Minimal face: dot eyes, tiny nose, no mouth. Calm everyday pose, static and quiet. Two-tone palette (black + background only), no gradients, no shadows. Independent literary magazine aesthetic, generous whitespace.`,
  RATIO_SUFFIX: `Instagram FEED canvas only, 1080x1350, aspect ratio 4:5. DO NOT generate 9:16.`,
} as const;

// ─── 프로젝트 상태 ──────────────────────────────────
export type ProjectStatus = 'draft' | 'editing' | 'completed' | 'published';
