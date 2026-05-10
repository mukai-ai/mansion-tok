import { NextRequest, NextResponse } from 'next/server';
import { processVideo } from '@/lib/video-editor';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('video') as File | null;
    const text = formData.get('text') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
    }

    // Generate unique filenames
    const fileId = uuidv4();
    const originalExt = path.extname(file.name) || '.mp4';
    const inputFilename = `input_${fileId}${originalExt}`;
    const outputFilename = `output_${fileId}.mp4`;

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const inputPath = path.join(uploadsDir, inputFilename);
    const outputPath = path.join(uploadsDir, outputFilename);

    // Write uploaded file to disk
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(inputPath, buffer);

    // Process video with FFmpeg
    await processVideo({
      inputPath,
      outputPath,
      text: text || 'おすすめ物件！',
      durationSeconds: 60
    });

    // We can delete the input file after processing to save space, but let's keep it for now.
    
    // Return the URL to the processed video
    const videoUrl = `/uploads/${outputFilename}`;
    return NextResponse.json({ success: true, videoUrl });

  } catch (error) {
    console.error('API Error processing video:', error);
    return NextResponse.json({ error: 'Failed to process video' }, { status: 500 });
  }
}
