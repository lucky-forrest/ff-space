import type { MusicSuggestion } from '@/types/music';

const API_BASE = import.meta.env.VITE_MUSIC_API_BASE as string;
const SEARCH_TIMEOUT_MS = 8000;

interface NeteaseSearchResult {
  id: number;
  name: string;
  artists: Array<{ name: string }>;
  album: { picUrl?: string };
  duration: number;
}

interface NeteaseSongUrlResult {
  data: Array<{ url?: string }>;
}

/**
 * 搜索单首歌曲，返回可播放的音频信息
 * 流程: /search?keywords=xxx&limit=1 → 取 song.id → /song/url?id=xxx
 * 任一环节失败返回 null（优雅降级）
 */
async function searchSong(keyword: string): Promise<{
  name: string;
  artist: string;
  audioUrl: string;
  coverUrl: string;
  duration: number;
} | null> {
  if (!API_BASE) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    // 步骤1：搜索歌曲
    const searchUrl = `${API_BASE}/search?keywords=${encodeURIComponent(keyword)}&limit=1&type=1`;
    const searchRes = await fetch(searchUrl, { signal: controller.signal });

    if (!searchRes.ok) return null;

    const searchData = await searchRes.json() as { result?: { songs?: NeteaseSearchResult[] } };
    const songs = searchData.result?.songs;
    if (!songs || songs.length === 0) return null;

    const song = songs[0];

    // 步骤2：获取播放 URL
    const urlRes = await fetch(`${API_BASE}/song/url?id=${song.id}`, { signal: controller.signal });

    if (!urlRes.ok) return null;

    const urlData = await urlRes.json() as NeteaseSongUrlResult;
    const audioUrl = urlData.data?.[0]?.url;

    if (!audioUrl) return null;

    return {
      name: song.name,
      artist: song.artists?.map(a => a.name).join(' / ') || '未知歌手',
      audioUrl: audioUrl,
      coverUrl: song.album?.picUrl || '',
      duration: song.duration,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 批量搜索并填充 musicSuggestions
 * 使用 Promise.allSettled 保证单条失败不影响其他
 * API_BASE 为空时直接返回未填充的数据
 */
export async function enrichMusicSuggestions(
  suggestions: Array<{ name: string; startTime: number; endTime: number }>
): Promise<MusicSuggestion[]> {
  if (!API_BASE) {
    return suggestions.map(s => ({
      id: crypto.randomUUID(),
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
    }));
  }

  const results = await Promise.allSettled(suggestions.map(s => searchSong(s.name)));

  return suggestions.map((s, i) => {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      return {
        id: crypto.randomUUID(),
        name: s.name,
        artist: result.value.artist,
        audioUrl: result.value.audioUrl,
        startTime: s.startTime,
        endTime: s.endTime,
        coverUrl: result.value.coverUrl,
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

/** 检查 API 是否可连通 */
export async function isMusicApiAvailable(): Promise<boolean> {
  if (!API_BASE) return false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/search?keywords=test&limit=1`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}