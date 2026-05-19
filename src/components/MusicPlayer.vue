<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import type { MusicSuggestion } from '@/types/music';

const props = defineProps<{ music: MusicSuggestion }>();

const isPlaying = ref(false);
const iframeKey = ref(0);
const showIframe = ref(false);
const coverLoadError = ref(false);

const hasPlayable = computed(() => !!(props.music.videoId || props.music.audioUrl));

const timeRangeLabel = computed(() =>
  `${formatTime(props.music.startTime)} - ${formatTime(props.music.endTime)}`
);

/** 封面图：优先 YouTube 缩略图，其次 music.coverUrl */
const displayCover = computed(() => {
  if (props.music.videoId) return `https://img.youtube.com/vi/${props.music.videoId}/hqdefault.jpg`;
  return props.music.coverUrl;
});

function formatTime(s: number): string {
  const sec = Math.max(0, Math.floor(s));
  const min = Math.floor(sec / 60);
  const remain = sec % 60;
  return `${min}:${String(remain).padStart(2, '0')}`;
}

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function togglePlay() {
  if (isPlaying.value) {
    stopPlayback();
    return;
  }
  startPlayback();
}

function startPlayback() {
  if (props.music.videoId) {
    if (isMobile) {
      // 移动端无法自动播放 YouTube 嵌入 iframe，直接跳转打开
      window.open(
        `https://youtu.be/${props.music.videoId}?t=${Math.floor(props.music.startTime)}`,
        '_blank'
      );
      return;
    }
    // 桌面端：通过 :key 强制重建 iframe，确保 start/end 参数生效
    iframeKey.value++;
    showIframe.value = true;
    isPlaying.value = true;
  } else if (props.music.audioUrl) {
    const audio = new Audio(props.music.audioUrl);
    audio.currentTime = props.music.startTime;
    audio.play().catch(() => {});
    audio.addEventListener('timeupdate', () => {
      if (audio.currentTime >= props.music.endTime) {
        audio.pause();
        isPlaying.value = false;
      }
    });
    audio.addEventListener('ended', () => { isPlaying.value = false; });
    isPlaying.value = true;
  }
}

function stopPlayback() {
  if (props.music.videoId) {
    showIframe.value = false;
  }
  isPlaying.value = false;
}

/** 监听 YouTube iframe 的 postMessage，检测播放结束 */
function onWindowMessage(event: MessageEvent) {
  if (!event.source) return;
  try {
    const data = JSON.parse(event.data as string);
    // YT.PlayerState.ENDED === 0
    if (data.event === 'infoDelivery' && data.info?.playerState === 0) {
      isPlaying.value = false;
    }
  } catch { /* 忽略非 JSON 消息 */ }
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', onWindowMessage);
}

onUnmounted(() => {
  window.removeEventListener('message', onWindowMessage);
});

async function copyYouTubeLink() {
  if (!props.music.videoId) return;
  const link = `https://youtu.be/${props.music.videoId}?t=${Math.floor(props.music.startTime)}`;
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const input = document.createElement('input');
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}
</script>

<template>
  <div class="music-player" :class="{ 'has-media': hasPlayable }">
    <!-- 封面 -->
    <div class="music-cover">
      <img
        v-if="displayCover && !coverLoadError"
        :src="displayCover"
        class="cover-img"
        @error="coverLoadError = true"
      />
      <span v-else class="cover-placeholder">🎵</span>
    </div>

    <!-- 信息 -->
    <div class="music-info">
      <span class="music-name">{{ music.name }}</span>
      <span v-if="music.artist" class="music-artist">{{ music.artist }}</span>
      <span class="music-time-range">片段: {{ timeRangeLabel }}</span>
    </div>

    <!-- 操作 -->
    <div class="music-actions">
      <button
        v-if="hasPlayable"
        class="btn-play"
        :title="isMobile ? '在 YouTube 中打开' : (isPlaying ? '暂停' : '播放')"
        @click="togglePlay"
      >
        <template v-if="isMobile">🔗</template>
        <template v-else>{{ isPlaying ? '⏸' : '▶️' }}</template>
      </button>
      <button
        v-if="music.videoId"
        class="btn-copy-url"
        title="复制 YouTube 链接"
        @click="copyYouTubeLink"
      >
        📋
      </button>
      <span v-if="!hasPlayable" class="no-audio-hint">暂无试听</span>
    </div>

    <!-- YouTube 隐藏 iframe -->
    <div v-if="showIframe && music.videoId" class="yt-hidden-wrapper">
      <iframe
        :key="iframeKey"
        :src="`https://www.youtube.com/embed/${music.videoId}?start=${Math.floor(music.startTime)}&end=${Math.floor(music.endTime)}&autoplay=1&enablejsapi=1&controls=0&modestbranding=1&rel=0`"
        allow="autoplay; encrypted-media"
        class="yt-hidden-iframe"
      />
    </div>
  </div>
</template>

<style scoped>
.music-player {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: #f0fdf4;
  border: 1px solid #dcfce7;
  border-radius: 0.5rem;
  transition: border-color 0.15s;
}

.music-player:not(.has-media) {
  opacity: 0.55;
  background: #f9fafb;
  border-color: #e5e7eb;
}

.music-cover {
  width: 48px;
  height: 48px;
  border-radius: 0.375rem;
  overflow: hidden;
  flex-shrink: 0;
  background: #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  font-size: 1.25rem;
}

.music-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.music-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-artist {
  font-size: 0.7rem;
  color: #6b7280;
}

.music-time-range {
  font-size: 0.7rem;
  color: #059669;
  font-family: 'SF Mono', 'Cascadia Code', monospace;
}

.music-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.btn-play,
.btn-copy-url {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  border: none;
  border-radius: 0.25rem;
  background: #10b981;
  color: white;
  font-size: 0.8rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

.btn-play:hover {
  background: #059669;
}

.btn-copy-url {
  background: #6b7280;
}

.btn-copy-url:hover {
  background: #4b5563;
}

.no-audio-hint {
  font-size: 0.7rem;
  color: #9ca3af;
}

.yt-hidden-wrapper {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

.yt-hidden-iframe {
  width: 0;
  height: 0;
  border: none;
}
</style>