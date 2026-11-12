// 앱 전체에 오디오 요소는 하나. 탭을 바꿔도 재생이 이어진다.
import { useSyncExternalStore } from 'react';
import type { Lesson, Sentence } from '../lib/types';
import { lessonKeyOf } from '../lib/types';
import { getSettings } from '../lib/settings';
import { speak, cancelSpeech, availableAccents, getVoiceState } from '../lib/tts';
import { autoCheck } from '../lib/progress';
import { cachedAudioBlob } from '../lib/audioCache';

export interface Segment { id: string; start: number; end: number | null }

export interface PlayerState {
  lessonKey: string | null;
  title: string;
  artist: string;
  mode: 'audio' | 'tts' | 'none';
  src: string | null;
  srcUrl: string | null; // 원래 URL (캐시 blob 이어도)
  srcKind: 'high' | 'low' | 'cached' | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  loop: boolean;
  a: number | null;
  b: number | null;
  error: string | null;
  segments: Segment[];
  introSkipSec: number | null;
  currentSentenceId: string | null;
  coverage: number;
  sentences: Sentence[];
  ttsIndex: number;
  ttsAccent: string | null;
}

const initial: PlayerState = {
  lessonKey: null, title: '', artist: '', mode: 'none', src: null, srcUrl: null, srcKind: null,
  playing: false, currentTime: 0, duration: 0, rate: 1, loop: false, a: null, b: null, error: null,
  segments: [], introSkipSec: null, currentSentenceId: null, coverage: 0, sentences: [], ttsIndex: 0, ttsAccent: null,
};

