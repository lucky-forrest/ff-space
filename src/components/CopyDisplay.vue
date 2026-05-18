<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { CopyResult } from '@/services/aiCopyService';
import { useToast } from '@/composables/useToast';

const { show: showToast } = useToast();

const props = defineProps<{
  copies: CopyResult[];
  selectedStyleId?: string;
}>();

defineEmits<{
  copyUpdated: [updatedCopy: CopyResult];
  copyCopied: [copy: CopyResult];
}>();

const selectedIndex = ref(0);
const isEditing = ref(false);
const editedCopy = ref<CopyResult | null>(null);

const currentCopy = computed(() => {
  if (props.copies.length === 0) return null;
  if (selectedIndex.value >= props.copies.length) selectedIndex.value = 0;
  return props.copies[selectedIndex.value];
});

watch(() => props.copies, () => {
  selectedIndex.value = 0;
  isEditing.value = false;
  editedCopy.value = null;
});

watch(() => props.selectedStyleId, () => {
  if (props.selectedStyleId) {
    const index = props.copies.findIndex(c => c.style.toLowerCase().includes(props.selectedStyleId!.toLowerCase()));
    if (index !== -1) selectedIndex.value = index;
  }
});

const startEditing = () => {
  if (currentCopy.value) {
    editedCopy.value = {
      ...currentCopy.value,
      hashtags: [...currentCopy.value.hashtags],
      musicSuggestions: [...currentCopy.value.musicSuggestions]
    };
    isEditing.value = true;
  }
};

const saveEdit = () => {
  if (editedCopy.value) {
    const updated = [...props.copies];
    updated[selectedIndex.value] = { ...editedCopy.value };
    selectedIndex.value = selectedIndex.value;
    isEditing.value = false;
    editedCopy.value = null;
  }
};

const cancelEdit = () => {
  isEditing.value = false;
  editedCopy.value = null;
};

const copyToClipboard = async () => {
  if (!currentCopy.value) return;
  const text = `${currentCopy.value.title}\n\n${currentCopy.value.content}\n\n${currentCopy.value.hashtags.join(' ')}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板', 'success');
  } catch {
    showToast('复制失败，请手动复制', 'error');
  }
};

const editedHashtagsText = computed({
  get: () => editedCopy.value?.hashtags.join(' ') ?? '',
  set: (val: string) => {
    if (editedCopy.value) {
      editedCopy.value.hashtags = val.split(/\s+/).filter(Boolean);
    }
  }
});

const editedMusicText = computed({
  get: () => editedCopy.value?.musicSuggestions.join('\n') ?? '',
  set: (val: string) => {
    if (editedCopy.value) {
      editedCopy.value.musicSuggestions = val.split('\n').filter(Boolean);
    }
  }
});

const editedTitle = computed({
  get: () => editedCopy.value?.title ?? '',
  set: (val: string) => { if (editedCopy.value) editedCopy.value.title = val; }
});

const editedContent = computed({
  get: () => editedCopy.value?.content ?? '',
  set: (val: string) => { if (editedCopy.value) editedCopy.value.content = val; }
});
</script>

<template>
  <div v-if="!currentCopy" class="empty-copy">
    <p>暂无文案</p>
  </div>

  <div v-else class="copy-display">
    <!-- 查看模式 -->
    <div v-if="!isEditing" class="view-mode">
      <h3 class="copy-title">{{ currentCopy.title }}</h3>

      <div class="copy-body">
        <p class="body-text">{{ currentCopy.content }}</p>
      </div>

      <div class="copy-hashtags">
        <span v-for="tag in currentCopy.hashtags" :key="tag" class="hashtag">
          {{ tag }}
        </span>
      </div>

      <div class="copy-music">
        <span class="music-label">BGM</span>
        <span class="music-names">{{ currentCopy.musicSuggestions.join(' / ') }}</span>
      </div>
    </div>

    <!-- 编辑模式 -->
    <div v-else class="edit-mode">
      <div class="edit-field">
        <label>标题</label>
        <input v-model="editedTitle" type="text" class="edit-input" />
      </div>
      <div class="edit-field">
        <label>正文</label>
        <textarea v-model="editedContent" class="edit-textarea" rows="3"></textarea>
      </div>
      <div class="edit-field">
        <label>标签（空格分隔）</label>
        <input v-model="editedHashtagsText" type="text" class="edit-input" />
      </div>
      <div class="edit-field">
        <label>BGM（每行一个）</label>
        <textarea v-model="editedMusicText" class="edit-textarea" rows="2"></textarea>
      </div>
      <div class="edit-actions">
        <button class="btn-cancel" @click="cancelEdit">取消</button>
        <button class="btn-save" @click="saveEdit">保存</button>
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="actions-bar">
      <button class="btn-icon" @click="startEditing" v-if="!isEditing">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
        </svg>
        编辑
      </button>
      <button class="btn-copy" @click="copyToClipboard">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.1045-2.098.368-2.098h4.368c1.323 0 2.368.963 2.368 2.098V7.5m8.25 3V15H3V7.5m8.25 3v.008c0 .048.007.096.022.142m8.025-.142V15a3 3 0 003 3h2.25a3 3 0 003-3V7.5" />
        </svg>
        复制全文
      </button>
    </div>
  </div>
</template>

<style scoped>
.copy-display {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.empty-copy {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #9ca3af;
  font-size: 0.875rem;
}

.view-mode {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.copy-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.5rem;
  line-height: 1.4;
}

.copy-body {
  margin-bottom: 0.75rem;
}

.body-text {
  color: #4b5563;
  line-height: 1.6;
  white-space: pre-wrap;
  font-size: 0.875rem;
  margin: 0;
}

.copy-hashtags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.hashtag {
  background-color: #e0f2fe;
  color: #0369a1;
  padding: 0.2rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.copy-music {
  display: flex;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #166534;
  background: #f0fdf4;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
}

.music-label {
  font-weight: 600;
  flex-shrink: 0;
}

.music-names {
  color: #15803d;
}

/* 编辑模式 */
.edit-mode {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.edit-field {
  margin-bottom: 0.625rem;
}

.edit-field label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
  margin-bottom: 0.25rem;
}

.edit-input {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-family: inherit;
}

.edit-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.edit-textarea {
  width: 100%;
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-family: inherit;
  resize: vertical;
  min-height: 40px;
}

.edit-textarea:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
}

.edit-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}

.btn-cancel {
  padding: 0.3rem 0.75rem;
  border: 1px solid #d1d5db;
  background: white;
  color: #4b5563;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-cancel:hover {
  background: #f3f4f6;
}

.btn-save {
  padding: 0.3rem 0.75rem;
  border: none;
  background: #3b82f6;
  color: white;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.btn-save:hover {
  background: #2563eb;
}

/* 操作按钮 */
.actions-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid #f3f4f6;
  flex-shrink: 0;
}

.btn-icon,
.btn-copy {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}

.btn-icon {
  background: #f3f4f6;
  color: #4b5563;
}

.btn-icon:hover {
  background: #e5e7eb;
}

.btn-copy {
  background: #3b82f6;
  color: white;
}

.btn-copy:hover {
  background: #2563eb;
}
</style>
