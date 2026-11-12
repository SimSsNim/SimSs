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
  // iOS Safari: cancel() 바로 뒤의 speak()는 소리 없이 버려질 때가 있어, 말하는 중일 때만 끊고 조금 뒤에 말한다
  if (synth.paused) synth.resume(); // iOS 에서 멈춤 상태로 굳는 경우
  const busy = synth.speaking || synth.pending;
  if (busy) synth.cancel();
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      resolve(ok && my === speakSeq);
    };
    const attempt = (useVoice: boolean) => {
      if (my !== speakSeq) return finish(false);
      const u = new SpeechSynthesisUtterance(text);
      const v = useVoice ? pickVoice(o.accent ?? 'en-US', o.voiceURI) : null;
      if (v) {
        u.voice = v;
        u.lang = v.lang;
      } else u.lang = o.accent ?? 'en-US';
      u.rate = o.rate ?? 1;
      let started = false;
      u.onstart = () => {
        started = true;
        o.onStart?.();
      };
      u.onend = () => finish(true);
      u.onerror = (e) => {
        // 고른 음성이 기기에 없거나(설치 안 된 고급 음성 등) 막히면, 기본 음성으로 한 번 더
        if (!started && useVoice && (e as SpeechSynthesisErrorEvent).error !== 'interrupted' && (e as SpeechSynthesisErrorEvent).error !== 'canceled') attempt(false);
        else finish(false);
      };
      synth.speak(u);
      // 시작조차 안 되면(음성이 조용히 버려짐) 기본 음성으로 다시 시도
      setTimeout(() => {
        // speaking 이 true 면 소리가 나고 있는 것(onstart 를 안 보내는 기기도 있음)
        if (done || started || synth.speaking || my !== speakSeq) return;
        if (useVoice) {
          synth.cancel();
          setTimeout(() => attempt(false), 60);
        } else {
          failedOnce();
          finish(false);
        }
      }, 2500);
    };
    if (busy) setTimeout(() => attempt(true), 80);
    else attempt(true);
  });
}

/** 소리가 끝내 안 나면 한 번 안내(아이폰 무음 모드 등) */
let warned = false;
let onSilent: (() => void) | null = null;
export const onSpeechSilent = (f: () => void) => { onSilent = f; };
function failedOnce() {
  if (warned) return;
  warned = true;
  onSilent?.();
}


/** 음성 점검: 실제로 한 번 말해 보고 일어난 일을 기록 */
export function diagnoseSpeech(o: { accent: Accent; voiceURI?: string; rate: number }, log: (line: string) => void) {
  const synth = window.speechSynthesis;
  const t0 = performance.now();
  const at = () => `${Math.round(performance.now() - t0)}ms`;
  if (!synth) return log('speechSynthesis 없음(이 브라우저는 음성 합성을 지원하지 않음)');
  log(`음성 ${state.voices.length}개(영어), 지원=${state.supported}, speaking=${synth.speaking}, pending=${synth.pending}, paused=${synth.paused}`);
  const v = pickVoice(o.accent, o.voiceURI);
  log(`고른 음성: ${v ? `${v.name} (${v.lang}, ${v.localService ? '기기 내장' : '온라인'})` : '없음 → 언어만 지정'}`);
  if (synth.speaking || synth.pending) synth.cancel();
  if (synth.paused) synth.resume();
  const u = new SpeechSynthesisUtterance('This is a sound test.');
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = o.accent;
  u.rate = o.rate;
  u.onstart = () => log(`${at()} 시작(onstart)`);
  u.onend = () => log(`${at()} 끝(onend) — 소리가 들렸나요?`);
  u.onerror = (e) => log(`${at()} 오류: ${(e as SpeechSynthesisErrorEvent).error}`);
  synth.speak(u);
  log(`${at()} speak() 호출 → speaking=${synth.speaking}, pending=${synth.pending}`);
  setTimeout(() => log(`${at()} 3초 뒤 speaking=${synth.speaking}, pending=${synth.pending}`), 3000);
}

export function cancelSpeech() {
  speakSeq++;
  window.speechSynthesis?.cancel();
}
