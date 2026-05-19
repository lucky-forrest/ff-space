/** AI 返回的原始音乐推荐格式 */
export interface RawMusicSuggestion {
  name: string;
  startTime: number;
  endTime: number;
}

/** 前端使用的完整音乐推荐数据 */
export interface MusicSuggestion {
  id: string;
  name: string;
  artist?: string;
  audioUrl?: string;       // 旧版网易云音频直链（兼容保留）
  videoId?: string;         // YouTube 视频 ID，用于内嵌播放
  startTime: number;
  endTime: number;
  coverUrl?: string;
}