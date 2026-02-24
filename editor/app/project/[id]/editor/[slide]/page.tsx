'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/common/Header';
import { useProjectStore } from '@/stores/projectStore';
import { COLORS, SLIDE_TYPES, CANVAS, LOGO } from '@/lib/openspec';
import type { Slide } from '@/lib/db';
import styles from './page.module.css';

// ─── 타입 정의 ─────────────────────────────────

interface ElementData {
  id: string;
  type: 'text' | 'image' | 'logo' | 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  direction?: 'horizontal' | 'vertical';
  src?: string;
  fill?: string;
  locked?: boolean;
  rotation?: number;
  opacity?: number;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

// ─── 기본 요소 생성 ─────────────────────────────

function createDefaultElements(slide: Slide): ElementData[] {
  const elements: ElementData[] = [];
  const slideType = slide.type;
  const background = slide.background || COLORS.background.kraft;
  const headline = slide.headline || '';
  const bodyLines = slide.body || [];
  const bodyText = bodyLines.join('\n');

  // 로고 (항상 좌상단 고정)
  elements.push({
    id: 'logo',
    type: 'logo',
    x: 24,
    y: 24,
    width: 70,
    height: 24,
    content: '1iN 일인양품',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter',
    color: background === COLORS.background.white ? COLORS.background.kraft : '#FFFFFF',
    locked: true,
  });

  if (slideType === 'hook') {
    elements.push({
      id: 'headline',
      type: 'text',
      x: 580,
      y: 550,
      width: 420,
      height: 200,
      content: headline || '퇴근 후,\n조용히 무너지는\n저녁',
      fontSize: 44,
      fontWeight: '800',
      fontFamily: 'NanumSquare',
      color: '#000',
      direction: 'horizontal',
    });
    elements.push({
      id: 'subcopy',
      type: 'text',
      x: 580,
      y: 770,
      width: 420,
      height: 80,
      content: bodyText || '나를 위한 시간을\n조용히 만들어주는 것',
      fontSize: 16,
      fontWeight: '400',
      fontFamily: 'NanumSquare',
      color: '#333',
      direction: 'horizontal',
    });
    elements.push({
      id: 'vol',
      type: 'text',
      x: 900,
      y: 28,
      width: 160,
      height: 24,
      content: 'VOL.001',
      fontSize: 13,
      fontWeight: '600',
      fontFamily: 'Inter',
      color: background === COLORS.background.white ? '#666' : 'rgba(255,255,255,0.7)',
      direction: 'horizontal',
    });
  } else if (slideType === 'agitation') {
    elements.push({
      id: 'headline',
      type: 'text',
      x: 80,
      y: 200,
      width: 500,
      height: 100,
      content: headline || '매일 반복되는 그 장면',
      fontSize: 36,
      fontWeight: '800',
      fontFamily: 'NanumSquare',
      color: '#000',
      direction: 'horizontal',
    });
    elements.push({
      id: 'body',
      type: 'text',
      x: 80,
      y: 320,
      width: 600,
      height: 120,
      content: bodyText || '설거지 위에 쌓이는 설거지\n좁은 싱크대와의 전쟁',
      fontSize: 18,
      fontWeight: '400',
      fontFamily: 'NanumSquare',
      color: '#333',
      direction: 'horizontal',
    });
  } else if (slideType === 'solution') {
    elements.push({
      id: 'keyword',
      type: 'text',
      x: 880,
      y: 200,
      width: 60,
      height: 500,
      content: headline || '조용한\n부엌',
      fontSize: 42,
      fontWeight: '800',
      fontFamily: 'NanumSquare',
      color: '#000',
      direction: 'vertical',
    });
    elements.push({
      id: 'body',
      type: 'text',
      x: 80,
      y: 1050,
      width: 800,
      height: 60,
      content: bodyText || '나를 위한 시간을 조용히 만들어주는 것',
      fontSize: 16,
      fontWeight: '400',
      fontFamily: 'NanumSquare',
      color: '#333',
      direction: 'horizontal',
    });
  } else if (slideType === 'photo_card') {
    elements.push({
      id: 'overlay-bg',
      type: 'rect',
      x: 0,
      y: 1100,
      width: 1080,
      height: 250,
      fill: 'rgba(0,0,0,0.45)',
    });
    elements.push({
      id: 'product-name',
      type: 'text',
      x: 40,
      y: 1140,
      width: 600,
      height: 50,
      content: '제품명',
      fontSize: 28,
      fontWeight: '700',
      fontFamily: 'NanumSquare',
      color: '#fff',
      direction: 'horizontal',
    });
    elements.push({
      id: 'product-price',
      type: 'text',
      x: 40,
      y: 1200,
      width: 300,
      height: 40,
      content: '₩00,000',
      fontSize: 22,
      fontWeight: '600',
      fontFamily: 'Inter',
      color: '#fff',
      direction: 'horizontal',
    });
  } else if (slideType === 'cta') {
    elements.push({
      id: 'cta-headline',
      type: 'text',
      x: 240,
      y: 500,
      width: 600,
      height: 80,
      content: '자세한 정보는\n프로필 링크에서',
      fontSize: 36,
      fontWeight: '700',
      fontFamily: 'NanumSquare',
      color: '#000',
      direction: 'horizontal',
    });
    elements.push({
      id: 'cta-sub',
      type: 'text',
      x: 240,
      y: 610,
      width: 600,
      height: 40,
      content: '일인양품 리스트에서 확인하세요',
      fontSize: 16,
      fontWeight: '400',
      fontFamily: 'NanumSquare',
      color: '#333',
      direction: 'horizontal',
    });
    elements.push({
      id: 'cta-btn',
      type: 'rect',
      x: 340,
      y: 700,
      width: 400,
      height: 56,
      fill: '#000',
    });
    elements.push({
      id: 'cta-btn-text',
      type: 'text',
      x: 340,
      y: 710,
      width: 400,
      height: 40,
      content: '구매 링크 보기',
      fontSize: 18,
      fontWeight: '600',
      fontFamily: 'NanumSquare',
      color: '#fff',
      direction: 'horizontal',
    });
  }

  return elements;
}

// ─── Canvas → PNG 내보내기 ─────────────────────

async function renderToPNG(
  elements: ElementData[],
  background: string
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS.WIDTH;
  canvas.height = CANVAS.HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 배경
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, CANVAS.WIDTH, CANVAS.HEIGHT);

