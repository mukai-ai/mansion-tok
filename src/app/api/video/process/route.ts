import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Video processing is now done client-side.' },
    { status: 410 }
  );
}
