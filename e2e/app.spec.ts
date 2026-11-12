import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setupMocks } from './mocks';

const raw = (f: string) => JSON.parse(readFileSync(`public/lessons/${f}`, 'utf-8'));
/** 원본(v2) → 문단별 영어 원문(문장을 공백 하나로 이음) */
const paraTexts = (l: { paragraphs: { sentenceIds: string[] }[]; sentences: { id: string; en: string }[] }) =>
  l.paragraphs.map((p) => p.sentenceIds.map((id) => l.sentences.find((x) => x.id === id)!.en).join(' '));
const G = raw('general/2026-11-12-L1.json');
const P5 = raw('toeic/2026-11-12-L1-part5.json');
const P6 = raw('toeic/2026-11-12-L1-part6.json');
const P7 = raw('toeic/2026-11-12-L1-part7.json');
const L = { general: G, toeic: P7 };
const ID = { general: '2026-11-12-L1', toeic: '2026-11-12-L1-part7' };

test.beforeEach(async ({ page }) => {
  await setupMocks(page);
});

/** 첫 실행: 레벨 고르기(일반 L1, 토익 L1) */
async function start(page: Page, path = './') {
  await page.goto(path);
  await page.getByTestId('onb-start').click();
  await expect(page.getByTestId('level-onboarding')).toHaveCount(0);
}

async function noHScroll(page: Page) {
  const [sw, w] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(sw, `가로 스크롤 없음 (${page.url()})`).toBeLessThanOrEqual(w);
}

for (const track of ['general', 'toeic'] as const) {
  test(`1. 홈 → 오늘 레슨 → 전체 문장: 화면 영어 = 원문 (${track})`, async ({ page }) => {
    await start(page, `./#/${track}`);
    if (track === 'general') await page.getByTestId('today-card').click();
    else await page.getByTestId('part-card-part7').click();
    await page.getByTestId('tab-full').click();
    const article = page.getByTestId('full-text');
    await expect(article).toBeVisible();
    const paras = await article.locator('[data-paragraph]').evaluateAll((ps) =>
      ps.map((p) => [...p.querySelectorAll('[data-sentence]')].map((s) => s.textContent).join(' ')));
    expect(paras).toEqual(paraTexts(L[track]));
    // 끊어 읽기 표시를 켜도 텍스트는 그대로(/ 는 CSS 의사 요소)
    await page.getByRole('button', { name: '끊어읽기 /' }).click();
    const again = await article.locator('[data-sentence]').evaluateAll((ss) => ss.map((s) => s.textContent).join(' '));
    expect(again).toBe(paraTexts(L[track]).join(' '));
    await noHScroll(page);
  });
}

test('읽기 설정은 두 줄 안에 들어간다(모든 토글을 켜도)', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  for (const name of ['문법', '끊어읽기 /']) await page.getByRole('button', { name, exact: true }).click();
  const rows = async (tid: string) => page.getByTestId(tid).locator('> *').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
  expect(await rows('display-modes')).toBe(1);
  expect(await rows('reading-toggles')).toBe(1);
  await noHScroll(page);
});

