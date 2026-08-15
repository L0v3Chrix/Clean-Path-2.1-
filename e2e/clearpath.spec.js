import { test, expect } from '@playwright/test';

const ownerEmail = 'sample.owner@example.test';
const ownerPassword = process.env.SAMPLE_AUTH_PASSWORD || 'ClearPath-test-only-2026!';
const browserErrors = new WeakMap();

function captureBrowserErrors(page, errors) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
}

async function createApplicant(page, firstName) {
  const lastName = `Test ${Date.now().toString().slice(-6)}`;
  await page.getByRole('link', { name: 'Residents', exact: true }).click();
  await page.getByRole('button', { name: 'New Intake' }).click();
  await page.getByText('First Name *').locator('..').getByRole('textbox').fill(firstName);
  await page.getByText('Last Name *').locator('..').getByRole('textbox').fill(lastName);
  await page.getByRole('button', { name: 'Complete Intake' }).click();
  const fullName = `${firstName} ${lastName}`;
  await expect(page.getByText(fullName)).toBeVisible();
  return fullName;
}

test.describe.serial('production-backed operator acceptance', () => {
  test.beforeEach(async ({ context, page }) => {
    const errors = [];
    browserErrors.set(context, errors);
    captureBrowserErrors(page, errors);
    context.on('page', (newPage) => captureBrowserErrors(newPage, errors));
    await page.goto('/login');
    await page.getByLabel('Email').fill(ownerEmail);
    await page.locator('#password').fill(ownerPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('heading', { name: "Today's operating picture" })).toBeVisible();
  });

  test.afterEach(async ({ context }) => {
    expect(browserErrors.get(context) || []).toEqual([]);
  });

  test('creates and reads a resident through authenticated RLS', async ({ page }) => {
    await createApplicant(page, 'Browser');
  });

  test('downloads an authorized report', async ({ page }) => {
    await page.getByRole('link', { name: 'Reports', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Operational Exports' })).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Residents' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^clearpath-resident-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  test('creates and edits a tenant-owned house', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const originalName = `Browser House ${suffix}`;
    const updatedName = `${originalName} Updated`;
    await page.getByRole('link', { name: 'Locations', exact: true }).click();
    await page.getByRole('button', { name: 'Add Location' }).click();
    await page.getByText('Property Name *').locator('..').getByRole('textbox').fill(originalName);
    await page.getByText('Address').locator('..').getByRole('textbox').fill('100 Acceptance Test Way');
    await page.getByText('City').locator('..').getByRole('textbox').fill('Sample City');
    await page.getByText('State').locator('..').getByRole('textbox').fill('MO');
    await page.getByText('ZIP').locator('..').getByRole('textbox').fill('64001');
    await page.getByText('Total Beds').locator('..').getByRole('spinbutton').fill('4');
    await page.getByRole('button', { name: 'Add Location', exact: true }).last().click();
    await expect(page.getByRole('button', { name: `Edit location ${originalName}` })).toBeVisible();
    await page.getByRole('button', { name: `Edit location ${originalName}` }).click();
    await page.getByText('Property Name *').locator('..').getByRole('textbox').fill(updatedName);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.getByRole('button', { name: `Edit location ${updatedName}` })).toBeVisible();
  });

  test('creates and edits a staff shift', async ({ page }) => {
    const seed = Number(Date.now().toString().slice(-4));
    const hour = String(5 + (seed % 8)).padStart(2, '0');
    const minute = String(seed % 60).padStart(2, '0');
    const start = `${hour}:${minute}`;
    const end = `${String(Number(hour) + 1).padStart(2, '0')}:${minute}`;
    const updatedEnd = `${String(Number(hour) + 2).padStart(2, '0')}:${minute}`;
    const date = new Date().toISOString().slice(0, 10);
    await page.getByRole('link', { name: 'Scheduling', exact: true }).click();
    await page.getByRole('button', { name: 'Assign Shift' }).click();
    await page.getByText('Location *').locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: 'SAMPLE - North House' }).click();
    await page.getByText('Staff Member *').locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: /Sample Staff/ }).click();
    await page.getByText('Start Time *').locator('..').getByRole('textbox').fill(start);
    await page.getByText('End Time *').locator('..').getByRole('textbox').fill(end);
    await page.getByRole('button', { name: 'Assign Shift', exact: true }).last().click();
    const createdShift = page.getByRole('button', {
      name: `Edit shift for Sample Staff on ${date} from ${start} to ${end}`,
    });
    await expect(createdShift).toBeVisible();
    await createdShift.click();
    await page.getByText('End Time *').locator('..').getByRole('textbox').fill(updatedEnd);
    await page.getByRole('button', { name: 'Update Shift' }).click();
    await expect(page.getByRole('button', {
      name: `Edit shift for Sample Staff on ${date} from ${start} to ${updatedEnd}`,
    })).toBeVisible();
  });

  test('creates and updates a resident care plan goal and task', async ({ page }) => {
    const suffix = Date.now().toString().slice(-6);
    const goalTitle = `Browser recovery goal ${suffix}`;
    const updatedGoalTitle = `${goalTitle} updated`;
    const taskTitle = `Browser follow-up ${suffix}`;
    await page.getByRole('link', { name: 'Residents', exact: true }).click();
    await page.getByRole('button', { name: /Demo Jordan/ }).click();
    await page.getByRole('button', { name: 'Care Plan' }).click();
    await page.getByRole('button', { name: 'Add Goal' }).click();
    await page.getByPlaceholder('e.g. Maintain 90 days sobriety').fill(goalTitle);
    await page.getByRole('button', { name: 'Save Goal' }).click();
    let goal = page.getByRole('article', { name: `Care plan goal: ${goalTitle}` });
    await expect(goal).toBeVisible();
    await goal.getByTitle('Edit goal').click();
    await page.getByPlaceholder('e.g. Maintain 90 days sobriety').fill(updatedGoalTitle);
    await page.getByText('Status').locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: 'In Progress' }).click();
    await page.getByRole('button', { name: 'Save Goal' }).click();
    goal = page.getByRole('article', { name: `Care plan goal: ${updatedGoalTitle}` });
    await expect(goal).toBeVisible();
    await goal.getByRole('button', { name: 'Add task to this goal' }).click();
    await page.getByPlaceholder('e.g. Weekly check-in call').fill(taskTitle);
    await page.getByRole('button', { name: 'Save Task' }).click();
    const taskRow = goal.getByRole('article', { name: `Care plan task: ${taskTitle}` });
    await expect(taskRow).toBeVisible();
    await taskRow.getByRole('button', { name: `Complete task ${taskTitle}` }).click();
    await expect(goal.getByText(taskTitle)).toHaveClass(/line-through/);
  });

  test('assigns an applicant to an available bed', async ({ page }) => {
    const applicantName = await createApplicant(page, 'Bed');
    await page.getByRole('link', { name: 'Bed Capacity', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Bed Capacity Dashboard' })).toBeVisible();
    await page.getByRole('button', { name: 'Assign Applicant' }).first().click();
    await page.getByText('Applicant *').locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: applicantName }).click();
    await page.getByPlaceholder('e.g. 2A, Rm 3').fill(`QA-${Date.now().toString().slice(-6)}`);
    await page.getByRole('button', { name: 'Confirm Assignment' }).click();
    await expect(page.getByRole('heading', { name: 'Assign Applicant to Bed' })).not.toBeVisible();
    await page.getByRole('button', { name: 'View Details' }).first().click();
    await expect(page.getByText(applicantName)).toBeVisible();
  });

  test('logs a resident medication dose', async ({ page }) => {
    await page.getByRole('link', { name: 'Residents', exact: true }).click();
    await page.getByRole('button', { name: /Demo Jordan/ }).click();
    await page.getByRole('button', { name: 'Meds', exact: true }).click();
    await expect(page.getByText('SAMPLE - Morning Support Medication', { exact: true })).toBeVisible();
    await page.getByTitle('Log Dose').click();
    await page.getByPlaceholder('Staff name').fill('Browser QA');
    await page.getByPlaceholder('Any observations…').fill('Recorded by automated operator acceptance.');
    await page.locator('form').getByRole('button', { name: 'Log Dose', exact: true }).click();
    await page.getByRole('button', { name: /Dose History/ }).first().click();
    await expect(page.getByText('by Browser QA').first()).toBeVisible();
  });

  test('creates and advances an incident report', async ({ page }) => {
    const description = `Browser acceptance incident ${Date.now()}`;
    await page.getByRole('link', { name: 'Incidents', exact: true }).click();
    await page.getByRole('button', { name: 'Log Incident' }).click();
    await page.getByText('Type *').locator('..').getByRole('combobox').click();
    await page.getByRole('option', { name: 'rule violation' }).click();
    await page.getByPlaceholder(/Describe what happened/).fill(description);
    await page.getByRole('button', { name: 'Submit Report' }).click();
    await expect(page.getByText(description)).toBeVisible();
    await page.getByText(description).click();
    const inReview = page.getByTitle('Mark as In Review');
    await inReview.click();
    await expect(inReview).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    const incidentRow = page.getByRole('button', { name: new RegExp(description) });
    await expect(incidentRow.getByText('in review')).toBeVisible();
  });

  test('opens an authorized private document URL', async ({ page }) => {
    await page.getByRole('link', { name: 'Secure Documents', exact: true }).click();
    const title = page.getByText('SAMPLE - Medication Documentation Policy');
    await expect(title).toBeVisible();
    const card = title.locator('..').locator('..').locator('..');
    await card.getByRole('button', { name: 'View', exact: true }).click();
    const downloadLink = page.getByRole('link').filter({
      has: page.getByRole('button', { name: 'Download', exact: true }),
    });
    await expect(downloadLink).toHaveAttribute('href', /storage\/v1\/object\/sign\/secure-documents\//);
  });

  test('submits an anonymous intake through the protected public token', async ({ page, context }) => {
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Create intake link' }).click();
    const preview = page.getByRole('link', { name: 'Preview' });
    await expect(preview).toBeVisible();
    const intakeUrl = await preview.getAttribute('href');
    const intakePage = await context.newPage();
    await intakePage.goto(intakeUrl);
    await expect(intakePage.getByRole('heading', { name: /Resident Application/ })).toBeVisible();
    const suffix = Date.now().toString().slice(-6);
    await intakePage.getByText('First Name *').locator('..').getByRole('textbox').fill('Public');
    await intakePage.getByText('Last Name *').locator('..').getByRole('textbox').fill(`Applicant ${suffix}`);
    await intakePage.getByText('Date of Birth *').locator('..').getByRole('textbox').fill('1990-01-15');
    for (let step = 0; step < 5; step += 1) {
      await intakePage.getByRole('button', { name: 'Continue' }).click();
    }
    await intakePage.locator('input[type="file"]').first().setInputFiles({
      name: 'browser-photo-id.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    await expect(intakePage.getByText(/browser-photo-id\.png/)).toBeVisible();
    await intakePage.getByRole('button', { name: 'Continue' }).click();
    await intakePage.getByRole('checkbox').check();
    await intakePage.getByRole('button', { name: 'Continue' }).click();
    const canvas = intakePage.locator('canvas');
    const box = await canvas.boundingBox();
    await intakePage.mouse.move(box.x + 60, box.y + 70);
    await intakePage.mouse.down();
    await intakePage.mouse.move(box.x + 180, box.y + 35, { steps: 8 });
    await intakePage.mouse.move(box.x + 300, box.y + 80, { steps: 8 });
    await intakePage.mouse.up();
    await intakePage.getByRole('checkbox').check();
    await intakePage.getByRole('button', { name: 'Submit Application' }).click();
    await expect(intakePage.getByRole('heading', { name: 'Application Submitted!' })).toBeVisible({ timeout: 15_000 });
    await expect(intakePage.getByText(`Public Applicant ${suffix}`)).toBeVisible();
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
