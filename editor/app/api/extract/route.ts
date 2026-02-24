import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

/**
 * 쿠팡 제품 URL → 제품 정보 추출 API
 * Firecrawl API로 HTML 수집 (봇 감지 우회, JS 렌더링 3초 대기)
 * Claude Haiku로 마크다운 파싱 → 제품 정보 + 카피라이팅 소구점 추출
 * ANTHROPIC_API_KEY 미설정 시 JSON-LD + OG 메타 정규식 폴백
 */
// Vercel 함수 타임아웃: Firecrawl 5초 + Claude ~2초 여유 확보
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { productUrl } = await req.json();

    // URL 검증: 프로토콜 + 도메인 엄격 체크
    if (
      !productUrl ||
      !/^https:\/\/www\.coupang\.com\//.test(productUrl)
    ) {
      return NextResponse.json(
        { error: '유효한 쿠팡 URL을 입력해 주세요. (https://www.coupang.com/ 으로 시작해야 합니다)' },
        { status: 400 }
      );
    }

    if (!process.env.FIRECRAWL_API_KEY) {
      return NextResponse.json(
        { error: 'FIRECRAWL_API_KEY 환경변수가 설정되지 않았습니다.' },
        { status: 503 }
      );
    }

    // ─── Firecrawl API로 쿠팡 페이지 수집 ──────────────
    let html = '';
    let markdown = '';
    try {
      const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: productUrl,
          formats: ['rawHtml', 'markdown'],
          waitFor: 5000,           // JS 렌더링 5초 대기 (쿠팡 가격 렌더링)
          onlyMainContent: false,  // 사이드바 가격/스펙 포함
        }),
      });

      if (!fcRes.ok) {
        return NextResponse.json(
          { error: '페이지를 가져올 수 없습니다. URL을 확인해 주세요.' },
          { status: 502 }
        );
      }

      const fcData = await fcRes.json();
      html     = fcData?.data?.rawHtml  ?? '';
      markdown = fcData?.data?.markdown ?? '';
    } catch {
      return NextResponse.json(
        { error: '페이지를 가져올 수 없습니다. URL을 확인해 주세요.' },
        { status: 502 }
      );
    }

    // markdown이 있으면 rawHtml이 짧아도 진행 (봇 차단 시 rawHtml 비어있을 수 있음)
    if (!markdown && (!html || html.length < 500)) {
      return NextResponse.json(
        { error: '제품 페이지를 파싱할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    let name = '';
    let price = '';
    let originalPrice = '';
    let category = '기타';
    let specs: string[] = [];
    let description = '';
    let keyFeatures: string[] = [];
    let copyPoints: string[] = [];
    let targetAudience = '';
    let rating = '';
    let ratingCount = '';
    let availability = '';

    // ─── Claude API 추출 (ANTHROPIC_API_KEY 설정 시) ───
    if (process.env.ANTHROPIC_API_KEY && markdown) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          tools: [
            {
              name: 'extract_product',
              description: '쿠팡 제품 페이지 마크다운에서 제품 정보와 카드뉴스 카피라이팅 소구점을 추출합니다.',
              input_schema: {
                type: 'object' as const,
                properties: {
                  name: {
                    type: 'string',
                    description: '제품명 (쿠팡/브랜드 접미사 제외)',
                  },
                  price: {
                    type: 'string',
                    description: '현재 판매가 (₩ 포함, 예: ₩29,900)',
                  },
                  originalPrice: {
                    type: 'string',
                    description: '정가/할인 전 가격 (있을 경우만)',
                  },
                  category: {
                    type: 'string',
                    enum: ['주방용품', '가전', '가구/인테리어', '뷰티/건강', '식품', '생활소품', '디지털/가전', '패션', '기타'],
                  },
                  specs: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '핵심 스펙 최대 6개 ("키: 값" 형태)',
                  },
                  description: {
                    type: 'string',
                    description: '제품 한 줄 요약 (50자 이내)',
                  },
                  keyFeatures: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '제품 핵심 기능/특징 3-5개',
                  },
                  copyPoints: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '카드뉴스에 쓸 카피라이팅 소구점 5-7개 (구어체 한국어, 감성적 표현)',
                  },
                  targetAudience: {
                    type: 'string',
                    description: '이 제품의 주 타겟 고객층 (한 줄)',
                  },
                },
                required: ['name'],
              },
            },
          ],
          tool_choice: { type: 'tool', name: 'extract_product' },
          messages: [
            {
              role: 'user',
              content: [
                '다음은 쿠팡 제품 페이지 정보입니다. 제품 정보와 카드뉴스 카피라이팅 포인트를 추출해 주세요. price 필드에는 반드시 ₩로 시작하는 판매가를 입력하세요.',
                (extractMeta(html, 'og:title') || extractTitle(html))
                  ? `[페이지 제목] ${extractMeta(html, 'og:title') || extractTitle(html)}`
                  : '',
                extractMeta(html, 'og:description')
                  ? `[페이지 설명] ${extractMeta(html, 'og:description')}`
                  : '',
                // 가격 관련 줄만 선별해서 별도 컨텍스트로 제공
                (() => {
                  if (!markdown) return '';
                  const priceLines = markdown
                    .split('\n')
                    .filter((l) => /[₩￦원]|가격|판매가|할인|price/i.test(l))
                    .slice(0, 15)
                    .join('\n');
                  return priceLines ? `[가격 정보 섹션]\n${priceLines}` : '';
                })(),
                markdown ? `[페이지 본문]\n${markdown.slice(0, 7500)}` : '',
              ].filter(Boolean).join('\n\n'),
            },
          ],
        });

        const toolResult = msg.content.find((c) => c.type === 'tool_use');
        if (toolResult?.type === 'tool_use') {
          const inp = toolResult.input as Record<string, unknown>;
          name           = String(inp.name           || '');
          price          = String(inp.price          || '');
          originalPrice  = String(inp.originalPrice  || '');
          // Claude가 가격을 못 찾을 때 "<UNKNOWN>", "N/A" 등 플레이스홀더를 반환하는 경우 제거
          // 유효한 가격은 반드시 ₩로 시작해야 함
          if (price && !/^₩[\d,]+/.test(price)) price = '';
          if (originalPrice && !/^₩[\d,]+/.test(originalPrice)) originalPrice = '';
          category       = String(inp.category       || '기타');
          specs          = Array.isArray(inp.specs)       ? (inp.specs       as string[]) : [];
          description    = String(inp.description    || '');
          keyFeatures    = Array.isArray(inp.keyFeatures) ? (inp.keyFeatures as string[]) : [];
          copyPoints     = Array.isArray(inp.copyPoints)  ? (inp.copyPoints  as string[]) : [];
          targetAudience = String(inp.targetAudience || '');
        }
      } catch (claudeErr) {
        console.error('Claude 추출 실패, 정규식 폴백:', claudeErr);
        // 아래 정규식 폴백으로 계속
      }
    }

    // ─── 정규식 폴백 (Claude 미설정 또는 실패 시) ────────
    if (!name) {
      // 1차: JSON-LD (schema.org)
      const jsonLd = extractJsonLd(html);
      if (jsonLd) {
        name        = jsonLd.name        || '';
        description = jsonLd.description || '';

        if (Array.isArray(jsonLd.image)) {
          // 이미지는 아래에서 별도 처리
        }
        if (jsonLd.offers) {
          const salePrice = jsonLd.offers.price;
          if (salePrice) price = `₩${Number(salePrice).toLocaleString()}`;
          if (jsonLd.offers.priceSpecification?.price) {
            originalPrice = `₩${Number(jsonLd.offers.priceSpecification.price).toLocaleString()}`;
          }
          if (jsonLd.offers.availability) {
            availability = jsonLd.offers.availability.includes('InStock') ? '재고 있음' : '품절';
          }
        }
        if (jsonLd.aggregateRating) {
          rating      = String(jsonLd.aggregateRating.ratingValue || '');
          ratingCount = String(jsonLd.aggregateRating.ratingCount || '');
        }
      }

      // 2차: OG 메타 태그
      if (!name)        name        = extractMeta(html, 'og:title') || extractTitle(html) || '';
      if (!description) description = extractMeta(html, 'og:description') || '';
      if (!price)       price       = extractPrice(html);

      // 3차: markdown 헤딩/가격 패턴
      if (!name && markdown) {
        const headingMatch = markdown.match(/^#\s+(.+)/m);
        if (headingMatch) name = headingMatch[1].trim();
      }
      if (!price && markdown) {
        const priceMatch = markdown.match(/[₩￦]?\s?([\d,]{4,})\s*원?/);
        if (priceMatch) {
          const digits = priceMatch[1].replace(/,/g, '');
          price = `₩${Number(digits).toLocaleString()}`;
        }
      }

      category = guessCategory(name, description);
      specs    = extractSpecs(html);
    }

    // ─── 가격 폴백 (항상 실행 — Claude가 name만 추출하고 price 누락 시 대응) ───
    // 1단계: JSON-LD offers.price
    if (!price) {
      const jsonLdForPrice = extractJsonLd(html);
      if (jsonLdForPrice?.offers?.price) {
        price = `₩${Number(jsonLdForPrice.offers.price).toLocaleString()}`;
      }
      if (!originalPrice && jsonLdForPrice?.offers?.priceSpecification?.price) {
        originalPrice = `₩${Number(jsonLdForPrice.offers.priceSpecification.price).toLocaleString()}`;
      }
    }
    // 2단계: OG Commerce / 이커머스 메타 태그
    if (!price) price = extractPriceFromMeta(html);
    // 3단계: HTML CSS 클래스 / data 속성 패턴
    if (!price) price = extractPrice(html);
    // 4단계: Firecrawl 마크다운에서 가격 패턴 탐색
    if (!price && markdown) {
      const pricePatterns = [
        /[₩￦]\s*([\d,]+)/,          // ₩29,900 형식
        /([\d,]{4,})\s*원/,           // 29,900원 형식
        /[₩￦]?\s?([\d,]{4,})\s*원?/, // 범용 패턴
      ];
      for (const pat of pricePatterns) {
        const m = markdown.match(pat);
        if (m) {
          const digits = m[1].replace(/,/g, '');
          if (Number(digits) > 1000) { // 1,000원 이상만 (노이즈 제거)
            price = `₩${Number(digits).toLocaleString()}`;
            break;
          }
        }
      }
    }

    // ─── 이미지 추출 (rawHtml OG 태그 기준, 항상 실행) ──
    let image = '';
    let images: string[] = [];

    const jsonLdForImg = html ? extractJsonLd(html) : null;
    if (jsonLdForImg?.image) {
      if (Array.isArray(jsonLdForImg.image)) {
        images = jsonLdForImg.image.map((img: string) =>
          img.startsWith('//') ? `https:${img}` : img
        );
        image = images[0] || '';
      } else if (typeof jsonLdForImg.image === 'string') {
        image  = jsonLdForImg.image.startsWith('//') ? `https:${jsonLdForImg.image}` : jsonLdForImg.image;
        images = [image];
      }
    }
    if (!image) {
      const ogImage = extractMeta(html, 'og:image') || '';
      image = ogImage.startsWith('//') ? `https:${ogImage}` : ogImage;
      if (image) images = [image];
    }

    // 쿠팡 접미사 정리
    name = cleanText(name).replace(/\s*[-|]\s*쿠팡$/, '').trim();

    return NextResponse.json({
      name,
      price,
      originalPrice,
      category,
      specs,
      image,
      images,
      description: cleanText(description),
      rating,
      ratingCount,
      availability,
      keyFeatures,
      copyPoints,
      targetAudience,
    });
  } catch (err: unknown) {
    console.error('제품 추출 오류:', err);
    return NextResponse.json(
      { error: '제품 정보를 추출할 수 없습니다. URL을 확인해 주세요.' },
      { status: 500 }
    );
  }
}

