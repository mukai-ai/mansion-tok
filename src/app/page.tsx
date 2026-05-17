'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Upload, Video, Wand2, Hash, Music, Send, Loader2, CheckCircle2, LogIn, Image as ImageIcon, Sparkles, RefreshCw } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { useSession, signOut } from 'next-auth/react';

export default function Home() {
  const { data: session } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  
  // 3つのアピールポイントテロップ
  const [text1, setText1] = useState<string>('2面採光の明るいLDK');
  const [text2, setText2] = useState<string>('窓のある対面キッチン');
  const [text3, setText3] = useState<string>('家族の会話が弾む心地よい空間');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // 分析データ
  const [analyzedHashtags, setAnalyzedHashtags] = useState<string[]>(['#ルームツアー', '#タワマン', '#不動産']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisSourceCount, setAnalysisSourceCount] = useState(0);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);

  const triggerAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/tiktok/videos');
      if (!res.ok) throw new Error('Failed to fetch videos');
      const data = await res.json();
      
      if (data.data && data.data.videos && data.data.videos.length > 0) {
        const videos = data.data.videos;
        setAnalysisSourceCount(videos.length);
        
        // ハッシュタグの抽出と集計
        const hashtagMap: { [key: string]: number } = {};
        videos.forEach((vid: { video_description?: string }) => {
          const desc = vid.video_description || '';
          const tags = desc.match(/#[^\s#]+/g) || [];
          tags.forEach((tag: string) => {
            hashtagMap[tag] = (hashtagMap[tag] || 0) + 1;
          });
        });

        // 頻度順にソートして上位3〜5個を抽出
        const sortedTags = Object.keys(hashtagMap).sort((a, b) => hashtagMap[b] - hashtagMap[a]);
        if (sortedTags.length > 0) {
          setAnalyzedHashtags(sortedTags.slice(0, 5));
        }
      }
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    // 認証状態の確認
    fetch('/api/auth/tiktok/status')
      .then(res => res.json())
      .then(data => {
        setIsAuthenticated(data.isAuthenticated);
        if (data.isAuthenticated) {
          // 自動で過去の動画を分析
          triggerAnalysis();
        }
      })
      .catch(console.error);
      
    // FFmpegのインスタンス作成とロード
    ffmpegRef.current = new FFmpeg();

    async function loadFFmpeg() {
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      const ffmpeg = ffmpegRef.current;
      
      if (!ffmpeg) return;

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
    }

    loadFFmpeg();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setVideoUrl(null);
      setProcessedBlob(null);
    }
  };

  const handleFloorPlanChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFloorPlanFile(e.target.files[0]);
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
      if (!ffmpeg) return;
      
      // 1. 日本語フォントを動的フェッチして書き込む
      const fontUrl = 'https://fonts.gstatic.com/s/notosansjp/v52/-cyZGRF3mB42JseTCOufv50Spw.ttf';
      const fontData = await fetchFile(fontUrl);
      await ffmpeg.writeFile('font.ttf', fontData);
      
      // 2. メイン動画ファイルを書き込む
      await ffmpeg.writeFile('input.mp4', await fetchFile(file));
      
      // 3. 間取り図があれば書き込む
      if (floorPlanFile) {
        await ffmpeg.writeFile('floorplan.png', await fetchFile(floorPlanFile));
      }

      // 4. FFmpegコマンドを構築
      const ffmpegArgs: string[] = ['-i', 'input.mp4'];

      if (floorPlanFile) {
        ffmpegArgs.push('-i', 'floorplan.png');
        
        // 複雑なフィルター (9:16にクロップ＆リサイズ ＋ 間取り図を左上に縮小オーバーレイ ＋ テロップ3行描画)
        // 間取り図は幅350pxにリサイズして (100, 100) に配置
        const filterStr = 
          `[0:v]crop=ih*(9/16):ih,scale=1080:1920[v];` +
          `[1:v]scale=320:-1[fp];` +
          `[v][fp]overlay=100:100[ov];` +
          `[ov]drawtext=fontfile=font.ttf:text='01  ${text1}':x=120:y=650:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=15,` +
          `drawtext=fontfile=font.ttf:text='02  ${text2}':x=120:y=780:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=15,` +
          `drawtext=fontfile=font.ttf:text='03  ${text3}':x=120:y=910:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=15[out]`;
        
        ffmpegArgs.push('-filter_complex', filterStr, '-map', '[out]', '-map', '0:a?');
      } else {
        // 間取り図なしの場合
        const filterStr = 
          `crop=ih*(9/16):ih,scale=1080:1920,` +
          `drawtext=fontfile=font.ttf:text='01  ${text1}':x=120:y=650:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=15,` +
          `drawtext=fontfile=font.ttf:text='02  ${text2}':x=120:y=780:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=15,` +
          `drawtext=fontfile=font.ttf:text='03  ${text3}':x=120:y=910:fontsize=44:fontcolor=white:box=1:boxcolor=black@0.4:boxborderw=15`;
        
        ffmpegArgs.push('-vf', filterStr);
      }

      // コーデック・画質オプション
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'copy',
        'output.mp4'
      );
      
      // FFmpeg実行
      await ffmpeg.exec(ffmpegArgs);
      
      // 処理されたファイルを読み込む
      const data = await ffmpeg.readFile('output.mp4');
      const videoBlob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(videoBlob);
      
      setVideoUrl(url);
      setProcessedBlob(videoBlob);
      
    } catch (err) {
      console.error(err);
      alert('動画処理中にエラーが発生しました。テロップに特殊文字等が含まれていないか確認してください。');
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
      
      // ハッシュタグを自動合成したテキストをキャプションに設定
      const finalCaption = `【おすすめ物件】\n${text1}\n${text2}\n${text3}\n\n${analyzedHashtags.join(' ')}`;
      formData.append('text', finalCaption);

      const res = await fetch('/api/tiktok/publish', {
        method: 'POST',
        body: formData
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
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans selection:bg-cyan-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0b0f19]/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-cyan-400 to-blue-600 p-2 rounded-xl shadow-lg shadow-cyan-500/20">
              <Video className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              MansionTok
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <span className="px-3 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-full text-xs font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                  TikTok連携済 (Sandbox)
                </span>
              ) : (
                <button onClick={handleLogin} className="px-4 py-1.5 bg-[#fe2c55] hover:bg-[#e0264b] rounded-full text-xs font-bold text-white shadow-lg shadow-[#fe2c55]/20 transition flex items-center gap-2">
                  <LogIn className="w-3.5 h-3.5" /> TikTok連携
                </button>
              )}
            </div>

            <div className="h-6 w-px bg-slate-800"></div>

            <div className="flex items-center gap-4">
              {session?.user && (
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-white leading-none">{session.user.name}</p>
                    <p className="text-[10px] text-slate-500 mt-1">{session.user.email}</p>
                  </div>
                  {session.user.image && (
                    <img src={session.user.image} alt="" className="w-8 h-8 rounded-full border border-slate-700" />
                  )}
                  <button 
                    onClick={() => signOut()}
                    className="text-xs text-slate-400 hover:text-white transition"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Upload and Form */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* 1. Video Upload */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-md font-bold mb-4 flex items-center gap-2 text-cyan-400">
              <Upload className="w-5 h-5" />
              1. 物件動画の選択
            </h2>
            
            <label className="group relative flex flex-col items-center justify-center w-full h-44 border-2 border-slate-800 border-dashed rounded-xl cursor-pointer bg-slate-950/30 hover:bg-slate-900/40 hover:border-cyan-500/40 transition-all overflow-hidden">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                {file ? (
                  <div className="p-4">
                    <Video className="w-10 h-10 text-cyan-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-300 font-semibold truncate max-w-[280px]">{file.name}</p>
                    <p className="text-xs text-slate-500 mt-1">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-slate-500 group-hover:text-cyan-400 transition-colors mb-3" />
                    <p className="mb-1 text-sm text-slate-400"><span className="font-semibold text-cyan-400">物件動画を選択</span> またはドロップ</p>
                    <p className="text-xs text-slate-600">MP4, MOV (縦横比自由)</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept="video/mp4,video/quicktime" onChange={handleFileChange} />
            </label>
          </div>

          {/* 1.5 Floor Plan Upload (Optional) */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-md font-bold mb-4 flex items-center gap-2 text-emerald-400">
              <ImageIcon className="w-5 h-5" />
              1.5 間取り図画像 (オプション)
            </h2>
            
            <label className="group relative flex flex-col items-center justify-center w-full h-28 border-2 border-slate-800 border-dashed rounded-xl cursor-pointer bg-slate-950/30 hover:bg-slate-900/40 hover:border-emerald-500/40 transition-all overflow-hidden">
              <div className="flex flex-col items-center justify-center pt-2 pb-2 text-center">
                {floorPlanFile ? (
                  <div className="p-2">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-300 font-semibold truncate max-w-[280px]">{floorPlanFile.name}</p>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors mb-1" />
                    <p className="text-xs text-slate-400"><span className="font-semibold text-emerald-400">間取り図を左上に重ねる</span> (PNG/JPG)</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept="image/png,image/jpeg" onChange={handleFloorPlanChange} />
            </label>
          </div>

          {/* 2. Style & Caption Options */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
            <h2 className="text-md font-bold mb-4 flex items-center gap-2 text-purple-400">
              <Wand2 className="w-5 h-5" />
              2. 物件アピールテロップ設定
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  アピールポイント 01
                </label>
                <input 
                  type="text" 
                  value={text1}
                  onChange={(e) => setText1(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition"
                  placeholder="例: 2面採光の明るいLDK"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  アピールポイント 02
                </label>
                <input 
                  type="text" 
                  value={text2}
                  onChange={(e) => setText2(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition"
                  placeholder="例: 窓のある対面キッチン"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                  アピールポイント 03
                </label>
                <input 
                  type="text" 
                  value={text3}
                  onChange={(e) => setText3(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 outline-none transition"
                  placeholder="例: 家族の会話が弾む心地よい空間"
                />
              </div>

              <div className="pt-2">
                <button 
                  onClick={handleProcess}
                  disabled={!file || isProcessing}
                  className="w-full bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 hover:from-cyan-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      縦型変換＆テロップ合成中...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      魔法の編集（テロップ・間取り合成）
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          
          {/* 2.5 Dynamic TikTok Analysis */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> アカウント分析 (ハッシュタグ)
              </h2>
              {isAuthenticated && (
                <button 
                  onClick={triggerAnalysis} 
                  disabled={isAnalyzing}
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} /> 再分析
                </button>
              )}
            </div>
            <div className="space-y-3">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                <p className="text-[10px] text-slate-500 mb-1.5 uppercase font-bold tracking-wider">
                  {analysisSourceCount > 0 ? `直近${analysisSourceCount}件の投稿から分析したハッシュタグ` : '推奨ハッシュタグ（過去投稿分析）'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {analyzedHashtags.map((tag, i) => (
                    <span key={i} className="text-xs px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-500 mb-0.5 uppercase font-bold tracking-wider">推奨BGM</p>
                  <p className="text-xs font-semibold text-purple-400 flex items-center gap-1">
                    <Music className="w-3.5 h-3.5" /> オリジナル楽曲 - 東京みらい不動産
                  </p>
                </div>
                <span className="text-[10px] bg-purple-500/15 border border-purple-500/20 px-2 py-0.5 text-purple-400 rounded">分析済</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Preview and Output */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-sm h-full flex flex-col shadow-xl">
            <h2 className="text-md font-bold mb-4 flex items-center gap-2 text-blue-400">
              <Video className="w-5 h-5" />
              3. 完成プレビュー ＆ TikTokへ下書き送信
            </h2>

            <div className="flex-1 bg-slate-950 rounded-xl border border-slate-850 overflow-hidden flex items-center justify-center relative min-h-[520px]">
              {videoUrl ? (
                <video 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  loop 
                  className="h-full w-auto max-h-[580px] object-contain rounded-lg"
                />
              ) : (
                <div className="text-center p-8 max-w-sm">
                  <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-800 shadow-inner">
                    <Video className="w-6 h-6 text-slate-600" />
                  </div>
                  <h3 className="text-slate-400 font-semibold mb-2 text-sm">プレビュー表示エリア</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    物件動画とアピールテロップ、そして間取り図（アップロード時）を合成したプロ仕様の不動産TikTok動画がここに生成されます。
                  </p>
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="mt-6 pt-6 border-t border-slate-850">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">TikTokアカウントへ送信</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    状態: {isAuthenticated ? '下書きトレイへの転送準備完了' : 'TikTok連携を完了してください'}
                  </p>
                </div>
                
                <button 
                  onClick={handleSendDraft}
                  disabled={!videoUrl || draftStatus !== 'idle'}
                  className={`${isAuthenticated ? 'bg-[#fe2c55] hover:bg-[#e0264b] shadow-lg shadow-[#fe2c55]/15' : 'bg-slate-800 hover:bg-slate-700'} disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl transition flex items-center gap-2`}
                >
                  {draftStatus === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      TikTokへ転送中...
                    </>
                  ) : draftStatus === 'success' ? (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      送信完了！通知を確認してください
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
