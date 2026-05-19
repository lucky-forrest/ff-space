<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useSettings, type AppSettings } from '@/composables/useSettings'
import { changeAppIcon } from '@/services/appIconBridge'

const emit = defineEmits<{
  close: []
}>()

const { settings, saveSettings } = useSettings()

const form = reactive<AppSettings>({
  apiKey: settings.value.apiKey,
  apiProxyUrl: settings.value.apiProxyUrl,
  apiModel: settings.value.apiModel,
  appIcon: settings.value.appIcon,
})

const models = ref<string[]>([])
const loadingModels = ref(false)
const modelError = ref('')
const showDropdown = ref(false)
const scheduleHide = () => setTimeout(() => showDropdown.value = false, 200)

const filteredModels = computed(() => {
  const keyword = form.apiModel.trim().toLowerCase()
  if (!keyword) return models.value
  return models.value.filter(m => m.toLowerCase().includes(keyword))
})

const DEFAULT_MODELS = [
  'deepseek-v4-pro',
  'deepseek-v3',
  'qwen-plus',
  'qwen-max',
  'qwen-turbo',
  'qwen3-235b-a22b',
  'qwen3-32b',
  'qwen3-14b',
  'qwen3-8b',
  'qwen3-4b',
  'qwq-plus',
  'qwq-32b',
  'qwen2.5-72b-instruct',
  'qwen2.5-32b-instruct',
  'qwen2.5-14b-instruct',
  'qwen2.5-7b-instruct',
  'llama3.1-405b-instruct',
  'llama3.1-70b-instruct',
  'llama3.1-8b-instruct',
]

async function fetchModels() {
  const baseUrl = form.apiProxyUrl.trim()
  if (!baseUrl) {
    models.value = [...DEFAULT_MODELS]
    return
  }
  loadingModels.value = true
  modelError.value = ''
  try {
    const url = baseUrl.replace(/\/+$/, '') + '/v1/models'
    const res = await fetch(url, {
      headers: form.apiKey ? { Authorization: `Bearer ${form.apiKey}` } : {},
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.data && Array.isArray(data.data)) {
      models.value = data.data.map((m: { id: string }) => m.id).sort()
    } else if (Array.isArray(data)) {
      models.value = data.map((m: { id: string }) => m.id).sort()
    } else {
      throw new Error('Unexpected response')
    }
  } catch {
    modelError.value = '获取失败，使用默认列表'
    models.value = [...DEFAULT_MODELS]
  } finally {
    loadingModels.value = false
  }
}

function selectModel(model: string) {
  form.apiModel = model
  showDropdown.value = false
}

function clearField(field: 'apiProxyUrl' | 'apiKey') {
  form[field] = ''
}

// 初始加载模型列表
fetchModels()

const handleSave = () => {
  saveSettings({ ...form })
  changeAppIcon(form.appIcon)
  emit('close')
}

</script>

<template>
  <div class="modal-overlay">
    <div class="modal-card">
      <div class="modal-header">
        <h2>设置</h2>
        <button class="modal-close" @click="emit('close')">&times;</button>
      </div>

      <div class="modal-body">
        <p class="modal-desc">
          以下配置保存在浏览器本地，仅当前设备生效。留空的字段将使用 <code>.env.local</code> 中的默认值。
        </p>

        <!-- API 代理地址 -->
        <label class="field">
          <span class="field-label">API 代理地址</span>
          <span class="field-hint">API 请求的代理地址，留空则直连 dashscope.aliyuncs.com</span>
          <div class="input-wrapper">
            <input
              v-model="form.apiProxyUrl"
              type="url"
              class="field-input"
              placeholder="https://dashscope.aliyuncs.com"
              @change="fetchModels"
            />
            <button
              v-if="form.apiProxyUrl"
              class="clear-btn"
              @click="clearField('apiProxyUrl')"
              title="清除"
            >&times;</button>
          </div>
        </label>

        <!-- API Key -->
        <label class="field">
          <span class="field-label">API Key</span>
          <span class="field-hint">阿里云 DashScope API Key，<a href="https://bailian.console.aliyun.com/" target="_blank">点此获取</a></span>
          <div class="input-wrapper">
            <input
              v-model="form.apiKey"
              type="password"
              class="field-input"
              placeholder="sk-..."
            />
            <button
              v-if="form.apiKey"
              class="clear-btn"
              @click="clearField('apiKey')"
              title="清除"
            >&times;</button>
          </div>
        </label>

        <!-- AI 模型 -->
        <label class="field">
          <span class="field-label">AI 模型</span>
          <div class="combo-wrapper">
            <div class="combo-input-row">
              <input
                v-model="form.apiModel"
                type="text"
                class="field-input"
                placeholder="选择或输入模型名称"
                @focus="showDropdown = true"
                @input="showDropdown = true"
                @blur="scheduleHide"
              />
              <button
                type="button"
                class="combo-arrow"
                @click="showDropdown = !showDropdown; if (showDropdown && !models.length && !loadingModels) fetchModels()"
              >▾</button>
            </div>
            <div v-if="showDropdown" class="combo-dropdown">
              <div v-if="loadingModels" class="combo-status">加载中...</div>
              <div v-else-if="modelError" class="combo-status combo-error">{{ modelError }}</div>
              <div v-else-if="!filteredModels.length" class="combo-status">无匹配模型，可手动输入</div>
              <div
                v-for="model in filteredModels"
                :key="model"
                class="combo-option"
                :class="{ selected: form.apiModel === model }"
                @mousedown.prevent="selectModel(model)"
              >{{ model }}</div>
            </div>
          </div>
        </label>

        <!-- 应用图标 -->
        <div class="icon-selector">
          <span class="field-label">应用图标</span>
          <div class="icon-options">
            <label class="icon-option" :class="{ active: form.appIcon === 'default' }">
              <span class="icon-preview icon-default"></span>
              <span class="icon-name">默认</span>
              <input v-model="form.appIcon" type="radio" value="default" class="icon-radio" />
            </label>
            <label class="icon-option" :class="{ active: form.appIcon === 'blue' }">
              <span class="icon-preview icon-blue"></span>
              <span class="icon-name">蓝色</span>
              <input v-model="form.appIcon" type="radio" value="blue" class="icon-radio" />
            </label>
            <label class="icon-option" :class="{ active: form.appIcon === 'purple' }">
              <span class="icon-preview icon-purple"></span>
              <span class="icon-name">紫色</span>
              <input v-model="form.appIcon" type="radio" value="purple" class="icon-radio" />
            </label>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-cancel" @click="emit('close')">取消</button>
        <button class="btn btn-save" @click="handleSave">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-card {
  background: white;
  border-radius: 0.75rem;
  width: 440px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #f3f4f6;
}

.modal-header h2 {
  font-size: 1rem;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.modal-close {
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 1.25rem;
  color: #9ca3af;
  cursor: pointer;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-close:hover {
  background: #f3f4f6;
  color: #374151;
}

.modal-body {
  padding: 1.25rem;
}

.modal-desc {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0 0 1rem;
  line-height: 1.5;
}

.modal-desc code {
  background: #f3f4f6;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.7rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-bottom: 1rem;
}

.field-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
}

.field-hint {
  font-size: 0.7rem;
  color: #9ca3af;
  margin-bottom: 0.25rem;
}

.field-hint a {
  color: #667eea;
}

.input-wrapper {
  position: relative;
}

.input-wrapper .field-input {
  padding-right: 2rem;
}

.field-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #111827;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.field-input::placeholder {
  color: #d1d5db;
}

.clear-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border: none;
  background: #e5e7eb;
  color: #6b7280;
  font-size: 0.875rem;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  padding: 0;
}

