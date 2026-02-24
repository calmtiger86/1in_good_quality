import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (!process.env.SITE_PASSWORD || password !== process.env.SITE_PASSWORD) {
    return NextResponse.json({ error: '비밀번호가 틀렸습니다' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('auth-token', password, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30일
    path: '/',
  });
  return res;
}
