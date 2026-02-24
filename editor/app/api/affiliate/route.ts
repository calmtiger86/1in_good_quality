/**
 * 쿠팡 파트너스 제휴 링크 API Route
 * POST /api/affiliate
 *
 * Body:  { productUrl: string }
 * Response:
 *   200  { affiliateUrl: string }
 *   400  { error: string }                        ← 잘못된 요청
 *   503  { error: string, fallback: true }        ← API 키 미설정 → 수동입력 UI 전환
 *   500  { error: string, fallback: true }        ← API 오류 → 수동입력 UI 전환
 *
 * 환경변수:
 *   COUPANG_PARTNERS_ACCESS_KEY  — 쿠팡 파트너스 액세스 키
 *   COUPANG_PARTNERS_SECRET_KEY  — HMAC-SHA256 서명용 시크릿 키
 *
 * 인증 방식:
 *   CEA (Coupang External API) — HMAC-SHA256
 *   Authorization: CEA algorithm=HmacSHA256, access-key={KEY}, signed-date={DATE}, signature={SIG}
 *   서명 대상: "{METHOD}\n{URI}\n{DATE}"
 *
 * 보안 주의:
 *   SECRET_KEY를 절대 로깅하거나 클라이언트에 노출하지 마세요.
 *   이 파일은 서버 전용 (Next.js API Route) — 클라이언트 번들에 포함되지 않습니다.
 */

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const COUPANG_API_HOST = 'api.coupang.com';
const DEEPLINK_PATH =
  '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';

export async function POST(request: Request) {
  let body: { productUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문을 파싱할 수 없습니다.' }, { status: 400 });
  }

  const { productUrl } = body;

  if (!productUrl || typeof productUrl !== 'string' || productUrl.trim().length === 0) {
    return NextResponse.json({ error: '제품 URL이 필요합니다.' }, { status: 400 });
  }

  // URL 프리픽스 검증 (보안: 쿠팡 도메인만 허용)
  const trimmedUrl = productUrl.trim();
  if (!trimmedUrl.startsWith('https://www.coupang.com/')) {
    return NextResponse.json(
      { error: '쿠팡(https://www.coupang.com/) URL만 지원합니다.' },
      { status: 400 }
    );
  }

  const accessKey = process.env.COUPANG_PARTNERS_ACCESS_KEY;
  const secretKey = process.env.COUPANG_PARTNERS_SECRET_KEY;

  // API 키 미설정 → 프론트엔드가 fallback: true를 감지하여 수동입력 UI로 전환
  if (!accessKey || !secretKey) {
    return NextResponse.json(
      {
        error:
          'COUPANG_PARTNERS_ACCESS_KEY 또는 COUPANG_PARTNERS_SECRET_KEY가 설정되지 않았습니다.',
        fallback: true,
      },
      { status: 503 }
    );
  }

  try {
    const affiliateUrl = await generateCoupangAffiliateLink(
      trimmedUrl,
      accessKey,
      secretKey
    );
    return NextResponse.json({ affiliateUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    // API 오류도 fallback: true — 수동입력 UI로 전환
    return NextResponse.json(
      { error: `제휴 링크 생성 실패: ${message}`, fallback: true },
      { status: 500 }
    );
  }
}

// ─── 쿠팡 파트너스 HMAC-SHA256 인증 ──────────────────

async function generateCoupangAffiliateLink(
  productUrl: string,
  accessKey: string,
  secretKey: string
): Promise<string> {
  const method = 'POST';
  const date = formatCoupangDate(new Date());
  const signature = buildHmacSignature(method, DEEPLINK_PATH, date, secretKey);

  const authorization =
    `CEA algorithm=HmacSHA256, access-key=${accessKey}, ` +
    `signed-date=${date}, signature=${signature}`;

  const response = await fetch(`https://${COUPANG_API_HOST}${DEEPLINK_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      Authorization: authorization,
    },
    body: JSON.stringify({ coupangUrls: [productUrl] }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`쿠팡 API ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ shortenUrl?: string }>;
    rtnCode?: string;
    rtnMessage?: string;
  };

  if (data.rtnCode && data.rtnCode !== '200') {
    throw new Error(`쿠팡 API 오류: ${data.rtnMessage || data.rtnCode}`);
  }

  const shortenUrl = data.data?.[0]?.shortenUrl;
  if (!shortenUrl) {
    throw new Error('응답에서 shortenUrl을 찾을 수 없습니다.');
  }

  return shortenUrl;
}

/**
 * HMAC-SHA256 서명 생성
 * 서명 대상: "{METHOD}\n{URI_PATH}\n{DATE}"
 */
function buildHmacSignature(
  method: string,
  path: string,
  date: string,
  secretKey: string
): string {
  const message = `${method}\n${path}\n${date}`;
  return createHmac('sha256', secretKey).update(message).digest('hex');
}

/**
 * 쿠팡 API 날짜 포맷: yyMMddHHmmss
 */
function formatCoupangDate(date: Date): string {
  const yy = String(date.getFullYear()).slice(2);
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yy}${MM}${dd}${HH}${mm}${ss}`;
}