// ─── 헬퍼 함수 ────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJsonLd(html: string): Record<string, any> | null {
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data['@type'] === 'Product') return data;
      if (Array.isArray(data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const product = data.find((d: Record<string, any>) => d['@type'] === 'Product');
        if (product) return product;
      }
    } catch {
      // 파싱 실패 시 다음 블록 시도
    }
  }
  return null;
}

function extractMeta(html: string, property: string): string | null {
  const regex = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    'i'
  );
  const match = html.match(regex);
  if (match) return match[1];

  const regex2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    'i'
  );
  const match2 = html.match(regex2);
  return match2 ? match2[1] : null;
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].replace(/\s*\|.*$/, '').trim() : null;
}

function extractPrice(html: string): string {
  const patterns = [
    // Coupang price-value (가장 정확한 패턴)
    /class="price-value"[^>]*>\s*([\d,]+)/,
    // total-price 컨테이너 — 중간 태그(<i class="currency"> 등) 허용
    /class="total-price"[\s\S]{0,300}?<strong[^>]*>\s*([\d,]+)\s*<\/strong>/,
    // prod-sale-price — 중간 태그 허용
    /class="prod-sale-price"[\s\S]{0,200}?([\d,]+)\s*원/,
    // data 속성
    /data-(?:sale-?)?price=["']([\d,]+)["']/,
    // itemprop price (Open Graph Commerce)
    /itemprop=["']price["'][^>]*content=["']([\d.]+)["']/,
    // 한국 원화 패턴
    /(\d{1,3}(?:,\d{3})+)\s*원/,
  ];

  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      const raw = m[1].replace(/,/g, '').split('.')[0]; // 쉼표·소수점 제거
      const num = Number(raw);
      if (num > 100) return `₩${num.toLocaleString()}`;
    }
  }
  return '';
}

