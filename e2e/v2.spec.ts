// v2: 레벨 선택, 토익 Part 5·6·7 문제 풀이, 오답노트
import { test, expect, type Page } from '@playwright/test';
import { setupMocks } from './mocks';
import { readFileSync } from 'node:fs';

const P5_ANSWERS = ['B', 'C', 'B', 'A', 'C', 'B', 'D', 'B', 'A', 'C'];
const P6_ANSWERS = ['B', 'B', 'A', 'D', 'C'];
const P7_ANSWERS = ['A', 'B', 'C'];
const URL5 = './#/toeic/lesson/2026-11-12-L1-part5/quiz';
const URL6 = './#/toeic/lesson/2026-11-12-L1-part6/quiz';
const URL7 = './#/toeic/lesson/2026-11-12-L1-part7/quiz';

test.beforeEach(async ({ page }) => {
  await setupMocks(page);
});

async function start(page: Page, path = './') {
  await page.goto(path);
  await page.getByTestId('onb-start').click();
  await expect(page.getByTestId('level-onboarding')).toHaveCount(0);
}

/** 연습 모드: 보기 누르고 다음 → 마지막에 결과 보기 */
async function solvePractice(page: Page, answers: string[]) {
  for (let i = 0; i < answers.length; i++) {
    await page.getByTestId(`choice-${answers[i]}`).click();
    await expect(page.getByTestId('feedback')).toBeVisible();
    if (i < answers.length - 1) await page.getByTestId('quiz-next').click();
  }
  await page.getByTestId('quiz-finish').click();
  await expect(page.getByTestId('quiz-result')).toBeVisible();
}

test('v1. 처음 실행 → 레벨 고르기(일반 L1, 토익 L1) → 오늘 화면', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByTestId('level-onboarding')).toBeVisible();
  await page.getByTestId('onb-general').getByTestId('level-1').click();
  await page.getByTestId('onb-toeic').getByTestId('level-1').click();
  await page.getByTestId('onb-start').click();
  await expect(page.getByTestId('today-card')).toContainText('The Fox and the Crow');
  // 레벨이 저장될 때까지 기다린 뒤 새로고침
  await expect.poll(() => page.evaluate(() => new Promise<unknown>((res) => {
    const r = indexedDB.open('pilsa');
    r.onsuccess = () => {
      const q = r.result.transaction('settings').objectStore('settings').get('levelByTrack');
      q.onsuccess = () => res((q.result as { value?: { general?: number } } | undefined)?.value?.general ?? null);
    };
  }))).toBe(1);
  await page.reload();
  await expect(page.getByTestId('level-onboarding')).toHaveCount(0);
  await page.getByTestId('track-toeic').click();
  await expect(page.getByTestId('part-cards')).toBeVisible();
  await expect(page.getByTestId('part-status-part5')).toHaveText('안 풂');
});

