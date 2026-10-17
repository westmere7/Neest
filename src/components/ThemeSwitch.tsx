import { Monitor, Moon, Sun } from 'lucide-react';
import { usePrefsStore, type ThemePref } from '@/state/uiStores';
import { Segmented } from './ui';

export function ThemeSwitch({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const pref = usePrefsStore((s) => s.themePref);
  const set = usePrefsStore((s) => s.setThemePref);
  return (
    <Segmented<ThemePref>
      label="Colour theme"
      size={size}
      value={pref}
      onChange={set}
      options={[
        { value: 'light', label: <Sun size={14} aria-label="Light" />, title: 'Light theme' },
        { value: 'dark', label: <Moon size={14} aria-label="Dark" />, title: 'Dark theme' },
        { value: 'system', label: <Monitor size={14} aria-label="System" />, title: 'Follow system theme' },
      ]}
    />
  );
}