let state: PlayerState = initial;
const listeners = new Set<() => void>();
function set(patch: Partial<PlayerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getPlayer = () => state;
export function usePlayer(): PlayerState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

let audio: HTMLAudioElement | null = null;
let played = new Set<number>();
let ttsSpoken = new Set<string>();
let listenChecked = false;
let segmentStop: { end: number; resolve: () => void } | null = null;
let blobUrl: string | null = null;

function el(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'metadata';
  a.hidden = true;
  a.setAttribute('aria-hidden', 'true');
  document.body.appendChild(a); // 하나뿐인 오디오 요소(화면에는 안 보임)
  a.preservesPitch = true;
  (a as HTMLAudioElement & { webkitPreservesPitch?: boolean }).webkitPreservesPitch = true;
  a.addEventListener('timeupdate', onTime);
  a.addEventListener('loadedmetadata', () => set({ duration: a.duration || 0, error: null }));
  a.addEventListener('durationchange', () => set({ duration: Number.isFinite(a.duration) ? a.duration : 0 }));
  a.addEventListener('play', () => set({ playing: true }));
  a.addEventListener('pause', () => set({ playing: false }));
  a.addEventListener('ended', () => {
    set({ playing: false });
    if (segmentStop) {
      segmentStop.resolve();
      segmentStop = null;
    }
  });
  a.addEventListener('error', () => set({ error: '음원을 불러오지 못했어요(오프라인이거나 주소 문제). 아래 TTS로 들을 수 있어요.', playing: false }));
  audio = a;
  return a;
}

function onTime() {
  const a = el();
  const t = a.currentTime;
  if (!a.paused && !a.seeking) played.add(Math.floor(t));
  const dur = a.duration || state.duration;
  const coverage = dur > 0 ? Math.min(1, played.size / Math.max(1, Math.ceil(dur))) : 0;
  // A-B 반복
  if (state.a !== null && state.b !== null && t >= state.b) a.currentTime = state.a;
  // 문장 하나만 재생
  if (segmentStop && t >= segmentStop.end) {
    a.pause();
    segmentStop.resolve();
    segmentStop = null;
  }
  const seg = findSegment(state.segments, t);
  set({ currentTime: t, coverage, currentSentenceId: seg?.id ?? (state.mode === 'audio' ? null : state.currentSentenceId) });
  maybeCheckListen(coverage);
}

function maybeCheckListen(coverage: number) {
  if (!listenChecked && coverage >= 0.8 && state.lessonKey) {
    listenChecked = true;
    void autoCheck(state.lessonKey, 'listen');
  }
}

export function findSegment(segs: Segment[], t: number): Segment | null {
  let found: Segment | null = null;
  for (const s of segs) {
    if (s.start <= t + 0.05) found = s;
    else break;
  }
  if (found && found.end !== null && t > found.end + 0.05) return null;
  return found;
}

export function buildSegments(lesson: Lesson, starts: Record<string, number> | undefined): Segment[] {
  const flat = lesson.paragraphs.flatMap((p) => p.sentences);
  const list = flat.map((s) => ({ id: s.id, start: starts?.[s.id] ?? s.audioStartSec ?? null, endData: s.audioEndSec ?? null }));
  const known = list.filter((x) => x.start !== null) as { id: string; start: number; endData: number | null }[];
  known.sort((x, y) => x.start - y.start);
  return known.map((x, i) => ({ id: x.id, start: x.start, end: starts?.[x.id] === undefined && x.endData !== null ? x.endData : known[i + 1]?.start ?? null }));
}

function preferLow(): boolean {
  const q = getSettings().audioQuality;
  if (q === 'low') return true;
  if (q === 'high') return false;
  const c = (navigator as Navigator & { connection?: { type?: string; saveData?: boolean } }).connection;
  return !!c && (c.type === 'cellular' || !!c.saveData);
}

/** 레슨을 플레이어에 올린다. 같은 레슨이면 그대로 둔다(재생 유지). */
export async function loadLesson(lesson: Lesson, opts: { quality?: 'high' | 'low' } = {}) {
  const key = lessonKeyOf(lesson.track, lesson.id);
  if (state.lessonKey === key && !opts.quality) return;
  stopAll();
  played = new Set();
  ttsSpoken = new Set();
  listenChecked = false;
  const sentences = lesson.paragraphs.flatMap((p) => p.sentences);
  const base: Partial<PlayerState> = {
    ...initial, lessonKey: key, title: lesson.title, artist: lesson.audio?.reader ?? (lesson.track === 'toeic' ? 'TTS' : ''),
    sentences, rate: state.rate || 1, segments: state.lessonKey === key ? state.segments : [],
    introSkipSec: state.lessonKey === key ? state.introSkipSec : null,
  };
  if (!lesson.audio) {
    set({ ...base, mode: 'tts', rate: getSettings().ttsRate });
    setMediaSession();
    return;
  }
  const low = opts.quality ? opts.quality === 'low' : preferLow();
  const url = low && lesson.audio.mp3Low ? lesson.audio.mp3Low : lesson.audio.mp3;
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = null;
  let src = url;
  let srcKind: PlayerState['srcKind'] = low && lesson.audio.mp3Low ? 'low' : 'high';
  const cached = await cachedAudioBlob(lesson.audio.mp3).catch(() => null) ?? (lesson.audio.mp3Low ? await cachedAudioBlob(lesson.audio.mp3Low).catch(() => null) : null);
  if (cached) {
    blobUrl = URL.createObjectURL(cached);
    src = blobUrl;
    srcKind = 'cached';
  }
  set({ ...base, mode: 'audio', src, srcUrl: url, srcKind, duration: lesson.audio.durationSec ?? 0 });
  const a = el();
  a.src = src;
  a.playbackRate = state.rate;
  a.load();
  setMediaSession();
}

export function setSegments(segments: Segment[], introSkipSec: number | null) {
  set({ segments, introSkipSec });
}

function setMediaSession() {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: state.title, artist: state.artist || '필사 노트', album: '필사 노트' });
    navigator.mediaSession.setActionHandler('play', () => play());
    navigator.mediaSession.setActionHandler('pause', () => pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-5));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(5));
    navigator.mediaSession.setActionHandler('seekto', (d) => d.seekTime !== undefined && seek(d.seekTime));
  } catch {
    /* 일부 브라우저는 지원 안 함 */
  }
}

export function play() {
  if (state.mode === 'tts') return void playTTS(state.ttsIndex);
  if (state.mode !== 'audio') return;
  const a = el();
  if (state.introSkipSec && a.currentTime < 1) a.currentTime = state.introSkipSec;
  segmentStop = null;
  a.playbackRate = state.rate;
  void a.play().catch(() => set({ playing: false }));
}
export function pause() {
  if (state.mode === 'tts') return stopTTS();
  audio?.pause();
}
export const toggle = () => (state.playing ? pause() : play());