test('v2. 일반 L2: 샘플에 없으므로 "아직 없음", 앱이 죽지 않음', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await start(page, './#/general');
  await expect(page.getByText('오늘 다른 레벨')).toHaveCount(0);
  await page.getByRole('group', { name: '내 레벨' }).getByTestId('level-2').click();
  await expect(page.getByTestId('no-lesson')).toBeVisible();
  await page.goto('./#/general/list');
  await expect(page.getByText('조건에 맞는 지문이 없어요.')).toBeVisible();
  await page.getByTestId('list-level-all').click();
  await expect(page.getByTestId('lesson-item')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('v3. Part 5 연습 모드: 정답대로 → 10/10, 하나 틀리면 오답노트에 1개', async ({ page }) => {
  await start(page, URL5);
  await expect(page.getByTestId('q-sentence')).toHaveText('The new coffee machine in the break room is very ------- to use.');
  await solvePractice(page, P5_ANSWERS);
  await expect(page.getByTestId('quiz-score')).toHaveText('10/10');
  await expect(page.getByTestId('result-item')).toHaveCount(10);
  // 오늘 화면: 첫 시도 점수
  await page.goto('./#/toeic');
  await expect(page.getByTestId('part-status-part5')).toHaveText('완료 10/10');

  // 다시 풀기(시도 2): 하나 틀림 → 오답노트 1개. 오늘 화면은 여전히 첫 시도 기준
  await page.goto(URL5);
  await page.getByTestId('retry-all').click();
  const wrong = [...P5_ANSWERS];
  wrong[0] = 'A';
  await solvePractice(page, wrong);
  await expect(page.getByTestId('quiz-score')).toHaveText('9/10');
  await page.goto('./#/review?tab=wrong');
  await expect(page.getByTestId('wrong-row')).toHaveCount(1);
  // 필터 칩에 개수
  await expect(page.getByRole('button', { name: 'L1 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'L2 0', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Part 5 1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Part 6 0', exact: true })).toBeVisible();
  await page.goto('./#/toeic');
  await expect(page.getByTestId('part-status-part5')).toHaveText('완료 10/10');
});

test('v3b. 레슨 ‹ 버튼: 들어오기 전 화면으로(오늘 → 오늘, 지문 목록 → 목록)', async ({ page }) => {
  await start(page, './#/toeic');
  await expect(page.getByTestId('chapter-part5')).toHaveCount(0);
  await page.getByTestId('part-card-part5').click();
  await page.getByTestId('tab-full').click();
  await page.getByTestId('tab-quiz').click();
  await page.getByRole('link', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/#\/toeic$/);
  await expect(page.getByTestId('part-cards')).toBeVisible();
  await page.goto('./#/toeic/list');
  await page.getByTestId('lesson-item').first().click();
  await page.getByRole('link', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/#\/toeic\/list$/);
});

test('v4. Part 6: 빈칸 [3] → 3번 문제, 답을 고르면 빈칸에 채워짐, 정답 5/5', async ({ page }) => {
  await start(page, URL6);
  await page.getByTestId('slot-3').click();
  await expect(page.getByTestId('quiz-dots').locator('[aria-current="step"]')).toContainText('3');
  await page.getByTestId('choice-A').click();
  await expect(page.getByTestId('slot-3')).toContainText('inconvenient');
  await page.getByTestId('quiz-dots').getByRole('button', { name: /^1\s*번/ }).click();
  for (let i = 0; i < 5; i++) {
    if (i === 2) { await page.getByTestId('quiz-next').click(); continue; }
    await page.getByTestId(`choice-${P6_ANSWERS[i]}`).click();
    if (i < 4) await page.getByTestId('quiz-next').click();
  }
  await expect(page.getByTestId('slot-4')).toContainText('Employees who need help');
  await page.getByTestId('quiz-finish').click();
  await expect(page.getByTestId('quiz-score')).toHaveText('5/5');
});

test('v5. Part 7: 채점 후 "근거 보기"가 s2를 강조', async ({ page }) => {
  await start(page, URL7);
  await page.getByTestId('mode-exam').click();
  await page.getByTestId('exam-begin').click();
  for (let i = 0; i < 3; i++) {
    const vp = page.viewportSize()!;
    if (vp.width < 900) await page.getByTestId('p7-tab-question').click();
    await page.getByTestId(`choice-${P7_ANSWERS[i]}`).click();
    if (i < 2) await page.getByRole('button', { name: '다음 문제' }).last().click();
  }
  await page.getByTestId('quiz-finish').click();
  await expect(page.getByTestId('quiz-score')).toHaveText('3/3');
  await page.getByTestId('evidence-q1').click();
  const ev = page.getByTestId('result-passage').locator('[data-evidence="true"]');
  await expect(ev).toHaveCount(1);
  await expect(ev).toHaveAttribute('data-sid', 's2');
  await expect(ev).toBeInViewport();
});

test('v6. 실전 모드: 풀기 전 전체 문장이 가려지고 [그냥 보기]로 열림, 나갔다 와도 답 유지', async ({ page }) => {
  await start(page, URL5);
  await page.getByTestId('mode-exam').click();
  await page.getByTestId('tab-full').click();
  await expect(page.getByTestId('quiz-gate')).toBeVisible();
  await expect(page.getByTestId('full-text')).toHaveCount(0);
  await page.getByTestId('tab-quiz').click();
  await page.getByTestId('exam-begin').click();
  await page.getByTestId('choice-B').click();
  await page.getByTestId('quiz-dots').getByRole('button', { name: /^2\s*번/ }).click();
  await page.getByTestId('choice-C').click();
  // 다른 탭으로 갔다가(가려져 있음) 돌아오기
  await page.getByTestId('tab-vocab').click();
  await expect(page.getByTestId('quiz-gate')).toBeVisible();
  await page.goto('./#/toeic');
  await expect(page.getByTestId('part-status-part5')).toContainText('푸는 중 2/10');
  await page.goto(URL5);
  await expect(page.getByTestId('quiz-dots').getByRole('button', { name: /^1\s*번 답함/ })).toBeVisible();
  await page.getByTestId('quiz-dots').getByRole('button', { name: /^1\s*번 답함/ }).click();
  await expect(page.getByTestId('choice-B')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('quiz-timer')).toContainText('남은');
  // 그냥 보기
  await page.getByTestId('tab-full').click();
  await page.getByTestId('gate-reveal').click();
  await expect(page.getByTestId('full-text')).toBeVisible();
});

test('v7. 오답노트: 보기 순서가 바뀌어도 채점이 맞음', async ({ page }) => {
  await start(page, URL5);
  const wrong = [...P5_ANSWERS];
  wrong[0] = 'A'; // q1 정답은 B('easy')
  await solvePractice(page, wrong);
  await page.goto('./#/review?tab=wrong');
  const row = page.getByTestId('wrong-row');
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: '다시 풀기' }).click();
  // 표시 글자와 상관없이 'easy' 를 고르면 정답
  await row.getByTestId('drill').getByRole('button', { name: /easy$/ }).click();
  await expect(row.getByTestId('drill-feedback')).toContainText('○ 정답');
  // 다른 문제 화면에서 오답 고르면 오답
  await page.reload();
  await page.getByTestId('wrong-row').getByRole('button', { name: '다시 풀기' }).click();
  await page.getByTestId('wrong-row').getByTestId('drill').getByRole('button', { name: /easily$/ }).click();
  await expect(page.getByTestId('wrong-row').getByTestId('drill-feedback')).toContainText('✕ 오답');
});

test('v8. 통계: Part별 정답률과 약점 유형 모아 풀기', async ({ page }) => {
  await start(page, URL5);
  const wrong = [...P5_ANSWERS];
  wrong[0] = 'A';
  wrong[4] = 'A'; // 형용사 자리 2문제 모두 틀림
  await solvePractice(page, wrong);
  await page.goto('./#/records/stats');
  await expect(page.getByTestId('rate-part5')).toContainText('80% (8/10)');
  const weak = page.getByTestId('weak-skill').first();
  await expect(weak).toContainText('형용사 자리');
  await weak.click();
  await expect(page.getByTestId('drill')).toBeVisible();
});

test('v9. 헷갈렸어요 → 오늘 복습·오답노트에 나옴, 취소·삭제·되돌리기', async ({ page }) => {
  await start(page, URL5);
  await page.getByTestId('choice-B').click(); // q1 정답
  await page.getByTestId('unsure-q1').click();
  await expect(page.getByTestId('unsure-q1')).toHaveAttribute('aria-pressed', 'true');
  await page.goto('./#/toeic');
  await expect(page.getByTestId('home-wrong-due')).toContainText('1개');
  await page.goto('./#/review?tab=wrong');
  await expect(page.getByTestId('wrong-row')).toHaveCount(1);
  await expect(page.getByTestId('wrong-row')).toContainText('헷갈림');
  await expect(page.getByTestId('filter-unsure')).toContainText('1');
  await page.getByTestId('wrong-review-btn').click();
  await expect(page.getByTestId('drill')).toBeVisible();
  // 삭제 → 되돌리기
  await page.getByRole('tab', { name: /목록/ }).click();
  await page.getByTestId('wrong-delete').click();
  await expect(page.getByTestId('wrong-row')).toHaveCount(0);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByTestId('wrong-row')).toHaveCount(1);
  // 문제 화면에서 다시 누르면 취소
  await page.goto(URL5);
  await page.getByTestId('quiz-dots').getByRole('button', { name: /^1\s*번/ }).click();
  await page.getByTestId('unsure-q1').click();
  await expect(page.getByTestId('unsure-q1')).toHaveAttribute('aria-pressed', 'false');
  await page.goto('./#/review?tab=wrong');
  await expect(page.getByText('오답노트가 비어 있어요', { exact: false })).toBeVisible();
});

test('v10. 단어 상태 지우기(새 단어로)', async ({ page }) => {
  await start(page, './#/toeic/lesson/2026-11-12-L1-part7/vocab');
  await page.getByTestId('quiz-gate').count(); // 연습 모드 Part 7 은 가리지 않음
  const row = page.getByTestId('word-row').first();
  await row.getByTestId('btn-unknown').click();
  await expect(page.getByTestId('count-unknown')).toHaveText('1');
  await row.getByTestId('btn-reset').click();
  await expect(page.getByTestId('count-unknown')).toHaveText('0');
  await expect(page.getByTestId('count-new')).toHaveText('5');
});

test('v11. 즐겨찾기 탭: 문제·문법 ☆ → 전체/항목별로 보임, 해제하면 빠짐', async ({ page }) => {
  await start(page, URL5);
  await page.getByTestId(`choice-${P5_ANSWERS[0]}`).click();
  await page.getByTestId('qstar-q1').click();
  await page.getByTestId('pick-folder-default').click();
  await expect(page.getByTestId('qstar-q1')).toHaveText('★ 즐겨찾기됨');
  await page.goto('./#/grammar');
  await page.getByTestId('grammar-star').first().click();
  await page.getByTestId('pick-folder-default').click();
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '즐겨찾기' }).click();
  await expect(page.getByTestId('fav-count-all')).toHaveText('2');
  await expect(page.getByTestId('fav-count-question')).toHaveText('1');
  await expect(page.getByTestId('fav-count-grammar')).toHaveText('1');
  await expect(page.getByTestId('fav-question-item')).toHaveCount(1);
  await expect(page.getByTestId('grammar-card')).toHaveCount(1);
  await page.getByTestId('fav-grammar').click();
  await expect(page.getByTestId('fav-question-item')).toHaveCount(0);
  await expect(page.getByTestId('grammar-card')).toHaveCount(1);
  await page.getByTestId('grammar-star').click();
  await expect(page.getByTestId('fav-empty')).toBeVisible();
  await page.getByTestId('fav-all').click();
  await expect(page.getByTestId('fav-count-all')).toHaveText('1');
});

