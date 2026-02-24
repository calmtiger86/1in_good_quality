# Session Handoff State

> AI 에이전트: 이 파일을 먼저 읽고 작업을 재개하세요.
> 세션 종료 시 이 파일을 최신 상태로 업데이트하세요.

---

## 마지막 업데이트
2026-02-24 — 쿠팡 가격 추출 버그 수정 완료 (c6cc3b5)

---

## 현재 우선순위
**P3** — Python 에이전트 팀 구성 (scout → data → content → image → layout → qa → pack)

---

## 완료된 작업

### P0 — 첫 커밋 전 인프라 (완료 ✅)
- [x] P0-1: `/.gitignore` — 모노레포용, .env* / node_modules / .next / output/ 포함
- [x] P0-2: `/.env.example`, `/editor/.env.example` — API 키 템플릿
- [x] P0-3: `/CLAUDE.md` — 에이전트 세션 컨텍스트 (기술스택, 금지패턴, 미구현 항목)

### P1 — 배포 전 완료 목록 (완료 ✅)
- [x] P1-1: `/HANDOFF.md` — 이 파일
- [x] P1-2: `editor/package.json` — `"type-check": "tsc --noEmit"` 스크립트 추가됨
- [x] P1-3: `editor/lib/qa-checker.ts` — 14개 항목 (§4.7 변주 규칙 2개 추가)
- [x] P1-4: `editor/lib/prompt-builder.ts` — `buildImagePrompt()` §5 프롬프트 조립
- [x] P1-5: `editor/app/api/generate-image/route.ts` — fal.ai Flux 연동, 비율 검증 포함
- [x] P1-6: `editor/app/api/affiliate/route.ts` — 쿠팡 Partners HMAC-SHA256 실 구현
- [x] P1-7: Jest 설치 + `__tests__/` 단위 테스트 3종 (40개 테스트)

### P2 — 배포 시점 (완료 ✅)
- [x] P2-1: `/.github/workflows/ci.yml` — CI 파이프라인
- [x] P2-2: `/editor/vercel.json` — Vercel 배포 설정
- [x] P2-3: 최초 git 커밋 & GitHub 푸시 (`8a53913`) + Vercel 배포 완료

### 가격 추출 버그 수정 (최신)
- [x] `editor/app/api/extract/route.ts`:
  - Claude Tool schema `required: ['name', 'price']` 변경 (가격 추출 강제)
  - `if (!name)` 블록 외부에 독립 가격 폴백 블록 추가 (항상 실행)
  - 폴백 순서: JSON-LD → extractPrice() → Markdown 3패턴 + 1,000원 필터

### 추가 구현 (이전 세션)
- [x] `editor/app/project/[id]/publish/page.tsx`:
  - ZIP 일괄 다운로드 (JSZip + file-saver, AI 이미지 포함)
  - Web Viewer HTML 생성 (슬라이더 + 구매 버튼, 모바일 스와이프 지원)
- [x] `editor/app/project/[id]/storyboard/page.tsx`:
  - AI 이미지 일괄/개별 생성 UI (`handleGenerateSingle`, `handleGenerateAll`)
  - 진행 상태 바, imagePrompt textarea
- [x] ESLint 오류 5개 수정 → `npm run build` 통과
- [x] `editor/public/assets/logo/` — 로고 PNG 2종 통합 (`ca26f93`)
  - `publish/page.tsx`: renderSlideToBlob() drawImage 전환 (폴백 포함)
  - `editor/[slide]/page.tsx`: renderToPNG() logo 분기 추가

---

## 검증 상태 (최신)

| 항목 | 결과 |
|------|------|
| `npm run type-check` | ✅ 오류 없음 |
| `npm test` | ✅ 40개 통과 (3 suites) |
| `npm run build` | ✅ 빌드 성공 (Warning만, Error 없음) |
| Vercel 배포 | ✅ `https://1in-good-quality.vercel.app` |

---

## 미구현 항목

없음 — P3 에이전트 팀 구성만 남음

---

## 알려진 이슈 / 주의사항

| 파일 | 이슈 |
|------|------|
| `editor/app/api/extract/route.ts` | `execSync(curl ...)` — shell injection 위험. 수정 시 보안 검토 필수 |
| `editor/app/api/generate-image/route.ts` | `IMAGE_GEN_API_KEY` 미설정 시 503 반환 → 스토리보드가 수동 모드 전환 |

---

## 다음 세션 시작 순서
1. 이 파일 읽기
2. `CLAUDE.md` 확인 (기술 스택, 금지 패턴)
3. P3 Python 에이전트 팀 구성 시작 (`agent/` 디렉토리)

---

## 환경 상태
- `.env.local`: 미생성 (`.env.example` 복사 후 실제 값 입력 필요, 로컬 개발용)
- Vercel 프로젝트: ✅ 연결 완료 (`https://1in-good-quality.vercel.app`)
- GitHub 레포: `https://github.com/calmtiger86/1in_good_quality`
- git 커밋: 2개
  - `8a53913` — 최초 커밋 (49파일)
  - `ca26f93` — 로고 PNG 통합
