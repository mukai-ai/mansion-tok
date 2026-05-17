import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const tokenCookie = cookieStore.get('tiktok_access_token');

    if (!tokenCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized. Please login with TikTok first.' }, { status: 401 });
    }

    // TikTok API v2 /video/list/ endpoint
    // Fields details: id, title, video_description, create_time, cover_image_url, share_url, view_count
    const response = await fetch('https://open.tiktokapis.com/v2/video/list/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenCookie.value}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        max_count: 10,
        fields: 'id,title,video_description,create_time,cover_image_url,share_url'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TikTok video list API error:', errorText);
      return NextResponse.json({ error: `TikTok API failed: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Failed to fetch TikTok videos:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