test('v13. 하단 탭: 홈·단어 추가, 제목 심쓰 영어', async ({ page }) => {
  await start(page, './#/review');
  const nav = page.getByRole('navigation', { name: '주 메뉴' });
  await expect(nav.getByRole('link')).toHaveText(['홈', '단어', '문법 모음', '복습', '즐겨찾기', '기록/설정']);
  await expect(page.getByText('심쓰 영어')).toBeVisible();
  await expect(page).toHaveTitle('심쓰 영어');
});

test('v14. 단어 탭: 전체·묶음별(레벨/지문/상태) 보기', async ({ page }) => {
  await start(page, './#/words');
  await page.getByTestId('track-filter-all').or(page.getByRole('group', { name: '트랙 필터' }).getByRole('button', { name: '전체' })).first().click();
  const total = await page.getByTestId('word-row').count();
  expect(total).toBeGreaterThan(5);
  await page.getByTestId('group-level').click();
  await expect(page.getByTestId('word-group')).toHaveCount(1);
  await expect(page.getByTestId('gsel-L1')).toContainText(String(total));
  await page.getByTestId('group-lesson').click();
  await expect(page.getByTestId('word-group')).toHaveCount(4);
  await page.getByTestId('gsel-all').locator('xpath=following-sibling::button[1]').click();
  await expect(page.getByTestId('word-group')).toHaveCount(1);
  await page.getByTestId('group-status').click();
  await expect(page.getByTestId('gsel-new')).toContainText(String(total));
  await page.getByTestId('group-none').click();
  await expect(page.getByTestId('word-row')).toHaveCount(total);
});

test('v15. 날짜 고르기: 홈·지문·문법에서 날짜를 바꾸면 그 날짜 것만', async ({ page }) => {
  await start(page, './#/toeic');
  await expect(page.getByTestId('date-pick')).toBeVisible();
  await page.getByTestId('date-input').fill('2026-11-11');
  await expect(page.getByTestId('not-arrived')).toContainText('11월 11일');
  await page.getByTestId('date-today').click();
  await expect(page.getByTestId('not-arrived')).toHaveCount(0);
  await page.goto('./#/toeic/list');
  await page.getByTestId('list-level-all').click();
  await page.getByTestId('date-input').fill('2026-11-10');
  await expect(page.getByText('조건에 맞는 지문이 없어요.')).toBeVisible();
  await page.getByTestId('date-all').click();
  await expect(page.getByTestId('lesson-item')).toHaveCount(3);
  await page.goto('./#/grammar');
  await page.getByTestId('date-prev').click();
  await expect(page.getByTestId('grammar-card').first()).toBeVisible();
});

test('v16. 하단 탭: 지금 보는 탭이 표시됨(레슨 화면은 홈)', async ({ page }) => {
  await start(page, './#/toeic');
  await expect(page.getByTestId('nav-active')).toHaveText('홈');
  await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('link', { name: '단어' }).click();
  await expect(page.getByTestId('nav-active')).toHaveText('단어');
  await page.goto(URL5);
  await expect(page.getByTestId('nav-active')).toHaveText('홈');
  await page.goto('./#/records/settings');
  await expect(page.getByTestId('nav-active')).toHaveText('기록/설정');
});

