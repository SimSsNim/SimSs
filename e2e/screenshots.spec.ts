// 390px 주요 화면 캡처 8장: SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts --project=mobile-light
import { test, expect } from '@playwright/test';
import { setupMocks } from './mocks';

test.skip(!process.env.SCREENSHOTS, 'SCREENSHOTS=1 일 때만');
test.use({ deviceScaleFactor: 2 });

const dir = 'docs/screenshots';

test('주요 화면 캡처', async ({ page }) => {
  await setupMocks(page);
  // 홈: 체크 두 개 정도 해 둔 모습
  await page.goto('./#/general');
  await page.getByTestId('check-listen').check();
  await page.getByTestId('check-read').check();
  await page.screenshot({ path: `${dir}/1-home.png` });

  await page.goto('./#/general/lesson/2026-11-12/full');
  await page.getByRole('button', { name: '문장마다 번역' }).click();
  await page.getByRole('button', { name: '끊어 읽기 /' }).click();
  await page.screenshot({ path: `${dir}/2-full-text.png` });
  await page.getByRole('button', { name: '영어만' }).click();
  await page.getByRole('button', { name: '✓ 끊어 읽기 /' }).click();

  await page.goto('./#/general/lesson/2026-11-12/vocab');
  await page.getByTestId('vocab-flash').click();
  await page.getByTestId('flash-card').click();
  await page.screenshot({ path: `${dir}/3-flashcards.png` });

  await page.goto('./#/general/lesson/2026-11-12/structure?s=s4');
  await expect(page.getByTestId('chunks')).toBeVisible();
  await page.screenshot({ path: `${dir}/4-structure.png` });

  await page.goto('./#/general/lesson/2026-11-12/listen');
  await page.getByTestId('listen-toggle').click();
  await page.waitForTimeout(1200);
  await page.getByTestId('listen-toggle').click();
  await page.screenshot({ path: `${dir}/5-listen-audio.png` });

  await page.goto('./#/toeic/lesson/2026-11-12/listen');
  await page.getByTestId('tts-toggle').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${dir}/6-listen-toeic-tts.png` });
  await page.getByTestId('tts-toggle').click();

  await page.goto('./#/general/lesson/2026-11-12/practice');
  await page.getByTestId('practice-typing').click();
  await page.getByTestId('typing-input').fill('A Fox once saw a Crow fly off with a piece of chese in its beak');
  await page.screenshot({ path: `${dir}/7-typing.png` });

  await page.goto('./#/toeic/list');
  await expect(page.getByTestId('lesson-item')).toHaveCount(1);
  await page.screenshot({ path: `${dir}/8-toeic-list.png` });
});
