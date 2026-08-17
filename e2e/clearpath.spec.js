import { test, expect } from '@playwright/test';
import { toLocalDateInputValue } from '../src/lib/localDate.js';

const ownerEmail = 'sample.owner@example.test';
const residentEmail = 'sample.resident@example.test';
const ownerPassword = process.env.SAMPLE_AUTH_PASSWORD || 'ClearPath-test-only-2026!';
const mailpitApiUrl = 'http://127.0.0.1:55324/api/v1';
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

async function pauseWalkthroughIfOpen(page) {
  const pauseButton = page.getByRole('button', { name: 'Pause', exact: true });
  const guideControl = page.getByRole('button', {
    name: /^(Pause|Open guided walkthrough)$/,
  }).first();
  await expect(guideControl).toBeVisible();
  if (await pauseButton.isVisible()) await pauseButton.click();
}

async function getMailpitMessages(request) {
  const response = await request.get(`${mailpitApiUrl}/messages`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()).messages;
}

function extractFirstEmailLink(message) {
  return message.HTML.match(/href="([^"]+)"/i)?.[1]?.replaceAll('&amp;', '&');
}

test.describe('invitation-only account entry', () => {
  test('does not expose public account creation and strips claim tokens from invalid links', async ({ page }) => {
    const requestUrls = [];
    page.on('request', request => requestUrls.push(request.url()));
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Create user' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

    await page.goto('/accept-invite#claim=must-not-remain&access_token=must-not-remain');
    await expect(page).toHaveURL(/\/accept-invite$/);
    await expect(page.getByText(/invitation is invalid or has expired/i)).toBeVisible();
    expect(requestUrls.some(url => url.includes('must-not-remain'))).toBe(false);
  });
});

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
    await expect(page).toHaveURL(/\/$/);
    await pauseWalkthroughIfOpen(page);
    await expect(page.getByRole('heading', { name: "Today's operating picture" })).toBeVisible();
  });

  test.afterEach(async ({ context }) => {
    expect(browserErrors.get(context) || []).toEqual([]);
  });

  test('persists, pauses, and replays the owner walkthrough', async ({ page }) => {
    await page.getByRole('button', { name: 'Open guided walkthrough' }).click();
    await expect(page.getByRole('heading', { name: /Owner setup and safety review/ })).toBeVisible();
    await page.getByRole('button', { name: /^(Replay walkthrough|Replay from beginning)$/ }).click();
    await expect(page.getByRole('heading', { name: 'Review the organization profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Confirm all six houses' })).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();

    await page.reload();
    await page.getByRole('button', { name: 'Open guided walkthrough' }).click();
    await expect(page.getByText('Your place is saved')).toBeVisible();
  });

  test('resumes the saved owner walkthrough within a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open guided walkthrough' }).click();

    const resume = page.getByRole('button', { name: 'Resume walkthrough' });
    const replay = page.getByRole('button', { name: 'Replay from beginning' });
    await expect(resume).toBeVisible();
    await expect(replay).toBeVisible();
    await expect(resume).toBeInViewport();
    await expect(replay).toBeInViewport();

    await resume.click();
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Open Locations' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeInViewport();
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
    const date = toLocalDateInputValue();
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

  test('invites an active resident into a single linked portal account', async ({ page, request }) => {
    const existingMessageIds = new Set((await getMailpitMessages(request)).map((message) => message.ID));
    await page.getByRole('link', { name: 'Residents', exact: true }).click();
    await page.getByRole('button', { name: /Demo Riley/ }).click();
    await page.getByRole('button', { name: 'Invite resident account' }).click();
    await expect(page.getByRole('heading', { name: 'Invite resident account' })).toBeVisible();
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByRole('heading', { name: 'Invitation sent' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    let invitationMessageId = null;
    await expect.poll(async () => {
      const messages = await getMailpitMessages(request);
      invitationMessageId = messages.find((message) => (
        !existingMessageIds.has(message.ID)
        && message.Subject === "You've been invited"
        && message.To.some((recipient) => recipient.Address === 'demo.riley@example.test')
      ))?.ID || null;
      return invitationMessageId;
    }).not.toBeNull();

    const messageResponse = await request.get(`${mailpitApiUrl}/message/${invitationMessageId}`);
    expect(messageResponse.ok()).toBeTruthy();
    const invitationUrl = extractFirstEmailLink(await messageResponse.json());
    expect(invitationUrl).toMatch(/^http:\/\/127\.0\.0\.1:55321\/auth\/v1\/verify\?/);

    await page.goto(invitationUrl);
    await expect(page.getByText('Accept your ClearPath invitation')).toBeVisible();
    const residentPassword = 'Resident-invite-test-only-2026!';
    await page.getByLabel('Password', { exact: true }).fill(residentPassword);
    await page.getByLabel('Confirm password').fill(residentPassword);
    await page.getByRole('button', { name: 'Finish account setup' }).click();
    await expect(page).toHaveURL(/\/my-profile$/);
    await pauseWalkthroughIfOpen(page);
    await expect(page.getByRole('heading', { name: /^Demo/ })).toBeVisible();
    await expect(page.getByText('SAMPLE - North House')).toBeVisible();
  });

  test('invites assigned staff, accepts the emailed account, and signs out', async ({ page, request }) => {
    const existingMessageIds = new Set((await getMailpitMessages(request)).map((message) => message.ID));
    const suffix = Date.now().toString().slice(-6);
    const invitedStaffEmail = `invite-${suffix}@example.test`;
    await page.getByRole('link', { name: 'Staff', exact: true }).click();
    await page.getByRole('button', { name: 'Add Staff' }).click();
    await page.getByText('First Name *').locator('..').getByRole('textbox').fill('Invite');
    await page.getByText('Last Name *').locator('..').getByRole('textbox').fill(`Test ${suffix}`);
    await page.getByText('Email').locator('..').getByRole('textbox').fill(invitedStaffEmail);
    await page.getByText('House Access').locator('..').getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Invite Staff Member' }).click();
    await expect(page.getByText(`Invite Test ${suffix}`)).toBeVisible();

    let invitationMessageId = null;
    await expect.poll(async () => {
      const messages = await getMailpitMessages(request);
      invitationMessageId = messages.find((message) => (
        !existingMessageIds.has(message.ID)
        && message.Subject === "You've been invited"
        && message.To.some((recipient) => recipient.Address === invitedStaffEmail)
      ))?.ID || null;
      return invitationMessageId;
    }).not.toBeNull();

    const messageResponse = await request.get(`${mailpitApiUrl}/message/${invitationMessageId}`);
    const invitationUrl = extractFirstEmailLink(await messageResponse.json());
    await page.goto(invitationUrl);
    await expect(page.getByText('Accept your ClearPath invitation')).toBeVisible();
    const staffPassword = 'Staff-invite-test-only-2026!';
    await page.getByLabel('Password', { exact: true }).fill(staffPassword);
    await page.getByLabel('Confirm password').fill(staffPassword);
    await page.getByRole('button', { name: 'Finish account setup' }).click();
    await expect(page).toHaveURL(/\/$/);
    await pauseWalkthroughIfOpen(page);
    await expect(page.getByRole('heading', { name: "Today's operating picture" })).toBeVisible();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('completes staff password recovery from the emailed link', async ({ page, request }) => {
    const messagesBeforeInvite = new Set((await getMailpitMessages(request)).map((message) => message.ID));
    await page.getByRole('link', { name: 'Staff', exact: true }).click();
    await page.getByRole('button', { name: 'Add Staff' }).click();
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const recoveryStaffEmail = `recovery-${suffix}@example.test`;
    await page.getByText('First Name *').locator('..').getByRole('textbox').fill('Recovery');
    await page.getByText('Last Name *').locator('..').getByRole('textbox').fill(`Test ${suffix}`);
    await page.getByText('Email').locator('..').getByRole('textbox').fill(recoveryStaffEmail);
    await page.getByText('House Access').locator('..').getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'Invite Staff Member' }).click();
    await expect(page.getByText(`Recovery Test ${suffix}`)).toBeVisible();

    let invitationMessageId = null;
    await expect.poll(async () => {
      const messages = await getMailpitMessages(request);
      invitationMessageId = messages.find((message) => (
        !messagesBeforeInvite.has(message.ID)
        && message.Subject === "You've been invited"
        && message.To.some((recipient) => recipient.Address === recoveryStaffEmail)
      ))?.ID || null;
      return invitationMessageId;
    }).not.toBeNull();

    const invitationResponse = await request.get(`${mailpitApiUrl}/message/${invitationMessageId}`);
    await page.goto(extractFirstEmailLink(await invitationResponse.json()));
    const initialPassword = 'Recovery-invite-test-only-2026!';
    await page.getByLabel('Password', { exact: true }).fill(initialPassword);
    await page.getByLabel('Confirm password').fill(initialPassword);
    await page.getByRole('button', { name: 'Finish account setup' }).click();
    await expect(page).toHaveURL(/\/$/);
    await pauseWalkthroughIfOpen(page);
    await expect(page.getByRole('heading', { name: "Today's operating picture" })).toBeVisible();
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    await page.getByLabel('Email').fill(ownerEmail);
    await page.locator('#password').fill(ownerPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/$/);
    await pauseWalkthroughIfOpen(page);
    await page.getByRole('link', { name: 'Staff', exact: true }).click();

    const existingMessageIds = new Set((await getMailpitMessages(request)).map((message) => message.ID));
    await page.getByRole('button').filter({ hasText: recoveryStaffEmail }).click();
    await page.getByRole('button', { name: 'Send password recovery' }).click();
    await expect(page.getByRole('button', { name: 'Recovery email requested' })).toBeVisible();

    let recoveryMessageId = null;
    await expect.poll(async () => {
      const messages = await getMailpitMessages(request);
      recoveryMessageId = messages.find((message) => (
        !existingMessageIds.has(message.ID)
        && message.Subject === 'Reset your password'
        && message.To.some((recipient) => recipient.Address === recoveryStaffEmail)
      ))?.ID || null;
      return recoveryMessageId;
    }).not.toBeNull();

    const messageResponse = await request.get(
      `${mailpitApiUrl}/message/${recoveryMessageId}`,
    );
    const message = await messageResponse.json();
    const recoveryUrl = extractFirstEmailLink(message);
    expect(recoveryUrl).toMatch(/^http:\/\/127\.0\.0\.1:55321\/auth\/v1\/verify\?/);

    await page.goto(recoveryUrl);
    await expect(page.getByText('Reset your ClearPath password')).toBeVisible();
    const newPassword = 'Recovered-test-only-2026!';
    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByLabel('Confirm password').fill(newPassword);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page).toHaveURL(/\/$/);
    await pauseWalkthroughIfOpen(page);
    await expect(page.getByRole('heading', { name: "Today's operating picture" })).toBeVisible();
    await expect(page.getByText('Active Residents', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign Out' }).click();

    await page.getByLabel('Email').fill(recoveryStaffEmail);
    await page.locator('#password').fill(newPassword);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: "Today's operating picture" })).toBeVisible();
  });
});

