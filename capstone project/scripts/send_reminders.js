#!/usr/bin/env node
/**
 * send_reminders.js
 *
 * Finds upcoming appointments within a lookahead window and sends SMS reminders.
 * Usage: node scripts/send_reminders.js --minutes 60
 *
 * NOTE: this file lives in scripts/, a sibling of backend-node/, not a child
 * of it. Node's module resolution only searches ancestor node_modules
 * folders, so packages installed under backend-node/node_modules (like
 * `argparse`) are NOT visible here. Rather than add a second, separately
 * managed set of dependencies just for this one CLI flag, we parse it by
 * hand -- one flag doesn't need an argument-parsing library.
 */
const { runReminders } = require('../backend-node/src/services/reminderService');

function parseMinutesArg(argv) {
  const flagIndex = argv.indexOf('--minutes');
  if (flagIndex === -1 || !argv[flagIndex + 1]) return 60;
  const parsed = parseInt(argv[flagIndex + 1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60;
}

async function main() {
  const minutes = parseMinutesArg(process.argv.slice(2));
  const results = await runReminders(minutes);
  const sent = results.filter((r) => r.status === 'sent').length;
  const failed = results.filter((r) => r.status !== 'sent').length;
  console.log(`Reminder run complete: ${sent} sent, ${failed} failed (window: ${minutes}m)`);
  if (failed > 0) {
    console.error('Some reminders failed to send:', results.filter((r) => r.status !== 'sent'));
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
