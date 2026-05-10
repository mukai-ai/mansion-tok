import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  const CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY;
  const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/tiktok/callback`;
  // video.publish: Direct Post用, user.info.basic: アカウント情報用
  const SCOPES = 'video.publish,user.info.basic';
  const STATE = Math.random().toString(36).substring(7); // CSRF対策

  if (!CLIENT_KEY || CLIENT_KEY === 'your_client_key_here') {
    return NextResponse.json({ error: 'TikTok Client Key is not configured in .env.local' }, { status: 500 });
  }

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${CLIENT_KEY}&scope=${SCOPES}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${STATE}`;

  return NextResponse.redirect(authUrl);
}
