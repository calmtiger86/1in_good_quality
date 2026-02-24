import { NextRequest, NextResponse } from 'next/server';

/**
 * 쿠팡 제품 URL → 제품 정보 추출 API
 * Firecrawl API로 HTML 수집 (봇 감지 우회)
 * JSON-LD (schema.org) 우선 파싱 + OG meta 폴백
 */
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

    // ─── Firecrawl API로 쿠팡 페이지 HTML 수집 ──────────
    let html: string;
    try {
      const fcRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: productUrl, formats: ['html'] }),
      });

      if (!fcRes.ok) {
        return NextResponse.json(
          { error: '페이지를 가져올 수 없습니다. URL을 확인해 주세요.' },
          { status: 502 }
        );
      }

      const fcData = await fcRes.json();
      html = fcData?.data?.html ?? '';
    } catch {
      return NextResponse.json(
        { error: '페이지를 가져올 수 없습니다. URL을 확인해 주세요.' },
        { status: 502 }
      );
    }

    if (!html || html.length < 500) {
      return NextResponse.json(
        { error: '제품 페이지를 파싱할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      );
    }

    // ─── 1차: JSON-LD (schema.org) 파싱 ─────────────
    const jsonLd = extractJsonLd(html);

    let name = '';
    let price = '';
    let originalPrice = '';
    let image = '';
    let images: string[] = [];
    let description = '';
    let rating = '';
    let ratingCount = '';
    let availability = '';

    if (jsonLd) {
      name = jsonLd.name || '';
      description = jsonLd.description || '';

      // 이미지 배열
      if (Array.isArray(jsonLd.image)) {
        images = jsonLd.image.map((img: string) =>
          img.startsWith('//') ? `https:${img}` : img
        );
        image = images[0] || '';
      } else if (typeof jsonLd.image === 'string') {
        image = jsonLd.image.startsWith('//')
          ? `https:${jsonLd.image}`
          : jsonLd.image;
        images = [image];
      }

      // 가격 정보
      if (jsonLd.offers) {
        const salePrice = jsonLd.offers.price;
        if (salePrice) {
          price = `₩${Number(salePrice).toLocaleString()}`;
        }
        if (jsonLd.offers.priceSpecification?.price) {
          originalPrice = `₩${Number(jsonLd.offers.priceSpecification.price).toLocaleString()}`;
        }
        if (jsonLd.offers.availability) {
          availability = jsonLd.offers.availability.includes('InStock')
            ? '재고 있음'
            : '품절';
        }
      }

      if (jsonLd.aggregateRating) {
        rating = String(jsonLd.aggregateRating.ratingValue || '');
        ratingCount = String(jsonLd.aggregateRating.ratingCount || '');
      }
    }

    // ─── 2차: OG 메타 태그 폴백 ──────────────────────
    if (!name) {
      name = extractMeta(html, 'og:title') || extractTitle(html) || '';
    }
    if (!image) {
      const ogImage = extractMeta(html, 'og:image') || '';
      image = ogImage.startsWith('//') ? `https:${ogImage}` : ogImage;
    }
    if (!description) {
      description = extractMeta(html, 'og:description') || '';
    }
    if (!price) {
      price = extractPrice(html);
    }

    // 카테고리 추측
    const category = guessCategory(name, description);

    // 스펙 추출
    const specs = extractSpecs(html);

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
    /class="total-price"[^>]*>[^<]*<strong[^>]*>([\d,]+)<\/strong>/,
    /class="prod-sale-price"[^>]*>[^<]*([\d,]+)원/,
    /"price":\s*"?([\d,]+)"?/,
    /class="price-value"[^>]*>([\d,]+)/,
    /(\d{1,3}(?:,\d{3})+)원/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const num = match[1].replace(/,/g, '');
      return `₩${Number(num).toLocaleString()}`;
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

  for (const [category, keywords] of map) {
    if (keywords.some((kw) => text.includes(kw))) return category;
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
