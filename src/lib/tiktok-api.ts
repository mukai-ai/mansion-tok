export interface DraftPostOptions {
  accessToken: string;
  videoBuffer: ArrayBuffer | Buffer; // The file data in memory
  title: string;
  privacyLevel?: 'PUBLIC' | 'MUTUAL_FOLLOW' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
}

export const sendToTikTokDraft = async (options: DraftPostOptions) => {
  const { accessToken, videoBuffer } = options;

  // File stats
  const fileSize = videoBuffer.byteLength;

  // 1. Init Video Upload for Inbox (video.upload scope)
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: fileSize,
        chunk_size: fileSize, // Single chunk upload for files < 64MB
        total_chunk_count: 1
      }
    })
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`Failed to initialize upload: ${err}`);
  }

  const initData = await initRes.json();
  const publishId = initData.data.publish_id;
  const uploadUrl = initData.data.upload_url;

  if (!uploadUrl) {
    throw new Error('No upload_url received from TikTok API');
  }

  // 3. Upload the actual video file via PUT
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`
    },
    body: videoBuffer as BodyInit
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Failed to upload video chunk: ${err}`);
  }

  // Success
  return {
    success: true,
    publishId: publishId,
    message: 'Video successfully uploaded to TikTok'
  };
};
