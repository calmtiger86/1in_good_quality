/**
 * AI 이미지 생성 API Route — fal.ai Flux
 * POST /api/generate-image
 *
 * Body:  { prompt: string }
 * Response:
 *   200  { imageUrl: string }
 *   503  { error: string, stub: true }   ← API 키 미설정 → 스토리보드가 수동 모드로 전환
 *   400  { error: string }               ← 잘못된 요청
 *   500  { error: string }               ← 생성 실패
 *
 * 환경변수:
 *   IMAGE_GEN_API_KEY — fal.ai API 키 (fal.ai 콘솔에서 발급)
 *   IMAGE_GEN_API_URL — fal.ai 모델 엔드포인트
 *                       빠른 생성: https://fal.run/fal-ai/flux/schnell
 *                       고품질:   https://fal.run/fal-ai/flux-pro/v1.1
 *
 * fal.ai 인증:  Authorization: Key {api_key}
 * fal.ai 응답: { images: [{ url: string, width: number, height: number }] }
 *
 * 비율 검증: OpenSpec §4.1 #1 — 1080×1350 (4:5) 범위 이탈 시 최대 3회 재시도
 */

import { NextResponse } from 'next/server';

export const maxDuration = 60; // Vercel 함수 최대 실행 시간 (초)

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const RATIO_TOLERANCE = 10; // ±10px 허용
const MAX_RETRIES = 3;
const DEFAULT_API_URL = 'https://fal.run/fal-ai/flux/schnell';

export async function POST(request: Request) {
  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '요청 본문을 파싱할 수 없습니다.' }, { status: 400 });
  }

  const { prompt } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'prompt가 필요합니다.' }, { status: 400 });
  }

  const apiKey = process.env.IMAGE_GEN_API_KEY;
  const apiUrl = process.env.IMAGE_GEN_API_URL || DEFAULT_API_URL;

  // API 키 미설정: stub: true로 프론트엔드가 수동 입력 UI 전환
  if (!apiKey) {
    return NextResponse.json(
      {
        imageUrl: null,
        error: 'IMAGE_GEN_API_KEY가 설정되지 않았습니다. .env.local에 fal.ai 키를 추가하세요.',
        stub: true,
      },
      { status: 503 }
    );
  }

  // 비율 검증 포함 재시도 루프 (OpenSpec §4.1 #1)
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // fal.ai 인증 형식: "Key {api_key}"
          Authorization: `Key ${apiKey}`,
        },
        // fal.ai 요청 형식
        body: JSON.stringify({
          prompt: prompt.trim(),
          image_size: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
          num_images: 1,
          num_inference_steps: 4,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (attempt === MAX_RETRIES) {
          return NextResponse.json(
            { error: `fal.ai API 오류 (${response.status}): ${errText}` },
            { status: 500 }
          );
        }
        continue;
      }

      // fal.ai 응답: { images: [{ url, width, height }] }
      const data = (await response.json()) as {
        images?: Array<{ url?: string; width?: number; height?: number }>;
        // 일반 API 호환: imageUrl 또는 url 필드도 지원
        imageUrl?: string;
        url?: string;
      };

      const imageUrl =
        data.images?.[0]?.url ?? data.imageUrl ?? data.url;

      if (!imageUrl) {
        if (attempt === MAX_RETRIES) {
          return NextResponse.json({ error: 'API 응답에 imageUrl이 없습니다.' }, { status: 500 });
        }
        continue;
      }

      // 비율 검증 (fal.ai는 image_size 직접 지정이므로 응답 메타 우선 사용)
      const returnedWidth = data.images?.[0]?.width;
      const returnedHeight = data.images?.[0]?.height;
      if (returnedWidth && returnedHeight) {
        const wOk = Math.abs(returnedWidth - CANVAS_WIDTH) <= RATIO_TOLERANCE;
        const hOk = Math.abs(returnedHeight - CANVAS_HEIGHT) <= RATIO_TOLERANCE;
        if (!wOk || !hOk) {
          if (attempt < MAX_RETRIES) continue;
          // 마지막 시도에서도 비율 이탈이면 경고만 하고 반환
        }
      }

      return NextResponse.json({ imageUrl });
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        return NextResponse.json({ error: `이미지 생성 실패: ${message}` }, { status: 500 });
      }
    }
  }

  return NextResponse.json(
    { error: `${MAX_RETRIES}회 재시도 후에도 유효한 이미지를 생성하지 못했습니다.` },
    { status: 500 }
  );
}
