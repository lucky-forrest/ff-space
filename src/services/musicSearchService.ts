import type { MusicSuggestion } from '@/types/music';

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;
const SEARCH_TIMEOUT_MS = 8000;

interface YouTubeSearchResult {
  videoId: string;
  channelTitle: string;
  thumbnailUrl: string;
}

/**
 * 通过 YouTube Data API v3 搜索单首歌曲
 * 返回 videoId、频道名、缩略图；搜索失败返回 null
 */
async function searchYouTubeSong(keyword: string): Promise<YouTubeSearchResult | null> {
  if (!API_KEY) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const query = `${keyword} official audio`;
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'video');
    url.searchParams.set('videoCategoryId', '10');
    url.searchParams.set('maxResults', '1');
    url.searchParams.set('key', API_KEY);

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return null;

    const data = await res.json() as {
      items?: Array<{
        id: { videoId: string };
        snippet: { channelTitle: string; thumbnails: { high: { url: string } } };
      }>;
    };

    const item = data.items?.[0];
    if (!item?.id?.videoId) return null;

    return {
      videoId: item.id.videoId,
      channelTitle: item.snippet.channelTitle,
      thumbnailUrl: item.snippet.thumbnails.high.url,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 批量搜索并填充 musicSuggestions
 * Promise.allSettled 保证单条失败不影响其他
 * API Key 为空时直接返回未填充的数据
 */
export async function enrichMusicSuggestions(
  suggestions: Array<{ name: string; startTime: number; endTime: number }>
): Promise<MusicSuggestion[]> {
  if (!API_KEY) {
    return suggestions.map(s => ({
      id: crypto.randomUUID(),
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }

  const results = await Promise.allSettled(suggestions.map(s => searchYouTubeSong(s.name)));

  return suggestions.map((s, i) => {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      return {
        id: crypto.randomUUID(),
        name: s.name,
        artist: result.value.channelTitle,
        videoId: result.value.videoId,
        coverUrl: result.value.thumbnailUrl,
        startTime: s.startTime,
        endTime: s.endTime,
      };
    }
    return {
      id: crypto.randomUUID(),
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
    };
  });
}

/** 检查 API 是否可用 */
export function isMusicApiAvailable(): boolean {
  return !!API_KEY;
}