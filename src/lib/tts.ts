import { useSyncExternalStore } from 'react';
import type { Accent } from './settings';

export const ACCENTS: { id: Accent; label: string }[] = [
  { id: 'en-US', label: '미국' },
  { id: 'en-GB', label: '영국' },
  { id: 'en-AU', label: '호주' },
  { id: 'en-CA', label: '캐나다' },
];

interface VoiceState {
  supported: boolean;
  voices: SpeechSynthesisVoice[]; // en-* 만
  byAccent: Partial<Record<Accent, SpeechSynthesisVoice[]>>;
}

let state: VoiceState = { supported: false, voices: [], byAccent: {} };
const listeners = new Set<() => void>();
const normLang = (l: string) => l.replace('_', '-');

function refresh() {
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
  if (!synth) {
    state = { supported: false, voices: [], byAccent: {} };
  } else {
    const voices = synth.getVoices().filter((v) => normLang(v.lang).toLowerCase().startsWith('en'));
    const byAccent: VoiceState['byAccent'] = {};
    for (const v of voices) {
      const lang = normLang(v.lang);
      const acc = ACCENTS.find((a) => a.id.toLowerCase() === lang.toLowerCase());
      if (acc) (byAccent[acc.id] ??= []).push(v);
    }
    state = { supported: voices.length > 0, voices, byAccent };
  }
  listeners.forEach((l) => l());
}

let inited = false;
export function initTTS() {
  if (inited || typeof window === 'undefined') return;
  inited = true;
  refresh();
  const synth = window.speechSynthesis;
  if (synth) {
    synth.addEventListener?.('voiceschanged', refresh);
    // 일부 브라우저는 이벤트 없이 늦게 채워진다
    setTimeout(refresh, 500);
    setTimeout(refresh, 2000);
  }
}

export const getVoiceState = () => state;
export function useVoices(): VoiceState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function pickVoice(accent: Accent, voiceURI?: string): SpeechSynthesisVoice | null {
  if (voiceURI) {
    const v = state.voices.find((x) => x.voiceURI === voiceURI);
    if (v && normLang(v.lang).toLowerCase() === accent.toLowerCase()) return v;
  }
  const list = state.byAccent[accent];
  if (list?.length) return list.find((v) => v.localService) ?? list[0];
  return state.voices[0] ?? null;
}

export function availableAccents(): Accent[] {
  return ACCENTS.map((a) => a.id).filter((id) => state.byAccent[id]?.length);
}

let speakSeq = 0;
export interface SpeakOptions {
  rate?: number;
  accent?: Accent;
  voiceURI?: string;
  onStart?: () => void;
}

/** 말하기. 끝나거나 취소되면 resolve(취소되면 false). */
export function speak(text: string, o: SpeakOptions = {}): Promise<boolean> {
  const synth = window.speechSynthesis;
  if (!synth || !state.supported) return Promise.resolve(false);
  const my = ++speakSeq;
  synth.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice(o.accent ?? 'en-US', o.voiceURI);
    if (v) {
      u.voice = v;
      u.lang = v.lang;
    } else u.lang = o.accent ?? 'en-US';
    u.rate = o.rate ?? 1;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok && my === speakSeq);
    };
    u.onstart = () => o.onStart?.();
    u.onend = () => finish(true);
    u.onerror = () => finish(false);
    synth.speak(u);
  });
}

export function cancelSpeech() {
  speakSeq++;
  window.speechSynthesis?.cancel();
}
