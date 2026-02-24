'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Header from '@/components/common/Header';
import { useProjectStore } from '@/stores/projectStore';
import styles from './page.module.css';

export default function InputPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = Number(params.id);

  const { project, loadProject, updateField } = useProjectStore();

  const [url, setUrl] = useState('');
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [affiliateMode, setAffiliateMode] = useState<'auto' | 'manual'>('auto');
  const [affiliateLoading, setAffiliateLoading] = useState(false);
  const [affiliateError, setAffiliateError] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState({
    name: '',
    price: '',
    category: '',
    specs: [] as string[],
  });
  const [keyFeatures, setKeyFeatures] = useState<string[]>([]);
  const [copyPoints, setCopyPoints] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState('');

  useEffect(() => {
    loadProject(projectId);
  }, [projectId, loadProject]);

  useEffect(() => {
    if (project) {
      setUrl(project.productUrl || '');
      setAffiliateUrl(project.affiliateUrl || '');
      setProductInfo({
        name: project.productName || '',
        price: project.productPrice || '',
        category: project.productCategory || '',
        specs: project.productSpecs || [],
      });
      setKeyFeatures(project.productKeyFeatures || []);
      setCopyPoints(project.productCopyPoints || []);
      setTargetAudience(project.productTargetAudience || '');
    }
  }, [project]);

  // ─── URL 추출 (실제 API 연동) ──────────────────
  async function handleExtract() {
    if (!url.trim()) return;
    setExtracting(true);
    setExtractError('');

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl: url }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `추출 실패 (${res.status})`);
      }

      const data = await res.json();

      if (!data.name) {
        throw new Error('제품 정보를 찾을 수 없습니다.');
      }

      const info = {
        name: data.name,
        price: data.price || '',
        category: data.category || '기타',
        specs: data.specs || [],
      };

      setProductInfo(info);
      setKeyFeatures(data.keyFeatures || []);
      setCopyPoints(data.copyPoints || []);
      setTargetAudience(data.targetAudience || '');

      updateField('productUrl', url);
      updateField('productName', info.name);
      updateField('productPrice', info.price);
      updateField('productCategory', info.category);
      updateField('productSpecs', info.specs);
      updateField('productKeyFeatures', data.keyFeatures || []);
      updateField('productCopyPoints', data.copyPoints || []);
      updateField('productTargetAudience', data.targetAudience || '');
      updateField('title', info.name);

      // 추출된 이미지가 있으면 자동으로 미리보기 설정
      if (data.image) {
        setPhotoPreview(data.image);
      }

      // 제휴 링크 자동 생성 시도
      if (affiliateMode === 'auto') {
        handleAffiliateAuto(url);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'URL에서 제품 정보를 추출할 수 없습니다. 직접 입력해 주세요.';
      setExtractError(message);
    } finally {
      setExtracting(false);
    }
  }

  // ─── 제휴 링크 자동 생성 ─────────────────────
  async function handleAffiliateAuto(productUrl: string) {
    setAffiliateLoading(true);
    setAffiliateError('');
    try {
      // TODO: 실제 쿠팡 파트너스 API 연동
      const res = await fetch('/api/affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl }),
      });
      if (!res.ok) throw new Error('API 실패');
      const data = await res.json();
      setAffiliateUrl(data.affiliateUrl);
      updateField('affiliateUrl', data.affiliateUrl);
    } catch {
      setAffiliateError('제휴 링크 자동 생성에 실패했습니다.');
      setAffiliateMode('manual');
    } finally {
      setAffiliateLoading(false);
    }
  }

  // ─── 사진 업로드 ──────────────────────────────
  const handlePhotoDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processPhoto(file);
  }, []);

  const handlePhotoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processPhoto(file);
  }, []);

  function processPhoto(file: File) {
    if (!file.type.startsWith('image/')) {
      alert('JPEG 또는 PNG 이미지만 업로드 가능합니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하로 제한됩니다.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
    updateField('userPhotoBlob', file as unknown as Blob);
  }

  // ─── 시작 버튼 ────────────────────────────────
  function handleStart() {
    if (!productInfo.name) {
      alert('제품 정보를 입력해 주세요.');
      return;
    }
    if (!photoPreview) {
      alert('제품 사진을 업로드해 주세요.');
      return;
    }
    if (!affiliateUrl) {
      alert('제휴 링크를 입력해 주세요.');
      return;
    }
    updateField('status', 'editing');
    router.push(`/project/${projectId}/storyboard`);
  }

  // ─── 카테고리 목록 ─────────────────────────────
  const categories = ['주방용품', '가전', '가구/인테리어', '생활소품', '식품', '뷰티/건강', '기타'];

  return (
    <>
      <Header title="새 카드뉴스" showSaveStatus projectId={projectId} />

      <main className={styles.main}>
        <div className={styles.card}>
          <h2 className={styles.stepTitle}>📎 새 카드뉴스 만들기</h2>

          {/* STEP 1: 제품 URL */}
          <section className={styles.section}>
            <label className={styles.label} htmlFor="product-url">STEP 1. 제품 URL</label>
            <div className={styles.urlRow}>
              <input
                id="product-url"
                name="product-url"
                type="url"
                className={`input ${styles.urlInput}`}
                placeholder="쿠팡 제품 URL을 붙여넣으세요"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onPaste={() => setTimeout(handleExtract, 100)}
              />
              <button
                className="btn btn--primary"
                onClick={handleExtract}
                disabled={extracting || !url.trim()}
              >
                {extracting ? '추출 중...' : '정보 추출'}
              </button>
            </div>
            {extractError && <p className={styles.errorText}>{extractError}</p>}
          </section>

          {/* 추출된 제품 정보 */}
          {productInfo.name && (
            <section className={`${styles.section} ${styles.infoCard}`}>
              <span className={styles.label}>📦 제품 정보</span>
              <div className={styles.infoGrid}>
                <div className={styles.infoField}>
                  <label className={styles.infoLabel} htmlFor="product-name">제품명</label>
                  <input
                    id="product-name"
                    name="product-name"
                    type="text"
                    className="input input--ko"
                    value={productInfo.name}
                    onChange={(e) => {
                      setProductInfo({ ...productInfo, name: e.target.value });
                      updateField('productName', e.target.value);
                      updateField('title', e.target.value);
                    }}
                  />
                </div>
                <div className={styles.infoField}>
                  <label className={styles.infoLabel} htmlFor="product-price">가격</label>
                  <input
                    id="product-price"
                    name="product-price"
                    type="text"
                    className="input"
                    value={productInfo.price}
                    onChange={(e) => {
                      setProductInfo({ ...productInfo, price: e.target.value });
                      updateField('productPrice', e.target.value);
                    }}
                  />
                </div>
                <div className={styles.infoField}>
                  <label className={styles.infoLabel} htmlFor="product-category">카테고리</label>
                  <select
                    id="product-category"
                    name="product-category"
                    className="input"
                    value={productInfo.category}
                    onChange={(e) => {
                      setProductInfo({ ...productInfo, category: e.target.value });
                      updateField('productCategory', e.target.value);
                    }}
                  >
                    <option value="">선택</option>
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              {productInfo.specs.length > 0 && (
                <div className={styles.specs}>
                  {productInfo.specs.map((spec, i) => (
                    <span key={i} className={styles.specTag}>{spec}</span>
                  ))}
                </div>
              )}

              {/* Claude 추출 카피라이팅 데이터 */}
              {(keyFeatures.length > 0 || copyPoints.length > 0) && (
                <div className={styles.copySection}>
                  {keyFeatures.length > 0 && (
                    <div className={styles.copyGroup}>
                      <span className={styles.copyGroupLabel}>핵심 기능</span>
                      <div className={styles.specs}>
                        {keyFeatures.map((f, i) => (
                          <span key={i} className={styles.featureTag}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {copyPoints.length > 0 && (
                    <div className={styles.copyGroup}>
                      <span className={styles.copyGroupLabel}>✍️ 카피라이팅 소구점</span>
                      <ol className={styles.copyList}>
                        {copyPoints.map((pt, i) => (
                          <li key={i} className={styles.copyItem}>{pt}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {targetAudience && (
                    <p className={styles.targetAudience}>👥 타겟: {targetAudience}</p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* 제휴 링크 */}
          <section className={styles.section}>
            <div className={styles.label}>
              STEP 2. 제휴 링크
              <div className={styles.modeToggle}>
                <button
                  className={`${styles.modeBtn} ${affiliateMode === 'auto' ? styles.modeBtnActive : ''}`}
                  onClick={() => setAffiliateMode('auto')}
                >
                  자동 생성
                </button>
                <button
                  className={`${styles.modeBtn} ${affiliateMode === 'manual' ? styles.modeBtnActive : ''}`}
                  onClick={() => setAffiliateMode('manual')}
                >
                  직접 입력
                </button>
              </div>
            </div>

            {affiliateMode === 'auto' ? (
              <div className={styles.affiliateAuto}>
                {affiliateLoading ? (
                  <p className={styles.loadingText}>🔄 제휴 링크 생성 중...</p>
                ) : affiliateError ? (
                  <div className={styles.affiliateError}>
                    <p>⚠️ {affiliateError}</p>
                    <p className={styles.affiliateHelp}>
                      <a href="https://partners.coupang.com" target="_blank" rel="noopener noreferrer">
                        쿠팡 파트너스에서 직접 생성하기 →
                      </a>
                    </p>
                  </div>
                ) : affiliateUrl ? (
                  <div className={styles.affiliateSuccess}>
                    <span>✅</span>
                    <input id="affiliate-url-display" name="affiliate-url-display" type="url" className="input" value={affiliateUrl} readOnly />
                  </div>
                ) : (
                  <p className={styles.helpText}>제품 URL 추출 시 자동으로 생성됩니다</p>
                )}
              </div>
            ) : (
              <input
                id="affiliate-url"
                name="affiliate-url"
                type="url"
                className="input"
                placeholder="쿠팡 파트너스 제휴 링크를 붙여넣으세요"
                value={affiliateUrl}
                onChange={(e) => {
                  setAffiliateUrl(e.target.value);
                  updateField('affiliateUrl', e.target.value);
                }}
              />
            )}
          </section>

          {/* 사진 업로드 */}
          <section className={styles.section}>
            <label className={styles.label} htmlFor="photo-input">STEP 3. 제품 실물 사진</label>
            <div
              className={`${styles.dropzone} ${photoPreview ? styles.dropzoneHasPhoto : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handlePhotoDrop}
              onClick={() => document.getElementById('photo-input')?.click()}
            >
              {photoPreview ? (
                <div className={styles.photoPreview}>
                  <img src={photoPreview} alt="제품 사진" className={styles.photoImg} />
                  <div className={styles.photoCropGuide}>
                    <span>4:5</span>
                  </div>
                </div>
              ) : (
                <div className={styles.dropzoneContent}>
                  <span className={styles.dropzoneIcon}>📷</span>
                  <p>드래그하거나 클릭하여</p>
                  <p>제품 사진 업로드</p>
                  <p className={styles.dropzoneHint}>(1080×1350 / 4:5 권장, 최대 10MB)</p>
                </div>
              )}
            </div>
            <input
              id="photo-input"
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />
          </section>

          {/* 시작 버튼 */}
          <button className="btn btn--primary btn--full btn--lg" onClick={handleStart}>
            ✨ 카드뉴스 생성 시작 →
          </button>
        </div>
      </main>
    </>
  );
}
