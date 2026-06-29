import type { MediaFile } from '@/components/MediaUploader.vue';

const MAX_FRAME_DIMENSION = 1024;
const EXTRACTION_TIMEOUT = 30000;

/**
 * 按比例缩小尺寸，确保最大边不超过 MAX_FRAME_DIMENSION
 */
function resizeFrame(canvas: HTMLCanvasElement, video: HTMLVideoElement): void {
  let width = video.videoWidth;
  let height = video.videoHeight;

  if (width > MAX_FRAME_DIMENSION || height > MAX_FRAME_DIMENSION) {
    const ratio = Math.min(MAX_FRAME_DIMENSION / width, MAX_FRAME_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
}

/**
 * 在指定时间点截取一帧
 */
function captureFrameAtTime(video: HTMLVideoElement, time: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resizeFrame(canvas, video);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85);
    };

    video.addEventListener('seeked', onSeeked);
    video.currentTime = time;
  });
}

/**
 * 从视频中提取关键帧
 */
export async function extractKeyFrames(videoFile: File, maxFrames = 5): Promise<Blob[]> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('视频帧提取超时'));
    }, EXTRACTION_TIMEOUT);

    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';

    const objectUrl = URL.createObjectURL(videoFile);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };

    const onError = () => {
      cleanup();
      clearTimeout(timeout);
      reject(new Error('视频无法加载'));
    };

    const onLoaded = async () => {
      try {
        const duration = video.duration;
        if (!isFinite(duration) || duration <= 0) {
          cleanup();
          clearTimeout(timeout);
          reject(new Error('无法获取视频时长'));
          return;
        }

        // 在视频的不同时间点截取帧
        const timestamps: number[] = [];
        for (let i = 0; i < maxFrames; i++) {
          // 从 10% 到 90% 均匀分布，避免开头和结尾的黑屏
          timestamps.push(duration * (0.1 + (0.8 * i) / (maxFrames - 1 || 1)));
        }

        // 确保第一帧至少在第 0.5 秒（避免片头黑屏）
        if (timestamps[0] < 0.5) timestamps[0] = 0.5;

        const frames: Blob[] = [];
        for (const time of timestamps) {
          const frame = await captureFrameAtTime(video, Math.min(time, duration - 0.1));
          if (frame) frames.push(frame);
        }

        cleanup();
        clearTimeout(timeout);
        resolve(frames);
      } catch (error) {
        cleanup();
        clearTimeout(timeout);
        reject(error);
      }
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
    video.src = objectUrl;
  });
}

/**
 * 将提取的关键帧转为 MediaFile 对象
 */
export async function extractKeyFramesAsMediaFiles(
  videoFile: File,
  maxFrames = 5
): Promise<MediaFile[]> {
  const frames = await extractKeyFrames(videoFile, maxFrames);
  const baseName = videoFile.name.replace(/\.[^.]+$/, '');

  const mediaFiles: MediaFile[] = [];
  for (let i = 0; i < frames.length; i++) {
    const blob = frames[i];
    const file = new File([blob], `${baseName}_frame_${i + 1}.jpg`, { type: 'image/jpeg' });
    const previewUrl = URL.createObjectURL(blob);

    mediaFiles.push({
      id: `${videoFile.name}-frame-${i}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      previewUrl,
      type: 'image',
      name: `${baseName} (帧${i + 1})`,
      size: blob.size
    });
  }

  return mediaFiles;
}
