// E2E 공용 모킹: TTS(speechSynthesis)와 archive.org 음원
import type { Page } from '@playwright/test';

/** 브라우저 TTS를 가짜로 바꾼다: 단어당 60ms 후 onend */
export const ttsMockScript = () => {
  const voices = [
    { name: 'Mock US', lang: 'en-US', voiceURI: 'mock-us', localService: true, default: true },
    { name: 'Mock GB', lang: 'en-GB', voiceURI: 'mock-gb', localService: true, default: false },
    { name: 'Mock AU', lang: 'en-AU', voiceURI: 'mock-au', localService: true, default: false },
  ];
  let timer: number | undefined;
  let current: SpeechSynthesisUtterance | null = null;
  const spoken: string[] = [];
  (window as unknown as { __spoken: string[] }).__spoken = spoken;
  const synth = {
    getVoices: () => voices,
    speak(u: SpeechSynthesisUtterance) {
      current = u;
      spoken.push(u.text);
      setTimeout(() => u.onstart?.(new Event('start') as SpeechSynthesisEvent), 0);
      timer = window.setTimeout(() => {
        current = null;
        u.onend?.(new Event('end') as SpeechSynthesisEvent);
      }, 60 * u.text.split(' ').length + 100);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      const c = current;
      current = null;
      c?.onerror?.(new Event('error') as SpeechSynthesisErrorEvent);
    },
    pause() {}, resume() {},
    speaking: false, pending: false, paused: false,
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    text: string; lang = ''; rate = 1; voice: unknown = null;
    onstart: ((e: Event) => void) | null = null; onend: ((e: Event) => void) | null = null; onerror: ((e: Event) => void) | null = null;
    constructor(t: string) { this.text = t; }
  };
};

/** 무음 WAV (seconds 길이) */
export function silentWav(seconds = 30, rate = 8000): Buffer {
  const n = seconds * rate;
  const b = Buffer.alloc(44 + n);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28); b.writeUInt16LE(1, 32); b.writeUInt16LE(8, 34); b.write('data', 36); b.writeUInt32LE(n, 40);
  b.fill(128, 44);
  return b;
}

export async function setupMocks(page: Page) {
  await page.addInitScript(ttsMockScript);
  const wav = silentWav();
  await page.route(/archive\.org\//, (route) => route.fulfill({ status: 200, body: wav, headers: { 'content-type': 'audio/wav', 'access-control-allow-origin': '*' } }));
}
