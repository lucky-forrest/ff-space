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

defineExpose({ removeAllFiles });
</script>

<template>
  <div class="media-uploader" @dragover.prevent="dragOver = true" @dragleave="dragOver = false" @drop="handleDrop">
    <!-- 错误信息 -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- 文件网格 -->
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

      <!-- 上传卡片 -->
      <div
        v-if="mediaFiles.length < maxFilesCount"
        class="file-item upload-card"
        :class="{ 'drag-over': dragOver }"
      >
        <div class="upload-card-content">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span class="upload-card-text">
           请点击或拖拽上传
          </span>
        </div>
        <input
          type="file"
          class="file-input"
          :accept="acceptedTypes"
          :multiple="maxFiles !== 1"
          @change="handleFileInput"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-uploader {
  width: 100%;
}

.error-message {
  margin-bottom: 0.5rem;
  padding: 0.5rem;
  background-color: #fee2e2;
  color: #dc2626;
  border-radius: 0.375rem;
  font-size: 0.875rem;
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
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
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

/* 上传卡片 */
.upload-card {
  cursor: pointer;
  transition: all 0.2s;
}

.upload-card:hover {
  border-color: #3b82f6;
  background-color: #f0f7ff;
}

.upload-card.drag-over {
  border-color: #3b82f6;
  background-color: #dbeafe;
  border-style: dashed;
}

.upload-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  height: 100%;
  min-height: 160px;
  color: #9ca3af;
  padding: 1rem;
}

.upload-card-text {
  font-size: 0.8rem;
  font-weight: 500;
  text-align: center;
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

@media (max-width: 640px) {
  .remove-btn {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
  }

  .files-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  }

  .file-preview {
    height: 80px;
  }

  .upload-card-content {
    min-height: 120px;
  }
}
</style>