/**
 * Prompt Builder — OpenSpec §5 이미지 프롬프트 조립
 *
 * 사용:
 *   import { buildImagePrompt } from '@/lib/prompt-builder';
 *   const prompt = buildImagePrompt({ slideType: 'hook', background: '#C4A882', ... });
 */

import { PROMPT, COLORS } from '@/lib/openspec';
import type { SlideType, TextLayout, Composition, ProductStyle } from '@/lib/openspec';

export interface PromptContext {
  slideType: SlideType;
  background: string;
  composition?: Composition;
  productStyle?: ProductStyle;
  textLayout?: TextLayout;
  /** 장면 묘사 — 1인 가구 맥락 (예: "person using a compact dish rack in a small kitchen") */
  sceneDescription?: string;
  /** 제품 카테고리 (예: "kitchen appliance", "furniture") */
  productCategory?: string;
}

/**
 * STYLE_PREFIX + SCENE_DESCRIPTION + COMPOSITION + RATIO_SUFFIX 조합
 * openspec.md §5.2 구조 준수
 */
export function buildImagePrompt(ctx: PromptContext): string {
  const bgColor = ctx.background === COLORS.background.white
    ? 'white (#FFFFFF)'
    : 'warm kraft paper beige (#C4A882)';

  const stylePrefix = PROMPT.STYLE_PREFIX.replace('{background_color}', bgColor);
  const scene = buildSceneDescription(ctx);
  const composition = buildCompositionDirective(ctx.composition);

  const parts = [stylePrefix, scene, composition, PROMPT.RATIO_SUFFIX].filter(Boolean);
  return parts.join(' ');
}

// ─── 슬라이드 타입별 장면 묘사 ──────────────────────

function buildSceneDescription(ctx: PromptContext): string {
  if (ctx.sceneDescription) return ctx.sceneDescription;

  const productHint = ctx.productCategory
    ? `${ctx.productCategory} product`
    : 'household item';

  switch (ctx.slideType) {
    case 'hook':
      return `A calm figure standing quietly next to a ${productHint} silhouette. Curious, inviting mood.`;
    case 'agitation':
      return `A lone figure in a small apartment, surrounded by clutter or inconvenience without the ${productHint}. Quiet frustration expressed through posture.`;
    case 'solution':
      return buildSolutionScene(ctx, productHint);
    case 'cta':
      return `Minimal centered composition. Small ${productHint} icon as subtle accent. Generous whitespace, literary magazine feel.`;
    case 'photo_card':
      return ''; // photo_card uses user photo — no AI prompt
  }
}

function buildSolutionScene(ctx: PromptContext, productHint: string): string {
  switch (ctx.productStyle) {
    case 'with_character':
      return `A person in a compact apartment using the ${productHint}. Natural, everyday quiet moment.`;
    case 'standalone':
      return `The ${productHint} alone, centered or slightly off-center. Generous surrounding whitespace. No people.`;
    case 'in_environment':
      return `The ${productHint} placed on a shelf or table in a minimal living space. Contextual, understated.`;
    default:
      return `A person using the ${productHint} in a small apartment. Static, calm pose.`;
  }
}

// ─── 구도 지시어 ─────────────────────────────────────

function buildCompositionDirective(composition?: Composition): string {
  if (!composition) return '';

  const directives: Record<Composition, string> = {
    lower_right: 'Subject placed in lower-right area, generous upper-left whitespace.',
    center: 'Subject centered, balanced whitespace on all sides.',
    three_quarter: '3/4 side view angle, subject slightly turned.',
    detail_crop: 'Tight detail crop, close-up of key feature or product element.',
  };

  return directives[composition];
}
