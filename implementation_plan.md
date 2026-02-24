# 카드뉴스 에디터 — 통합 구현 계획서

## 목표

OpenSpec v6.6 기반 **일인양품 카드뉴스 에디터 웹 애플리케이션**을 구축한다.
제품 URL 입력부터 인스타그램 배포까지 전 과정을 하나의 웹앱에서 완결한다.

---

## 전체 플로우

```
STEP 0      STEP 1     STEP 2           STEP 4       STEP 5      STEP 6
대시보드 ──→ 입력 ──→ 스토리보드+생성 ──→ 카드 편집 ──→ 미리보기 ──→ 배포
(홈)       URL+사진   텍스트+AI일러스트   WYSIWYG      +QA검증    +내보내기
  ↑          +제휴링크  +변주규칙                        │
  │                     │                              │
  │                     └────── 개별 편집 ───────────────┘
  │                                                    │
  └──────────── 프로젝트 재진입 / JSON Import ──────────┘
```

---

## 기술 스택 (제안)

> [!IMPORTANT]
> 아래 기술 스택은 제안이며, 사용자 승인 후 확정합니다.

| 계층 | 기술 | 근거 |
|------|------|------|
| **프레임워크** | Next.js 14 (App Router) | SSR + API Routes + 파일 기반 라우팅 |
| **언어** | TypeScript | 타입 안전성, 에디터 복잡도 관리 |
| **스타일** | Vanilla CSS (CSS Modules) | OpenSpec 준수, 사용자 선호 |
| **캔버스 엔진** | Fabric.js | WYSIWYG 카드 에디터용 2D 캔버스 |
| **상태 관리** | Zustand | 경량, 프로젝트/슬라이드 상태 |
| **저장소** | IndexedDB (Dexie.js) | 로컬 자동 저장, 오프라인 지원 |
| **이미지 생성** | 외부 API (Nano Banana 등) | OpenSpec §5 프롬프트 규격 |
| **제휴 링크** | 쿠팡 파트너스 API | 자동 생성 + 수동 폴백 |
| **폰트** | NanumSquare + Inter (Google Fonts) | OpenSpec §4.4 |
| **내보내기** | html2canvas + JSZip | PNG 렌더링 + ZIP 패키징 |
| **배포** | Vercel | Next.js 최적 호스팅 |

---

## 페이지별 구현 상세

### STEP 0 — 대시보드 (홈)

**경로:** `/`

| 컴포넌트 | 기능 |
|---------|------|
| **ProjectList** | 저장된 프로젝트 카드 리스트 (썸네일 + 제목 + 상태 + 날짜) |
| **StatusFilter** | 전체 / 작업 중 / 완료 / 배포됨 필터 탭 |
| **NewProjectButton** | "새 카드뉴스 만들기" → STEP 1 이동 |
| **ImportJSON** | "JSON 불러오기" → storyboard.json import → 기존 프로젝트 재편집 |
| **VOLCounter** | 현재 VOL 번호 표시 (마지막 프로젝트 VOL+1 자동 채번) |

---

### STEP 1 — 입력

**경로:** `/project/new` 또는 `/project/[id]/input`

| 컴포넌트 | 기능 |
|---------|------|
| **URLInput** | 쿠팡 URL 입력 필드 + "추출" 버튼 |
| **ProductInfoCard** | 추출 결과 표시 (제품명·가격·카테고리·스펙, 각 필드 편집 가능) |
| **AffiliateLink** | 쿠팡 파트너스 API로 자동 생성. 실패 시 "직접 입력" 폴백 필드 전환 |
| **PhotoUpload** | 드래그&드롭 + 클릭 업로드. 업로드 후 4:5 크롭 가이드 |
| **CropPreview** | 4:5 프레임 내 위치 조정 |
| **ErrorFallback** | URL 파싱 실패 → 수동 입력 폼 자동 전환 |
| **StartButton** | "카드뉴스 생성 시작 →" CTA |

