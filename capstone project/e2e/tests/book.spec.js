const { test, expect } = require('@playwright/test');

const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

test('patient can book an appointment (UI flow)', async ({ page }) => {
  await page.goto(FRONTEND);

  // Sign in as patient
  await page.fill('input[type="email"]', 'e2e-patient@example.com');
  await page.selectOption('select', 'patient');
  await page.click('button:has-text("Login")');

  // Choose date (use default input if present)
  const dateInput = await page.$('input[type="date"]');
  if (dateInput) {
    const today = new Date();
    today.setDate(today.getDate() + 2);
    const iso = today.toISOString().split('T')[0];
    await page.fill('input[type="date"]', iso);
  }

  // View slots
  await page.click('button:has-text("View available slots")');
  // wait for a slot button to appear
  await page.waitForSelector('.slot-button, button.slot-button', { timeout: 5000 });
  await page.click('.slot-button');

  // fill patient details
  await page.fill('input[name="first_name"], input[placeholder="First name"], input[aria-label="First name"]', 'E2E');
  await page.fill('input[name="last_name"], input[placeholder="Last name"], input[aria-label="Last name"]', 'Tester');
  await page.fill('input[type="email"]', 'e2e-patient@example.com');

  // Book appointment
  await page.click('button:has-text("Book appointment")');

  // Expect success message
  await expect(page.locator('.status.success, .status')).toContainText('booked', { timeout: 5000 });
});
