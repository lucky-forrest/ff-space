import { registerPlugin } from '@capacitor/core';

export interface AppIconPlugin {
  changeIcon(options: { iconName: string }): Promise<void>;
  getCurrentIcon(): Promise<{ iconName: string }>;
}

const AppIcon = registerPlugin<AppIconPlugin>('AppIcon');

const IN_CAPACITOR = typeof (window as any).Capacitor !== 'undefined';

export function changeAppIcon(iconName: 'default' | 'blue' | 'purple'): Promise<void> {
  if (!IN_CAPACITOR) return Promise.resolve();
  return AppIcon.changeIcon({ iconName });
}

export function getCurrentAppIcon(): Promise<string> {
  if (!IN_CAPACITOR) return Promise.resolve('default');
  return AppIcon.getCurrentIcon().then(res => res.iconName).catch(() => 'default');
}
