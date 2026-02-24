/**
 * QA Checker — OpenSpec §10 자동 검증
 *
 * 사용:
 *   import { runQAChecks, type QAResult } from '@/lib/qa-checker';
 *   const results = runQAChecks(project);
 */

import type { Project } from '@/lib/db';
import { validateVariations, type VariationSet } from '@/lib/variation';

export interface QAResult {
  category: string;
  rule: string;
  pass: boolean;
}

/**
 * OpenSpec §10 기준 14개 항목을 검사하여 결과를 반환합니다.
 */
export function runQAChecks(project: Project): QAResult[] {
  const slides = project.slides || [];
  const results: QAResult[] = [];

  // 1. 슬라이드 수 (6개 이상)
  results.push({
    category: '구성',
    rule: `슬라이드 수 6개 이상 (현재: ${slides.length}개)`,
    pass: slides.length >= 6,
  });

  // 2. Hook 슬라이드 존재
  results.push({
    category: '구성',
    rule: 'Hook (표지) 슬라이드 포함',
    pass: slides.some((s) => s.type === 'hook'),
  });

  // 3. CTA 슬라이드 존재
  results.push({
    category: '구성',
    rule: 'CTA 슬라이드 포함',
    pass: slides.some((s) => s.type === 'cta'),
  });

  // 4. Photo Card 존재
  results.push({
    category: '구성',
    rule: 'Photo Card 슬라이드 포함',
    pass: slides.some((s) => s.type === 'photo_card'),
  });

  // 5. 배경색 3연속 방지 (§4.7)
  let bgConsecutivePass = true;
  for (let i = 0; i < slides.length - 2; i++) {
    if (
      slides[i].background === slides[i + 1].background &&
      slides[i + 1].background === slides[i + 2].background
    ) {
      bgConsecutivePass = false;
      break;
    }
  }
  results.push({
    category: '디자인',
    rule: '같은 배경색 3연속 없음 (§4.7)',
    pass: bgConsecutivePass,
  });

  // 6. 헤드라인 길이 (≤18자/줄, §4.4)
  const headlineOk = slides.every((s) => {
    if (!s.headline) return true;
    return s.headline.split('\n').every((line) => line.length <= 18);
  });
  results.push({
    category: '텍스트',
    rule: '헤드라인 18자 이하/줄 (§4.4)',
    pass: headlineOk,
  });

  // 7. 전체 슬라이드 헤드라인 입력
  results.push({
    category: '콘텐츠',
    rule: '전체 슬라이드 헤드라인 입력',
    pass: slides.every(
      (s) => s.type === 'photo_card' || (s.headline && s.headline.trim().length > 0)
    ),
  });

  // 8. 제품명 / 가격 입력
  results.push({
    category: '콘텐츠',
    rule: '제품명 & 가격 입력',
    pass: !!project.productName?.trim() && !!project.productPrice?.trim(),
  });

  // 9. 어필리에이트 링크
  results.push({
    category: '링크',
    rule: '어필리에이트 링크 입력',
    pass: !!project.affiliateUrl?.trim(),
  });

  // 10. 캡션 Editor's Note
  results.push({
    category: '캡션',
    rule: "Editor's Note 입력",
    pass: !!project.caption?.editorsNote?.trim(),
  });

  // 11. 해시태그 3개 이상
  results.push({
    category: '캡션',
    rule: '해시태그 3개 이상',
    pass: (project.caption?.hashtags || []).length >= 3,
  });

  // 12. AI 이미지 생성 완료
  const aiSlides = slides.filter((s) => s.type !== 'photo_card');
  const generatedCount = aiSlides.filter((s) => s.status === 'completed' && s.imageUrl).length;
  results.push({
    category: '이미지',
    rule: `AI 이미지 생성 완료 (${generatedCount}/${aiSlides.length})`,
    pass: aiSlides.length > 0 && generatedCount === aiSlides.length,
  });

  // ─── 변주 규칙 검증 (§4.7) ───────────────────────────────
  const solutionSlides = slides.filter((s) => s.type === 'solution');
  const variationSets: VariationSet[] = solutionSlides.map((s) => ({
    textLayout: s.textLayout || 'vertical_keyword',
    composition: s.composition || 'lower_right',
    background: s.background,
    productStyle: s.productStyle || 'with_character',
  }));
  const variationWarnings = validateVariations(variationSets);

  // 13. 텍스트 패턴 / 구도 연속 금지 (§4.7)
  const consecutivePass = !variationWarnings.some(
    (w) => w.rule === '텍스트 패턴 연속 금지' || w.rule === '구도 연속 금지'
  );
  results.push({
    category: '변주',
    rule: '텍스트 패턴 / 구도 2연속 없음 (§4.7)',
    pass: solutionSlides.length < 2 || consecutivePass,
  });

  // 14. 인접 슬라이드 최소 2축 차이 (§4.7)
  const axisPass = !variationWarnings.some((w) => w.rule === '최소 2축 차이');
  results.push({
    category: '변주',
    rule: '인접 슬라이드 최소 2축 차이 (§4.7)',
    pass: solutionSlides.length < 2 || axisPass,
  });

  return results;
}