test('v17. 이야기: 하루 여러 편 고르기, 뉴스 칩, 레벨 켜고 끄기, 우선순위', async ({ page }) => {
  const G = JSON.parse(readFileSync('public/lessons/general/2026-11-12-L1.json', 'utf-8'));
  await start(page, './#/records/import');
  for (const d of [{ ...G, id: '2026-11-12-L1-2', title: 'Second Story' }, { ...G, id: '2026-11-12-L1-news', genre: 'news', title: 'Sample News' }]) {
    await page.getByTestId('import-text').fill(JSON.stringify(d));
    await page.getByTestId('import-run').click();
    await expect(page.getByTestId('import-result')).toContainText('통과');
  }
  await page.goto('./#/general');
  await expect(page.getByTestId('track-general')).toHaveText(/이야기/);
  await expect(page.getByTestId('story-1')).toBeVisible();
  await expect(page.getByTestId('today-card')).toContainText('The Fox and the Crow');
  await page.getByTestId('story-2').click();
  await expect(page.getByTestId('today-card')).toContainText('Second Story');
  await page.getByTestId('level-news').click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('이야기 뉴스');
  await expect(page.getByTestId('today-card')).toContainText('Sample News');
  await expect(page.getByTestId('story-1')).toHaveCount(0);

  // 레벨 켜고 끄기: 끈 것은 안 보임
  await page.goto('./#/records/settings');
  await page.getByTestId('toggle-general-2').click();
  await page.getByTestId('toggle-news').click();
  await page.goto('./#/general');
  await expect(page.getByTestId('level-2')).toHaveCount(0);
  await expect(page.getByTestId('level-news')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('이야기 L1');

  // 우선순위: 토익 먼저 → 주소 없이 열면 토익, 트랙 버튼도 토익이 앞
  await page.goto('./#/records/settings');
  await page.getByTestId('start-track').selectOption('toeic');
  await page.getByTestId('start-level-toeic').selectOption('1');
  await page.goto('./');
  await page.reload();
  await expect(page).toHaveURL(/#\/toeic$/);
  await expect(page.getByRole('group', { name: '학습 트랙' }).getByRole('button')).toHaveText(['전체', /토익/, /이야기/]);
});

test('v18. 기록 첫 화면: 공부 기록 초기화(항목 선택, 전체 선택/해제)', async ({ page }) => {
  await start(page, URL5);
  await solvePractice(page, P5_ANSWERS.map((a, i) => (i === 0 ? 'A' : a)));
  await page.goto('./#/review?tab=wrong');
  await expect(page.getByTestId('wrong-row')).toHaveCount(1);
  await page.goto('./#/records');
  await page.getByTestId('study-reset').locator('summary').click();
  await page.getByTestId('reset-all').click();
  await expect(page.getByTestId('reset-run')).toHaveText('선택한 12개 초기화');
  await page.getByTestId('reset-none').click();
  await expect(page.getByTestId('reset-run')).toBeDisabled();
  await page.getByTestId('reset-wrong').check();
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('reset-run').click();
  await expect(page.getByTestId('reset-run')).toHaveText('선택한 0개 초기화');
  await page.goto('./#/review?tab=wrong');
  await expect(page.getByTestId('wrong-row')).toHaveCount(0);
  // 고르지 않은 문제 풀이 기록은 남음
  await page.goto('./#/toeic');
  await expect(page.getByTestId('part-status-part5')).toHaveText('완료 9/10');
});

test('v19. 홈 전체: 이야기와 토익을 한 화면에, 트랙 버튼이 화면 폭을 채움', async ({ page }) => {
  await start(page, './#/general');
  const seg = page.getByRole('group', { name: '학습 트랙' });
  const box = await seg.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.width).toBeGreaterThan(Math.min(vw, 760) - 60);
  await page.getByTestId('track-all').click();
  await expect(page).toHaveURL(/#\/all$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('전체');
  await expect(page.getByTestId('all-general').getByTestId('today-card')).toContainText('The Fox and the Crow');
  await expect(page.getByTestId('all-toeic').getByTestId('part-cards')).toBeVisible();
  await expect(page.getByTestId('nav-active')).toHaveText('홈');
  // 다시 열어도 전체 유지, 트랙을 고르면 그 트랙으로 (설정 저장을 잠깐 기다림)
  await page.waitForTimeout(400);
  await page.goto('./');
  await expect(page).toHaveURL(/#\/all$/);
  await page.getByTestId('track-toeic').click();
  await expect(page).toHaveURL(/#\/toeic$/);
  await page.waitForTimeout(400);
  await page.goto('./');
  await expect(page).toHaveURL(/#\/toeic$/);
});

test('v20. 문법 카드: 예시는 맨 아래에 닫힌 채로, 하나씩·전체 열고 닫기', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/grammar');
  const cards = page.getByTestId('grammar-card');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThan(1);
  await expect(page.getByTestId('examples')).toHaveCount(0);
  await cards.first().getByTestId('examples-toggle').click();
  await expect(page.getByTestId('examples')).toHaveCount(1);
  await expect(cards.first().getByTestId('examples')).toContainText('지문 속 문장');
  await cards.first().getByTestId('examples-toggle').click();
  await expect(page.getByTestId('examples')).toHaveCount(0);
  await page.getByTestId('examples-open-all').click();
  await expect(page.getByTestId('examples')).toHaveCount(n);
  await page.getByTestId('examples-close-all').click();
  await expect(page.getByTestId('examples')).toHaveCount(0);
});

test('v21. 이야기 학습 순서: 홈엔 없음, 전체 보기는 접힘, 레슨 안 가로 줄에서 이동·체크', async ({ page }) => {
  await start(page, './#/general');
  await expect(page.getByTestId('today-card')).toBeVisible();
  await expect(page.getByTestId('check-listen')).toHaveCount(0);
  await page.getByTestId('track-all').click();
  await expect(page.getByTestId('steps-collapsed')).toBeVisible();
  await expect(page.getByTestId('check-listen')).toBeHidden();
  await page.getByTestId('steps-collapsed').locator('summary').click();
  await expect(page.getByTestId('check-listen')).toBeVisible();
  await page.goto('./#/general/lesson/2026-11-12-L1/vocab');
  const steps = page.getByTestId('lesson-steps');
  await expect(steps).toContainText('순서 0/6');
  await expect(page.getByTestId('step-vocab')).toHaveAttribute('aria-current', 'step');
  await page.getByTestId('step-grammar').click();
  await expect(page).toHaveURL(/\/grammar$/);
  await page.getByTestId('step-check-listen').click();
  await expect(steps).toContainText('순서 1/6');
  await page.getByTestId('step-check-listen').click();
  await expect(steps).toContainText('순서 0/6');
  await page.goto('./#/toeic/lesson/2026-11-12-L1-part5/quiz');
  await expect(page.getByTestId('lesson-steps')).toHaveCount(0);
});

test('v22. 화면 꺼짐 방지: 기본은 레슨에서만, 설정으로 항상/끄기', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __wl: number };
    w.__wl = 0;
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: async () => {
      w.__wl++;
      const s = { released: false, release: async () => { s.released = true; w.__wl--; }, addEventListener: () => {} };
      return s;
    } } });
  });
  const held = () => page.evaluate(() => (window as unknown as { __wl: number }).__wl);
  await start(page, './#/general');
  await expect.poll(held).toBe(0);
  await page.getByTestId('today-card').click();
  await expect.poll(held).toBe(1);
  await page.getByRole('link', { name: '뒤로' }).click();
  await expect.poll(held).toBe(0);
  await page.goto('./#/records/settings');
  await page.getByTestId('keep-awake').selectOption('always');
  await expect.poll(held).toBe(1);
  await page.getByTestId('keep-awake').selectOption('off');
  await expect.poll(held).toBe(0);
});