test('1-1. 트랙 전환: 목록·오늘 카드가 바뀌고 마지막 위치와 진행 기록은 따로', async ({ page }) => {
  await start(page, './#/general');
  await expect(page.getByTestId('today-card')).toContainText('The Fox and the Crow');
  await page.getByTestId('track-toeic').click();
  await expect(page).toHaveURL(/#\/toeic$/);
  await expect(page.getByTestId('part-cards')).toContainText('Workshop Registration Confirmation');
  await page.goto('./#/toeic/list');
  await page.getByRole('combobox', { name: 'Part' }).selectOption('all');
  await expect(page.getByTestId('lesson-item')).toHaveCount(3);
  await expect(page.getByTestId('lesson-item').first()).toContainText('AI 작성 연습 지문');

  // 일반: 단어 탭에서 멈춤
  await page.goto('./#/general/lesson/2026-11-12-L1/vocab');
  await expect(page.getByTestId('lesson-title')).toHaveText('The Fox and the Crow');
  // 토익: Part 7 문법 탭에서 멈춤
  await page.getByTestId('track-toeic').click();
  await expect(page).toHaveURL(/#\/toeic$/);
  await page.goto('./#/toeic/lesson/2026-11-12-L1-part7/grammar');
  await expect(page.getByTestId('lesson-title')).toHaveText('Workshop Registration Confirmation');
  // 레슨 화면에서 전환 → 각 트랙의 마지막 위치
  await page.getByTestId('track-general').click();
  await expect(page).toHaveURL(/#\/general\/lesson\/2026-11-12-L1\/vocab$/);
  await page.getByTestId('track-toeic').click();
  await expect(page).toHaveURL(/#\/toeic\/lesson\/2026-11-12-L1-part7\/grammar$/);

  // 같은 날짜 레슨끼리 진행 기록이 섞이지 않음
  await page.goto('./#/general');
  await page.getByTestId('check-read').check();
  await expect(page.getByTestId('summary-general')).toContainText('1/6');
  await expect(page.getByTestId('summary-toeic')).toContainText('P5 –');
});

test('1-2. 토익 듣기: 음원 없음 → TTS 모드, 문장 강조가 따라간다', async ({ page }) => {
  await start(page, './#/toeic/lesson/2026-11-12-L1-part7/listen');
  await expect(page.getByTestId('tts-mode')).toBeVisible();
  await expect(page.getByText('구간 맞추기 시작')).toHaveCount(0);
  await page.getByTestId('tts-toggle').click();
  const follow = page.getByTestId('follow-list');
  await expect(follow.locator('[data-current="true"]')).toHaveAttribute('data-sentence-id', 's1');
  await expect(follow.locator('[data-current="true"]')).toHaveAttribute('data-sentence-id', 's2', { timeout: 5000 });
  await expect(follow.locator('[data-current="true"]')).toHaveAttribute('data-sentence-id', 's3', { timeout: 5000 });
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken[0]).toBe(P7.sentences[0].en);
  // 탭을 바꿔도 미니 플레이어에서 이어진다
  await page.getByTestId('tab-full').click();
  await expect(page.getByTestId('mini-player')).toBeVisible();
  await noHScroll(page);
});

test('2. 한 문장씩: 6번 넘기면 마지막 카드, ←/→ 키', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/one');
  await expect(page.getByTestId('one-progress')).toHaveText('1 / 6');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('one-progress')).toHaveText('2 / 6');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('one-progress')).toHaveText('1 / 6');
  for (let i = 0; i < 6; i++) await page.getByTestId('one-next').click();
  await expect(page.getByTestId('one-end')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 처음부터' })).toBeVisible();
  await expect(page.getByRole('link', { name: '단어 탭으로' })).toBeVisible();
  await noHScroll(page);
});

test('3. 플래시카드 자동 넘김 2초 · 일시정지 · 탭 이동 시 정리', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await start(page, './#/general/lesson/2026-11-12-L1/vocab');
  await page.getByTestId('vocab-flash').click();
  await page.getByText('자동 재생 설정').click();
  await page.getByLabel('앞면 → 뒷면 공개 → 다음 (2단계)').uncheck();
  await page.getByTestId('flash-front-sec').fill('2');
  await expect(page.getByText('간격 2.0초')).toBeVisible();
  const idx = page.getByTestId('flash-index');
  await expect(idx).toHaveText('1 / 5');
  const t0 = Date.now();
  await page.getByTestId('flash-auto').click();
  await expect(idx).toHaveText('2 / 5', { timeout: 4000 });
  const dt = Date.now() - t0;
  expect(dt).toBeGreaterThan(1500);
  expect(dt).toBeLessThan(3500);
  await page.getByTestId('flash-pause').click();
  await expect(page.getByTestId('flash-paused')).toBeVisible();
  await page.waitForTimeout(2600);
  await expect(idx).toHaveText('2 / 5');
  await page.getByTestId('flash-pause').click();
  await expect(idx).toHaveText('3 / 5', { timeout: 4000 });
  // 다른 탭으로 가면 타이머가 정리되어 아무 일도 일어나지 않는다
  await page.getByTestId('tab-full').click();
  await page.waitForTimeout(2600);
  expect(errors).toEqual([]);
  await page.getByTestId('tab-vocab').click();
  await page.getByTestId('vocab-flash').click();
  await expect(page.getByTestId('flash-index')).toHaveText('1 / 5');
  await page.waitForTimeout(2500);
  await expect(page.getByTestId('flash-index')).toHaveText('1 / 5');
});

