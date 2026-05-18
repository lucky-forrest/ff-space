<script setup lang="ts">
import { ref, computed } from 'vue';

export interface MediaFile {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  name: string;
  size: number;
}

const emit = defineEmits<{
  filesSelected: [files: MediaFile[]];
  filesRemoved: [files: MediaFile[]];
}>();

const props = defineProps<{
  accept?: string;
  maxSize?: number; // in MB
  maxFiles?: number;
}>();

const mediaFiles = ref<MediaFile[]>([]);
const dragOver = ref(false);
const error = ref('');

// 默认值设置
const acceptedTypes = computed(() => props.accept || 'image/*,video/*');
const maxSizeInBytes = computed(() => (props.maxSize || 10) * 1024 * 1024); // 默认10MB
const maxFilesCount = computed(() => props.maxFiles || 5);

const validateFile = (file: File): boolean => {
  // 检查文件类型
  const validType = acceptedTypes.value.split(',').some(type => {
    const trimmedType = type.trim();
    if (trimmedType.endsWith('/*')) {
      return file.type.startsWith(trimmedType.slice(0, -2));
    }
    return file.type === trimmedType || file.name.toLowerCase().endsWith(trimmedType.replace('.', ''));
  });

  if (!validType) {
    error.value = `不支持的文件类型: ${file.type}`;
    return false;
  }

  // 检查文件大小
  if (file.size > maxSizeInBytes.value) {
    error.value = `文件过大: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB). 最大允许 ${(maxSizeInBytes.value / 1024 / 1024).toFixed(2)}MB`;
    return false;
  }

  return true;
};

const createPreview = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
};

const addFiles = async (files: FileList) => {
  error.value = '';

  const validFiles: MediaFile[] = [];
  const totalFiles = mediaFiles.value.length + files.length;

  if (totalFiles > maxFilesCount.value) {
    error.value = `最多只能上传 ${maxFilesCount.value} 个文件`;
    return;
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (validateFile(file)) {
      const previewUrl = await createPreview(file);
      const mediaFile: MediaFile = {
        id: Math.random().toString(36).substring(2, 9),
        file,
        previewUrl,
        type: file.type.startsWith('image') ? 'image' : 'video',
        name: file.name,
        size: file.size,
      };
      validFiles.push(mediaFile);
    }
  }

  if (validFiles.length > 0) {
    mediaFiles.value = [...mediaFiles.value, ...validFiles];
    emit('filesSelected', validFiles);
  }
};

const handleFileInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    addFiles(target.files);
  }
};

const handleDrop = (event: DragEvent) => {
  event.preventDefault();
  dragOver.value = false;

  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    addFiles(event.dataTransfer.files);
  }
};

const removeFile = (id: string) => {
  const index = mediaFiles.value.findIndex(f => f.id === id);
  if (index !== -1) {
    const removedFile = mediaFiles.value[index];
    mediaFiles.value.splice(index, 1);
    mediaFiles.value = [...mediaFiles.value]; // 触发响应式更新
    emit('filesRemoved', [removedFile]);
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
};

const removeAllFiles = () => {
  const removedFiles = [...mediaFiles.value];
  mediaFiles.value = [];
  emit('filesRemoved', removedFiles);
};
</script>

<template>
  <div class="media-uploader">
    <!-- 上传区域 -->
    <div
      class="upload-area"
      :class="{ 'drag-over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop="handleDrop"
    >
      <div class="upload-content">
        <div class="upload-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p class="upload-text">拖拽文件到此处或点击上传</p>
        <p class="upload-hint">支持图片和视频格式，最大{{ maxSize || 10 }}MB</p>
        <input
          type="file"
          class="file-input"
          :accept="acceptedTypes"
          :multiple="maxFiles !== 1"
          @change="handleFileInput"
        />
        <button
          type="button"
          class="upload-btn primary"
          @click="$el.querySelector('.file-input')?.click()"
        >
          选择文件
        </button>
      </div>
    </div>

    <!-- 错误信息 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 已选文件列表 -->
    <div v-if="mediaFiles.length > 0" class="selected-files">
      <div class="files-header">
        <h3>已选择的文件 ({{ mediaFiles.length }}/{{ maxFilesCount }})</h3>
        <button
          type="button"
          class="btn-remove-all"
          @click="removeAllFiles"
        >
          全部移除
        </button>
      </div>

      <div class="files-grid">
        <div
          v-for="file in mediaFiles"
          :key="file.id"
          class="file-item"
        >
          <div class="file-preview">
            <img
              v-if="file.type === 'image'"
              :src="file.previewUrl"
              :alt="file.name"
              @error="(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/assets/placeholder-image.svg';
              }"
            />
            <video
              v-else
              :src="file.previewUrl"
              controls
              @error="(e) => {
                const target = e.target as HTMLVideoElement;
                target.parentElement!.innerHTML = '<div class=\'video-placeholder\'>视频预览不可用</div>';
              }"
            />
          </div>
          <div class="file-info">
            <div class="file-name">{{ file.name }}</div>
            <div class="file-size">{{ formatFileSize(file.size) }}</div>
          </div>
          <button
            type="button"
            class="remove-btn"
            @click="removeFile(file.id)"
            :aria-label="`移除 ${file.name}`"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-uploader {
  width: 100%;
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 0.5rem;
  padding: 2rem;
  text-align: center;
  transition: all 0.2s ease-in-out;
  background-color: #f9fafb;
  position: relative;
}

.upload-area.drag-over {
  border-color: #3b82f6;
  background-color: #dbeafe;
  transform: scale(1.02);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.upload-icon {
  color: #9ca3af;
}

.upload-text {
  font-size: 1.125rem;
  font-weight: 500;
  color: #1f2937;
}

.upload-hint {
  color: #6b7280;
  margin-bottom: 1rem;
}

.file-input {
  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  opacity: 0;
  cursor: pointer;
}

.upload-btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.2s;
}

.upload-btn.primary {
  background-color: #3b82f6;
  color: white;
}

.upload-btn.primary:hover {
  background-color: #2563eb;
}

.error-message {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background-color: #fee2e2;
  color: #dc2626;
  border-radius: 0.375rem;
  font-size: 0.875rem;
}

.selected-files {
  margin-top: 1.5rem;
}

.files-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.files-header h3 {
  font-size: 1.125rem;
  font-weight: 500;
  color: #1f2937;
}

.btn-remove-all {
  color: #dc2626;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
}

.btn-remove-all:hover {
  background-color: #fee2e2;
}

.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
}

.file-item {
  position: relative;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  background-color: white;
}

.file-preview {
  width: 100%;
  height: 120px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f3f4f6;
}

.file-preview img,
.file-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6b7280;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.5rem;
}

.file-info {
  padding: 0.5rem;
  font-size: 0.75rem;
}

.file-name {
  font-weight: 500;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  color: #6b7280;
  margin-top: 0.125rem;
}

.remove-btn {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
  background-color: rgba(255, 255, 255, 0.8);
  border: none;
  border-radius: 50%;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.remove-btn:hover {
  background-color: rgba(239, 68, 68, 0.8);
  color: white;
}

@media (max-width: 640px) {
  .files-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }

  .file-preview {
    height: 100px;
  }
}
</style>