**제휴 링크 플로우:**
```
URL 입력 → 쿠팡 파트너스 API 호출
              ├─ 성공 → 제휴 링크 자동 채움 (편집 가능)
              └─ 실패 → "자동 생성 실패" 안내 + 수동 입력 필드 표시
                        + "쿠팡 파트너스에서 직접 생성하기" 외부 링크
```

---

### STEP 2 — 스토리보드 + 일러스트 생성

**경로:** `/project/[id]/storyboard`

| 컴포넌트 | 기능 |
|---------|------|
| **SlideList** (좌측) | 드래그&드롭 슬라이드 카드 리스트 + 상태 아이콘 + 우클릭 메뉴(복제/삭제) |
| **CanvasPreview** (중앙) | 선택된 슬라이드 축소 미리보기 + 인라인 텍스트 편집 |
| **PropertyPanel** (우측) | 텍스트 편집 / 레이아웃 선택 / 변주 검증 상태 |
| **VariationBar** (하단) | 전체 Solution 슬라이드 변주 현황 한 줄 표시 |
| **BatchGenerate** | "전체 일러스트 일괄 생성" 버튼 |
| **GenerationProgress** | 슬라이드별 생성 진행률 바 + 예상 소요 시간 |
| **BatchStyleChange** | "전체 설정" 메뉴 → 전체 배경 통일 / 변주 재셔플 |
| **AddSlide** | Solution 추가 (최대 8장) |
| **DuplicateSlide** | 선택 카드 복제 (우클릭 또는 버튼) |
| **VOLEditor** | Hook 선택 시 VOL 번호 편집 (자동 채번 + 수동 오버라이드) |

**일러스트 생성 로딩 UI:**
```
[슬라이드 3] ████████░░░░ 70%  예상 12초
[슬라이드 4] ░░░░░░░░░░░░ 대기 중
[슬라이드 5] ✅ 완료
[슬라이드 6] ❌ 실패 [재시도] [프롬프트 수정] [건너뛰기]
```

**슬라이드 복제 동작:**
- Solution 카드 선택 → 복제 → 텍스트 복사 + 일러스트는 "미생성" 상태
- 변주 축 자동 재배정 (연속 반복 금지 규칙 적용)

---

### STEP 4 — 카드 에디터

**경로:** `/project/[id]/editor/[slideIndex]`

| 컴포넌트 | 기능 |
|---------|------|
| **Toolbar** | 선택/가로텍스트/세로텍스트/사각형/이미지교체/되돌리기 |
| **FabricCanvas** | 1080×1350 Fabric.js 캔버스 + 스냅 가이드 + 세이프존 |
| **LogoLayer** | 좌측 상단 로고 자동 배치 (잠금, 배경별 색상 전환) |
| **PropertyPanel** | 선택 요소별 속성 편집 (위치/크기/폰트/색상/방향) |
| **LayerPanel** | 레이어 순서 관리 (로고·배경 잠금) |
| **WhitespaceGauge** | 실시간 여백 비율 표시 (50% 미만 경고) |
| **InfoStripTool** | 패턴 C용 하단 3칼럼 스펙 바 자동 생성 |

---

### STEP 5 — 미리보기 + QA 검증

**경로:** `/project/[id]/preview`

| 컴포넌트 | 기능 |
|---------|------|
| **SlideshowViewer** | 좌우 스와이프/버튼으로 카드 순회 + 자동 재생 |
| **AllCardsView** | 전체 카드 가로 나열 + 변주 태그 |
| **CoverGridPreview** | Hook 표지 1장이 프로필 그리드에서 어떻게 보이는지 미리보기 |
| **QAPanel** | §10 자동 검증 결과 (비율/로고/화풍/톤/변주 18항목) |
| **QAWarningLink** | 경고 항목 클릭 → 해당 카드 에디터로 바로 이동 |
| **ThumbnailStrip** | 하단 고정 썸네일 + 상태 아이콘 |

> STEP 5에는 다운로드/캡션 기능 없음 — 모두 STEP 6으로 분리

---

### STEP 6 — 배포 + 내보내기