test('4. 몰라요 2개 + 알아요 3개 → 필터 개수 2/3, 새로고침 후 유지', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/vocab');
  const rows = page.getByTestId('word-row');
  await expect(rows).toHaveCount(5);
  await rows.nth(0).getByTestId('btn-unknown').click();
  await rows.nth(1).getByTestId('btn-unknown').click();
  for (const i of [2, 3, 4]) await rows.nth(i).getByTestId('btn-known').click();
  await expect(page.getByTestId('count-unknown')).toHaveText('2');
  await expect(page.getByTestId('count-known')).toHaveText('3');
  await expect(page.getByTestId('count-new')).toHaveText('0');
  await page.reload();
  await expect(page.getByTestId('count-unknown')).toHaveText('2');
  await expect(page.getByTestId('count-known')).toHaveText('3');
  // 단어 5개 분류 → 오늘 체크리스트 '단어' 자동 체크
  await page.goto('./#/general');
  await expect(page.getByTestId('check-vocab')).toBeChecked();
});

test('5. 문장+문법: 조각 라벨 순서와 뼈대만 보기', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/structure');
  await expect(page.getByTestId('chunks')).toBeVisible();
  const labels = await page.getByTestId('chunks').getByTestId('role-label').allTextContents();
  expect(labels).toEqual(G.structures[0].chunks.map((c: { role: string; sub?: boolean }) => (c.sub && c.role !== 'CONJ' ? `${c.role}′` : c.role)));
  const chunkText = await page.getByTestId('chunks').locator('[data-role] > span').allTextContents();
  expect(chunkText.join(' ')).toBe(G.sentences[0].en);
  await page.getByTestId('skeleton-toggle').click();
  await expect(page.getByTestId('skeleton')).toHaveText(G.structures[0].skeleton);
  await expect.poll(async () => Number(await page.locator('[data-role="M"]').first().evaluate((el) => getComputedStyle(el).opacity))).toBeLessThan(0.5);
  // 종속절 성분은 프라임 표시
  await page.getByRole('option', { name: '4 🧩' }).click();
  await expect(page.getByTestId('chunks').getByTestId('role-label').filter({ hasText: 'S′' }).first()).toBeVisible();
  await noHScroll(page);
});

for (const track of ['general', 'toeic'] as const) {
  test(`6. 타이핑 필사: 그대로 입력 = 100%, 한 글자 틀리면 100% 미만 (${track})`, async ({ page }) => {
    await start(page, `./#/${track}/lesson/${ID[track]}/practice`);
    await page.getByTestId('practice-typing').click();
    const full = paraTexts(L[track]).join('\n');
    await page.getByTestId('typing-input').fill(full);
    await page.getByTestId('typing-finish').click();
    await expect(page.getByTestId('typing-accuracy')).toHaveText('100%');
    const wrong = full.replace('Fox', 'Fax').replace('Workshop', 'Workshap');
    expect(wrong).not.toBe(full);
    await page.getByTestId('typing-input').fill(wrong);
    await page.getByTestId('typing-finish').click();
    const acc = parseFloat((await page.getByTestId('typing-accuracy').textContent())!);
    expect(acc).toBeLessThan(100);
    if (track === 'general') {
      await page.goto(`./#/${track}`);
      await expect(page.getByTestId('check-transcribe')).toBeChecked();
    }
  });
}

test('7. 오프라인: 한 번 연 뒤 네트워크 끊고 새로고침 → 레슨이 열린다', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile-light', '한 프로젝트에서만');
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await expect(page.getByTestId('full-text')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect(page.getByTestId('full-text')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('full-text')).toBeVisible();
  await expect(page.getByTestId('full-text')).toContainText('A Crow was sitting on a branch');
  await page.goto('./#/toeic/lesson/2026-11-12-L1-part7/full');
  await expect(page.getByTestId('full-text')).toContainText('Thank you for registering');
  await context.setOffline(false);
});

