import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'edge';

export async function GET() {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get('tiktok_access_token');
  
  return NextResponse.json({ 
    isAuthenticated: !!tokenCookie?.value 
  });
}
