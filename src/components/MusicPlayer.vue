<script setup lang="ts">
import { ref, computed } from 'vue';
import type { MusicSuggestion } from '@/types/music';

const props = defineProps<{ music: MusicSuggestion }>();

const isPlaying = ref(false);
const audioRef = ref<HTMLAudioElement | null>(null);
const coverLoadError = ref(false);
const audioLoadError = ref(false);

const hasAudioUrl = computed(() => !!props.music.audioUrl && !audioLoadError.value);

const timeRangeLabel = computed(() =>
  `${formatTime(props.music.startTime)} - ${formatTime(props.music.endTime)}`
);

function formatTime(s: number): string {
  const sec = Math.max(0, Math.floor(s));
  const min = Math.floor(sec / 60);
  const remain = sec % 60;
  return `${min}:${String(remain).padStart(2, '0')}`;
}

async function togglePlay() {
  if (!audioRef.value) return;

  if (isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
    return;
  }

  try {
    audioRef.value.currentTime = props.music.startTime;
    await audioRef.value.play();
    isPlaying.value = true;
  } catch {
    audioLoadError.value = true;
  }
}

function onTimeUpdate() {
  if (audioRef.value && audioRef.value.currentTime >= props.music.endTime) {
    audioRef.value.pause();
    isPlaying.value = false;
  }
}

function onAudioEnded() {
  isPlaying.value = false;
}

function onAudioError() {
  audioLoadError.value = true;
  isPlaying.value = false;
}

async function copyAudioUrl() {
  if (!props.music.audioUrl) return;
  try {
    await navigator.clipboard.writeText(props.music.audioUrl);
  } catch {
    // fallback
    const input = document.createElement('input');
    input.value = props.music.audioUrl;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }
}
</script>

<template>
  <div class="music-player" :class="{ 'no-url': !hasAudioUrl }">
    <!-- 封面 -->
    <div class="music-cover">
      <img
        v-if="music.coverUrl && !coverLoadError"
        :src="music.coverUrl"
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
        v-if="hasAudioUrl"
        class="btn-play"
        :title="isPlaying ? '暂停' : '播放'"
        @click="togglePlay"
      >
        {{ isPlaying ? '⏸' : '▶️' }}
      </button>
      <button
        v-if="hasAudioUrl"
        class="btn-copy-url"
        title="复制音频链接"
        @click="copyAudioUrl"
      >
        📋
      </button>
      <span v-else class="no-audio-hint">暂无试听</span>
    </div>

    <!-- 隐藏音频元素 -->
    <audio
      v-if="hasAudioUrl"
      ref="audioRef"
      :src="music.audioUrl"
      preload="none"
      @timeupdate="onTimeUpdate"
      @ended="onAudioEnded"
      @error="onAudioError"
    />
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

.music-player.no-url {
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
  width: 28px;
  height: 28px;
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
</style>