test('8. 레슨 가져오기: 깨진 JSON → 오류, 정상 JSON → 목록에 추가', async ({ page }) => {
  await start(page, './#/records/import');
  await page.getByTestId('import-text').fill('{ "id": "oops", ');
  await page.getByTestId('import-run').click();
  await expect(page.getByTestId('import-result')).toContainText('오류');
  await expect(page.getByTestId('import-result')).toContainText('JSON 형식 오류');

  const bad = structuredClone(P7);
  bad.vocab[0].matchText = 'not in sentence';
  await page.getByTestId('import-text').fill(JSON.stringify(bad));
  await page.getByTestId('import-run').click();
  await expect(page.getByTestId('import-result')).toContainText('matchText');

  const ok = structuredClone(P7);
  ok.id = '2026-11-13-L1-part7';
  ok.date = '2026-11-13';
  ok.title = 'Imported Practice Notice';
  await page.getByTestId('import-text').fill(JSON.stringify(ok));
  await page.getByTestId('import-run').click();
  await expect(page.getByTestId('import-result')).toContainText('통과');
  await page.goto('./#/toeic/list');
  await page.getByRole('combobox', { name: 'Part' }).selectOption('part7');
  await expect(page.getByTestId('lesson-item')).toHaveCount(2);
  await expect(page.getByTestId('lesson-item').first()).toContainText('Imported Practice Notice');
  await expect(page.getByTestId('lesson-item').first()).toContainText('가져옴');
  await page.reload();
  await page.getByRole('combobox', { name: 'Part' }).selectOption('part7');
  await expect(page.getByTestId('lesson-item')).toHaveCount(2);

  // 여러 파일 한 번에: 요약 문장
  const files = [P5, P6, { ...structuredClone(P5), id: '2026-11-14-L1-part5', date: '2026-11-14' }, bad].map((d, i) => ({
    name: `f${i}.json`, mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(d)),
  }));
  await page.goto('./#/records/import');
  await page.getByTestId('import-file').setInputFiles(files);
  await expect(page.getByTestId('import-summary')).toContainText('4개 중 3개 추가, 1개 오류');
});

test('9. 모든 화면 가로 스크롤 없음', async ({ page }) => {
  await start(page);
  const routes = ['/general', '/toeic', '/general/list', '/toeic/list', '/review?tab=words', '/review?tab=wrong', '/grammar', '/words', '/favorites', '/records/stats', '/records/settings', '/records/backup', '/records/import', '/drill?skill=%ED%98%95%EC%9A%A9%EC%82%AC%20%EC%9E%90%EB%A6%AC'];
  for (const tab of ['full', 'one', 'vocab', 'grammar', 'structure', 'listen', 'practice']) routes.push(`/general/lesson/2026-11-12-L1/${tab}`);
  for (const p of ['part5', 'part6', 'part7']) for (const tab of ['quiz', 'full', 'one', 'vocab', 'grammar', 'structure', 'listen', 'practice']) routes.push(`/toeic/lesson/2026-11-12-L1-${p}/${tab}`);
  for (const r of routes) {
    await page.goto(`./#${r}`);
    await page.waitForTimeout(250);
    await noHScroll(page);
  }
  // 연습 하위 화면들
  await page.goto('./#/general/lesson/2026-11-12-L1/practice');
  for (const m of ['typing', 'dictation', 'blank', 'arrange', 'translate']) {
    await page.getByTestId(`practice-${m}`).click();
    await noHScroll(page);
  }
  await page.goto('./#/general/lesson/2026-11-12-L1/vocab');
  await page.getByTestId('vocab-flash').click();
  await noHScroll(page);
});

test('원음 레슨 듣기 탭: 컨트롤과 구간 맞추기', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/listen');
  await expect(page.getByText('구간 맞추기 시작')).toBeVisible();
  await expect(page.getByRole('button', { name: 'A', exact: true })).toBeVisible();
  const pitch = await page.evaluate(() => {
    const a = document.querySelector('audio');
    return a ? (a as HTMLAudioElement).preservesPitch : 'none';
  });
  expect(pitch).toBe(true);
  await page.getByTestId('listen-toggle').click();
  await page.getByText('구간 맞추기 시작').click();
  for (let i = 0; i < G.sentences.length; i++) {
    await page.waitForTimeout(150);
    await page.getByRole('button', { name: '다음 문장 시작 ⏎' }).click();
  }
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByText(`${G.sentences.length}개 문장 구간 있음`)).toBeVisible();
  await noHScroll(page);
});
