// v2: 레벨 선택, 토익 Part 5·6·7 문제 풀이, 오답노트
import { test, expect, type Page } from '@playwright/test';
import { setupMocks } from './mocks';

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
  await expect(page.getByTestId('other-level-2')).toBeDisabled();
  await expect(page.getByTestId('other-level-2')).toContainText('아직 없음');
  await page.getByRole('group', { name: '내 레벨' }).getByTestId('level-2').click();
  await expect(page.getByTestId('no-lesson')).toBeVisible();
  await page.getByRole('link', { name: '지문', exact: true }).click();
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
  await page.goto('./#/toeic');
  await expect(page.getByTestId('part-status-part5')).toHaveText('완료 10/10');
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