test('v23. 연습 모드 다시 풀기: 풀다가 처음부터, 다시 푼 횟수, 이전 결과 눌러 상세 보기', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await start(page, URL7);
  await expect(page.getByTestId('attempt-label')).toHaveText('첫 풀이');
  // 풀다가 다시 풀기 → 답이 지워지고 1번부터
  await qTab(page);
  await page.getByTestId('choice-A').click();
  await expect(page.getByTestId('feedback')).toBeVisible();
  await page.getByTestId('quiz-restart').click();
  await expect(page.getByTestId('feedback')).toHaveCount(0);
  await expect(page.getByTestId('quiz-restart')).toHaveCount(0);

  // 1회차: 하나 틀림
  await qTab(page);
  await solvePractice(page, ['D', ...P7_ANSWERS.slice(1)]);
  await expect(page.getByTestId('quiz-score')).toHaveText('2/3');
  await expect(page.getByTestId('retry-count')).toHaveText('처음 푼 결과');

  // 2회차: 다 맞힘 → 다시 푼 횟수 1회, 기록 2개
  await page.getByTestId('retry-all').click();
  await expect(page.getByTestId('attempt-label')).toHaveText('다시 풀기 1회째');
  await qTab(page);
  await solvePractice(page, P7_ANSWERS);
  await expect(page.getByTestId('quiz-score')).toHaveText('3/3');
  await expect(page.getByTestId('retry-count')).toHaveText('다시 푼 횟수 1회');
  await expect(page.getByTestId('attempt-history').locator('li')).toHaveCount(2);

  // 이전 결과(1회차) 누르면 그 결과 상세
  await page.getByTestId('attempt-1').click();
  await expect(page.getByTestId('past-result-badge')).toBeVisible();
  await expect(page.getByTestId('quiz-score')).toHaveText('2/3');
  await expect(page.getByTestId('result-item').first()).toContainText('✕ 틀림');

  // 풀이 화면에서도 이전 결과 열기
  await page.getByTestId('retry-all').click();
  await expect(page.getByTestId('attempt-label')).toHaveText('다시 풀기 2회째');
  await page.getByTestId('attempt-history-solver').locator('summary').click();
  await page.getByTestId('attempt-2').click();
  await expect(page.getByTestId('quiz-score')).toHaveText('3/3');
});

/** 모바일에서만 보이는 Part 7 '문제' 탭 */
async function qTab(page: Page) {
  const t = page.getByTestId('p7-tab-question');
  if (await t.isVisible()) await t.click();
}

test('v24. 옛 레슨 사본(형식이 바뀌기 전)이 와도 지문이 사라지지 않음', async ({ page }) => {
  let staleServed = 0;
  // 서비스 워커·브라우저 캐시에 남은 옛 사본 흉내: 쿼리 없이 요청하면 glossary 없는 파일을 준다
  await page.route(/\/lessons\/toeic\/2026-11-12-L1-part5\.json(\?.*)?$/, async (route) => {
    const url = route.request().url();
    const res = await route.fetch();
    const d = (await res.json()) as Record<string, unknown>;
    if (!url.includes('?r=')) { delete d.glossary; staleServed++; }
    await route.fulfill({ response: res, json: d });
  });
  await start(page, './#/toeic');
  await expect(page.getByTestId('part-card-part5')).toBeVisible();
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('part-card-part5')).toBeVisible();
  await expect(page.getByTestId('no-lesson')).toHaveCount(0);
  expect(staleServed).toBeGreaterThan(0);
});

test('v25. 새 파일이 검증에 실패해도 전에 받아 둔 정상 사본은 계속 보임', async ({ page }) => {
  await start(page, './#/toeic');
  await expect(page.getByTestId('part-card-part5')).toBeVisible();
  await page.route(/\/lessons\/toeic\/2026-11-12-L1-part5\.json(\?.*)?$/, async (route) => {
    const res = await route.fetch();
    const d = (await res.json()) as Record<string, unknown>;
    delete d.glossary;
    await route.fulfill({ response: res, json: d });
  });
  await page.reload();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('part-card-part5')).toBeVisible();
});

test('v26. 플레이어 메뉴: 재생줄을 누르면 서랍, 한 문장 반복·문장 이동·속도', async ({ page }) => {
  await start(page, URL7);
  await expect(page.getByTestId('mini-player')).toBeVisible();
  await page.getByTestId('player-open').click();
  const drawer = page.getByTestId('player-drawer');
  await expect(drawer).toBeVisible();
  await page.getByTestId('repeat-one').click();
  await expect(page.getByTestId('repeat-one')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('mini-toggle').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length), { timeout: 15000 }).toBeGreaterThanOrEqual(3);
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.slice(0, 3));
  expect(new Set(spoken).size).toBe(1); // 같은 문장만 반복
  await page.getByTestId('step-next').click();
  await expect(page.getByTestId('mini-player')).toContainText('TTS · 2/');
  await drawer.getByRole('button', { name: '1.25×' }).click();
  await expect(page.getByTestId('mini-player')).toContainText('1.25×');
  await page.getByRole('button', { name: '재생 메뉴 닫기' }).click();
  await expect(drawer).toHaveCount(0);
});

test('v27. 단어 듣기: 고른 음성이 실패하면 기본 음성으로 다시, 끝내 안 나면 무음 안내', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __spoken2: string[]; __mode: 'voiceFails' | 'silent' };
    w.__spoken2 = [];
    w.__mode = 'voiceFails';
    const voices = [{ name: 'Mock US', lang: 'en-US', voiceURI: 'mock-us', localService: true, default: true }];
    const synth = {
      getVoices: () => voices, speaking: false, pending: false, paused: false,
      speak(u: SpeechSynthesisUtterance & { voice: unknown }) {
        if (w.__mode === 'silent') return; // 아무 일도 안 일어남(무음·버려짐)
        if (u.voice) { setTimeout(() => u.onerror?.({ error: 'synthesis-failed' } as never), 10); return; }
        w.__spoken2.push(u.text);
        setTimeout(() => u.onstart?.(new Event('start') as never), 0);
        setTimeout(() => u.onend?.(new Event('end') as never), 50);
      },
      cancel() {}, pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
      text: string; lang = ''; rate = 1; voice: unknown = null;
      onstart: ((e: Event) => void) | null = null; onend: ((e: Event) => void) | null = null; onerror: ((e: unknown) => void) | null = null;
      constructor(t: string) { this.text = t; }
    };
  });
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  const dlgOpen = async () => {
    await page.locator('span', { hasText: /^sitting$/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  };
  await dlgOpen();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken2: string[] }).__spoken2)).toContain('sitting');
  await page.evaluate(() => { (window as unknown as { __mode: string }).__mode = 'silent'; });
  await page.getByRole('dialog').getByRole('button', { name: 'sitting 발음 듣기' }).click();
  await expect(page.getByText('무음 스위치를 꺼 주세요')).toBeVisible({ timeout: 8000 });
});

