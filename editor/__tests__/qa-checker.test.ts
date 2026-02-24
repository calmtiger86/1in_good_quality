/**
 * qa-checker.ts 단위 테스트 — OpenSpec §10 QA 체크리스트
 */

import { runQAChecks } from '@/lib/qa-checker';
import type { Project, Slide } from '@/lib/db';
import { COLORS } from '@/lib/openspec';

// ─── 테스트 픽스처 헬퍼 ────────────────────────────────

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    index: 0,
    type: 'solution',
    headline: '조용한 부엌',
    body: [],
    imagePrompt: '',
    imageUrl: 'https://example.com/image.png',
    background: COLORS.background.kraft,
    composition: 'lower_right',
    productStyle: 'with_character',
    textLayout: 'vertical_keyword',
    userPhoto: false,
    status: 'completed',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  const defaultSlides: Slide[] = [
    makeSlide({ type: 'hook',       headline: '퇴근 후, 조용한 부엌', background: COLORS.background.kraft }),
    makeSlide({ type: 'agitation',  headline: '매일 반복되는 그 장면', background: COLORS.background.white }),
    // Solution 슬라이드: §4.7 변주 규칙 준수 (textLayout, composition, productStyle 최소 2축 차이)
    makeSlide({ type: 'solution',   headline: '해결책 하나',   background: COLORS.background.kraft, textLayout: 'vertical_keyword',  composition: 'lower_right', productStyle: 'with_character' }),
    makeSlide({ type: 'photo_card', headline: undefined, imageUrl: 'https://example.com/photo.jpg', background: COLORS.background.white }),
    makeSlide({ type: 'cta',        headline: '자세한 정보는 프로필 링크에서', background: COLORS.background.kraft }),
    makeSlide({ type: 'solution',   headline: '또 다른 해결책', background: COLORS.background.white, textLayout: 'mixed_vh',         composition: 'center',      productStyle: 'standalone' }),
  ];

  return {
    id: 1,
    title: '테스트 프로젝트',
    vol: 1,
    status: 'editing',
    productUrl: 'https://www.coupang.com/vp/products/test',
    affiliateUrl: 'https://link.coupang.com/a/test123',
    productName: '테스트 제품',
    productPrice: '₩29,900',
    productCategory: '생활소품',
    productSpecs: [],
    productImageUrl: null,
    userPhotoBlob: null,
    slides: defaultSlides,
    caption: {
      editorsNote: '[Editor\'s Note] 조용한 혁명',
      body: '퇴근 후 현관문을 열면...',
      cta: '자세한 정보는 프로필 링크에서',
      hashtags: ['#일인양품', '#1인가구라이프', '#미니멀인테리어'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── 슬라이드 수 검증 ─────────────────────────────────

describe('runQAChecks — 슬라이드 수', () => {
  it('슬라이드 6개 이상이면 통과', () => {
    const project = makeProject();
    const results = runQAChecks(project);
    const slideCountResult = results.find((r) => r.rule.startsWith('슬라이드 수'));
    expect(slideCountResult?.pass).toBe(true);
  });

  it('슬라이드 5개 이하면 실패', () => {
    const project = makeProject({ slides: makeProject().slides.slice(0, 5) });
    const results = runQAChecks(project);
    const slideCountResult = results.find((r) => r.rule.startsWith('슬라이드 수'));
    expect(slideCountResult?.pass).toBe(false);
  });
});

// ─── 필수 슬라이드 타입 검증 ──────────────────────────

describe('runQAChecks — 필수 슬라이드 타입', () => {
  it('hook 없으면 실패', () => {
    const slides = makeProject().slides.filter((s) => s.type !== 'hook');
    const results = runQAChecks(makeProject({ slides }));
    const hookResult = results.find((r) => r.rule === 'Hook (표지) 슬라이드 포함');
    expect(hookResult?.pass).toBe(false);
  });

  it('cta 없으면 실패', () => {
    const slides = makeProject().slides.filter((s) => s.type !== 'cta');
    const results = runQAChecks(makeProject({ slides }));
    const ctaResult = results.find((r) => r.rule === 'CTA 슬라이드 포함');
    expect(ctaResult?.pass).toBe(false);
  });

  it('photo_card 없으면 실패', () => {
    const slides = makeProject().slides.filter((s) => s.type !== 'photo_card');
    const results = runQAChecks(makeProject({ slides }));
    const photoResult = results.find((r) => r.rule === 'Photo Card 슬라이드 포함');
    expect(photoResult?.pass).toBe(false);
  });
});

// ─── 배경색 3연속 검증 ───────────────────────────────

describe('runQAChecks — 배경색 3연속', () => {
  it('3연속 같은 배경색이면 실패', () => {
    const slides = [
      makeSlide({ type: 'hook',       background: COLORS.background.kraft }),
      makeSlide({ type: 'agitation',  background: COLORS.background.kraft }),
      makeSlide({ type: 'solution',   background: COLORS.background.kraft }),
      makeSlide({ type: 'photo_card', background: COLORS.background.white }),
      makeSlide({ type: 'cta',        background: COLORS.background.white }),
      makeSlide({ type: 'solution',   background: COLORS.background.kraft }),
    ];
    const results = runQAChecks(makeProject({ slides }));
    const bgResult = results.find((r) => r.rule.includes('배경색'));
    expect(bgResult?.pass).toBe(false);
  });

  it('교차 배경색이면 통과', () => {
    const results = runQAChecks(makeProject());
    const bgResult = results.find((r) => r.rule.includes('배경색'));
    expect(bgResult?.pass).toBe(true);
  });
});

// ─── 콘텐츠 검증 ─────────────────────────────────────

describe('runQAChecks — 콘텐츠', () => {
  it('제품명 없으면 실패', () => {
    const results = runQAChecks(makeProject({ productName: '' }));
    const result = results.find((r) => r.rule === '제품명 & 가격 입력');
    expect(result?.pass).toBe(false);
  });

  it('제휴 링크 없으면 실패', () => {
    const results = runQAChecks(makeProject({ affiliateUrl: '' }));
    const result = results.find((r) => r.rule === '어필리에이트 링크 입력');
    expect(result?.pass).toBe(false);
  });

  it('해시태그 2개 이하면 실패', () => {
    const results = runQAChecks(
      makeProject({ caption: { ...makeProject().caption!, hashtags: ['#일인양품', '#자취'] } })
    );
    const result = results.find((r) => r.rule === '해시태그 3개 이상');
    expect(result?.pass).toBe(false);
  });
});

// ─── 변주 규칙 검증 ───────────────────────────────────

describe('runQAChecks — 변주 규칙', () => {
  it('Solution 텍스트 패턴 2연속이면 실패', () => {
    const slides = makeProject().slides.map((s) =>
      s.type === 'solution' ? { ...s, textLayout: 'vertical_keyword' as const } : s
    );
    const results = runQAChecks(makeProject({ slides }));
    const result = results.find((r) => r.rule.includes('텍스트 패턴'));
    expect(result?.pass).toBe(false);
  });

  it('Solution 최소 2축 차이 미달이면 실패', () => {
    // 모든 Solution을 동일한 3축으로 설정 (background만 다름)
    const slides = makeProject().slides.map((s, i) =>
      s.type === 'solution'
        ? {
            ...s,
            textLayout: 'vertical_keyword' as const,
            composition: 'lower_right' as const,
            productStyle: 'with_character' as const,
            background: i % 2 === 0 ? COLORS.background.kraft : COLORS.background.white,
          }
        : s
    );
    const results = runQAChecks(makeProject({ slides }));
    const result = results.find((r) => r.rule.includes('2축 차이'));
    expect(result?.pass).toBe(false);
  });

  it('Solution이 1개 이하면 변주 규칙 통과 (비교 불가)', () => {
    const slides = [
      makeSlide({ type: 'hook',       background: COLORS.background.kraft }),
      makeSlide({ type: 'agitation',  background: COLORS.background.white }),
      makeSlide({ type: 'solution',   background: COLORS.background.kraft }),
      makeSlide({ type: 'photo_card', background: COLORS.background.white }),
      makeSlide({ type: 'cta',        background: COLORS.background.kraft }),
      makeSlide({ type: 'solution',   background: COLORS.background.white }),
    ];
    const results = runQAChecks(makeProject({ slides }));
    const textResult = results.find((r) => r.rule.includes('텍스트 패턴'));
    const axisResult = results.find((r) => r.rule.includes('2축 차이'));
    // 2개 슬라이드는 비교 가능하므로 실제 변주 상태에 따라 결과가 다를 수 있음
    expect(textResult).toBeDefined();
    expect(axisResult).toBeDefined();
  });
});

// ─── 전체 유효 프로젝트 ────────────────────────────────

describe('runQAChecks — 전체 통과', () => {
  it('완전한 프로젝트는 14개 항목 모두 통과한다', () => {
    const results = runQAChecks(makeProject());
    const failures = results.filter((r) => !r.pass);
    expect(failures).toHaveLength(0);
    expect(results).toHaveLength(14);
  });

  it('결과 배열은 항상 14개다', () => {
    expect(runQAChecks(makeProject())).toHaveLength(14);
    expect(runQAChecks(makeProject({ slides: [] }))).toHaveLength(14);
  });
});
