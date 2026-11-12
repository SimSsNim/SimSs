import { useSyncExternalStore } from 'react';
import s from '../styles/ui.module.css';

interface ToastItem { id: number; text: string; action?: { label: string; run: () => void }; sticky?: boolean }
let items: ToastItem[] = [];
let seq = 0;
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

export function toast(text: string, o: { action?: ToastItem['action']; sticky?: boolean; ms?: number } = {}) {
  const id = ++seq;
  items = [...items, { id, text, action: o.action, sticky: o.sticky }];
  emit();
  if (!o.sticky) setTimeout(() => dismiss(id), o.ms ?? 2500);
  return id;
}
export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function Toasts() {
  const list = useSyncExternalStore((l) => (ls.add(l), () => ls.delete(l)), () => items, () => items);
  const t = list[list.length - 1];
  if (!t) return null;
  return (
    <div className={s.toast} role="status" aria-live="polite">
      <span>{t.text}</span>
      {t.action && (
        <button type="button" onClick={() => { t.action!.run(); dismiss(t.id); }}>
          {t.action.label}
        </button>
      )}
      {t.sticky && (
        <button type="button" aria-label="닫기" onClick={() => dismiss(t.id)}>
          ✕
        </button>
      )}
    </div>
  );
}
