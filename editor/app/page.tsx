'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import { getAllProjects, createProject, deleteProject, importProjectFromJSON, type Project } from '@/lib/db';
import type { ProjectStatus } from '@/lib/openspec';
import styles from './page.module.css';

const STATUS_TABS: { key: 'all' | ProjectStatus; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'draft', label: '작업 중' },
  { key: 'completed', label: '완료' },
  { key: 'published', label: '배포됨' },
];

export default function DashboardPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<'all' | ProjectStatus>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    setLoading(true);
    const all = await getAllProjects();
    setProjects(all);
    setLoading(false);
  }

  const filtered = filter === 'all'
    ? projects
    : projects.filter((p) => p.status === filter);

  async function handleNewProject() {
    const id = await createProject();
    router.push(`/project/${id}/input`);
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('이 프로젝트를 삭제하시겠습니까?')) {
      await deleteProject(id);
      loadProjects();
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const id = await importProjectFromJSON(text);
      router.push(`/project/${id}/storyboard`);
    } catch {
      alert('JSON 파일을 읽을 수 없습니다.');
    }
  }

  function getStatusBadge(status: ProjectStatus) {
    const map: Record<ProjectStatus, { label: string; cls: string }> = {
      draft: { label: '작업 중', cls: styles.badgeDraft },
      editing: { label: '편집 중', cls: styles.badgeEditing },
      completed: { label: '완료', cls: styles.badgeCompleted },
      published: { label: '배포됨', cls: styles.badgePublished },
    };
    const { label, cls } = map[status];
    return <span className={`${styles.badge} ${cls}`}>{label}</span>;
  }

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <>
      <Header
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--secondary" onClick={handleImportClick}>
              📂 JSON 불러오기
            </button>
            <button className="btn btn--primary" onClick={handleNewProject}>
              ✨ 새 카드뉴스 만들기
            </button>
          </div>
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      <main className={styles.main}>
        <section className={styles.hero}>
          <h2 className={styles.heroTitle}>카드뉴스 에디터</h2>
          <p className={styles.heroDesc}>
            제품 URL 하나로 Noritake 스타일 카드뉴스를 자동 생성합니다
          </p>
        </section>

        {/* 필터 탭 */}
        <div className={styles.tabs}>
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${filter === tab.key ? styles.tabActive : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              {tab.key !== 'all' && (
                <span className={styles.tabCount}>
                  {projects.filter((p) => tab.key === 'all' || p.status === tab.key).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 프로젝트 그리드 */}
        {loading ? (
          <div className={styles.empty}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>📑</span>
            <p>아직 프로젝트가 없습니다</p>
            <button className="btn btn--primary btn--lg" onClick={handleNewProject}>
              ✨ 첫 카드뉴스 만들기
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((project) => (
              <div
                key={project.id}
                className={styles.projectCard}
                onClick={() =>
                  router.push(
                    `/project/${project.id}/${project.status === 'draft' ? 'input' : 'storyboard'}`
                  )
                }
              >
                <div className={styles.cardThumb}>
                  <span className={styles.cardVol}>VOL.{String(project.vol).padStart(3, '0')}</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{project.title || '제목 없음'}</h3>
                    {getStatusBadge(project.status)}
                  </div>
                  <p className={styles.cardProduct}>{project.productName || '제품 미설정'}</p>
                  <div className={styles.cardFooter}>
                    <span className={styles.cardDate}>{formatDate(project.updatedAt)}</span>
                    <span className={styles.cardSlides}>
                      {project.slides.length}장
                    </span>
                    <button
                      className={styles.cardDelete}
                      onClick={(e) => handleDelete(project.id!, e)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
