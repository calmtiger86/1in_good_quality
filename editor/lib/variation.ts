/**
 * §4.7 통합 변주 알고리즘
 * Solution 슬라이드 4축 순환 + 연속 반복 금지
 */
import { VARIATION, type TextLayout, type Composition, type ProductStyle } from './openspec';

export interface VariationSet {
  textLayout: TextLayout;
  composition: Composition;
  background: string;
  productStyle: ProductStyle;
}

export interface VariationWarning {
  slideIndex: number;
  rule: string;
  message: string;
}

/**
 * Solution 슬라이드에 변주 자동 배정
 */
export function assignVariations(count: number): VariationSet[] {
  const results: VariationSet[] = [];

  for (let i = 0; i < count; i++) {
    results.push({
      textLayout: VARIATION.textLayouts[i % 3],
      composition: VARIATION.compositions[i % 4],
      background: VARIATION.backgrounds[i % 2],
      productStyle: VARIATION.productStyles[i % 3],
    });
  }

  return results;
}

/**
 * 변주 규칙 검증 (§4.7 연속 반복 금지)
 */
export function validateVariations(sets: VariationSet[]): VariationWarning[] {
  const warnings: VariationWarning[] = [];

  for (let i = 1; i < sets.length; i++) {
    const prev = sets[i - 1];
    const curr = sets[i];

    // 텍스트 패턴 연속 금지
    if (curr.textLayout === prev.textLayout) {
      warnings.push({
        slideIndex: i,
        rule: '텍스트 패턴 연속 금지',
        message: `S${i + 3}: 텍스트 패턴(${VARIATION.labels.textLayouts[curr.textLayout]})이 이전 슬라이드와 동일합니다`,
      });
    }

    // 구도 연속 금지
    if (curr.composition === prev.composition) {
      warnings.push({
        slideIndex: i,
        rule: '구도 연속 금지',
        message: `S${i + 3}: 구도(${VARIATION.labels.compositions[curr.composition]})가 이전 슬라이드와 동일합니다`,
      });
    }

    // 배경색 3연속 금지
    if (i >= 2 && curr.background === prev.background && prev.background === sets[i - 2].background) {
      warnings.push({
        slideIndex: i,
        rule: '배경색 3연속 금지',
        message: `S${i + 3}: 배경색이 3장 연속 동일합니다`,
      });
    }

    // 최소 2축 차이 보장
    let diffCount = 0;
    if (curr.textLayout !== prev.textLayout) diffCount++;
    if (curr.composition !== prev.composition) diffCount++;
    if (curr.background !== prev.background) diffCount++;
    if (curr.productStyle !== prev.productStyle) diffCount++;

    if (diffCount < 2) {
      warnings.push({
        slideIndex: i,
        rule: '최소 2축 차이',
        message: `S${i + 3}: 이전 슬라이드와 ${diffCount}축만 다릅니다 (최소 2축 필요)`,
      });
    }
  }

  return warnings;
}

/**
 * 변주 재셔플 — 현재 배정을 무작위로 재조합 (규칙 준수)
 */
export function reshuffleVariations(count: number): VariationSet[] {
  let attempts = 0;
  let result: VariationSet[];

  do {
    result = [];
    const tPool = [...VARIATION.textLayouts].sort(() => Math.random() - 0.5);
    const cPool = [...VARIATION.compositions].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      result.push({
        textLayout: tPool[i % tPool.length],
        composition: cPool[i % cPool.length],
        background: VARIATION.backgrounds[i % 2],
        productStyle: VARIATION.productStyles[i % 3],
      });
    }
    attempts++;
  } while (validateVariations(result).length > 0 && attempts < 100);

  return result;
}
