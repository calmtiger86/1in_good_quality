# Antigravity — 1iN 일인양품 카드뉴스 시스템

**프로젝트 코드명:** The Affairs
**OpenSpec 버전:** v6.6
**대상 플랫폼:** Instagram Feed 1080×1350 (4:5)
**세션 재개 시:** `HANDOFF.md` → `openspec.md` 순서로 읽을 것

---

## 모노레포 구조

```
Antigravity/
├── editor/           → Next.js 14 웹 에디터 (주 작업 영역, 대부분 구현 완료)
├── agent/            → (예정 P3) Python 에이전트 오케스트레이션
│   ├── agents/       → scout / data / content / image / layout / qa / pack
│   └── pipelines/    → full_pipeline.py (7 에이전트 순차 실행)
├── shared/           → (예정 P3) storyboard.schema.json
├── CLAUDE.md         → 이 파일 (세션 시작 시 자동 로드)
├── HANDOFF.md        → 세션 상태 / 진행 현황
└── openspec.md       → 디자인 전체 규격 (항상 참조)
```

---

## 기술 스택 (editor/)

| 항목 | 값 |
|------|-----|
| 프레임워크 | Next.js 14.2 (App Router) |
| 언어 | TypeScript (strict: true) |
| 상태 관리 | Zustand — `stores/projectStore.ts` |
| 로컬 저장 | Dexie.js (IndexedDB) — `lib/db.ts` |
| 스타일 | CSS Modules + CSS variables — `styles/variables.css` |
| 캔버스 | **커스텀 HTML5 Canvas** (Fabric.js 미사용) |
| 내보내기 | JSZip + file-saver |
| 배포 | Vercel |
| 패키지 관리 | **npm** (yarn/pnpm 금지) |

---

## 빌드·테스트 명령 (editor/ 기준)

```bash
npm run dev          # 개발 서버 :3000
npm run build        # 프로덕션 빌드 (배포 전 필수 통과)
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npm test             # Jest 단위 테스트 (P1-7 이후)
```

---

## 금지 패턴 (절대 수행 금지)

1. **`extract/route.ts` 수정 시 보안 검토 필수**
   - `execSync(curl ...)` + 사용자 URL 패턴 — shell injection 위험
   - 현재 `'` → `'\''` 이스케이프만 처리됨
   - Firecrawl(P3) 이전 전까지 URL이 `https://www.coupang.com/` 프리픽스인지 반드시 검증

2. **API 키를 코드에 하드코딩 금지** — `process.env.변수명`만 사용, 서버 컴포넌트/라우트 핸들러에서만

3. **`node_modules/`, `.next/`, `.env.local` 커밋 금지** — `.gitignore` 확인 후 `git add`

4. **`git push --force` to main 금지**

5. **Dexie `db`를 `lib/db.ts` 외부에서 직접 import 금지** — 반드시 exported helper function 경유

6. **클라이언트 컴포넌트에서 `process.env` 직접 참조 금지** — `NEXT_PUBLIC_` prefix만 클라이언트에 노출됨

---

## 현재 구현 상태 (2026-02-24 기준)

### 완료

| 파일/기능 | 상태 |
|---------|------|
| 대시보드 (STEP 0) | ✅ 완료 |
| 입력 페이지 (STEP 1) | ✅ 완료 |
| 스토리보드 (STEP 2) | ✅ 완료 |
| 캔버스 에디터 (STEP 4) | ✅ 완료 (922줄) |
| 미리보기+QA (STEP 5) | ✅ 완료 |
| 배포+내보내기 (STEP 6) | ✅ 완료 |
| lib/db.ts | ✅ Dexie CRUD 완료 |
| lib/openspec.ts | ✅ 디자인 상수 전체 |
| lib/variation.ts | ✅ 변주 알고리즘 3종 |
| stores/projectStore.ts | ✅ Zustand + 2초 자동저장 |
| app/api/extract/route.ts | ✅ 쿠팡 HTML 파싱 (curl) |

### 미구현 / 스텁

| 파일/기능 | 상태 | 담당 작업 |
|---------|------|---------|
| `app/api/affiliate/route.ts` | ⚠️ mock 스텁 | P1-6 |
| `app/api/generate-image/route.ts` | ❌ 파일 없음 | P1-5 스텁, P3-4 실구현 |
| `lib/qa-checker.ts` | ❌ preview/page.tsx에 인라인 | P1-3 |
| `lib/prompt-builder.ts` | ❌ 파일 없음 | P1-4 |
| Jest + 단위 테스트 | ❌ 미설치 | P1-7 |
| `.github/workflows/ci.yml` | ❌ 없음 | P2-1 |

---

## 에이전트 파이프라인 구조 (P3 이후)

```
사용자가 하는 것: 쿠팡 URL + 사진 제공 → 최종 인스타그램 업로드
에이전트가 하는 것: 아래 7단계 자동 실행

Scout   → Data   → Content  → Image  → Layout → QA   → Pack
(탐색)    (파싱)    (JSON생성)  (일러스트)  (조립)    (검증)  (출력)
```

통합 계약(Contract): `storyboard.json` 스키마 (`shared/storyboard.schema.json`)

---

## OpenSpec 핵심 규칙 (빠른 참조)

```
캔버스:   1080×1350 (4:5), safe margin 24px
배경:     kraft #C4A882 ↔ white #FFFFFF 교차
슬라이드: hook → agitation → solution(3~8) → photo_card → cta
화풍:     Noritake 스타일 — 머리카락만 솔리드 블랙 필, 나머지 아웃라인만
변주:     텍스트패턴/구도 연속 금지, 배경 3연속 금지, 인접 슬라이드 최소 2축 차이
캡션:     최대 2200자, 2000자 경고 / 해시태그 5~7개
로고:     모든 슬라이드 좌상단 고정 (60~80px), 배경별 색상 자동 전환
```

전체 규격: `openspec.md` 참조

---

## 환경변수 목록

`.env.example` 참조. 실제 값은 `editor/.env.local`에 저장 (커밋 금지).

| 변수 | 사용처 |
|------|-------|
| `COUPANG_PARTNERS_ACCESS_KEY` | affiliate/route.ts |
| `COUPANG_PARTNERS_SECRET_KEY` | affiliate/route.ts |
| `COUPANG_PARTNERS_VENDOR_ID` | affiliate/route.ts |
| `IMAGE_GEN_API_KEY` | generate-image/route.ts |
| `IMAGE_GEN_API_URL` | generate-image/route.ts |
| `FIRECRAWL_API_KEY` | P3 agent/agents/scout.py |
| `NEXT_PUBLIC_APP_URL` | 공개 URL (클라이언트 접근 가능) |
