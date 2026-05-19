<script setup lang="ts">
import { ref } from 'vue';
import MediaUploader, { type MediaFile } from '@/components/MediaUploader.vue';
import CopyDisplay from '@/components/CopyDisplay.vue';
import Toast from '@/components/Toast.vue';
import AICopyService, { type CopyResult, type AICopyError } from '@/services/aiCopyService';
import SettingsModal from '@/components/SettingsModal.vue';

const mediaFiles = ref<MediaFile[]>([]);
const mediaUploaderRef = ref<InstanceType<typeof MediaUploader>>();
const generatedCopies = ref<CopyResult[]>([]);
const isLoading = ref(false);
const loadingStep = ref('');
const errorMessage = ref('');
const selectedStyleId = ref('');

const showSettings = ref(false);

const aiService = AICopyService;

const handleFilesSelected = (files: MediaFile[]) => {
  mediaFiles.value = [...mediaFiles.value, ...files];
};

const handleFilesRemoved = (files: MediaFile[]) => {
  const removedIds = files.map(f => f.id);
  mediaFiles.value = mediaFiles.value.filter(f => !removedIds.includes(f.id));

  if (mediaFiles.value.length === 0) {
    generatedCopies.value = [];
  }
};

const generateCopyForFiles = async () => {
  if (mediaFiles.value.length === 0) return;

  isLoading.value = true;
  errorMessage.value = '';
  generatedCopies.value = [];

  try {
    loadingStep.value = mediaFiles.value.some((f: MediaFile) => f.type === 'video')
      ? '正在提取视频关键帧...'
      : '正在分析内容...';

    loadingStep.value = '正在生成文案...';

    const results = await aiService.generateCopy(mediaFiles.value);
    generatedCopies.value = results;
    loadingStep.value = '';
  } catch (error) {
    const aiError = error as AICopyError;
    errorMessage.value = aiError.message || '生成文案时发生未知错误';
    loadingStep.value = '';
  } finally {
    isLoading.value = false;
  }
};

const regenerateStyle = async (styleId: string) => {
  if (mediaFiles.value.length === 0) return;

  isLoading.value = true;
  errorMessage.value = '';
  loadingStep.value = '正在生成文案...';

  try {
    const results = await aiService.generateCopy(mediaFiles.value, [styleId]);

    const updatedCopies = [...generatedCopies.value];
    for (const newCopy of results) {
      const existingIndex = updatedCopies.findIndex(
        (c: CopyResult) => c.style === newCopy.style
      );
      if (existingIndex !== -1) {
        updatedCopies[existingIndex] = newCopy;
      } else {
        updatedCopies.push(newCopy);
      }
    }

    generatedCopies.value = updatedCopies;
    loadingStep.value = '';
  } catch (error) {
    const aiError = error as AICopyError;
    errorMessage.value = aiError.message || '重新生成文案时发生错误';
    loadingStep.value = '';
  } finally {
    isLoading.value = false;
  }
};

const handleStyleSelected = (styleId: string) => {
  selectedStyleId.value = styleId;
};

const handleCopyUpdated = (updatedCopy: CopyResult) => {
  const index = generatedCopies.value.findIndex(c => c.id === updatedCopy.id);
  if (index !== -1) {
    generatedCopies.value[index] = updatedCopy;
  }
};

const handleCopyCopied = (copy: CopyResult) => {
  console.log('文案已复制:', copy);
};
</script>

<template>
  <div id="app">
    <!-- 顶部标题栏 -->
    <header class="app-header">
      <h1>短视频爆款文案生成器</h1>
      <button class="settings-btn" title="设置" @click="showSettings = true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
    </header>

    <!-- 主内容区：左上传 + 右展示 -->
    <main class="main-content">
      <!-- 左侧：上传区 -->
      <section class="panel upload-panel">
        <div class="panel-title-row">
          <h2 class="panel-title">上传素材 ({{ mediaFiles.length }}/10)</h2>
          <button
            v-if="mediaFiles.length > 0"
            class="btn-remove-all"
            @click="mediaUploaderRef?.removeAllFiles()"
          >
            全部移除
          </button>
        </div>
        <div class="upload-scroll">
          <MediaUploader
            ref="mediaUploaderRef"
            :max-size="10"
            :max-files="10"
            accept="image/*,video/*"
            @files-selected="handleFilesSelected"
            @files-removed="handleFilesRemoved"
          />
        </div>

        <div v-if="mediaFiles.length > 0" class="generate-bar">
          <button
            :disabled="isLoading"
            class="generate-btn"
            :class="{ loading: isLoading }"
            @click="generateCopyForFiles"
          >
            <span v-if="!isLoading">✨ 生成文案</span>
            <span v-else class="loading-content">
              <span class="spinner"></span>
              {{ loadingStep || '生成中...' }}
            </span>
          </button>
        </div>

        <!-- 错误提示 -->
        <div v-if="errorMessage" class="error-inline">
          <p>⚠️ {{ errorMessage }}</p>
          <p v-if="errorMessage.includes('API_KEY')" class="error-hint">
            请检查 <code>.env.local</code> 中的 <code>VITE_DASHSCOPE_API_KEY</code>
          </p>
          <button class="error-close" @click="errorMessage = ''">关闭</button>
        </div>
      </section>

      <!-- 右侧：文案展示区 -->
      <section class="panel display-panel">
        <template v-if="generatedCopies.length > 0">
          <!-- 风格切换标签 -->
          <div class="style-tabs">
            <div class="style-tabs-inner">
              <div class="style-tab-row">
                <button
                  v-for="(copy, index) in generatedCopies"
                  :key="copy.id"
                  :class="['style-tab', { active: copy.style === selectedStyleId || (!selectedStyleId && index === 0) }]"
                  @click="selectedStyleId = copy.style"
                >
                  {{ copy.style }}
                </button>
              </div>
              <div class="regenerate-row">
                <button
                  v-for="style in aiService.getStyles()"
                  :key="style.id"
                  class="regenerate-mini"
                  @click="regenerateStyle(style.id)"
                  :disabled="isLoading"
                  title="重新生成"
                >
                  🔄 {{ style.name }}
                </button>
              </div>
            </div>
          </div>

          <!-- 文案内容 -->
          <div class="copy-area">
            <CopyDisplay
              :copies="generatedCopies"
              :selected-style-id="selectedStyleId"
              @style-selected="handleStyleSelected"
              @copy-updated="handleCopyUpdated"
              @copy-copied="handleCopyCopied"
            />
          </div>
        </template>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" class="w-16 h-16">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.095-3.098L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.095-3.098L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.095 3.098L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.095 3.098ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
          </div>
          <p class="empty-text">上传素材后，AI 将为你生成多风格文案</p>
        </div>
      </section>
    </main>

    <Toast />

    <SettingsModal v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
}
</style>

