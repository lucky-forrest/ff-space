import { ref } from 'vue'

export interface AppSettings {
  apiKey: string
  apiProxyUrl: string
  apiModel: string
  appIcon: 'default' | 'blue' | 'purple'
}

const STORAGE_KEY = 'ff-space-settings'

function loadFromStorage(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }

  return {
    apiKey: import.meta.env.VITE_DASHSCOPE_API_KEY || '',
    apiProxyUrl: import.meta.env.VITE_API_PROXY_URL || '',
    apiModel: import.meta.env.VITE_API_MODEL || '',
    appIcon: 'default',
  }
}

const settings = ref<AppSettings>(loadFromStorage())

export function useSettings() {
  const saveSettings = (val: AppSettings) => {
    settings.value = { ...val }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
  }

  const clearSettings = () => {
    localStorage.removeItem(STORAGE_KEY)
    settings.value = {
      apiKey: import.meta.env.VITE_DASHSCOPE_API_KEY || '',
      apiProxyUrl: import.meta.env.VITE_API_PROXY_URL || '',
      apiModel: import.meta.env.VITE_API_MODEL || '',
      appIcon: 'default',
    }
  }

  return { settings, saveSettings, clearSettings }
}
