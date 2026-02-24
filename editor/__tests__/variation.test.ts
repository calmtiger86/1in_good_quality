/**
 * variation.ts 단위 테스트 — OpenSpec §4.7 변주 알고리즘
 */

import {
  assignVariations,
  validateVariations,
  reshuffleVariations,
  type VariationSet,
} from '@/lib/variation';
import { COLORS } from '@/lib/openspec';

// ─── assignVariations ─────────────────────────────────

describe('assignVariations', () => {
  it('요청한 수만큼 VariationSet을 반환한다', () => {
    expect(assignVariations(4)).toHaveLength(4);
    expect(assignVariations(8)).toHaveLength(8);
  });

  it('각 항목이 4개 필드를 모두 갖는다', () => {
    const sets = assignVariations(3);
    sets.forEach((s) => {
      expect(s).toHaveProperty('textLayout');
      expect(s).toHaveProperty('composition');
      expect(s).toHaveProperty('background');
      expect(s).toHaveProperty('productStyle');
    });
  });

  it('배경색이 kraft ↔ white 교차된다 (짝수=kraft, 홀수=white)', () => {
    const sets = assignVariations(4);
    expect(sets[0].background).toBe(COLORS.background.kraft);
    expect(sets[1].background).toBe(COLORS.background.white);
    expect(sets[2].background).toBe(COLORS.background.kraft);
    expect(sets[3].background).toBe(COLORS.background.white);
  });

  it('count=0이면 빈 배열을 반환한다', () => {
    expect(assignVariations(0)).toHaveLength(0);
  });
});

// ─── validateVariations ───────────────────────────────

describe('validateVariations', () => {
  it('연속 텍스트 패턴을 감지한다', () => {
    const sets: VariationSet[] = [
      { textLayout: 'vertical_keyword', composition: 'lower_right', background: '#C4A882', productStyle: 'with_character' },
      { textLayout: 'vertical_keyword', composition: 'center',      background: '#FFFFFF', productStyle: 'standalone' },
    ];
    const warnings = validateVariations(sets);
    const textWarning = warnings.find((w) => w.rule === '텍스트 패턴 연속 금지');
    expect(textWarning).toBeDefined();
  });

  it('연속 구도를 감지한다', () => {
    const sets: VariationSet[] = [
      { textLayout: 'vertical_keyword', composition: 'center', background: '#C4A882', productStyle: 'with_character' },
      { textLayout: 'mixed_vh',         composition: 'center', background: '#FFFFFF', productStyle: 'standalone' },
    ];
    const warnings = validateVariations(sets);
    const compWarning = warnings.find((w) => w.rule === '구도 연속 금지');
    expect(compWarning).toBeDefined();
  });

  it('배경색 3연속을 감지한다', () => {
    const sets: VariationSet[] = [
      { textLayout: 'vertical_keyword', composition: 'lower_right',   background: '#C4A882', productStyle: 'with_character' },
      { textLayout: 'mixed_vh',         composition: 'center',         background: '#C4A882', productStyle: 'standalone' },
      { textLayout: 'info_strip',       composition: 'three_quarter',  background: '#C4A882', productStyle: 'in_environment' },
    ];
    const warnings = validateVariations(sets);
    const bgWarning = warnings.find((w) => w.rule === '배경색 3연속 금지');
    expect(bgWarning).toBeDefined();
  });

  it('2축 미만 차이를 감지한다', () => {
    // textLayout만 다르고 나머지 3축 동일 → 1축 차이 → 경고
    const sets: VariationSet[] = [
      { textLayout: 'vertical_keyword', composition: 'lower_right', background: '#C4A882', productStyle: 'with_character' },
      { textLayout: 'mixed_vh',         composition: 'lower_right', background: '#C4A882', productStyle: 'with_character' },
    ];
    const warnings = validateVariations(sets);
    const diffWarning = warnings.find((w) => w.rule === '최소 2축 차이');
    expect(diffWarning).toBeDefined();
  });

  it('규칙을 모두 지킨 경우 경고 없음', () => {
    // assignVariations로 생성한 기본 배정은 규칙 준수
    const sets = assignVariations(4);
    const warnings = validateVariations(sets);
    expect(warnings).toHaveLength(0);
  });

  it('슬라이드 1개이면 검증 항목이 없다', () => {
    const sets = assignVariations(1);
    expect(validateVariations(sets)).toHaveLength(0);
  });
});

// ─── reshuffleVariations ─────────────────────────────

describe('reshuffleVariations', () => {
  it('규칙을 준수하는 결과를 반환한다 (4장)', () => {
    const sets = reshuffleVariations(4);
    expect(validateVariations(sets)).toHaveLength(0);
  });

  it('규칙을 준수하는 결과를 반환한다 (8장 최대)', () => {
    const sets = reshuffleVariations(8);
    expect(validateVariations(sets)).toHaveLength(0);
  });

  it('요청한 수만큼 반환한다', () => {
    expect(reshuffleVariations(5)).toHaveLength(5);
  });
});