// extractPriceFromScripts는 제거됨:
// 쿠팡 인라인 JS의 ID/타임스탬프 등을 가격으로 오인 + 전체 스크립트 탐색으로 타임아웃 유발

function extractPriceFromMeta(html: string): string {
  // Open Graph Commerce / 표준 이커머스 메타 태그
  const props = ['og:price:amount', 'product:price:amount', 'product:sale_price:amount'];
  for (const prop of props) {
    const val = extractMeta(html, prop);
    if (val) {
      const num = Math.round(Number(val));
      if (num > 100) return `₩${num.toLocaleString()}`;
    }
  }
  return '';
}


function extractSpecs(html: string): string[] {
  const specs: string[] = [];

  const attrPattern = /<tr[^>]*>\s*<th[^>]*>([^<]+)<\/th>\s*<td[^>]*>([^<]+)<\/td>/gi;
  let match;
  while ((match = attrPattern.exec(html)) !== null && specs.length < 6) {
    const key = cleanText(match[1]);
    const val = cleanText(match[2]);
    if (key && val && key.length < 20 && val.length < 50) {
      specs.push(`${key}: ${val}`);
    }
  }

  if (specs.length === 0) {
    const dlPattern = /<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]+)<\/dd>/gi;
    while ((match = dlPattern.exec(html)) !== null && specs.length < 6) {
      const key = cleanText(match[1]);
      const val = cleanText(match[2]);
      if (key && val) {
        specs.push(`${key}: ${val}`);
      }
    }
  }

  return specs;
}

