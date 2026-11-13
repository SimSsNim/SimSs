// 즐겨찾기 폴더: 종류(문장·단어·문법·문제)마다 폴더를 만들고, ☆/🔖 를 누를 때 폴더를 고른다
import { db, type FavKind, type FavAssignRow, type FavFolderRow } from './db';

export type { FavKind };
export const FAV_KIND_LABEL: Record<FavKind, string> = { sentence: '문장', word: '단어', grammar: '문법', question: '문제' };
export const DEFAULT_FOLDER = '';
export const DEFAULT_FOLDER_NAME = '기본';
const LAST_KEY = 'pilsa.lastFavFolder';

export const assignKey = (kind: FavKind, ref: string) => `${kind}:${ref}`;

// ---- 폴더 고르기 창(앱에 하나) ----
type Pending = { kind: FavKind; title?: string; resolve: (folderId: string | undefined) => void } | null;
let pending: Pending = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const subscribePicker = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const getPicker = () => pending;
/** 폴더 고르기 창을 띄운다. 고르면 폴더 id('' = 기본), 취소하면 undefined */
export function pickFolder(kind: FavKind, title?: string): Promise<string | undefined> {
  pending?.resolve(undefined);
  return new Promise((resolve) => {
    pending = { kind, title, resolve: (v) => { pending = null; emit(); if (v !== undefined) rememberLast(kind, v); resolve(v); } };
    emit();
  });
}
export function lastFolder(kind: FavKind): string {
  try { return (JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Record<string, string>)[kind] ?? DEFAULT_FOLDER; } catch { return DEFAULT_FOLDER; }
}
function rememberLast(kind: FavKind, id: string) {
  try {
    const m = JSON.parse(localStorage.getItem(LAST_KEY) ?? '{}') as Record<string, string>;
    m[kind] = id;
    localStorage.setItem(LAST_KEY, JSON.stringify(m));
  } catch { /* 저장 불가 */ }
}

/**
 * 즐겨찾기 켜기/끄기. 켤 때는 폴더를 먼저 고르고(취소하면 아무것도 안 함), apply(원래 표시 바꾸기)를 부른다.
 * 돌려주는 값: 바뀌었으면 true
 */
export async function setFavorite(kind: FavKind, ref: string, on: boolean, apply: () => Promise<void>, snap?: FavAssignRow['snap']): Promise<boolean> {
  const key = assignKey(kind, ref);
  if (!on) {
    await apply();
    await db.favAssign.delete(key);
    return true;
  }
  const folderId = await pickFolder(kind);
  if (folderId === undefined) return false;
  await apply();
  await db.favAssign.put({ key, kind, ref, folderId, addedAt: Date.now(), snap });
  return true;
}

/** 이미 즐겨찾기한 항목을 다른 폴더로 */
export async function moveFavorite(kind: FavKind, ref: string): Promise<void> {
  const folderId = await pickFolder(kind, '어느 폴더로 옮길까요?');
  if (folderId === undefined) return;
  const key = assignKey(kind, ref);
  const cur = await db.favAssign.get(key);
  await db.favAssign.put({ ...(cur ?? { key, kind, ref, addedAt: Date.now() }), folderId });
}

export async function createFolder(kind: FavKind, name: string): Promise<string> {
  const list = await db.favFolders.where('kind').equals(kind).toArray();
  const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await db.favFolders.put({ id, kind, name: name.trim() || '새 폴더', order: list.length, createdAt: Date.now() });
  return id;
}
export const renameFolder = (id: string, name: string) => db.favFolders.update(id, { name: name.trim() || '이름 없음' });
/** 폴더 지우기: 안의 항목은 기본 폴더로(즐겨찾기 표시는 그대로) */
export async function deleteFolder(id: string): Promise<void> {
  await db.transaction('rw', db.favFolders, db.favAssign, async () => {
    await db.favAssign.where('folderId').equals(id).modify({ folderId: DEFAULT_FOLDER });
    await db.favFolders.delete(id);
  });
}
export async function moveFolder(id: string, dir: -1 | 1): Promise<void> {
  const f = await db.favFolders.get(id);
  if (!f) return;
  const list = (await db.favFolders.where('kind').equals(f.kind).toArray()).sort((a, b) => a.order - b.order);
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.favFolders.bulkPut(list.map((x, k) => ({ ...x, order: k })));
}
export const sortFolders = (l: FavFolderRow[]) => l.slice().sort((a, b) => a.order - b.order);
