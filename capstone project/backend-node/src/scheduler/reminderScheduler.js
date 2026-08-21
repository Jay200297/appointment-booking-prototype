const { runReminders } = require('../services/reminderService');

let timer = null;

function startScheduler() {
  const enabled = String(process.env.ENABLE_REMINDER_SCHEDULER || '').toLowerCase() === 'true';
  if (!enabled) return;

  const intervalMinutes = Number(process.env.REMINDER_INTERVAL_MINUTES) || 60;
  console.log(`Starting reminder scheduler: every ${intervalMinutes} minutes`);

  // initial run
  runReminders(intervalMinutes).catch((err) => console.error('reminder run failed', err));

  // schedule
  timer = setInterval(() => {
    runReminders(intervalMinutes).catch((err) => console.error('reminder run failed', err));
  }, intervalMinutes * 60000);
}

function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

module.exports = { startScheduler, stopScheduler };
