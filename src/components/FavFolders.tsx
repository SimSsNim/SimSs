import { useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import s from '../styles/ui.module.css';
import { db, type FavKind } from '../lib/db';
import {
  subscribePicker, getPicker, lastFolder, createFolder, renameFolder, deleteFolder, moveFolder, sortFolders,
  FAV_KIND_LABEL, DEFAULT_FOLDER, DEFAULT_FOLDER_NAME,
} from '../lib/favorites';

/** ☆/🔖 를 누르면 뜨는 '어느 폴더에 넣을까요?' (앱에 하나) */
export function FolderPicker() {
  const p = useSyncExternalStore(subscribePicker, getPicker, getPicker);
  const folders = useLiveQuery(async () => (p ? db.favFolders.where('kind').equals(p.kind).toArray() : []), [p?.kind]);
  const [name, setName] = useState('');
  if (!p) return null;
  const last = lastFolder(p.kind);
  const all = [{ id: DEFAULT_FOLDER, name: DEFAULT_FOLDER_NAME }, ...sortFolders(folders ?? [])];
  return (
    <>
      <div onClick={() => p.resolve(undefined)} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 74, background: 'rgb(0 0 0 / 25%)' }} />
      <div role="dialog" aria-label="폴더 고르기" data-testid="folder-picker" className={s.card}
        style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(var(--nav-h) + 12px + env(safe-area-inset-bottom))', zIndex: 75, maxWidth: 520, margin: '0 auto', maxHeight: '70vh', overflow: 'auto', boxShadow: '0 10px 40px rgb(0 0 0 / 25%)' }}>
        <b>{p.title ?? `어느 폴더에 넣을까요? (${FAV_KIND_LABEL[p.kind]})`}</b>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, margin: '10px 0' }}>
          {all.map((f) => (
            <button key={f.id || 'default'} type="button" className={s.chip} aria-pressed={f.id === last} onClick={() => p.resolve(f.id)}
              data-testid={`pick-folder-${f.id || 'default'}`} style={{ borderRadius: 8, justifyContent: 'center', overflow: 'hidden' }}>
              📁 {f.name}
            </button>
          ))}
        </div>
        <form className={s.row} style={{ flexWrap: 'nowrap' }} onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const id = await createFolder(p.kind, name);
          setName('');
          p.resolve(id);
        }}>
          <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="새 폴더 이름" aria-label="새 폴더 이름" data-testid="new-folder-name" style={{ minHeight: 36 }} />
          <button type="submit" className={s.primary} disabled={!name.trim()} style={{ flex: 'none', minHeight: 36 }} data-testid="new-folder-add">만들고 넣기</button>
        </form>
        <button type="button" className={s.ghost} onClick={() => p.resolve(undefined)} style={{ marginTop: 4 }}>취소</button>
      </div>
    </>
  );
}

/** 즐겨찾기 화면: 폴더 관리(추가·이름 바꾸기·순서·삭제) */
export function FolderManager({ kind, onClose }: { kind: FavKind; onClose: () => void }) {
  const folders = useLiveQuery(() => db.favFolders.where('kind').equals(kind).toArray(), [kind]);
  const [name, setName] = useState('');
  const [edit, setEdit] = useState<{ id: string; name: string } | null>(null);
  const list = sortFolders(folders ?? []);
  return (
    <div className={s.card} data-testid="folder-manager" style={{ margin: '6px 0' }}>
      <div className={s.between}><b>📁 {FAV_KIND_LABEL[kind]} 폴더 관리</b><button type="button" className={s.ghost} onClick={onClose}>닫기</button></div>
      <ul className={s.list} style={{ gap: 6, marginTop: 8 }}>
        <li className={s.small + ' ' + s.muted}>📁 {DEFAULT_FOLDER_NAME} (항상 있음 · 폴더를 지우면 안의 항목이 여기로)</li>
        {list.map((f, i) => (
          <li key={f.id} className={s.row} style={{ flexWrap: 'nowrap' }} data-testid="folder-row">
            {edit?.id === f.id ? (
              <form className={s.row} style={{ flexWrap: 'nowrap', flex: 1 }} onSubmit={async (e) => { e.preventDefault(); await renameFolder(f.id, edit.name); setEdit(null); }}>
                <input className={s.input} value={edit.name} onChange={(e) => setEdit({ id: f.id, name: e.target.value })} aria-label="폴더 이름" autoFocus style={{ minHeight: 34 }} data-testid="folder-rename-input" />
                <button type="submit" className={s.primary} style={{ flex: 'none', minHeight: 34 }} data-testid="folder-rename-save">저장</button>
              </form>
            ) : (
              <>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {f.name}</span>
                <button type="button" className={s.iconSm} aria-label="위로" disabled={i === 0} onClick={() => void moveFolder(f.id, -1)}>↑</button>
                <button type="button" className={s.iconSm} aria-label="아래로" disabled={i === list.length - 1} onClick={() => void moveFolder(f.id, 1)}>↓</button>
                <button type="button" className={s.chip} onClick={() => setEdit({ id: f.id, name: f.name })} data-testid="folder-rename">이름 바꾸기</button>
                <button type="button" className={s.chip} data-testid="folder-delete" onClick={() => {
                  if (confirm(`'${f.name}' 폴더를 지울까요? 안의 항목은 '${DEFAULT_FOLDER_NAME}' 폴더로 옮겨져요.`)) void deleteFolder(f.id);
                }}>삭제</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className={s.row} style={{ flexWrap: 'nowrap', marginTop: 8 }} onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; await createFolder(kind, name); setName(''); }}>
        <input className={s.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="새 폴더 이름" aria-label="새 폴더 이름" style={{ minHeight: 36 }} data-testid="manager-new-name" />
        <button type="submit" className={s.primary} disabled={!name.trim()} style={{ flex: 'none', minHeight: 36 }} data-testid="manager-add">＋ 폴더 추가</button>
      </form>
    </div>
  );
}
