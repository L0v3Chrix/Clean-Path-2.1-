import { test, expect } from '@playwright/test';

const ownerEmail = 'sample.owner@example.test';
const ownerPassword = process.env.SAMPLE_AUTH_PASSWORD || 'ClearPath-test-only-2026!';

test.describe.serial('production-backed operator acceptance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(ownerEmail);
    await page.locator('#password').fill(ownerPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: "Today's operating picture" })).toBeVisible();
  });

  test('creates and reads a resident through authenticated RLS', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    await page.getByRole('link', { name: 'Residents', exact: true }).click();
    await page.getByRole('button', { name: 'New Intake' }).click();
    await page.getByText('First Name *').locator('..').getByRole('textbox').fill('Browser');
    await page.getByText('Last Name *').locator('..').getByRole('textbox').fill(`Test ${suffix}`);
    await page.getByRole('button', { name: 'Complete Intake' }).click();
    await expect(page.getByText(`Browser Test ${suffix}`)).toBeVisible();
  });

  test('downloads an authorized report', async ({ page }) => {
    await page.getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Operational Exports' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Residents' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^clearpath-resident-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('rotates and opens a protected public-intake token', async ({ page, context }) => {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Create intake link' }).click();
    const preview = page.getByRole('link', { name: 'Preview' });
    await expect(preview).toBeVisible();
    const intakeUrl = await preview.getAttribute('href');
    const intakePage = await context.newPage();
    await intakePage.goto(intakeUrl);
    await expect(intakePage.getByRole('heading', { name: /Resident Application/ })).toBeVisible();
    await intakePage.close();
  });

  test('invites assigned staff and signs out', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    await page.getByRole('link', { name: 'Staff', exact: true }).click();
    await page.getByRole('button', { name: 'Add Staff' }).click();
    await page.getByText('First Name *').locator('..').getByRole('textbox').fill('Invite');
    await page.getByText('Last Name *').locator('..').getByRole('textbox').fill(`Test ${suffix}`);
    await page.getByText('Email').locator('..').getByRole('textbox').fill(`invite-${suffix}@example.test`);
    await page.getByText('House Access').locator('..').getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Invite Staff Member' }).click();
    await expect(page.getByText(`Invite Test ${suffix}`)).toBeVisible();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});
