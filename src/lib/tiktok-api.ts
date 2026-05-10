export interface DraftPostOptions {
  accessToken: string;
  videoBuffer: ArrayBuffer | Buffer; // The file data in memory
  title: string;
  privacyLevel?: 'PUBLIC' | 'MUTUAL_FOLLOW' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
}

export const sendToTikTokDraft = async (options: DraftPostOptions) => {
  const { accessToken, videoBuffer, title, privacyLevel = 'SELF_ONLY' } = options;

  // 1. Check Creator Info
  const creatorInfoRes = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!creatorInfoRes.ok) {
    const err = await creatorInfoRes.text();
    throw new Error(`Failed to query creator info: ${err}`);
  }

  // File stats
  const fileSize = videoBuffer.byteLength;

  // 2. Init Video Upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      post_info: {
        title: title,
        privacy_level: privacyLevel, // SELF_ONLY means Private/Draft behavior
        disable_comment: false,
        disable_duet: false,
        disable_stitch: false
      },
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
    body: videoBuffer
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