<style scoped>
#app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
}

.app-header {
  height: 48px;
  flex-shrink: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  padding: 0 1.5rem;
  color: white;
}

.app-header h1 {
  font-size: 1.125rem;
  font-weight: 600;
}

@media (max-width: 400px) {
  .app-header h1 {
    font-size: 0.875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 0 1 auto;
  }
}

.settings-btn {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border-radius: 0.375rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  flex-shrink: 0;
}

.settings-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.main-content {
  flex: 1;
  display: flex;
  gap: 0;
  overflow: hidden;
}

.panel {
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
}

.upload-panel {
  width: 380px;
  flex-shrink: 0;
  border-right: 1px solid #e5e7eb;
}

.display-panel {
  flex: 1;
  min-width: 0;
}

.panel-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.panel-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
}

.btn-remove-all {
  color: #dc2626;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  white-space: nowrap;
}

.btn-remove-all:hover {
  background-color: #fee2e2;
}

.upload-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.generate-bar {
  padding: 0.5rem 1rem;
  flex-shrink: 0;
}

.generate-btn {
  width: 100%;
  padding: 0.625rem;
  border: none;
  border-radius: 0.375rem;
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

.generate-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.generate-btn.loading {
  opacity: 0.85;
}

.loading-content {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-inline {
  margin: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: #fee2e2;
  border-radius: 0.375rem;
  color: #dc2626;
  font-size: 0.75rem;
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
  overflow: hidden;
}

.error-inline p {
  flex: 1;
  margin: 0;
  min-width: 0;
  word-break: break-word;
}

.error-hint {
  font-size: 0.7rem;
  color: #991b1b;
}

.error-close {
  padding: 0.125rem 0.5rem;
  border: 1px solid #dc2626;
  background: transparent;
  color: #dc2626;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 0.7rem;
}

.error-close:hover {
  background: #dc2626;
  color: white;
}

/* 右侧：风格标签 */
.style-tabs {
  padding: 0.5rem 0.75rem 0;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.style-tabs::-webkit-scrollbar {
  display: none;
}

.style-tabs-inner {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
  padding-bottom: 0.5rem;
}

.style-tab-row {
  display: inline-flex;
  gap: 0.375rem;
  white-space: nowrap;
  flex-shrink: 0;
}

.style-tab {
  padding: 0.375rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 9999px;
  background: #f9fafb;
  color: #6b7280;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;
}

.style-tab:hover {
  background: #f3f4f6;
}

.style-tab.active {
  background: #667eea;
  color: white;
  border-color: #667eea;
}

.regenerate-row {
  display: inline-flex;
  gap: 0.375rem;
  flex-shrink: 0;
  white-space: nowrap;
}

.regenerate-mini {
  padding: 0.25rem 0.5rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.25rem;
  background: white;
  color: #6b7280;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
  flex-shrink: 0;
  min-height: 32px;
}

.regenerate-mini:hover:not(:disabled) {
  background: #f3f4f6;
}

.regenerate-mini:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.copy-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0.75rem 1rem;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.empty-icon {
  color: #d1d5db;
  margin-bottom: 1rem;
}

.empty-text {
  font-size: 0.875rem;
}

@media (max-width: 900px) {
  .main-content {
    flex-direction: column;
  }

  .upload-panel {
    width: 100%;
    max-height: 45vh;
    max-height: 45dvh;
    border-right: none;
    border-bottom: 1px solid #e5e7eb;
  }

  .display-panel {
    min-height: 55vh;
    min-height: 55dvh;
  }
}
</style>

