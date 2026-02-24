'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/common/Header';
import { useProjectStore } from '@/stores/projectStore';
import { SLIDE_TYPES, COLORS } from '@/lib/openspec';
import { runQAChecks } from '@/lib/qa-checker';
import type { Slide } from '@/lib/db';
import styles from './page.module.css';

// ─── 슬라이드 미리보기 컴포넌트 ──────────────────

function SlidePreview({
  slide,
  size = 'full',
}: {
  slide: Slide;
  size?: 'full' | 'mini' | 'profile';
}) {
  const bg = slide.background || COLORS.background.kraft;
  const icon = SLIDE_TYPES[slide.type]?.icon || '📄';

  if (size === 'mini') {
    return (
      <div className={styles.miniCardInner} style={{ background: bg }}>
        <span className={styles.miniIcon}>{icon}</span>
      </div>
    );
  }

  if (size === 'profile') {
    return (
      <div className={styles.profileCellContent} style={{ background: bg }}>
        {icon}
      </div>
    );
  }

  return (
    <div className={styles.slideCard} style={{ background: bg }}>
      {slide.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={slide.imageUrl} alt="" className={styles.slideImg} />
      ) : (
        <div className={styles.slideContent}>
          <div className={styles.slidePlaceholder}>
            <span>{icon}</span>
            <p>{slide.headline?.split('\n')[0] || SLIDE_TYPES[slide.type]?.label}</p>
          </div>
        </div>
      )}
      <span
        className={styles.slideLogo}
        style={{ color: bg === COLORS.background.white ? COLORS.background.kraft : '#fff' }}
      >
        1iN
      </span>
    </div>
  );
}

// ─── Preview 메인 컴포넌트 ────────────────────────

export default function PreviewPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.id);

  const { project, loadProject } = useProjectStore();
  const [viewMode, setViewMode] = useState<'slideshow' | 'all' | 'profile'>('slideshow');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  if (!project) return <div className={styles.loading}>불러오는 중...</div>;

  const slides = project.slides || [];
  const qaResults = runQAChecks(project);
  const passCount = qaResults.filter((r) => r.pass).length;
  const allPass = passCount === qaResults.length;

  function goPrev() {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }
  function goNext() {
    setCurrentIndex((i) => Math.min(slides.length - 1, i + 1));
  }

  return (
    <>
      <Header
        title={`미리보기 — ${project.title}`}
        showSaveStatus
        projectId={projectId}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn--secondary"
              onClick={() => router.push(`/project/${projectId}/storyboard`)}
            >
              ← 스토리보드
            </button>
            <button
              className="btn btn--primary"
              onClick={() => router.push(`/project/${projectId}/publish`)}
            >
              배포 →
            </button>
          </div>
        }
      />

      <div className={styles.layout}>
        {/* ─── 좌측 뷰어 ─── */}
        <div className={styles.viewer}>
          {/* 탭 */}
          <div className={styles.viewTabs}>
            {(['slideshow', 'all', 'profile'] as const).map((mode) => (
              <button
                key={mode}
                className={`${styles.viewTab} ${viewMode === mode ? styles.viewTabActive : ''}`}
                onClick={() => setViewMode(mode)}
              >
                {mode === 'slideshow' ? '슬라이드쇼' : mode === 'all' ? '전체 보기' : '프로필 그리드'}
              </button>
            ))}
          </div>

          {/* 슬라이드쇼 뷰 */}
          {viewMode === 'slideshow' && (
            <div className={styles.slideshow}>
              <button
                className={styles.navBtn}
                onClick={goPrev}
                disabled={currentIndex === 0}
              >
                ‹
              </button>
              <div className={styles.slideFrame}>
                {slides[currentIndex] ? (
                  <SlidePreview slide={slides[currentIndex]} />
                ) : (
                  <div className={styles.slideCard} style={{ background: '#eee' }}>
                    <div className={styles.slideContent}>
                      <div className={styles.slidePlaceholder}>
                        <span>📄</span>
                        <p>슬라이드 없음</p>
                      </div>
                    </div>
                  </div>
                )}
                <span className={styles.slideCounter}>
                  {slides.length > 0 ? `${currentIndex + 1} / ${slides.length}` : '0 / 0'}
                </span>
              </div>
              <button
                className={styles.navBtn}
                onClick={goNext}
                disabled={currentIndex >= slides.length - 1}
              >
                ›
              </button>
            </div>
          )}

          {/* 전체 보기 */}
          {viewMode === 'all' && (
            <div className={styles.allCards}>
              {slides.map((slide, i) => (
                <div
                  key={i}
                  className={styles.miniCard}
                  onClick={() => {
                    setCurrentIndex(i);
                    setViewMode('slideshow');
                  }}
                >
                  <SlidePreview slide={slide} size="mini" />
                  <span className={styles.miniLabel}>
                    {i + 1}. {SLIDE_TYPES[slide.type]?.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 프로필 그리드 뷰 */}
          {viewMode === 'profile' && (
            <div className={styles.profileGrid}>
              <p className={styles.profileHint}>
                Instagram 프로필 그리드 — Hook 슬라이드 표시 위치 (좌상단)
              </p>
              <div className={styles.profileGridInner}>
                {Array.from({ length: 9 }).map((_, i) => (
                  <div
                    key={i}
                    className={`${styles.profileCell} ${i === 0 ? styles.profileCellHighlight : ''}`}
                  >
                    {i === 0 && slides[0] ? (
                      <SlidePreview slide={slides[0]} size="profile" />
                    ) : (
                      <div className={styles.profileCellPlaceholder} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 썸네일 스트립 */}
          <div className={styles.thumbStrip}>
            {slides.map((slide, i) => (
              <div
                key={i}
                className={`${styles.thumb} ${currentIndex === i ? styles.thumbActive : ''}`}
                style={{ background: slide.background || COLORS.background.kraft }}
                onClick={() => {
                  setCurrentIndex(i);
                  setViewMode('slideshow');
                }}
              >
                {SLIDE_TYPES[slide.type]?.icon}
              </div>
            ))}
          </div>
        </div>

        {/* ─── 우측 QA 패널 ─── */}
        <div className={styles.qaPanel}>
          <div className={styles.qaHeader}>
            <h3>QA 체크리스트</h3>
            <span
              className={`${styles.qaScore} ${allPass ? styles.qaScorePass : styles.qaScoreWarn}`}
            >
              {passCount}/{qaResults.length}
            </span>
          </div>
          <div className={styles.qaList}>
            {qaResults.map((item, i) => (
              <div
                key={i}
                className={`${styles.qaItem} ${item.pass ? styles.qaItemPass : styles.qaItemFail}`}
              >
                <span className={styles.qaIcon}>{item.pass ? '✅' : '❌'}</span>
                <div>
                  <div className={styles.qaCategory}>{item.category}</div>
                  <div className={styles.qaRule}>{item.rule}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
