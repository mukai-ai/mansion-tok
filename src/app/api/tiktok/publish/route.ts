import { NextRequest, NextResponse } from 'next/server';
import { sendToTikTokDraft } from '@/lib/tiktok-api';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const videoFile = formData.get('video') as File;
    const text = formData.get('text') as string;

    if (!videoFile) {
      return NextResponse.json({ error: 'Video file is required' }, { status: 400 });
    }

    // クッキーからTikTokアクセストークンを取得
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('tiktok_access_token');
    
    if (!tokenCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized. Please login with TikTok first.' }, { status: 401 });
    }

    // Convert file to ArrayBuffer
    const videoBuffer = await videoFile.arrayBuffer();

    const result = await sendToTikTokDraft({
      accessToken: tokenCookie.value,
      videoBuffer: videoBuffer,
      title: text || 'おすすめ物件紹介',
      privacyLevel: 'SELF_ONLY' // 非公開・下書きとして送信
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Error publishing to TikTok:', error);
    return NextResponse.json({ error: error.message || 'Failed to publish video to TikTok' }, { status: 500 });
  }
}