**경로:** `/project/[id]/publish`

| 컴포넌트 | 기능 |
|---------|------|
| **InstagramCard** | 캡션 편집 + 글자수 카운터(187/2,200) + 클립보드 복사 + 이미지 일괄 저장 |
| **WebViewerCard** | 공유 링크 + QR 코드 + 임베드 코드 |
| **DownloadCard** | ZIP 일괄 / 개별 PNG / storyboard.json 다운로드 |
| **PublishSummary** | 제품명·슬라이드 수·제휴링크·웹뷰어URL·생성일 요약 |
| **CharCounter** | 인스타 캡션 실시간 글자수 (2,000자 노란 경고, 2,200자 빨간 에러) |

---

## 공통 인프라

### 저장 / 자동 저장

| 항목 | 구현 |
|------|------|
| **저장소** | IndexedDB (Dexie.js) — 브라우저 로컬 |
| **자동 저장** | 변경 감지 후 2초 debounce → IndexedDB 저장 |
| **상태 표시** | 헤더 우측: "✅ 저장됨" / "💾 저장 중..." / "⚠️ 저장 실패" |
| **프로젝트 구조** | `{ id, title, vol, status, slides[], caption, createdAt, updatedAt }` |

### 오류 처리

| 상황 | UX |
|------|-----|
| URL 파싱 실패 | 수동 입력 폼 전환 + 안내 |
| 제휴 링크 API 실패 | "직접 입력" 필드 표시 + 외부 링크 |
| 이미지 생성 실패 | [재시도] [프롬프트 수정] [건너뛰기] 3선택지 |
| 네트워크 끊김 | 상단 배너 "오프라인 상태" + 로컬 저장 계속 |
| 사진 업로드 오류 | 파일 형식(JPEG/PNG)/크기(10MB) 안내 |

### 로딩 UI 패턴

| 작업 | 로딩 UI |
|------|---------|
| URL 데이터 추출 | 스켈레톤 카드 + 스피너 (3~5초) |
| 제휴 링크 생성 | 인라인 스피너 + "생성 중..." (2~3초) |
| 일러스트 1장 생성 | 프로그레스 바 + 예상 시간 (10~30초) |
| 일괄 생성 (7장) | 슬라이드별 개별 프로그레스 (1~3분) |
| PNG 내보내기 | 프로그레스 바 + "N/8장 완료" |

---

## API 연동

### 쿠팡 파트너스 API

```
POST /api/affiliate
Body: { productUrl: "https://www.coupang.com/..." }
Headers: { Authorization: "Bearer {COUPANG_API_KEY}" }
Response: { affiliateUrl: "https://link.coupang.com/..." }
Fallback: 실패 시 수동 입력 UI 전환
```

### 이미지 생성 API

```
POST /api/generate-image
Body: { prompt: "{STYLE_PREFIX}+{SCENE}+{RATIO_SUFFIX}", width: 1080, height: 1350 }
Response: { imageUrl: "...", width: 1080, height: 1350 }
Validation: 비율 4:5 검증 → 이탈 시 자동 재생성 (최대 3회)
```

---

## 파일 구조 (제안)