function guessCategory(name: string, desc: string): string {
  const text = `${name} ${desc}`.toLowerCase();
  const map: [string, string[]][] = [
    ['주방용품', ['텀블러', '냄비', '프라이팬', '접시', '컵', '그릇', '도마', '칼', '주방']],
    ['가전', ['청소기', '에어컨', '세탁기', '냉장고', '전자레인지', '가습기', '선풍기', '건조기']],
    ['가구/인테리어', ['소파', '테이블', '책상', '의자', '침대', '수납', '선반', '매트리스', '스탠드', '인테리어', '조명', 'led']],
    ['뷰티/건강', ['화장품', '스킨', '로션', '크림', '비타민', '영양제', '마스크', '선크림']],
    ['식품', ['과일', '고기', '채소', '쌀', '김치', '과자', '음료', '커피']],
    ['생활소품', ['수건', '세제', '세탁', '화장지', '물티슈', '건전지', '쓰레기']],
    ['디지털/가전', ['이어폰', '충전기', '케이블', '마우스', '키보드', '모니터', '노트북']],
    ['패션', ['티셔츠', '바지', '자켓', '신발', '모자', '가방', '양말']],
  ];

  for (const [cat, keywords] of map) {
    if (keywords.some((kw) => text.includes(kw))) return cat;
  }
  return '기타';
}

function cleanText(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
