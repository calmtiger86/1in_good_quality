'use client';

import { useProjectStore } from '@/stores/projectStore';
import styles from './Header.module.css';
import Link from 'next/link';

interface HeaderProps {
  title?: string;
  showSaveStatus?: boolean;
  projectId?: number;
  actions?: React.ReactNode;
}

export default function Header({ title, showSaveStatus = false, actions }: HeaderProps) {
  const saveStatus = useProjectStore((s) => s.saveStatus);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <Link href="/" className={styles.logo}>
          <span className={styles.logoText}>1iN</span>
          <span className={styles.logoSub}>일인양품</span>
        </Link>
        {title && (
          <>
            <span className={styles.divider}>/</span>
            <h1 className={styles.title}>{title}</h1>
          </>
        )}
      </div>

      <div className={styles.right}>
        {showSaveStatus && (
          <div className={styles.saveStatus}>
            {saveStatus.state === 'saved' && <span className={styles.saved}>✅ 저장됨</span>}
            {saveStatus.state === 'saving' && <span className={styles.saving}>💾 저장 중...</span>}
            {saveStatus.state === 'error' && <span className={styles.error}>⚠️ 저장 실패</span>}
          </div>
        )}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