  // 이미지 요소 미리 로드 (일반 image + logo PNG)
  const imageMap = new Map<string, HTMLImageElement>();
  const preloads: Promise<void>[] = elements
    .filter((el) => el.type === 'image' && el.src)
    .map(
      (el) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => { imageMap.set(el.id, img); resolve(); };
          img.onerror = () => resolve();
          img.src = el.src!;
        })
    );

  // 로고 PNG 프리로드
  if (elements.some((el) => el.type === 'logo')) {
    preloads.push(
      new Promise<void>((resolve) => {
        const logoSrc = LOGO.getLogoForBackground(background);
        const img = new Image();
        img.onload = () => { imageMap.set('__logo__', img); resolve(); };
        img.onerror = () => resolve(); // 실패 시 텍스트 폴백
        img.src = logoSrc;
      })
    );
  }

  await Promise.all(preloads);

  // 요소 그리기
  for (const el of elements) {
    ctx.save();
    ctx.globalAlpha = el.opacity ?? 1;

    if (el.type === 'rect') {
      ctx.fillStyle = el.fill || 'rgba(0,0,0,0.1)';
      ctx.fillRect(el.x, el.y, el.width, el.height);
    } else if (el.type === 'logo') {
      const logoImg = imageMap.get('__logo__');
      if (logoImg) {
        ctx.drawImage(logoImg, el.x, el.y, el.width, el.height);
      } else {
        // 폴백: 텍스트
        ctx.fillStyle = el.color || COLORS.background.kraft;
        ctx.font = `${el.fontWeight || '700'} ${el.fontSize || 14}px ${el.fontFamily || 'Inter'}, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(el.content || '1iN 일인양품', el.x, el.y);
      }
    } else if (el.type === 'text') {
      ctx.fillStyle = el.color || '#000';
      const size = el.fontSize || 24;
      const weight = el.fontWeight || '400';
      const family = el.fontFamily || 'NanumSquare';
      ctx.font = `${weight} ${size}px ${family}, sans-serif`;
      ctx.textBaseline = 'top';

      if (el.direction === 'vertical' && el.content) {
        // 세로 텍스트: 글자 하나씩 세로 배치
        const chars = el.content.replace(/\n/g, '').split('');
        let cy = el.y;
        for (const ch of chars) {
          ctx.fillText(ch, el.x, cy);
          cy += size * 1.3;
        }
      } else {
        // 가로 텍스트
        const lines = (el.content || '').split('\n');
        let ly = el.y;
        for (const line of lines) {
          ctx.fillText(line, el.x, ly);
          ly += size * 1.4;
        }
      }
    } else if (el.type === 'image') {
      const img = imageMap.get(el.id);
      if (img) {
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      }
    }

    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

// ─── 에디터 컴포넌트 ────────────────────────────

export default function EditorPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.id);
  const slideIndex = Number(params.slide);

  const { project, loadProject } = useProjectStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [elements, setElements] = useState<ElementData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, elX: 0, elY: 0, elW: 0, elH: 0 });
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [, setUndoStack] = useState<ElementData[][]>([]);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  const scale = 0.5;

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  useEffect(() => {
    if (project?.slides?.[slideIndex]) {
      setElements(createDefaultElements(project.slides[slideIndex]));
    }
  }, [project, slideIndex]);

  // ─── Undo ─────────────────────────────
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-20), elements.map((e) => ({ ...e }))]);
  }, [elements]);

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setElements(last);
      return prev.slice(0, -1);
    });
  }, []);

  // ─── 드래그 시작 ──────────────────────
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, el: ElementData) => {
      if (el.locked) return;
      e.stopPropagation();
      pushUndo();
      setSelectedId(el.id);
      setIsDragging(true);

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        elX: el.x,
        elY: el.y,
        elW: el.width,
        elH: el.height,
      });
    },
    [pushUndo]
  );

  // ─── 리사이즈 시작 ────────────────────
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, el: ElementData, handle: ResizeHandle) => {
      if (el.locked) return;
      e.stopPropagation();
      e.preventDefault();
      pushUndo();
      setSelectedId(el.id);
      setIsResizing(handle);
      setIsDragging(false);

      setDragStart({
        x: e.clientX,
        y: e.clientY,
        elX: el.x,
        elY: el.y,
        elW: el.width,
        elH: el.height,
      });
    },
    [pushUndo]
  );

  // ─── 마우스 이동 ──────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!selectedId) return;

      const dx = (e.clientX - dragStart.x) / scale;
      const dy = (e.clientY - dragStart.y) / scale;

      if (isDragging) {
        setElements((prev) =>
          prev.map((el) =>
            el.id === selectedId
              ? {
                  ...el,
                  x: Math.max(0, Math.min(CANVAS.WIDTH - el.width, dragStart.elX + dx)),
                  y: Math.max(0, Math.min(CANVAS.HEIGHT - el.height, dragStart.elY + dy)),
                }
              : el
          )
        );
      } else if (isResizing) {
        setElements((prev) =>
          prev.map((el) => {
            if (el.id !== selectedId) return el;
            let { x, y, width, height } = { x: dragStart.elX, y: dragStart.elY, width: dragStart.elW, height: dragStart.elH };

            if (isResizing.includes('e')) width = Math.max(30, dragStart.elW + dx);
            if (isResizing.includes('w')) { x = dragStart.elX + dx; width = Math.max(30, dragStart.elW - dx); }
            if (isResizing.includes('s')) height = Math.max(20, dragStart.elH + dy);
            if (isResizing.includes('n')) { y = dragStart.elY + dy; height = Math.max(20, dragStart.elH - dy); }

            return { ...el, x, y, width, height };
          })
        );
      }
    },
    [isDragging, isResizing, selectedId, dragStart, scale]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  // ─── 키보드 (Cmd+Z, Delete) ───────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingTextId) return; // 텍스트 편집 중이면 무시
        if (selectedId) {
          const el = elements.find((e) => e.id === selectedId);
          if (el && !el.locked) {
            pushUndo();
            setElements((prev) => prev.filter((e) => e.id !== selectedId));
            setSelectedId(null);
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, editingTextId, elements, handleUndo, pushUndo]);

  // ─── 조건부 return ────────────────────
  const slide = project?.slides?.[slideIndex];
  if (!slide) return <div className={styles.loading}>불러오는 중...</div>;

  const selected = elements.find((e) => e.id === selectedId);
  const background = slide.background || COLORS.background.kraft;

  // 여백 비율
  const usedArea = elements
    .filter((e) => e.type !== 'logo')
    .reduce((sum, e) => sum + e.width * e.height, 0);
  const whitespacePercent = Math.round((1 - usedArea / (CANVAS.WIDTH * CANVAS.HEIGHT)) * 100);

  // ─── 텍스트 편집 ──────────────────────
  function handleDoubleClick(el: ElementData) {
    if (el.type === 'text' && !el.locked) setEditingTextId(el.id);
  }
  function handleTextChange(id: string, val: string) {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, content: val } : el)));
  }
  function handleTextBlur() { setEditingTextId(null); }
  function updateElement(id: string, changes: Partial<ElementData>) {
    setElements((prev) => prev.map((el) => (el.id === id ? { ...el, ...changes } : el)));
  }
  function handleCanvasClick() { setSelectedId(null); setEditingTextId(null); }

  // ─── PNG 내보내기 ─────────────────────
  async function handleExportPNG() {
    const url = await renderToPNG(elements, background);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `slide_${String(slideIndex + 1).padStart(2, '0')}.png`;
    a.click();
  }
  async function handlePreview() {
    const url = await renderToPNG(elements, background);
    if (url) setPreviewURL(url);
  }

  // ─── 이미지 업로드 ────────────────────
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      pushUndo();
      setElements((p) => [
        ...p,
        {
          id: `img-${Date.now()}`,
          type: 'image',
          x: 40,
          y: 40,
          width: 1000,
          height: 1270,
          src,
          opacity: 1,
        },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ─── 슬라이드 이동 ────────────────────
  const totalSlides = project?.slides?.length || 0;
  function goPrev() { if (slideIndex > 0) router.push(`/project/${projectId}/editor/${slideIndex - 1}`); }
  function goNext() { if (slideIndex < totalSlides - 1) router.push(`/project/${projectId}/editor/${slideIndex + 1}`); }

  // ─── 리사이즈 핸들 위치 ─────────────────
  const resizeHandles: { pos: ResizeHandle; style: React.CSSProperties }[] = [
    { pos: 'nw', style: { top: -4, left: -4, cursor: 'nwse-resize' } },
    { pos: 'ne', style: { top: -4, right: -4, cursor: 'nesw-resize' } },
    { pos: 'sw', style: { bottom: -4, left: -4, cursor: 'nesw-resize' } },
    { pos: 'se', style: { bottom: -4, right: -4, cursor: 'nwse-resize' } },
    { pos: 'n', style: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
    { pos: 's', style: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'ns-resize' } },
    { pos: 'e', style: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
    { pos: 'w', style: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'ew-resize' } },
  ];

  return (
    <>
      <Header
        title={`카드 에디터 — ${slideIndex + 1}/${totalSlides} ${SLIDE_TYPES[slide.type]?.label || ''}`}
        showSaveStatus
        projectId={projectId}
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn--secondary" onClick={() => router.push(`/project/${projectId}/storyboard`)}>
              ← 스토리보드
            </button>
            <button className="btn btn--secondary" onClick={handlePreview}>
              👁 미리보기
            </button>
            <button className="btn btn--primary" onClick={handleExportPNG}>
              📥 PNG 저장
            </button>
          </div>
        }
      />

      <div className={styles.layout}>
        {/* ─── 좌측 도구바 ─── */}
        <aside className={styles.toolbar}>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
          <button className={styles.toolBtn} title="선택" onClick={() => setSelectedId(null)}>🖱️</button>
          <button
            className={styles.toolBtn}
            title="가로 텍스트"
            onClick={() => {
              pushUndo();
              setElements((p) => [...p, {
                id: `text-${Date.now()}`, type: 'text', x: 200, y: 600,
                width: 600, height: 60, content: '텍스트', fontSize: 28,
                fontWeight: '700', fontFamily: 'NanumSquare', color: '#000', direction: 'horizontal',
              }]);
            }}
          >T</button>
          <button
            className={styles.toolBtn}
            title="세로 텍스트"
            onClick={() => {
              pushUndo();
              setElements((p) => [...p, {
                id: `vtext-${Date.now()}`, type: 'text', x: 100, y: 200,
                width: 60, height: 400, content: '세로', fontSize: 36,
                fontWeight: '800', fontFamily: 'NanumSquare', color: '#000', direction: 'vertical',
              }]);
            }}
          >T↕</button>
          <button
            className={styles.toolBtn}
            title="사각형"
            onClick={() => {
              pushUndo();
              setElements((p) => [...p, {
                id: `rect-${Date.now()}`, type: 'rect', x: 300, y: 300,
                width: 400, height: 300, fill: 'rgba(0,0,0,0.1)',
              }]);
            }}
          >▢</button>
          <button
            className={styles.toolBtn}
            title="이미지 삽입"
            onClick={() => imageInputRef.current?.click()}
          >🖼</button>
          <div className={styles.toolDivider} />
          <button className={`${styles.toolBtn} ${showSafeZone ? styles.toolBtnActive : ''}`} title="세이프존" onClick={() => setShowSafeZone(!showSafeZone)}>⊞</button>
          <button className={styles.toolBtn} title="되돌리기 (⌘Z)" onClick={handleUndo}>↩</button>
          <div className={styles.toolDivider} />
          <button
            className={styles.toolBtn}
            title="삭제"
            onClick={() => {
              if (selectedId && !elements.find((e) => e.id === selectedId)?.locked) {
                pushUndo();
                setElements((p) => p.filter((e) => e.id !== selectedId));
                setSelectedId(null);
              }
            }}
          >🗑</button>
        </aside>

        {/* ─── 중앙 캔버스 ─── */}
        <main className={styles.canvasArea} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
          <div className={styles.canvasInfo}>
            <span>1080 × 1350 · 4:5</span>
            <span className={`${styles.whitespace} ${whitespacePercent < 50 ? styles.whitespaceWarn : ''}`}>
              여백 {whitespacePercent}% {whitespacePercent < 50 ? '⚠️' : '✅'}
            </span>
            <span className={styles.slideNav}>
              <button onClick={goPrev} disabled={slideIndex <= 0} className={styles.navBtn}>◀</button>
              <span>{slideIndex + 1} / {totalSlides}</span>
              <button onClick={goNext} disabled={slideIndex >= totalSlides - 1} className={styles.navBtn}>▶</button>
            </span>
          </div>

          <div
            ref={canvasRef}
            className={styles.canvas}
            style={{ width: CANVAS.WIDTH * scale, height: CANVAS.HEIGHT * scale, background }}
            onClick={handleCanvasClick}
          >
            {/* 세이프존 가이드 */}
            {showSafeZone && (
              <div
                className={styles.safeZone}
                style={{
                  left: CANVAS.SAFE_MARGIN * scale, top: CANVAS.SAFE_MARGIN * scale,
                  width: (CANVAS.WIDTH - CANVAS.SAFE_MARGIN * 2) * scale,
                  height: (CANVAS.HEIGHT - CANVAS.SAFE_MARGIN * 2) * scale,
                }}
              />
            )}

            {/* 센터 가이드 */}
            {showSafeZone && (
              <>
                <div className={styles.centerGuide} style={{ left: '50%', top: 0, width: 1, height: '100%' }} />
                <div className={styles.centerGuide} style={{ top: '50%', left: 0, height: 1, width: '100%' }} />
              </>
            )}

            {/* 요소 렌더링 */}
            {elements.map((el) => (
              <div
                key={el.id}
                className={`${styles.element} ${selectedId === el.id ? styles.elementSelected : ''} ${el.locked ? styles.elementLocked : ''}`}
                style={{
                  left: el.x * scale, top: el.y * scale,
                  width: el.width * scale, height: el.height * scale,
                }}
                onMouseDown={(e) => handleMouseDown(e, el)}
                onDoubleClick={() => handleDoubleClick(el)}
                onClick={(e) => { e.stopPropagation(); setSelectedId(el.id); }}
              >
                {/* 텍스트 요소 */}
                {el.type === 'text' && editingTextId === el.id ? (
                  <textarea
                    className={styles.textEdit}
                    style={{
                      fontSize: (el.fontSize || 24) * scale, fontWeight: el.fontWeight || '400',
                      fontFamily: el.fontFamily || 'NanumSquare', color: el.color || '#000',
                      writingMode: el.direction === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                    }}
                    value={el.content || ''}
                    onChange={(e) => handleTextChange(el.id, e.target.value)}
                    onBlur={handleTextBlur}
                    autoFocus
                  />
                ) : el.type === 'text' || el.type === 'logo' ? (
                  <div
                    className={styles.textDisplay}
                    style={{
                      fontSize: (el.fontSize || 24) * scale, fontWeight: el.fontWeight || '400',
                      fontFamily: el.fontFamily || 'NanumSquare', color: el.color || '#000',
                      writingMode: el.direction === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                    }}
                  >
                    {el.content}
                  </div>
                ) : el.type === 'rect' ? (
                  <div className={styles.rectElement} style={{ background: el.fill || 'rgba(0,0,0,0.1)', opacity: el.opacity ?? 1 }} />
                ) : el.type === 'image' && el.src ? (
                  <img src={el.src} alt="" className={styles.imageElement} />
                ) : null}

                {/* 리사이즈 핸들 */}
                {selectedId === el.id && !el.locked && (
                  resizeHandles.map(({ pos, style }) => (
                    <div
                      key={pos}
                      className={styles.resizeHandle}
                      style={style}
                      onMouseDown={(e) => handleResizeStart(e, el, pos)}
                    />
                  ))
                )}
              </div>
            ))}
          </div>
        </main>

        {/* ─── 우측 속성 패널 ─── */}
        <aside className={styles.panel}>
          {selected ? (
            <>
              <h3 className={styles.panelTitle}>
                {selected.type === 'text' ? '📝 텍스트' : selected.type === 'rect' ? '▢ 도형' : selected.type === 'logo' ? '🏷 로고' : '🖼 이미지'}
                {selected.locked && <span className={styles.lockBadge}>🔒</span>}
              </h3>

              {/* 위치/크기 */}
              <div className={styles.panelSection}>
                <span className={styles.panelLabel}>위치 &amp; 크기</span>
                <div className={styles.posGrid}>
                  {(['x', 'y', 'width', 'height'] as const).map((key) => (
                    <div key={key} className={styles.posField}>
                      <span>{key === 'width' ? 'W' : key === 'height' ? 'H' : key.toUpperCase()}</span>
                      <input
                        id={`pos-${key}`}
                        name={key}
                        type="number"
                        className="input"
                        value={Math.round(selected[key])}
                        onChange={(e) => updateElement(selected.id, { [key]: Number(e.target.value) })}
                        disabled={selected.locked}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* 텍스트 속성 */}
              {selected.type === 'text' && !selected.locked && (
                <>
                  <div className={styles.panelSection}>
                    <label className={styles.panelLabel} htmlFor="element-content">내용</label>
                    <textarea
                      id="element-content"
                      name="element-content"
                      className={styles.contentTextarea}
                      value={selected.content || ''}
                      onChange={(e) => updateElement(selected.id, { content: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className={styles.panelSection}>
                    <label className={styles.panelLabel} htmlFor="element-font">폰트</label>
                    <select
                      id="element-font"
                      name="element-font"
                      className="input"
                      value={selected.fontFamily}
                      onChange={(e) => updateElement(selected.id, { fontFamily: e.target.value })}
                    >
                      <option value="NanumSquare">NanumSquare (한글)</option>
                      <option value="Inter">Inter (영문)</option>
                    </select>
                  </div>
                  <div className={styles.panelSection}>
                    <span className={styles.panelLabel}>크기 &amp; 굵기</span>
                    <div className={styles.rowFields}>
                      <input
                        id="element-font-size"
                        name="element-font-size"
                        type="number"
                        className="input"
                        value={selected.fontSize}
                        onChange={(e) => updateElement(selected.id, { fontSize: Number(e.target.value) })}
                        style={{ width: 70 }}
                      />
                      <select
                        id="element-font-weight"
                        name="element-font-weight"
                        className="input"
                        value={selected.fontWeight}
                        onChange={(e) => updateElement(selected.id, { fontWeight: e.target.value })}
                      >
                        <option value="400">Regular</option>
                        <option value="600">SemiBold</option>
                        <option value="700">Bold</option>
                        <option value="800">ExtraBold</option>
                      </select>
                    </div>
                  </div>
                  <div className={styles.panelSection}>
                    <label className={styles.panelLabel} htmlFor="element-color">색상</label>
                    <input id="element-color" name="element-color" type="color" value={selected.color || '#000000'} onChange={(e) => updateElement(selected.id, { color: e.target.value })} className={styles.colorPicker} />
                  </div>
                  <div className={styles.panelSection}>
                    <span className={styles.panelLabel}>방향</span>
                    <div className={styles.directionBtns}>
                      <button className={`${styles.dirBtn} ${selected.direction === 'horizontal' ? styles.dirBtnActive : ''}`} onClick={() => updateElement(selected.id, { direction: 'horizontal' })}>가로</button>
                      <button className={`${styles.dirBtn} ${selected.direction === 'vertical' ? styles.dirBtnActive : ''}`} onClick={() => updateElement(selected.id, { direction: 'vertical' })}>세로</button>
                    </div>
                  </div>
                </>
              )}

              {/* 도형 속성 */}
              {selected.type === 'rect' && (
                <div className={styles.panelSection}>
                  <label className={styles.panelLabel} htmlFor="element-fill">채우기 색</label>
                  <input id="element-fill" name="element-fill" type="color" value={selected.fill || '#000000'} onChange={(e) => updateElement(selected.id, { fill: e.target.value })} className={styles.colorPicker} />
                </div>
              )}

              {/* 불투명도 (이미지 & 도형) */}
              {(selected.type === 'image' || selected.type === 'rect') && (
                <div className={styles.panelSection}>
                  <label className={styles.panelLabel} htmlFor="element-opacity">불투명도 {Math.round((selected.opacity ?? 1) * 100)}%</label>
                  <input
                    id="element-opacity"
                    name="element-opacity"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selected.opacity ?? 1}
                    onChange={(e) => updateElement(selected.id, { opacity: parseFloat(e.target.value) })}
                    className={styles.opacitySlider}
                  />
                </div>
              )}
            </>
          ) : (
            <div className={styles.panelEmpty}>
              <p>요소를 선택하세요</p>
              <p className={styles.panelHint}>더블클릭으로 텍스트 편집</p>
              <p className={styles.panelHint}>⌘Z로 되돌리기</p>
            </div>
          )}

          {/* 레이어 목록 */}
          <div className={styles.layerSection}>
            <h4 className={styles.layerTitle}>레이어</h4>
            {[...elements].reverse().map((el) => (
              <div
                key={el.id}
                className={`${styles.layerItem} ${selectedId === el.id ? styles.layerItemActive : ''}`}
                onClick={() => setSelectedId(el.id)}
              >
                <span className={styles.layerIcon}>
                  {el.type === 'text' ? '📝' : el.type === 'logo' ? '🏷' : el.type === 'rect' ? '▢' : '🖼'}
                </span>
                <span className={styles.layerName}>{el.content?.substring(0, 12) || el.id}</span>
                {el.locked && <span className={styles.layerLock}>🔒</span>}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* ─── PNG 미리보기 모달 ─── */}
      {previewURL && (
        <div className={styles.previewOverlay} onClick={() => setPreviewURL(null)}>
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <h3>PNG 미리보기 (1080×1350)</h3>
            <img src={previewURL} alt="Preview" className={styles.previewImage} />
            <div className={styles.previewActions}>
              <button className="btn btn--primary" onClick={handleExportPNG}>📥 다운로드</button>
              <button className="btn btn--secondary" onClick={() => setPreviewURL(null)}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
