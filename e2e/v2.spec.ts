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
  await expect(page.getByTestId('qstar-q1')).toHaveText('★ 즐겨찾기됨');
  await page.goto('./#/grammar');
  await page.getByTestId('grammar-star').first().click();
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

test('v12. 맨 위에서 아래로 당기면 새로고침', async ({ page }) => {
  await start(page, './#/toeic');
  await page.evaluate(() => ((window as unknown as { __mark: number }).__mark = 1));
  const touch = (type: string, y: number) => page.evaluate(({ type, y }) => {
    const t = new Touch({ identifier: 1, target: document.body, clientX: 150, clientY: y });
    document.body.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], cancelable: true, bubbles: true }));
  }, { type, y });
  await touch('touchstart', 100);
  await touch('touchmove', 140);
  await touch('touchmove', 320);
  await expect(page.getByTestId('ptr')).toContainText('놓으면 새로고침');
  await touch('touchend', 320);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mark?: number }).__mark ?? 0)).toBe(0);
  await expect(page.getByTestId('part-cards')).toBeVisible();
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
  await expect(page.getByTestId('reset-run')).toHaveText('선택한 10개 초기화');
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
