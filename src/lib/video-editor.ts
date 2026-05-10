import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

// Next.jsのサーバービルド環境ではパスがずれるため、process.cwd()から絶対パスを組み立てる
const ffmpegPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
ffmpeg.setFfmpegPath(ffmpegPath);

export interface VideoProcessOptions {
  inputPath: string;
  outputPath: string;
  text?: string;
  durationSeconds?: number;
}

export const processVideo = ({
  inputPath,
  outputPath,
  text = 'おすすめ物件！',
  durationSeconds = 60,
}: VideoProcessOptions): Promise<string> => {
  return new Promise((resolve, reject) => {
    // Basic crop to 9:16 (1080x1920 or proportional)
    // We use a complex filter to scale and crop, and then overlay text
    const filterGraph = [
      {
        filter: 'scale',
        options: '1080:1920:force_original_aspect_ratio=increase',
        inputs: '0:v',
        outputs: 'scaled',
      },
      {
        filter: 'crop',
        options: '1080:1920',
        inputs: 'scaled',
        outputs: 'cropped',
      },
      {
        filter: 'drawtext',
        options: {
          text: text,
          fontfile: 'C:/Windows/Fonts/meiryo.ttc',
          fontcolor: 'white',
          fontsize: 72,
          x: '(w-text_w)/2',
          y: '(h-text_h)/2',
          box: 1,
          boxcolor: 'black@0.5',
          boxborderw: 10,
        },
        inputs: 'cropped',
        outputs: 'output_v',
      },
    ];

    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-c:a aac',
        '-b:a 128k',
        `-t ${durationSeconds}`
      ])
      .complexFilter(filterGraph, 'output_v')
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('progress', (progress) => {
        console.log('Processing: ' + progress.percent + '% done');
      })
      .on('end', () => {
        console.log('Finished processing video');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Error processing video:', err);
        reject(err);
      })
      .run();
  });
};
