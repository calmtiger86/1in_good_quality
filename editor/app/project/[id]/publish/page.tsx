'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import Header from '@/components/common/Header';
import { useProjectStore } from '@/stores/projectStore';
import { exportProjectAsJSON } from '@/lib/db';
import type { Slide } from '@/lib/db';
import { TYPOGRAPHY, CANVAS, COLORS } from '@/lib/openspec';
import styles from './page.module.css';

export default function PublishPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.id);

  const { project, loadProject, updateField } = useProjectStore();
  const [copySuccess, setCopySuccess] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  if (!project) return <div className={styles.loading}>불러오는 중...</div>;

  const caption = project.caption;
  const fullCaption = [
    caption.editorsNote,
    '',
    caption.body,
    '',
    caption.cta,
    '',
    caption.hashtags.join(' '),
  ].join('\n');

  const charCount = fullCaption.length;
  const isWarning = charCount > TYPOGRAPHY.caption.warningThreshold;
  const isError = charCount > TYPOGRAPHY.caption.maxLength;

  // ─── 캡션 복사 ─────────────────────
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullCaption);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // 클립보드 API 실패 시 수동 복사 안내
      const textarea = document.createElement('textarea');
      textarea.value = fullCaption;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  // ─── JSON 내보내기 ──────────────────
  async function handleExportJSON() {
    if (!project?.id) return;
    const json = await exportProjectAsJSON(project.id);
    downloadFile(json, `storyboard_vol${project.vol}.json`, 'application/json');
  }

  // ─── 파일 다운로드 헬퍼 ──────────────
  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── 슬라이드 → PNG Blob (비동기, imageUrl 포함) ──────────
  async function renderSlideToBlob(slide: Slide): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS.WIDTH;
    canvas.height = CANVAS.HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 배경
    ctx.fillStyle = slide.background || COLORS.background.kraft;
    ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);

    // AI 생성 이미지 로드 (있을 경우)
    if (slide.imageUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => { ctx.drawImage(img, 0, 0, CANVAS.WIDTH, CANVAS.HEIGHT); resolve(); };
        img.onerror = () => resolve(); // 실패 시 배경만 사용
        img.src = slide.imageUrl!;
      });
    } else {
      // 이미지 미생성 시 플레이스홀더 아이콘
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.font = '64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        slide.type === 'hook' ? '📰' : slide.type === 'cta' ? '📢' : '💡',
        CANVAS.WIDTH / 2,
        CANVAS.HEIGHT / 2
      );
      ctx.textAlign = 'start';
      ctx.textBaseline = 'top';
    }

    // 로고 (항상 최상단 레이어)
    ctx.fillStyle = slide.background === COLORS.background.white ? COLORS.background.kraft : '#fff';
    ctx.font = '700 14px Inter, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('1iN 일인양품', 24, 24);

    // 헤드라인
    if (slide.headline) {
      ctx.fillStyle = '#000';
      ctx.font = '800 44px NanumSquare, sans-serif';
      const lines = slide.headline.split('\n');
      let y = slide.type === 'hook' ? 550 : 200;
      for (const line of lines) {
        ctx.fillText(line, slide.type === 'hook' ? 580 : 80, y);
        y += 58;
      }
    }

    // 서브카피
    if (slide.body && slide.body.length > 0) {
      ctx.fillStyle = '#333';
      ctx.font = '400 18px NanumSquare, sans-serif';
      const startY = slide.type === 'hook' ? 770 : 320;
      slide.body.forEach((line, i) => {
        ctx.fillText(line, slide.type === 'hook' ? 580 : 80, startY + i * 26);
      });
    }

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  // ─── 이미지 ZIP 일괄 다운로드 ──────────────
  async function handleDownloadImages() {
    if (!project) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      const folderName = `1in_vol${String(project.vol).padStart(3, '0')}`;
      const folder = zip.folder(folderName);

      for (let i = 0; i < project.slides.length; i++) {
        const slide = project.slides[i];
        const blob = await renderSlideToBlob(slide);
        if (blob) {
          folder?.file(`slide_${String(i + 1).padStart(2, '0')}_${slide.type}.png`, blob);
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `${folderName}.zip`);
    } finally {
      setExporting(false);
    }
  }

  // ─── 캡션 텍스트 다운로드 ─────────────
  function handleDownloadCaption() {
    if (!project) return;
    downloadFile(fullCaption, `caption_vol${project.vol}.txt`, 'text/plain');
  }

  // ─── Web Viewer HTML 생성 ──────────────
  async function handleExportWebViewer() {
    if (!project) return;
    setExporting(true);
    try {
      // 슬라이드를 base64로 렌더링
      const slideDataUrls: string[] = [];
      for (const slide of project.slides) {
        const blob = await renderSlideToBlob(slide);
        if (blob) {
          const reader = new FileReader();
          const dataUrl = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          slideDataUrls.push(dataUrl);
        } else {
          slideDataUrls.push('');
        }
      }

      const volStr = `VOL.${String(project.vol).padStart(3, '0')}`;
      const affiliateUrl = project.affiliateUrl || '#';
      const productName = project.productName || '제품 보러가기';

      // 슬라이드 img 태그 배열
      const slidesHTML = slideDataUrls
        .map(
          (src, i) =>
            `<div class="slide" id="slide-${i}" style="display:${i === 0 ? 'flex' : 'none'}">
              <img src="${src}" alt="슬라이드 ${i + 1}" draggable="false" />
            </div>`
        )
        .join('\n');

      const dotsHTML = slideDataUrls
        .map((_, i) => `<button class="dot${i === 0 ? ' active' : ''}" data-index="${i}" aria-label="슬라이드 ${i + 1}"></button>`)
        .join('');

      const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>1iN 일인양품 — ${volStr}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #f5f0eb; display: flex; flex-direction: column; align-items: center; min-height: 100vh; font-family: 'Noto Sans KR', sans-serif; padding: 24px 16px 48px; }
    h1 { font-size: 13px; letter-spacing: 0.12em; color: #7a6a5a; margin-bottom: 20px; text-transform: uppercase; }
    .viewer { position: relative; width: 100%; max-width: 480px; aspect-ratio: 4/5; background: #c4a882; border-radius: 4px; overflow: hidden; touch-action: pan-y; user-select: none; }
    .slide { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .slide img { width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.7); border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .nav--prev { left: 8px; }
    .nav--next { right: 8px; }
    .nav:hover { background: rgba(255,255,255,0.95); }
    .dots { display: flex; gap: 6px; justify-content: center; margin-top: 14px; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: #c4a882; border: none; cursor: pointer; padding: 0; transition: background 0.2s; }
    .dot.active { background: #7a6a5a; }
    .counter { font-size: 12px; color: #7a6a5a; margin-top: 8px; }
    .cta-btn { display: block; width: 100%; max-width: 480px; margin-top: 24px; padding: 16px; background: #3a3028; color: #fff; text-align: center; text-decoration: none; font-size: 15px; letter-spacing: 0.06em; border-radius: 4px; }
    .cta-btn:hover { background: #1a100a; }
  </style>
</head>
<body>
  <h1>1iN 일인양품 — ${volStr}</h1>

  <div class="viewer" id="viewer">
    ${slidesHTML}
    <button class="nav nav--prev" id="prev" aria-label="이전">&#8249;</button>
    <button class="nav nav--next" id="next" aria-label="다음">&#8250;</button>
  </div>

  <div class="dots" id="dots">${dotsHTML}</div>
  <p class="counter" id="counter">1 / ${slideDataUrls.length}</p>

  <a class="cta-btn" href="${affiliateUrl}" target="_blank" rel="noopener noreferrer">
    ${productName} — 구매하러 가기 →
  </a>

  <script>
    const total = ${slideDataUrls.length};
    let current = 0;
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const counter = document.getElementById('counter');

    function goTo(n) {
      slides[current].style.display = 'none';
      dots[current].classList.remove('active');
      current = (n + total) % total;
      slides[current].style.display = 'flex';
      dots[current].classList.add('active');
      counter.textContent = (current + 1) + ' / ' + total;
    }

    document.getElementById('prev').onclick = () => goTo(current - 1);
    document.getElementById('next').onclick = () => goTo(current + 1);
    dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

    // 스와이프 지원
    let startX = 0;
    const viewer = document.getElementById('viewer');
    viewer.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    viewer.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) goTo(dx < 0 ? current + 1 : current - 1);
    });
  </script>
</body>
</html>`;

      downloadFile(html, `1in_${volStr.toLowerCase().replace('.', '')}.html`, 'text/html;charset=utf-8');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Header
        title="배포"
        showSaveStatus
        projectId={projectId}
        actions={
          <button className="btn btn--secondary" onClick={() => router.push(`/project/${projectId}/preview`)}>
            ← 미리보기
          </button>
        }
      />

      <main className={styles.main}>
        {/* ─── 인스타그램 캡션 ─── */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>📸 인스타그램 캡션</h2>
            <div className={styles.charCounter}>
              <span className={`${styles.charCount} ${isError ? styles.charError : isWarning ? styles.charWarning : ''}`}>
                {charCount.toLocaleString()} / {TYPOGRAPHY.caption.maxLength.toLocaleString()}자
              </span>
            </div>
          </div>

          <div className={styles.captionFields}>
            <div className={styles.captionField}>
              <label>에디터스 노트</label>
              <textarea
                className={`input input--ko ${styles.textarea}`}
                rows={3}
                placeholder="큐레이션 관점의 제품 소개 (에디터 노트 톤)"
                value={caption.editorsNote}
                onChange={(e) =>
                  updateField('caption', { ...caption, editorsNote: e.target.value })
                }
              />
            </div>

            <div className={styles.captionField}>
              <label>본문</label>
              <textarea
                className={`input input--ko ${styles.textarea}`}
                rows={4}
                placeholder="제품의 핵심 특징과 사용 경험"
                value={caption.body}
                onChange={(e) =>
                  updateField('caption', { ...caption, body: e.target.value })
                }
              />
            </div>

            <div className={styles.captionField}>
              <label>CTA</label>
              <textarea
                className={`input input--ko ${styles.textarea}`}
                rows={2}
                value={caption.cta}
                onChange={(e) =>
                  updateField('caption', { ...caption, cta: e.target.value })
                }
              />
            </div>

            <div className={styles.captionField}>
              <label>해시태그</label>
              <input
                className="input"
                value={caption.hashtags.join(' ')}
                onChange={(e) =>
                  updateField('caption', { ...caption, hashtags: e.target.value.split(' ').filter(Boolean) })
                }
              />
            </div>
          </div>

          {/* 캡션 미리보기 */}
          <div className={styles.captionPreview}>
            <pre className={styles.captionText}>{fullCaption}</pre>
          </div>

          {/* 경고 */}
          {isWarning && !isError && (
            <div className={styles.warning}>
              ⚠️ 글자수가 {TYPOGRAPHY.caption.warningThreshold.toLocaleString()}자를 넘었습니다. 불필요한 내용을 줄여주세요.
            </div>
          )}
          {isError && (
            <div className={styles.error}>
              ❌ 인스타그램 캡션 제한({TYPOGRAPHY.caption.maxLength.toLocaleString()}자)을 초과했습니다!
            </div>
          )}

          <div className={styles.captionActions}>
            <button className="btn btn--primary" onClick={handleCopy}>
              {copySuccess ? '✅ 복사됨!' : '📋 캡션 복사'}
            </button>
            <button className="btn btn--secondary" onClick={handleDownloadCaption}>
              📄 캡션 TXT 다운로드
            </button>
          </div>
        </section>

        {/* ─── 이미지 내보내기 ─── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>🖼 이미지 내보내기</h2>
          <p className={styles.cardDesc}>모든 카드를 1080×1350 PNG로 내보냅니다</p>
          <button
            className="btn btn--primary btn--full btn--lg"
            onClick={handleDownloadImages}
            disabled={exporting}
          >
            {exporting ? '⏳ 내보내는 중...' : '📥 이미지 ZIP 다운로드'}
          </button>
        </section>

        {/* ─── Web Viewer ─── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>🌐 Web Viewer 내보내기</h2>
          <p className={styles.cardDesc}>
            슬라이드 슬라이더 + 구매 버튼이 포함된 자체 완결 HTML 파일을 생성합니다.
            링크트리, Notion, 개인 블로그 등에 임베드하거나 공유할 수 있습니다.
          </p>
          <button
            className="btn btn--secondary btn--full"
            onClick={handleExportWebViewer}
            disabled={exporting}
          >
            {exporting ? '⏳ 생성 중...' : '🌐 Web Viewer HTML 다운로드'}
          </button>
        </section>

        {/* ─── 파일 백업 ─── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>💾 프로젝트 백업</h2>
          <p className={styles.cardDesc}>스토리보드 JSON을 저장하여 나중에 다시 편집할 수 있습니다</p>
          <button className="btn btn--secondary btn--full" onClick={handleExportJSON}>
            📄 storyboard.json 다운로드
          </button>
        </section>

        {/* ─── 배포 요약 ─── */}
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>📊 배포 요약</h2>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>프로젝트</span>
              <span className={styles.summaryValue}>{project.title || '제목 없음'}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>VOL</span>
              <span className={styles.summaryValue}>VOL.{String(project.vol).padStart(3, '0')}</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>슬라이드</span>
              <span className={styles.summaryValue}>{project.slides.length}장</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryLabel}>제휴링크</span>
              <span className={styles.summaryValue} style={{ fontSize: 11, wordBreak: 'break-all' }}>
                {project.affiliateUrl || '미설정'}
              </span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
