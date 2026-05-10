'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Video, Wand2, Hash, Music, Send, Loader2, CheckCircle2, LogIn } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>('【超絶景】港区タワマン最上階！');
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const ffmpegRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // 認証状態の確認
    fetch('/api/auth/tiktok/status')
      .then(res => res.json())
      .then(data => setIsAuthenticated(data.isAuthenticated))
      .catch(console.error);
      
    // FFmpegのインスタンス作成とロード
    ffmpegRef.current = new FFmpeg();
    loadFFmpeg();
  }, []);

  const loadFFmpeg = async () => {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = ffmpegRef.current;
    
    // Log progress
    ffmpeg.on('progress', (event: { progress: number }) => {
      console.log(`Processing: ${Math.round(event.progress * 100)}%`);
    });

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      setLoaded(true);
    } catch (e) {
      console.error('Failed to load FFmpeg:', e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setVideoUrl(null); // Reset
      setProcessedBlob(null);
    }
  };

  const handleProcess = async () => {
    if (!file) return;
    if (!loaded) {
      alert('動画処理エンジンのロード中です。数秒後にもう一度お試しください。');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      const ffmpeg = ffmpegRef.current;
      
      // ファイルをメモリに書き込む
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));
      
      // FFmpegコマンドの実行 (クロップと縦長リサイズ)
      // Note: Cloudflare対応のため、OS依存のローカルフォントを使うdrawtextは一旦除外しています。
      await ffmpeg.exec([
        '-i', 'input.mp4',
        '-vf', 'crop=ih*(9/16):ih,scale=1080:1920',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'copy',
        'output.mp4'
      ]);
      
      // 処理されたファイルを読み込む
      const data = await ffmpeg.readFile('output.mp4');
      const videoBlob = new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);
      
      setVideoUrl(url);
      setProcessedBlob(videoBlob);
      
    } catch (err) {
      console.error(err);
      alert('エラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendDraft = async () => {
    if (!isAuthenticated) {
      alert('TikTokでログインしてください！');
      return;
    }
    if (!processedBlob) {
      alert('先に動画を処理してください。');
      return;
    }
    
    setDraftStatus('sending');
    
    try {
      const formData = new FormData();
      formData.append('video', processedBlob, 'video.mp4');
      formData.append('text', text);

      const res = await fetch('/api/tiktok/publish', {
        method: 'POST',
        body: formData // JSONではなくFormDataで送信
      });
      
      const data = await res.json();
      
      if (data.success) {
        setDraftStatus('success');
        setTimeout(() => setDraftStatus('idle'), 5000);
      } else {
        alert('送信エラー: ' + (data.error || '不明なエラー'));
        setDraftStatus('idle');
      }
    } catch (err) {
      console.error(err);
      alert('通信エラーが発生しました。');
      setDraftStatus('idle');
    }
  };

  const handleLogin = () => {
    window.location.href = '/api/auth/tiktok';
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-cyan-400 to-blue-600 p-2 rounded-xl">
              <Video className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              MansionTok
            </h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium">
            {isAuthenticated ? (
              <span className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> 連携済み
              </span>
            ) : (
              <button onClick={handleLogin} className="px-4 py-1.5 bg-[#fe2c55] hover:bg-[#e0264b] rounded-full text-white transition flex items-center gap-2 shadow-lg shadow-[#fe2c55]/20">
                <LogIn className="w-4 h-4" /> TikTok連携
              </button>
            )}
            <span className="px-3 py-1 text-slate-400 hover:text-white cursor-pointer transition">設定</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upload and Form */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" />
              1. 動画をアップロード
            </h2>
            
            <label className="group relative flex flex-col items-center justify-center w-full h-48 border-2 border-slate-600 border-dashed rounded-xl cursor-pointer bg-slate-900/50 hover:bg-slate-800/80 hover:border-cyan-500/50 transition-all overflow-hidden">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <div className="text-center">
                    <Video className="w-10 h-10 text-cyan-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-300 font-medium">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-slate-400 group-hover:text-cyan-400 transition-colors mb-3" />
                    <p className="mb-2 text-sm text-slate-400"><span className="font-semibold text-cyan-400">クリックして選択</span> またはドラッグ＆ドロップ</p>
                    <p className="text-xs text-slate-500">MP4, MOV (最大 500MB)</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
            </label>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-400" />
              2. 編集オプション
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  メインテロップ（物件のアピールポイント）
                </label>
                <input 
                  type="text" 
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 outline-none transition"
                  placeholder="例: 【超絶景】港区タワマン最上階！"
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button 
                  onClick={handleProcess}
                  disabled={!file || isProcessing}
                  className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      AIで自動編集＆カット中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      魔法の編集を開始
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* Trends Mini Dashboard */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm">
            <h2 className="text-sm font-semibold mb-4 text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Hash className="w-4 h-4" /> トレンド分析 (自動抽出)
            </h2>
            <div className="space-y-3">
              <div className="flex items-start justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                <div>
                  <p className="text-xs text-slate-400 mb-1">推奨ハッシュタグ</p>
                  <p className="text-sm font-medium text-cyan-400">#ルームツアー #タワマン #不動産</p>
                </div>
                <button className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white transition">コピー</button>
              </div>
              <div className="flex items-start justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                <div>
                  <p className="text-xs text-slate-400 mb-1">推奨BGM</p>
                  <p className="text-sm font-medium flex items-center gap-1 text-purple-400">
                    <Music className="w-3 h-3" /> Chill Lofi Vibe
                  </p>
                </div>
                <button className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white transition">適用</button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Preview and Output */}
        <div className="lg:col-span-7">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur-sm h-full flex flex-col">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-blue-400" />
              3. 完成プレビュー＆投稿
            </h2>

            <div className="flex-1 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center relative min-h-[500px]">
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="h-full w-auto max-h-[600px] object-contain"
                />
              ) : (
                <div className="text-center p-6 max-w-sm">
                  <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700 shadow-inner">
                    <Video className="w-6 h-6 text-slate-500" />
                  </div>
                  <h3 className="text-slate-300 font-medium mb-2">プレビューがここに表示されます</h3>
                  <p className="text-sm text-slate-500">
                    アップロードした動画はTikTok向けの縦型(9:16)に自動で最適化・カットされ、トレンド分析に基づいたテロップが合成されます。
                  </p>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="mt-6 pt-6 border-t border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-300">TikTok Direct Post</p>
                  <p className="text-xs text-slate-500">状態: {isAuthenticated ? '連携済 (本番送信)' : '未連携 (ログインが必要です)'}</p>
                </div>
                
                <button 
                  onClick={handleSendDraft}
                  disabled={!videoUrl || draftStatus !== 'idle'}
                  className={`${isAuthenticated ? 'bg-[#fe2c55] hover:bg-[#e0264b] shadow-[#fe2c55]/20' : 'bg-slate-700 hover:bg-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl shadow-lg transition flex items-center gap-2`}
                >
                  {draftStatus === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      本番へ送信中...
                    </>
                  ) : draftStatus === 'success' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      送信完了！
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      TikTokの下書きへ送信
                    </>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}