test('v28. 음성 점검: 설정에서 실제로 말해 보고 기록을 보여 줌', async ({ page }) => {
  await start(page, './#/records/settings');
  const box = page.getByTestId('speech-check');
  await box.scrollIntoViewIfNeeded();
  await box.locator('summary').click();
  await page.getByTestId('speech-check-run').click();
  const log = page.getByTestId('speech-check-log');
  await expect(log).toContainText('고른 음성: Mock US');
  await expect(log).toContainText('시작(onstart)');
  await expect(log).toContainText('끝(onend)');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).toContain('This is a sound test.');
});

test('v30. 단어 탭: 발음기호는 단어 아래 한 줄(긴 구도 줄바꿈 없음)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await start(page, './#/words');
  await page.getByRole('group', { name: '트랙 필터' }).getByRole('button', { name: '전체' }).click();
  const rows = page.getByTestId('word-row');
  await expect(rows.first()).toBeVisible();
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const ipa = rows.nth(i).getByTestId('ipa');
    if (!(await ipa.count())) continue;
    const b = (await ipa.boundingBox())!;
    expect(b.height, await ipa.textContent() ?? '').toBeLessThan(26);
  }
});

async function drawLine(page: Page, testid: string, fx1: number, fy1: number, fx2: number, fy2: number) {
  const b = (await page.getByTestId(testid).boundingBox())!;
  await page.mouse.move(b.x + b.width * fx1, b.y + Math.min(b.height, 600) * fy1);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) {
    await page.mouse.move(b.x + b.width * (fx1 + ((fx2 - fx1) * k) / 8), b.y + Math.min(b.height, 600) * (fy1 + ((fy2 - fy1) * k) / 8));
  }
  await page.mouse.up();
}

test('v31. 화면 위 손글씨 메모: 그리기·되돌리기·지우개·저장 후 다시 보임', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await page.getByTestId('ink-toggle').click();
  await expect(page.getByTestId('ink-toolbar')).toBeVisible();
  // 첫째 줄: 색·굵기·완료 / 둘째 줄: 형광펜~PDF
  await expect(page.getByTestId('ink-row1').getByTestId('ink-done')).toBeVisible();
  await expect(page.getByTestId('ink-row1').getByTestId('ink-size-1')).toBeVisible();
  await expect(page.getByTestId('ink-row2').getByTestId('ink-hl')).toBeVisible();
  await expect(page.getByTestId('ink-row2').getByTestId('ink-pdf')).toBeVisible();
  const r1 = (await page.getByTestId('ink-row1').boundingBox())!;
  const r2 = (await page.getByTestId('ink-row2').boundingBox())!;
  expect(r2.y).toBeGreaterThanOrEqual(r1.y + r1.height - 1);
  await drawLine(page, 'ink-box', 0.1, 0.1, 0.6, 0.15);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(1);
  await page.getByTestId('ink-undo').click();
  await expect(page.getByTestId('ink-stroke')).toHaveCount(0);
  await drawLine(page, 'ink-box', 0.1, 0.2, 0.7, 0.2);
  await page.getByTestId('ink-hl').click();
  await drawLine(page, 'ink-box', 0.1, 0.4, 0.5, 0.4);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(2);
  await page.getByTestId('ink-eraser').click();
  await drawLine(page, 'ink-box', 0.3, 0.35, 0.3, 0.45);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(1);
  await page.getByTestId('ink-done').click();
  await expect(page.getByTestId('ink-toggle')).toContainText('메모 1');
  await page.reload();
  await expect(page.getByTestId('ink-stroke')).toHaveCount(1);
  // 메모 끈 동안 단어 누르기는 그대로
  await page.locator('span', { hasText: /^sitting$/ }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('v32. 본문 + 메모를 PDF로 저장', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await page.getByTestId('ink-toggle').click();
  await drawLine(page, 'ink-box', 0.1, 0.1, 0.6, 0.15);
  await page.getByTestId('ink-pdf').click();
  await expect(page.getByTestId('pdf-ready')).toBeVisible({ timeout: 30000 });
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.getByTestId('pdf-save').click();
  const d = await dl;
  // PDF 보기는 그대로 → ✕ 로 닫으면 보던 화면
  await expect(page.getByTestId('pdf-pages').locator('img').first()).toBeVisible();
  await page.getByTestId('pdf-close').click();
  await expect(page.getByTestId('pdf-ready')).toHaveCount(0);
  await expect(page).toHaveURL(/lesson\/2026-11-12-L1\/full$/);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(1);
  expect(d.suggestedFilename()).toMatch(/\.pdf$/);
  const buf = await readFileSync(await d.path());
  expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  expect(buf.length).toBeGreaterThan(20000);
});

test('v33. 손글씨 필사: 문장마다 쓰고 모아 보기·PDF', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/practice');
  await page.getByTestId('practice-handwrite').click();
  await expect(page.getByTestId('hw-sentence')).toBeVisible();
  await drawLine(page, 'hw-pad', 0.1, 0.3, 0.8, 0.35);
  await expect(page.getByTestId('hw-pad').getByTestId('ink-stroke')).toHaveCount(1);
  await expect(page.getByTestId('hw-s-1')).toContainText('✓');
  await page.getByTestId('hw-next').click();
  await expect(page.getByTestId('hw-pad').getByTestId('ink-stroke')).toHaveCount(0);
  await drawLine(page, 'hw-pad', 0.2, 0.5, 0.7, 0.5);
  await page.getByTestId('hw-all').click();
  await expect(page.getByTestId('hw-all')).toContainText('2/');
  await expect(page.getByTestId('hw-page').first().locator('canvas')).toBeVisible();
  await page.getByTestId('hw-pdf').click();
  await expect(page.getByTestId('pdf-ready')).toBeVisible({ timeout: 30000 });
  const dl = page.waitForEvent('download', { timeout: 30000 });
  await page.getByTestId('pdf-save').click();
  const d = await dl;
  const buf = readFileSync(await d.path());
  expect(buf.subarray(0, 4).toString()).toBe('%PDF');
});

