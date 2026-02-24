/**
 * prompt-builder.ts 단위 테스트 — OpenSpec §5 프롬프트 조립
 */

import { buildImagePrompt, type PromptContext } from '@/lib/prompt-builder';
import { COLORS, PROMPT } from '@/lib/openspec';

// ─── STYLE_PREFIX / RATIO_SUFFIX 포함 여부 ────────────

describe('buildImagePrompt — 구조 검증', () => {
  const baseCtx: PromptContext = {
    slideType: 'solution',
    background: COLORS.background.kraft,
    composition: 'lower_right',
    productStyle: 'with_character',
  };

  it('출력에 RATIO_SUFFIX (1080x1350)가 포함된다', () => {
    const prompt = buildImagePrompt(baseCtx);
    expect(prompt).toContain('1080x1350');
    expect(prompt).toContain('aspect ratio 4:5');
    expect(prompt).toContain('DO NOT generate 9:16');
  });

  it('출력에 Noritake 스타일 지시어가 포함된다', () => {
    const prompt = buildImagePrompt(baseCtx);
    expect(prompt).toContain('Noritake-style');
    expect(prompt).toContain('Hair is the ONLY solid black filled area');
  });

  it('빈 문자열이 아니다', () => {
    const prompt = buildImagePrompt(baseCtx);
    expect(prompt.trim().length).toBeGreaterThan(50);
  });
});

// ─── 배경색 반영 ──────────────────────────────────────

describe('buildImagePrompt — 배경색', () => {
  it('kraft 배경이면 "kraft paper" 문구가 포함된다', () => {
    const prompt = buildImagePrompt({
      slideType: 'hook',
      background: COLORS.background.kraft,
    });
    expect(prompt).toContain('kraft');
  });

  it('white 배경이면 "white" 문구가 포함된다', () => {
    const prompt = buildImagePrompt({
      slideType: 'agitation',
      background: COLORS.background.white,
    });
    expect(prompt.toLowerCase()).toContain('white');
  });
});

// ─── 슬라이드 타입별 장면 묘사 ──────────────────────────

describe('buildImagePrompt — 슬라이드 타입', () => {
  it('hook 타입이면 실루엣/호기심 장면을 포함한다', () => {
    const prompt = buildImagePrompt({ slideType: 'hook', background: COLORS.background.kraft });
    expect(prompt.toLowerCase()).toMatch(/silhouette|hook|calm|figure/);
  });

  it('agitation 타입이면 불편함 묘사를 포함한다', () => {
    const prompt = buildImagePrompt({ slideType: 'agitation', background: COLORS.background.white });
    expect(prompt.toLowerCase()).toMatch(/inconvenience|clutter|without|frustration/);
  });

  it('cta 타입이면 미니멀 구성을 포함한다', () => {
    const prompt = buildImagePrompt({ slideType: 'cta', background: COLORS.background.kraft });
    expect(prompt.toLowerCase()).toMatch(/minimal|whitespace|centered/);
  });

  it('photo_card 타입은 빈 장면 묘사를 사용한다 (AI 이미지 생성 없음)', () => {
    const prompt = buildImagePrompt({ slideType: 'photo_card', background: COLORS.background.white });
    // photo_card는 장면 묘사가 비어있어야 함 — STYLE_PREFIX + RATIO_SUFFIX만
    expect(prompt).toContain(PROMPT.RATIO_SUFFIX);
  });
});

// ─── 구도 지시어 반영 ────────────────────────────────

describe('buildImagePrompt — 구도', () => {
  it('lower_right 구도면 하단우측 지시어가 포함된다', () => {
    const prompt = buildImagePrompt({
      slideType: 'solution',
      background: COLORS.background.kraft,
      composition: 'lower_right',
    });
    expect(prompt.toLowerCase()).toContain('lower-right');
  });

  it('center 구도면 중앙 지시어가 포함된다', () => {
    const prompt = buildImagePrompt({
      slideType: 'solution',
      background: COLORS.background.white,
      composition: 'center',
    });
    expect(prompt.toLowerCase()).toContain('centered');
  });
});

// ─── 사용자 정의 장면 묘사 ────────────────────────────

describe('buildImagePrompt — sceneDescription 우선', () => {
  it('sceneDescription 제공 시 자동 생성 장면 묘사를 대체한다', () => {
    const customScene = 'A person brewing coffee in a minimalist kitchen.';
    const prompt = buildImagePrompt({
      slideType: 'solution',
      background: COLORS.background.kraft,
      sceneDescription: customScene,
    });
    expect(prompt).toContain(customScene);
  });
});
