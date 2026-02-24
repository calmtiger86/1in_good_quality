'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/common/Header';
import { useProjectStore } from '@/stores/projectStore';
import { COLORS, SLIDE_TYPES, VARIATION, type SlideType } from '@/lib/openspec';
import { assignVariations, validateVariations, reshuffleVariations, type VariationSet, type VariationWarning } from '@/lib/variation';
import { buildImagePrompt } from '@/lib/prompt-builder';
import type { Slide } from '@/lib/db';
import styles from './page.module.css';

const DEFAULT_SEQUENCE: SlideType[] = ['hook', 'agitation', 'solution', 'solution', 'solution', 'solution', 'photo_card', 'cta'];

function createDefaultSlides(): Slide[] {
  const variations = assignVariations(4); // 4 Solution slides
  let varIdx = 0;

  return DEFAULT_SEQUENCE.map((type, index) => {
    const isSolution = type === 'solution';
    const variation = isSolution ? variations[varIdx++] : null;

    return {
      index,
      type,
      headline: null,
      body: null,
      imagePrompt: null,
      imageUrl: null,
      background: variation?.background || (type === 'hook' ? COLORS.background.white : COLORS.background.kraft),
      textLayout: variation?.textLayout || null,
      composition: variation?.composition || null,
      productStyle: variation?.productStyle || null,
      userPhoto: type === 'photo_card',
      status: 'pending' as const,
    };
  });
}

