import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateLesson, blankedSentence, countOccurrences } from '../src/lib/validateLesson';
import type { RawLesson } from '../src/lib/types';

const root = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(resolve(root, p), 'utf-8'));
const SAMPLES = ['general/2026-11-12-L1.json', 'toeic/2026-11-12-L1-part5.json', 'toeic/2026-11-12-L1-part6.json', 'toeic/2026-11-12-L1-part7.json'];

const py = spawnSync('python3', ['-c', 'import jsonschema'], { encoding: 'utf-8' });
const hasPy = py.status === 0;
const runPy = (file: string) => spawnSync('python3', ['scripts/validate_lessons.py', file], { cwd: root, encoding: 'utf-8' });

describe('validateLesson (v2) — 샘플 통과', () => {
  for (const f of SAMPLES) {
    it(f, () => {
      const [folder, name] = f.split('/');
      expect(validateLesson(read(`public/lessons/${f}`), { folderTrack: folder, fileStem: name.replace('.json', '') })).toEqual([]);
    });
  }
});

const brokenDir = resolve(root, 'tests/fixtures/broken');
const cases = readdirSync(brokenDir).filter((n) => statSync(join(brokenDir, n)).isDirectory());

describe('깨진 레슨: TS 와 파이썬이 같이 실패', () => {
  it('케이스가 충분히 있다', () => expect(cases.length).toBeGreaterThanOrEqual(10));
  for (const name of cases) {
    const caseDir = join(brokenDir, name);
    const folder = readdirSync(caseDir).find((n) => statSync(join(caseDir, n)).isDirectory())!;
    const file = join(caseDir, folder, readdirSync(join(caseDir, folder))[0]);
    const expected = readFileSync(join(caseDir, 'expect.txt'), 'utf-8').trim();
    it(`${name} (TS)`, () => {
      const errs = validateLesson(JSON.parse(readFileSync(file, 'utf-8')), { folderTrack: basename(dirname(file)), fileStem: basename(file, '.json') });
      expect(errs.length).toBeGreaterThan(0);
      expect(errs.join('\n')).toContain(expected);
    });
    it.skipIf(!hasPy)(`${name} (파이썬)`, () => {
      const r = runPy(file);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain(expected);
    });
  }
  it.skipIf(!hasPy)('정상 샘플은 파이썬도 통과', () => {
    const r = runPy('public/lessons/');
    expect(r.status, r.stdout).toBe(0);
  });
});

describe('이야기 여러 개·뉴스 id (TS·파이썬 같은 결과)', () => {
  const base = read('public/lessons/general/2026-11-12-L1.json');
  const cases: [string, string, boolean][] = [
    ['2026-11-12-L1-2', 'fable', true],
    ['2026-11-12-L1-3', 'fable', true],
    ['2026-11-12-L1-news', 'news', true],
    ['2026-11-12-L1-news2', 'news', true],
    ['2026-11-12-L1-news', 'fable', false], // 뉴스 id인데 genre가 news가 아님
    ['2026-11-12-L1', 'news', false], // 뉴스인데 -news가 없음
    ['2026-11-12-L1-1', 'fable', false],
    ['2026-11-12-L2-2', 'fable', false], // 레벨과 다름
  ];
  for (const [id, genre, ok] of cases) {
    it(`${id} / ${genre} → ${ok ? '통과' : '실패'}`, () => {
      const d = { ...structuredClone(base), id, genre };
      const errs = validateLesson(d, { folderTrack: 'general', fileStem: id });
      expect(errs.length === 0, errs.join('\n')).toBe(ok);
      if (!hasPy) return;
      const dir = resolve(root, `tests/.tmp-id/${id}-${genre}/general`);
      spawnSync('mkdir', ['-p', dir]);
      const file = join(dir, `${id}.json`);
      writeFileSync(file, JSON.stringify(d));
      const r = runPy(file);
      expect(r.status === 0, r.stdout).toBe(ok);
      if (!ok && !errs[0].startsWith('스키마')) expect(r.stdout).toContain(errs[0]);
    });
  }
});

describe('빈칸 만들기', () => {
  const p5 = read('public/lessons/toeic/2026-11-12-L1-part5.json') as RawLesson;
  const p6 = read('public/lessons/toeic/2026-11-12-L1-part6.json') as RawLesson;
  const sent = (l: RawLesson, id: string) => l.sentences.find((s) => s.id === id)!.en;
  it('Part 5 q1', () => {
    const q = p5.questions![0];
    expect(blankedSentence(sent(p5, q.blank!.sentenceId), q.blank!.answerText)).toBe('The new coffee machine in the break room is very ------- to use.');
  });
  it('Part 6 q4 (문장 넣기) = 문장 전체가 빈칸', () => {
    const q = p6.questions![3];
    expect(blankedSentence(sent(p6, q.blank!.sentenceId), q.blank!.answerText)).toBe('-------');
  });
  it('countOccurrences = 파이썬 str.count', () => {
    expect(countOccurrences('aaaa', 'aa')).toBe(2);
    expect(countOccurrences('abc', 'x')).toBe(0);
  });
});
