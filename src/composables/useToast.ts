import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

const toasts = ref<ToastItem[]>([]);

export function useToast() {
  const show = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    toasts.value.push({ id, message, type });
    setTimeout(() => dismiss(id), duration);
  };

  const dismiss = (id: string) => {
    const index = toasts.value.findIndex(t => t.id === id);
    if (index !== -1) {
      toasts.value.splice(index, 1);
    }
  };

  return { toasts, show, dismiss };
}