export default function StoryboardPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.id);

  const { project, loadProject, updateField, updateSlide, addSlide, removeSlide, duplicateSlide, setCurrentSlide, currentSlideIndex } = useProjectStore();
  const [warnings, setWarnings] = useState<VariationWarning[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; index: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  // 슬라이드 초기화
  useEffect(() => {
    if (project && project.slides.length === 0) {
      updateField('slides', createDefaultSlides());
    }
  }, [project]);

  // 변주 검증
  useEffect(() => {
    if (!project?.slides) return;
    const solutionSlides = project.slides.filter((s) => s.type === 'solution');
    const sets: VariationSet[] = solutionSlides.map((s) => ({
      textLayout: s.textLayout || 'vertical_keyword',
      composition: s.composition || 'lower_right',
      background: s.background,
      productStyle: s.productStyle || 'with_character',
    }));
    setWarnings(validateVariations(sets));
  }, [project?.slides]);

  if (!project) return <div className={styles.loading}>불러오는 중...</div>;

  const slides = project.slides;
  const currentSlide = slides[currentSlideIndex];
  const solutionCount = slides.filter((s) => s.type === 'solution').length;

  // ─── 슬라이드 추가 ──────────────────
  function handleAddSolution() {
    if (solutionCount >= 8) return;
    const ctaIndex = slides.findIndex((s) => s.type === 'cta');
    const insertIndex = ctaIndex > 0 ? ctaIndex - 1 : slides.length - 1;

    const newSlide: Slide = {
      index: insertIndex + 1,
      type: 'solution',
      headline: null,
      body: null,
      imagePrompt: null,
      imageUrl: null,
      background: COLORS.background.kraft,
      textLayout: 'vertical_keyword',
      composition: 'center',
      productStyle: 'standalone',
      userPhoto: false,
      status: 'pending',
    };
    addSlide(newSlide);
  }

  // ─── 재셔플 ─────────────────────────
  function handleReshuffle() {
    const newVariations = reshuffleVariations(solutionCount);
    let varIdx = 0;
    slides.forEach((slide, i) => {
      if (slide.type === 'solution') {
        const v = newVariations[varIdx++];
        updateSlide(i, {
          textLayout: v.textLayout,
          composition: v.composition,
          background: v.background,
          productStyle: v.productStyle,
        });
      }
    });
  }

  // ─── AI 이미지 생성 (단일) ──────────
  async function handleGenerateSingle(slideIndex: number) {
    const slide = slides[slideIndex];
    if (!slide || slide.type === 'photo_card') return;

    const prompt = slide.imagePrompt || buildImagePrompt({
      slideType: slide.type,
      background: slide.background,
      composition: slide.composition ?? undefined,
      productStyle: slide.productStyle ?? undefined,
      textLayout: slide.textLayout ?? undefined,
      productCategory: project?.productCategory || undefined,
    });

    updateSlide(slideIndex, { status: 'generating', imagePrompt: prompt });

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json() as { imageUrl?: string; error?: string; stub?: boolean };

      if (!res.ok) {
        console.error('이미지 생성 오류:', data.error);
        updateSlide(slideIndex, { status: 'error' });
      } else {
        updateSlide(slideIndex, { imageUrl: data.imageUrl ?? null, status: 'completed' });
      }
    } catch (err) {
      console.error('이미지 생성 실패:', err);
      updateSlide(slideIndex, { status: 'error' });
    }
  }

  // ─── AI 이미지 일괄 생성 ────────────
  async function handleGenerateAll() {
    if (isGenerating) return;
    const targets = slides
      .map((_, i) => i)
      .filter((i) => slides[i].type !== 'photo_card');

    setIsGenerating(true);
    setGenProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      setGenProgress({ current: i + 1, total: targets.length });
      await handleGenerateSingle(targets[i]);
    }

    setIsGenerating(false);
    setGenProgress(null);
  }

  // ─── 우클릭 메뉴 ────────────────────
  function handleContextMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, index });
  }

  function getStatusIcon(slide: Slide) {
    switch (slide.status) {
      case 'completed': return '✅';
      case 'generating': return '⏳';
      case 'error': return '❌';
      default: return '⬜';
    }
  }

  function getWarningsForSlide(slideGlobalIndex: number): VariationWarning[] {
    const solutionIndices = slides.map((s, i) => s.type === 'solution' ? i : -1).filter((i) => i >= 0);
    const solutionLocalIdx = solutionIndices.indexOf(slideGlobalIndex);
    return warnings.filter((w) => w.slideIndex === solutionLocalIdx);
  }

  return (
    <>
      <Header
        title={project.productName || '스토리보드'}
        showSaveStatus
        projectId={projectId}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary" onClick={() => router.push(`/project/${projectId}/input`)}>
              ← 입력으로
            </button>
            <button
              className="btn btn--secondary"
              onClick={handleGenerateAll}
              disabled={isGenerating}
              title="photo_card 제외 모든 슬라이드 일러스트 생성"
            >
              {isGenerating && genProgress
                ? `⏳ ${genProgress.current}/${genProgress.total}`
                : '🤖 일괄 생성'}
            </button>
            <button className="btn btn--primary" onClick={() => router.push(`/project/${projectId}/preview`)}>
              미리보기 →
            </button>
          </div>
        }
      />

      {/* ─── 생성 진행 상태 바 ─── */}
      {genProgress && (
        <div className={styles.genProgressBar}>
          <span>{genProgress.current}/{genProgress.total} 슬라이드 생성 중...</span>
          <div className={styles.genProgressTrack}>
            <div
              className={styles.genProgressFill}
              style={{ width: `${(genProgress.current / genProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className={styles.layout}>
        {/* ─── 좌측: 슬라이드 리스트 ─── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h3>슬라이드 ({slides.length}장)</h3>
            <div className={styles.sidebarActions}>
              <button className={styles.miniBtn} onClick={handleReshuffle} title="변주 재셔플">
                🔀
              </button>
            </div>
          </div>

          <div className={styles.slideList}>
            {slides.map((slide, i) => {
              const slideWarnings = getWarningsForSlide(i);
              return (
                <div
                  key={i}
                  className={`${styles.slideItem} ${i === currentSlideIndex ? styles.slideItemActive : ''}`}
                  onClick={() => setCurrentSlide(i)}
                  onContextMenu={(e) => handleContextMenu(e, i)}
                >
                  <div className={styles.slideThumb}>
                    <div
                      className={styles.slideThumbInner}
                      style={{ background: slide.background || COLORS.background.kraft }}
                    >
                      <span className={styles.slideThumbIcon}>{SLIDE_TYPES[slide.type].icon}</span>
                    </div>
                  </div>
                  <div className={styles.slideInfo}>
                    <span className={styles.slideLabel}>
                      {i + 1}. {SLIDE_TYPES[slide.type].label}
                    </span>
                    <span className={styles.slideStatus}>
                      {getStatusIcon(slide)}
                      {slideWarnings.length > 0 && <span className={styles.warningDot}>⚠️</span>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {solutionCount < 8 && (
            <button className={styles.addBtn} onClick={handleAddSolution}>
              + Solution 추가
            </button>
          )}
        </aside>

        {/* ─── 중앙: 캔버스 미리보기 ─── */}
        <main className={styles.canvas}>
          {currentSlide ? (
            <div className={styles.canvasInner}>
              <div
                className={styles.canvasCard}
                style={{ background: currentSlide.background || COLORS.background.kraft }}
              >
                {/* 로고 */}
                <div className={styles.canvasLogo}>
                  <span style={{ color: currentSlide.background === COLORS.background.white ? COLORS.background.kraft : '#fff' }}>
                    1iN
                  </span>
                </div>

                {/* 이미지 또는 플레이스홀더 */}
                <div className={styles.canvasCenter}>
                  {currentSlide.imageUrl ? (
                    <img src={currentSlide.imageUrl} alt="" className={styles.canvasImage} />
                  ) : (
                    <div className={styles.canvasPlaceholder}>
                      <span>{SLIDE_TYPES[currentSlide.type].icon}</span>
                      <p>{SLIDE_TYPES[currentSlide.type].label}</p>
                    </div>
                  )}
                </div>

                {/* 텍스트 */}
                {currentSlide.headline && (
                  <div className={styles.canvasHeadline}>{currentSlide.headline}</div>
                )}
              </div>

              {/* 일러스트 액션 */}
              <div className={styles.canvasActions}>
                <button
                  className="btn btn--secondary"
                  onClick={() => handleGenerateSingle(currentSlideIndex)}
                  disabled={isGenerating || currentSlide.type === 'photo_card' || currentSlide.status === 'generating'}
                >
                  {currentSlide.status === 'generating' ? '⏳ 생성 중...' : '🔄 일러스트 생성'}
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => router.push(`/project/${projectId}/editor/${currentSlideIndex}`)}
                >
                  🖼 카드 에디터
                </button>
              </div>
            </div>
          ) : (
            <p>슬라이드를 선택하세요</p>
          )}
        </main>

        {/* ─── 우측: 속성 패널 ─── */}
        <aside className={styles.panel}>
          {currentSlide && (
            <>
              <h3 className={styles.panelTitle}>
                {SLIDE_TYPES[currentSlide.type].icon} {SLIDE_TYPES[currentSlide.type].label}
              </h3>

              {/* 텍스트 편집 */}
              <div className={styles.panelSection}>
                <label className={styles.panelLabel}>헤드라인</label>
                <input
                  className="input input--ko"
                  placeholder="헤드라인을 입력하세요 (12~18자)"
                  value={currentSlide.headline || ''}
                  onChange={(e) => updateSlide(currentSlideIndex, { headline: e.target.value })}
                />
                <span className={styles.charCount}>
                  {(currentSlide.headline || '').length}/18자
                </span>
              </div>

              <div className={styles.panelSection}>
                <label className={styles.panelLabel}>서브카피</label>
                <textarea
                  className={`input input--ko ${styles.textarea}`}
                  placeholder="서브카피 (각 줄 12~18자, 2~3줄)"
                  rows={3}
                  value={(currentSlide.body || []).join('\n')}
                  onChange={(e) => updateSlide(currentSlideIndex, { body: e.target.value.split('\n') })}
                />
              </div>

              {/* 이미지 프롬프트 (photo_card 제외) */}
              {currentSlide.type !== 'photo_card' && (
                <div className={styles.panelSection}>
                  <label className={styles.panelLabel}>일러스트 프롬프트</label>
                  <textarea
                    className={`input ${styles.textarea}`}
                    placeholder="비워두면 생성 시 자동으로 빌드됩니다"
                    rows={4}
                    value={currentSlide.imagePrompt || ''}
                    onChange={(e) => updateSlide(currentSlideIndex, { imagePrompt: e.target.value || null })}
                  />
                  {currentSlide.status === 'error' && (
                    <p className={styles.warningText}>❌ 생성 실패 — 프롬프트 수정 후 재시도하세요</p>
                  )}
                  {currentSlide.status === 'completed' && currentSlide.imageUrl && (
                    <p style={{ fontSize: 11, color: '#666', marginTop: 4 }}>✅ 생성 완료</p>
                  )}
                </div>
              )}

              {/* Solution 전용 옵션 */}
              {currentSlide.type === 'solution' && (
                <>
                  <div className={styles.panelSection}>
                    <label className={styles.panelLabel}>텍스트 패턴</label>
                    <div className={styles.optionGroup}>
                      {VARIATION.textLayouts.map((tl) => (
                        <button
                          key={tl}
                          className={`${styles.optionBtn} ${currentSlide.textLayout === tl ? styles.optionBtnActive : ''}`}
                          onClick={() => updateSlide(currentSlideIndex, { textLayout: tl })}
                        >
                          {VARIATION.labels.textLayouts[tl]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.panelSection}>
                    <label className={styles.panelLabel}>구도</label>
                    <div className={styles.optionGroup}>
                      {VARIATION.compositions.map((c) => (
                        <button
                          key={c}
                          className={`${styles.optionBtn} ${currentSlide.composition === c ? styles.optionBtnActive : ''}`}
                          onClick={() => updateSlide(currentSlideIndex, { composition: c })}
                        >
                          {VARIATION.labels.compositions[c]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.panelSection}>
                    <label className={styles.panelLabel}>배경</label>
                    <div className={styles.optionGroup}>
                      {VARIATION.backgrounds.map((bg) => (
                        <button
                          key={bg}
                          className={`${styles.optionBtn} ${currentSlide.background === bg ? styles.optionBtnActive : ''}`}
                          onClick={() => updateSlide(currentSlideIndex, { background: bg })}
                          style={{ borderLeftColor: bg, borderLeftWidth: 4 }}
                        >
                          {bg === COLORS.background.kraft ? '🟫 크래프트' : '⬜ 순백'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.panelSection}>
                    <label className={styles.panelLabel}>제품 표현</label>
                    <div className={styles.optionGroup}>
                      {VARIATION.productStyles.map((ps) => (
                        <button
                          key={ps}
                          className={`${styles.optionBtn} ${currentSlide.productStyle === ps ? styles.optionBtnActive : ''}`}
                          onClick={() => updateSlide(currentSlideIndex, { productStyle: ps })}
                        >
                          {VARIATION.labels.productStyles[ps]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 변주 경고 */}
                  {getWarningsForSlide(currentSlideIndex).length > 0 && (
                    <div className={styles.panelWarnings}>
                      <label className={styles.panelLabel}>⚠️ 변주 경고</label>
                      {getWarningsForSlide(currentSlideIndex).map((w, i) => (
                        <p key={i} className={styles.warningText}>{w.message}</p>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* CTA 전용 */}
              {currentSlide.type === 'cta' && (
                <div className={styles.panelSection}>
                  <label className={styles.panelLabel}>제휴 링크</label>
                  <input
                    className="input"
                    placeholder="https://link.coupang.com/..."
                    value={currentSlide.buttonUrl || project.affiliateUrl || ''}
                    onChange={(e) => updateSlide(currentSlideIndex, { buttonUrl: e.target.value })}
                  />
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      {/* ─── 하단: 변주 현황 바 ─── */}
      <div className={styles.variationBar}>
        {slides.map((slide, i) => {
          if (slide.type !== 'solution') {
            return (
              <div key={i} className={styles.varItem}>
                <span className={styles.varLabel}>{SLIDE_TYPES[slide.type].icon}</span>
              </div>
            );
          }
          const tl = slide.textLayout ? VARIATION.labels.textLayouts[slide.textLayout].charAt(0) : '?';
          return (
            <div
              key={i}
              className={`${styles.varItem} ${i === currentSlideIndex ? styles.varItemActive : ''}`}
              onClick={() => setCurrentSlide(i)}
            >
              <span className={styles.varLabel}>S{i + 1}</span>
              <div className={styles.varTags}>
                <span className={styles.varTag}>{tl}</span>
                <span
                  className={styles.varColorDot}
                  style={{ background: slide.background }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 우클릭 컨텍스트 메뉴 */}
      {contextMenu && (
        <>
          <div className={styles.overlay} onClick={() => setContextMenu(null)} />
          <div className={styles.contextMenu} style={{ left: contextMenu.x, top: contextMenu.y }}>
            {slides[contextMenu.index].type === 'solution' && (
              <>
                <button onClick={() => { duplicateSlide(contextMenu.index); setContextMenu(null); }}>
                  📋 복제
                </button>
                <button onClick={() => { removeSlide(contextMenu.index); setContextMenu(null); }}>
                  🗑 삭제
                </button>
              </>
            )}
            <button onClick={() => setContextMenu(null)}>취소</button>
          </div>
        </>
      )}
    </>
  );
}