```
src/
├── app/
│   ├── page.tsx                    # STEP 0: 대시보드
│   ├── project/
│   │   ├── new/page.tsx            # STEP 1: 입력
│   │   └── [id]/
│   │       ├── storyboard/page.tsx # STEP 2: 스토리보드
│   │       ├── editor/
│   │       │   └── [slide]/page.tsx # STEP 4: 카드 에디터
│   │       ├── preview/page.tsx    # STEP 5: 미리보기
│   │       └── publish/page.tsx    # STEP 6: 배포
│   └── api/
│       ├── affiliate/route.ts     # 쿠팡 파트너스 API Proxy
│       ├── generate-image/route.ts # 이미지 생성 API Proxy
│       └── extract-product/route.ts # URL 파싱 API
├── components/
│   ├── common/             # 로고, 헤더, 저장상태, 에러바운더리
│   ├── dashboard/           # 프로젝트 리스트, 필터
│   ├── input/              # URL입력, 사진업로드, 크롭
│   ├── storyboard/         # 슬라이드리스트, 프로퍼티패널, 변주바
│   ├── editor/             # Fabric 캔버스, 툴바, 레이어
│   ├── preview/            # 슬라이드쇼, QA패널
│   └── publish/            # 캡션편집, 웹뷰어, 다운로드
├── stores/
│   ├── projectStore.ts     # Zustand 프로젝트 상태
│   └── editorStore.ts      # Zustand 에디터 상태
├── lib/
│   ├── db.ts               # Dexie.js IndexedDB
│   ├── openspec.ts         # OpenSpec 규칙 상수 + 검증 함수
│   ├── variation.ts        # §4.7 변주 알고리즘
│   ├── prompt-builder.ts   # §5 프롬프트 조립
│   └── qa-checker.ts       # §10 QA 자동 검증
├── assets/
│   └── logo/
│       ├── 1in_logo_white.png
│       └── 1in_logo_kraft.png
└── styles/
    ├── globals.css
    └── variables.css        # OpenSpec 컬러/폰트 토큰
```

---

## 구현 순서

| 순번 | 대상 | 핵심 산출물 | 의존성 |
|------|------|-----------|--------|
| 1 | 프로젝트 초기 설정 | Next.js + 폴더 구조 + 공통 레이아웃 | - |
| 2 | 공통 인프라 | IndexedDB 저장, 자동저장, 에러처리, 로딩UI | 1 |
| 3 | STEP 0 대시보드 | 프로젝트 CRUD, 필터, JSON Import | 2 |
| 4 | STEP 1 입력 | URL 파싱, 제휴 링크 API, 사진 업로드 | 2 |
| 5 | STEP 2 스토리보드 | 슬라이드 관리, 변주 엔진, AI 생성, 일괄생성 | 3, 4 |
| 6 | STEP 4 카드 에디터 | Fabric.js 캔버스, 로고 배치, 레이어 | 5 |
| 7 | STEP 5 미리보기 | 슬라이드쇼, QA 검증 엔진 | 6 |
| 8 | STEP 6 배포 | PNG 내보내기, 캡션, 웹 뷰어, ZIP | 7 |

---

## 검증 계획

### 자동 테스트

| 테스트 | 대상 | 방법 |
|-------|------|------|
| 변주 알고리즘 | `lib/variation.ts` | Jest 단위 테스트: 연속 반복 금지, 최소 2축 차이 검증 |
| QA 검증기 | `lib/qa-checker.ts` | Jest 단위 테스트: §10 18항목 각각 통과/실패 케이스 |
| 프롬프트 빌더 | `lib/prompt-builder.ts` | Jest: STYLE_PREFIX + RATIO_SUFFIX 포함 확인 |
| OpenSpec 상수 | `lib/openspec.ts` | Jest: 컬러코드, 폰트, 비율 값 정합성 |

### 브라우저 테스트

| 테스트 | 방법 |
|-------|------|
| 전체 플로우 E2E | 브라우저 서브에이전트로: 대시보드 → 입력 → 스토리보드 → (생략) → 미리보기 → 배포 순회 확인 |
| 반응형 | 브라우저 리사이즈: 1280px, 768px에서 레이아웃 깨짐 확인 |
| 자동 저장 | 텍스트 수정 → 2초 후 IndexedDB 확인 → 새로고침 후 복원 확인 |

### 수동 테스트 (사용자)

| 테스트 | 방법 |
|-------|------|
| 쿠팡 URL 파싱 | 실제 쿠팡 제품 URL 3개로 데이터 추출 정확성 확인 |
| 제휴 링크 API | 실제 API 키로 링크 생성 + 리다이렉트 정상 작동 확인 |
| Fabric 캔버스 | 텍스트 드래그/세로텍스트/정보 스트립 등 조작 확인 |
| PNG 품질 | 내보낸 이미지의 해상도·비율·텍스트 선명도 확인 |