test.describe('resident account boundary', () => {
  test('shows resident guidance and rejects staff-only routes', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(residentEmail);
    await page.locator('#password').fill(ownerPassword);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/my-profile$/);
    const residentGuideControl = page.getByRole('button', {
      name: /^(Pause|Open guided walkthrough)$/,
    }).first();
    await expect(residentGuideControl).toBeVisible();
    const openGuide = page.getByRole('button', { name: 'Open guided walkthrough' });
    if (await openGuide.isVisible()) await openGuide.click();
    const resumeGuide = page.getByRole('button', { name: 'Resume walkthrough' });
    const replayGuide = page.getByRole('button', { name: /^Replay/ });
    if (await resumeGuide.isVisible().catch(() => false)) await resumeGuide.click();
    else if (await replayGuide.isVisible().catch(() => false)) await replayGuide.click();
    await expect(page.getByRole('heading', { name: /Resident essentials guide/ })).toBeVisible();
    await expect(page.getByText('Check your chores', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByText('SAMPLE - North House')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'My Wallet' })).toBeVisible();
    await expect(page.getByText('1 document', { exact: true })).toBeVisible();
    const agreement = page.getByText('Signed agreement', { exact: true });
    await expect(agreement).toBeVisible();
    const documentCard = agreement.locator('..').locator('..');
    const popupPromise = page.waitForEvent('popup');
    await documentCard.getByRole('button', { name: 'View', exact: true }).click();
    const documentPage = await popupPromise;
    await expect.poll(() => documentPage.url()).toMatch(/storage\/v1\/object\/sign\/resident-documents\//);
    await documentPage.close();

    await expect(page.getByRole('link', { name: 'Staff', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Residents', exact: true })).toHaveCount(0);
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/my-profile$/);
    await expect(page.getByText('Demo Riley', { exact: true })).toHaveCount(0);
  });
});
