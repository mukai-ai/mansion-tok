import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url));
  }

  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
  const CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;

  try {
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: CLIENT_KEY!,
        client_secret: CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString()
    });

    const data = await tokenResponse.json();
    
    if (data.access_token) {
      const cookieStore = await cookies();
      cookieStore.set('tiktok_access_token', data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: data.expires_in || 86400,
      });
      // 成功したらダッシュボードへリダイレクト
      return NextResponse.redirect(new URL('/?auth=success', req.url));
    } else {
      console.error('Token fetch failed:', data);
      return NextResponse.redirect(new URL('/?error=token_failed', req.url));
    }
  } catch (err) {
    console.error('Auth error:', err);
    return NextResponse.redirect(new URL('/?error=server_error', req.url));
  }
}
