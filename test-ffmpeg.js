const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

console.log('FFmpeg Path:', ffmpegStatic);

ffmpeg()
  .input('color=c=black:s=1080x1920:d=1')
  .inputFormat('lavfi')
  .complexFilter([
    {
      filter: 'drawtext',
      options: {
        text: 'テスト',
        fontcolor: 'white',
        fontsize: 72,
        fontfile: 'C:/Windows/Fonts/meiryo.ttc',
        x: '(w-text_w)/2',
        y: '(h-text_h)/2',
      },
      inputs: '0:v',
      outputs: 'output_v',
    }
  ], 'output_v')
  .output('test_output.mp4')
  .on('start', (cmd) => console.log('Started:', cmd))
  .on('error', (err) => console.error('Error:', err.message))
  .on('end', () => console.log('Finished'))
  .run();
