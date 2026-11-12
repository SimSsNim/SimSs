// 390px 주요 화면 캡처: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=mobile-light
import { test, expect } from '@playwright/test';
import { setupMocks } from './mocks';

test.skip(!process.env.SCREENSHOTS, 'SCREENSHOTS=1 일 때만');
test.use({ deviceScaleFactor: 2 });

const dir = 'docs/screenshots';
const G = './#/general/lesson/2026-11-12-L1';
const T = (p: string) => `./#/toeic/lesson/2026-11-12-L1-${p}`;

test('주요 화면 캡처', async ({ page }) => {
  await setupMocks(page);
  await page.goto('./');
  await expect(page.getByTestId('level-onboarding')).toBeVisible();
  await page.getByTestId('onb-general').getByTestId('level-2').click();
  await page.getByTestId('onb-general').getByTestId('level-1').click();
  await page.screenshot({ path: `${dir}/09-level-picker.png` });
  await page.getByTestId('onb-start').click();

  await page.getByTestId('check-listen').check();
  await page.getByTestId('check-read').check();
  await page.screenshot({ path: `${dir}/01-home.png` });

  await page.goto(`${G}/full`);
  await page.getByRole('button', { name: '문장별 번역' }).click();
  await page.getByRole('button', { name: '끊어읽기 /' }).click();
  await page.screenshot({ path: `${dir}/02-full-text.png` });
  await page.getByRole('button', { name: '영어', exact: true }).click();
  await page.getByRole('button', { name: '✓끊어읽기 /' }).click();

  await page.goto(`${G}/vocab`);
  await page.getByTestId('vocab-flash').click();
  await page.getByTestId('flash-card').click();
  await page.screenshot({ path: `${dir}/03-flashcards.png` });

  await page.goto(`${G}/structure?s=s4`);
  await expect(page.getByTestId('chunks')).toBeVisible();
  await page.screenshot({ path: `${dir}/04-structure.png` });

  await page.goto(`${G}/listen`);
  await page.getByTestId('listen-toggle').click();
  await page.waitForTimeout(1200);
  await page.getByTestId('listen-toggle').click();
  await page.screenshot({ path: `${dir}/05-listen-audio.png` });

  await page.goto(`${T('part7')}/listen`);
  await page.getByTestId('tts-toggle').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/06-listen-toeic-tts.png` });
  await page.getByTestId('tts-toggle').click();

  await page.goto(`${G}/practice`);
  await page.getByTestId('practice-typing').click();
  await page.getByTestId('typing-input').fill('A Crow was sitting on a branch of a tree with a pece of cheese');
  await page.screenshot({ path: `${dir}/07-typing.png` });

  await page.goto('./#/toeic/list');
  await page.getByRole('combobox', { name: 'Part' }).selectOption('all');
  await expect(page.getByTestId('lesson-item')).toHaveCount(3);
  await page.screenshot({ path: `${dir}/08-toeic-list.png` });

  // ---- v2 ----
  await page.goto(`${T('part5')}/quiz`);
  for (const k of ['B', 'A']) {
    await page.getByTestId(`choice-${k}`).click();
    await page.getByTestId('quiz-next').click();
  }
  await page.goto('./#/toeic');
  await page.screenshot({ path: `${dir}/10-toeic-today.png` });

  await page.goto(`${T('part5')}/quiz`);
  await page.getByTestId('quiz-dots').getByRole('button', { name: /^2\s*번/ }).click();
  await page.screenshot({ path: `${dir}/11-part5-question.png` });

  await page.goto(`${T('part6')}/quiz`);
  await page.getByTestId('choice-B').click();
  await page.getByTestId('slot-3').click();
  await page.screenshot({ path: `${dir}/12-part6-passage.png` });

  await page.goto(`${T('part7')}/quiz`);
  for (const [i, k] of ['A', 'C', 'C'].entries()) {
    await page.getByTestId('p7-tab-question').click();
    await page.getByTestId(`choice-${k}`).click();
    if (i < 2) await page.getByTestId('quiz-next').click();
  }
  await page.getByTestId('quiz-finish').click();
  await page.getByTestId('evidence-q2').click();
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${dir}/13-part7-result.png` });

  await page.goto('./#/review?tab=wrong');
  await expect(page.getByTestId('wrong-row').first()).toBeVisible();
  await page.getByTestId('wrong-row').first().getByRole('button', { name: '다시 풀기' }).click();
  await page.screenshot({ path: `${dir}/14-wrong-note.png` });
});
