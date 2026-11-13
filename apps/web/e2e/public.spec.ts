import { expect, test } from '@playwright/test';

const VIEWPORTS = [
  { width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 },
  { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 360, height: 800 },
];

test('a signed-out visit to a protected page lands on sign-in', async ({ page }) => {
  await page.goto('/journal');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('heading', { name: 'Chào mừng trở lại' })).toBeVisible();
});

test('sign-in validates before calling the server', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).last().click();
  await expect(page.getByText('Nhập email.')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await page.getByLabel('Email').fill('ten@vidu');
  await expect(page.getByText('Email chưa đúng dạng.')).toBeVisible();
});

test('sign-up and forgot-password modes switch the form', async ({ page }) => {
  await page.goto('/sign-in');
  await page.getByRole('tab', { name: 'Đăng ký' }).click();
  await expect(page.getByLabel('Nhập lại mật khẩu')).toBeVisible();
  await page.getByRole('tab', { name: 'Đăng nhập' }).click();
  await page.getByRole('button', { name: 'Quên mật khẩu?' }).click();
  await expect(page.getByRole('heading', { name: 'Quên mật khẩu' })).toBeVisible();
  await expect(page.getByLabel('Mật khẩu')).toHaveCount(0);
});

test('a reset link opened without a valid recovery says so', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('heading', { name: 'Link đã hết hạn' })).toBeVisible();
});

test('the design system switches theme live', async ({ page }) => {
  await page.goto('/design-system');
  await page.getByRole('radio', { name: 'Dark' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const vp of VIEWPORTS) {
  test(`no horizontal scroll at ${vp.width}x${vp.height}`, async ({ page }) => {
    await page.setViewportSize(vp);
    for (const path of ['/sign-in', '/design-system']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, path).toBeLessThanOrEqual(cw);
    }
  });
}
