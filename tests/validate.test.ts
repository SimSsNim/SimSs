import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateLesson } from '../src/lib/validateLesson';
import type { Lesson } from '../src/lib/types';

const load = (track: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), `public/lessons/${track}/2026-11-12.json`), 'utf-8')) as Lesson;

describe('validateLesson', () => {
  for (const track of ['general', 'toeic']) {
    it(`${track} 샘플 통과`, () => {
      expect(validateLesson(load(track), { folderTrack: track, fileStem: '2026-11-12' })).toEqual([]);
    });
  }

  const broken: [string, (l: Lesson) => void, RegExp, object?][] = [
    ['청크 불일치', (l) => { l.structures[0].chunks[0].text = 'A Dog'; }, /청크/],
    ['matchText 없음', (l) => { l.vocab[0].matchText = 'xyzzy'; }, /matchText/],
    ['wordCount 불일치', (l) => { l.wordCount += 1; }, /wordCount/],
    ['없는 sentenceId', (l) => { l.grammar[0].sentenceId = 's99'; }, /없는 sentenceId/],
    ['id≠파일명', (l) => { l.id = '2026-11-13'; }, /파일 이름/, { fileStem: '2026-11-12' }],
    ['문단≠문장 연결', (l) => { l.paragraphs[0].en += ' '; }, /문단/],
    ['highlight 없음', (l) => { l.grammar[0].highlight = ['nope nope']; }, /highlight/],
    ['토익 라이선스', (l) => { l.track = 'toeic'; l.audio = null; }, /license/],
    ['폴더≠track', (l) => { void l; }, /폴더/, { folderTrack: 'toeic' }],
  ];
  for (const [name, mutate, re, opts] of broken) {
    it(`깨진 샘플 실패: ${name}`, () => {
      const l = structuredClone(load('general'));
      mutate(l);
      const errs = validateLesson(l, opts);
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join('\n')).toMatch(re);
    });
  }
  it('객체가 아니면 실패', () => {
    expect(validateLesson(null).length).toBe(1);
    expect(validateLesson({}).length).toBeGreaterThan(5);
  });
});