test('v34. PDF를 열었다 닫아 앱이 처음부터 다시 열려도 보던 화면으로 돌아옴', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/vocab');
  // 아이패드에서 PDF 보기를 닫으면 앱이 시작 주소로 다시 열리는 상황 흉내
  await page.evaluate(() => localStorage.setItem('pilsa.resumeRoute', JSON.stringify({ hash: '#/general/lesson/2026-11-12-L1/vocab', at: Date.now() })));
  await page.goto('./');
  await expect(page).toHaveURL(/#\/general\/lesson\/2026-11-12-L1\/vocab$/);
  // 한 번만: 다시 열면 평소대로
  await page.goto('./');
  await expect(page).not.toHaveURL(/lesson/);
});

test('v35. 즐겨찾기 폴더: 고를 때 새 폴더, 폴더별 보기, 이동, 이름 바꾸기, 삭제(기본으로)', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  // 본문 단어(단어장에 없는 것)를 ☆ → 새 폴더 만들며 넣기
  await page.locator('span', { hasText: /^sitting$/ }).first().click();
  await page.getByRole('dialog', { name: /단어/ }).getByTestId('word-fav').click();
  await page.getByTestId('new-folder-name').fill('동사');
  await page.getByTestId('new-folder-add').click();
  await expect(page.getByTestId('folder-picker')).toHaveCount(0);
  // 단어장 단어 ☆ → 취소하면 안 들어감, 다시 → 기본
  await page.goto('./#/words');
  const first = page.getByTestId('word-row').first();
  await first.getByRole('button', { name: '즐겨찾기' }).click();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(first.getByRole('button', { name: '즐겨찾기', exact: true })).toBeVisible();
  await first.getByRole('button', { name: '즐겨찾기' }).click();
  await page.getByTestId('pick-folder-default').click();
  await page.goto('./#/favorites');
  await page.getByTestId('fav-word').click();
  await expect(page.getByTestId('fav-count-word')).toHaveText('2');
  const folders = page.getByTestId('fav-folders');
  await expect(folders).toContainText('📁 동사 1');
  await expect(folders).toContainText('📁 기본 1');
  await folders.getByRole('button', { name: /동사/ }).click();
  await expect(page.getByTestId('word-row')).toHaveCount(1);
  await expect(page.getByTestId('word-row')).toContainText('sit');
  // 기본에 있던 단어를 동사로 이동
  await page.getByTestId('fav-folder-default').click();
  await page.getByTestId('fav-move').click();
  await page.getByTestId('folder-picker').getByRole('button', { name: /동사/ }).click();
  await expect(page.getByTestId('fav-folder-empty')).toBeVisible();
  await expect(folders).toContainText('📁 동사 2');
  // 이름 바꾸기·삭제
  await page.getByTestId('fav-manage').click();
  await page.getByTestId('folder-rename').click();
  await page.getByTestId('folder-rename-input').fill('중요 동사');
  await page.getByTestId('folder-rename-save').click();
  await expect(folders).toContainText('📁 중요 동사 2');
  page.once('dialog', (d) => void d.accept());
  await page.getByTestId('folder-delete').click();
  await expect(folders).not.toContainText('중요 동사');
  await expect(folders).toContainText('📁 기본 2');
});

test('v36. 기록은 시간이 아니라 활동: 이야기 화면 15초 머묾 · 토익 푼 문제', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-light', '15초를 실제로 기다리는 테스트라 한 번만');
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await page.waitForTimeout(16500);
  await page.goto(URL5);
  await page.getByTestId(`choice-${P5_ANSWERS[0]}`).click();
  await page.getByTestId('quiz-next').click();
  await page.getByTestId(`choice-${P5_ANSWERS[1]}`).click();
  await page.goto('./#/general');
  const goal = page.getByTestId('today-goal');
  await expect(goal).toContainText('이야기 화면 1 /');
  await expect(goal).toContainText('토익 문제 2 /');
  await expect(goal).not.toContainText('분 /');
  await page.goto('./#/records');
  await expect(page.getByText('푼 토익 문제', { exact: true })).toBeVisible();
  await page.getByTestId('date-pick').getByTestId('date-input').fill('2026-11-12');
  await expect(page.getByTestId('day-lesson').first()).toContainText('전체 문장');
  await expect(page.getByText('✏️ 토익 문제 2문제')).toBeVisible();
});

test('v37. 문법 표시를 켜고 문법 음영 위 단어를 누르면 단어 뜻과 문법을 함께', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await page.getByRole('button', { name: '문법', exact: true }).click();
  const g = page.locator('[data-grammar]').first();
  await expect(g).toBeVisible();
  const gid = await g.getAttribute('data-grammar');
  const word = (await g.textContent())!.trim();
  await g.click();
  const dlg = page.getByRole('dialog', { name: /단어/ });
  await expect(dlg.getByTestId('popup-grammar')).toBeVisible();
  await expect(dlg.getByTestId('popup-grammar')).toContainText('✏️ 문법 ·');
  await expect(dlg).not.toContainText('뜻 정보가 없어요');
  await dlg.getByRole('button', { name: '닫기' }).click();
  // 문법 표시를 끄면 같은 단어도 단어 뜻만
  await page.getByRole('button', { name: '✓문법', exact: true }).click();
  await expect(page.locator('[data-grammar]')).toHaveCount(0);
  await page.locator('span', { hasText: new RegExp(`^${word}$`) }).first().click();
  await expect(page.getByRole('dialog', { name: /단어/ })).toBeVisible();
  await expect(page.getByRole('dialog', { name: /단어/ }).getByTestId('popup-grammar')).toHaveCount(0);
  expect(gid).toBeTruthy();
});