.clear-btn:hover {
  background: #d1d5db;
  color: #374151;
}

.combo-wrapper {
  position: relative;
}

.combo-input-row {
  display: flex;
  gap: 0;
}

.combo-input-row .field-input {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.combo-arrow {
  padding: 0 0.625rem;
  border: 1px solid #e5e7eb;
  border-left: none;
  border-radius: 0 0.375rem 0.375rem 0;
  background: #f9fafb;
  color: #6b7280;
  cursor: pointer;
  font-size: 0.75rem;
}

.combo-arrow:hover {
  background: #f3f4f6;
}

.combo-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 180px;
  overflow-y: auto;
  background: white;
  border: 1px solid #e5e7eb;
  border-top: none;
  border-radius: 0 0 0.375rem 0.375rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.combo-option {
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: #374151;
  cursor: pointer;
}

.combo-option:hover {
  background: #f3f4f6;
}

.combo-option.selected {
  background: #eef0ff;
  color: #667eea;
}

.combo-status {
  padding: 0.625rem 0.75rem;
  font-size: 0.75rem;
  color: #9ca3af;
}

.combo-error {
  color: #ef4444;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #f3f4f6;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: opacity 0.15s;
}

.btn:hover {
  opacity: 0.85;
}

.btn-cancel {
  background: #f3f4f6;
  color: #374151;
}

.btn-save {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.icon-selector {
  margin-bottom: 1rem;
}

.icon-options {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.icon-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: border-color 0.15s;
}

.icon-option:hover {
  border-color: #d1d5db;
}

.icon-option.active {
  border-color: #667eea;
}

.icon-radio {
  display: none;
}

.icon-preview {
  width: 40px;
  height: 40px;
  border-radius: 0.5rem;
}

.icon-default {
  background: linear-gradient(135deg, #26A69A 0%, #1abc9c 100%);
}

.icon-blue {
  background: linear-gradient(135deg, #1976D2 0%, #42a5f5 100%);
}

.icon-purple {
  background: linear-gradient(135deg, #7B1FA2 0%, #ab47bc 100%);
}

.icon-name {
  font-size: 0.7rem;
  color: #6b7280;
}

.icon-option.active .icon-name {
  color: #667eea;
  font-weight: 500;
}
</style>
