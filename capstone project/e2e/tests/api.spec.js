const { test, expect } = require('@playwright/test');

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000';

test('API smoke: availability and iCal endpoints respond', async ({ request }) => {
  const avail = await request.get(`${BACKEND}/availability`);
  expect(avail.ok()).toBeTruthy();
  // body may be JSON array or empty
  const body = await avail.text();
  expect(body.length).toBeGreaterThanOrEqual(0);

  const ical = await request.get(`${BACKEND}/integrations/ical`);
  expect(ical.ok()).toBeTruthy();
  const txt = await ical.text();
  expect(txt.length).toBeGreaterThan(0);
});