async function penLine(page: Page, testid: string, fx1: number, fy: number, fx2: number) {
  const b = (await page.getByTestId(testid).boundingBox())!;
  await page.evaluate(({ b, fx1, fy, fx2 }) => {
    const at = (fx: number) => ({ x: b.x + b.width * fx, y: b.y + 120 * fy });
    const p0 = at(fx1);
    const target = document.elementFromPoint(p0.x, p0.y)!;
    const fire = (type: string, p: { x: number; y: number }) => target.dispatchEvent(new PointerEvent(type, {
      pointerType: 'pen', pointerId: 7, isPrimary: true, clientX: p.x, clientY: p.y, pressure: 0.6, bubbles: true, cancelable: true, button: 0, buttons: 1,
    }));
    fire('pointerdown', p0);
    for (let k = 1; k <= 8; k++) fire('pointermove', at(fx1 + ((fx2 - fx1) * k) / 8));
    fire('pointerup', at(fx2));
  }, { b, fx1, fy, fx2 });
}

test('v38. 애플펜슬이 닿으면 바로 메모(버튼 없이), 손가락·마우스 탭은 그대로 단어 창', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await expect(page.getByTestId('ink-toolbar')).toHaveCount(0);
  await penLine(page, 'ink-box', 0.1, 1.2, 0.6);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(1);
  await expect(page.getByTestId('ink-toolbar')).toBeVisible(); // 펜슬로 쓰면 도구 줄이 자동으로
  await page.getByTestId('ink-done').click();
  // 메모 모드가 꺼져 있어도 펜슬은 계속 그려짐
  await penLine(page, 'ink-box', 0.2, 2, 0.7);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(2);
  await page.getByTestId('ink-done').click();
  // 손가락(마우스) 탭은 단어 창
  await page.locator('span', { hasText: /^sitting$/ }).first().click();
  await expect(page.getByRole('dialog', { name: /단어/ })).toBeVisible();
  await page.getByRole('dialog', { name: /단어/ }).getByRole('button', { name: '닫기' }).click();
  // 설정에서 끄면 펜슬도 버튼을 눌러야
  await page.goto('./#/records/settings');
  await page.getByTestId('pen-auto').uncheck();
  await page.goto('./#/general/lesson/2026-11-12-L1/full');
  await penLine(page, 'ink-box', 0.1, 3, 0.5);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(2);
});

test('v39. 지우개(획/부분), 이전·되살리기', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await page.getByTestId('ink-toggle').click();
  const strokes = page.getByTestId('ink-stroke');
  await drawLine(page, 'ink-box', 0.1, 0.1, 0.8, 0.1);
  await drawLine(page, 'ink-box', 0.1, 0.3, 0.8, 0.3);
  await expect(strokes).toHaveCount(2);
  // 이전·되살리기: 한 획씩
  await page.getByTestId('ink-undo').click();
  await expect(strokes).toHaveCount(1);
  await page.getByTestId('ink-redo').click();
  await expect(strokes).toHaveCount(2);
  await expect(page.getByTestId('ink-redo')).toBeDisabled();
  // 부분 지우개: 가운데를 세로로 지나가면 획이 둘로 나뉨(통째로 사라지지 않음)
  await page.getByTestId('ink-eraser-part').click();
  await drawLine(page, 'ink-box', 0.45, 0.05, 0.45, 0.15);
  await expect(strokes).toHaveCount(3);
  // 지우개 한 번은 '이전' 한 번으로 통째로 되돌아감
  await page.getByTestId('ink-undo').click();
  await expect(strokes).toHaveCount(2);
  // 획 지우개: 닿은 획 전체가 사라짐
  await page.getByTestId('ink-eraser').click();
  await drawLine(page, 'ink-box', 0.45, 0.25, 0.45, 0.35);
  await expect(strokes).toHaveCount(1);
  await page.getByTestId('ink-undo').click();
  await expect(strokes).toHaveCount(2);
  // 새로 쓰면 되살리기 목록은 비워짐
  await page.getByTestId('ink-pen-1f2937').click();
  await drawLine(page, 'ink-box', 0.1, 0.5, 0.5, 0.5);
  await expect(page.getByTestId('ink-redo')).toBeDisabled();
});

async function penTap(page: Page, testid: string, fx: number, fy: number) {
  const b = (await page.getByTestId(testid).boundingBox())!;
  await page.evaluate(({ x, y }) => {
    const target = document.elementFromPoint(x, y)!;
    const o = { pointerType: 'pen', pointerId: 9, isPrimary: true, clientX: x, clientY: y, pressure: 0.5, bubbles: true, cancelable: true, button: 0, buttons: 1 };
    target.dispatchEvent(new PointerEvent('pointerdown', o));
    target.dispatchEvent(new PointerEvent('pointerup', o));
  }, { x: b.x + b.width * fx, y: b.y + 120 * fy });
}

test('v40. 펜 색 직접 고르기·굵기, 펜슬 두 번 톡 = 지우개 ↔ 펜(점은 안 남김)', async ({ page }) => {
  await start(page, './#/general/lesson/2026-11-12-L1/full');
  await page.getByTestId('ink-toggle').click();
  await page.getByTestId('ink-color-input').fill('#ff00aa');
  await page.getByTestId('ink-size-3').click();
  await drawLine(page, 'ink-box', 0.1, 0.1, 0.8, 0.1);
  const s1 = page.getByTestId('ink-stroke').first();
  await expect(s1).toHaveAttribute('stroke', '#ff00aa');
  await page.getByTestId('ink-size-0').click();
  await drawLine(page, 'ink-box', 0.1, 0.4, 0.8, 0.4);
  const w = async (i: number) => Number(await page.getByTestId('ink-stroke').nth(i).getAttribute('stroke-width'));
  expect(await w(0)).toBeGreaterThan((await w(1)) * 3);
  // 펜슬 한 번 톡 = 점 하나(잠깐 뒤 저장)
  await penTap(page, 'ink-box', 0.5, 1.5);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(3);
  await page.waitForTimeout(600);
  // 두 번 톡 = 지우개로(점 안 남김)
  await penTap(page, 'ink-box', 0.6, 2.2);
  await penTap(page, 'ink-box', 0.6, 2.2);
  await expect(page.getByText('🧽 지우개로')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('ink-stroke')).toHaveCount(3);
  await expect(page.getByTestId('ink-eraser')).toHaveAttribute('aria-pressed', 'true');
  // 다시 두 번 톡 = 펜으로
  await penTap(page, 'ink-box', 0.6, 2.6);
  await penTap(page, 'ink-box', 0.6, 2.6);
  await expect(page.getByText('✏️ 펜으로')).toBeVisible();
  // 설정 확인: 색·굵기는 기억됨
  await page.reload();
  await page.getByTestId('ink-toggle').click();
  await expect(page.getByTestId('ink-size-0')).toHaveAttribute('aria-pressed', 'true');
});