export function seek(t: number) {
  if (state.mode !== 'audio') return;
  const a = el();
  a.currentTime = Math.max(0, Math.min(t, a.duration || t));
  set({ currentTime: a.currentTime });
}
export function skip(delta: number) {
  if (state.mode === 'tts') {
    const n = state.sentences.length;
    const idx = Math.max(0, Math.min(n - 1, state.ttsIndex + (delta < 0 ? -1 : 1)));
    set({ ttsIndex: idx, currentSentenceId: state.sentences[idx]?.id ?? null });
    if (state.playing) void playTTS(idx);
    return;
  }
  seek((audio?.currentTime ?? 0) + delta);
}
export function setRate(r: number) {
  const rate = Math.round(Math.max(0.5, Math.min(1.5, r)) * 100) / 100;
  set({ rate });
  if (audio) audio.playbackRate = rate;
}
export function setLoop(loop: boolean) {
  set({ loop });
  if (audio) audio.loop = loop;
}
export function setAB(a: number | null, b: number | null) {
  set({ a, b });
}

/** 한 구간 재생. 끝나면 resolve */
export function playSegment(start: number, end: number | null): Promise<void> {
  const a = el();
  cancelSpeech();
  if (segmentStop) segmentStop.resolve();
  return new Promise((resolve) => {
    segmentStop = end !== null ? { end, resolve } : { end: Number.POSITIVE_INFINITY, resolve };
    a.currentTime = start;
    a.playbackRate = state.rate;
    void a.play().catch(() => {
      segmentStop = null;
      resolve();
    });
  });
}

// ---------- TTS ----------
let ttsToken = 0;
function accentFor(i: number): string {
  const s = getSettings();
  if (s.ttsRotateAccent) {
    const acc = availableAccents();
    if (acc.length) return acc[i % acc.length];
  }
  return s.ttsAccent;
}

export interface TTSPlayOptions { to?: number; repeat?: boolean }
export async function playTTS(from: number, o: TTSPlayOptions = {}) {
  if (!getVoiceState().supported) return;
  const my = ++ttsToken;
  const list = state.sentences;
  const to = o.to ?? list.length - 1;
  set({ playing: true });
  let i = from;
  for (;;) {
    if (i > to) {
      if (o.repeat || state.loop) i = from;
      else break;
    }
    const s = list[i];
    if (!s) break;
    const accent = accentFor(i);
    set({ ttsIndex: i, currentSentenceId: s.id, ttsAccent: accent });
    const ok = await speak(s.en, { rate: state.rate, accent: accent as never, voiceURI: getSettings().ttsVoiceURI });
    if (my !== ttsToken) return;
    if (!ok) break;
    ttsSpoken.add(s.id);
    const coverage = list.length ? ttsSpoken.size / list.length : 0;
    set({ coverage });
    maybeCheckListen(coverage);
    i++;
  }
  if (my === ttsToken) set({ playing: false, ttsIndex: Math.min(i, list.length - 1) });
}
export function stopTTS() {
  ttsToken++;
  cancelSpeech();
  set({ playing: false });
}
export function setTTSIndex(i: number) {
  set({ ttsIndex: i, currentSentenceId: state.sentences[i]?.id ?? null });
}

/** 문장 하나 듣기: 원음 구간이 있으면 원음, 없으면 TTS */
export async function playSentence(sentence: Sentence, o: { rate?: number } = {}): Promise<void> {
  const seg = state.mode === 'audio' && !state.error ? state.segments.find((s) => s.id === sentence.id) : undefined;
  if (seg) {
    const prev = state.rate;
    if (o.rate) setRate(o.rate);
    await playSegment(seg.start, seg.end);
    if (o.rate) setRate(prev);
    return;
  }
  stopTTS();
  audio?.pause();
  await speak(sentence.en, { rate: o.rate ?? getSettings().ttsRate, accent: getSettings().ttsAccent, voiceURI: getSettings().ttsVoiceURI });
}
export const hasSentenceAudio = (sentenceId: string) =>
  state.mode === 'audio' && !state.error && state.segments.some((s) => s.id === sentenceId);

export function stopAll() {
  stopTTS();
  audio?.pause();
  segmentStop = null;
}
export const audioElement = () => el();
