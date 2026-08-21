# Reminder scheduling

There are three simple ways to run `scripts/send_reminders.js` regularly:

1. Crontab (Linux)

Add a crontab entry for the system user that runs your service (example: every 15 minutes):

```bash
# Edit the crontab
crontab -e

# Add this line (adjust path)
*/15 * * * * cd /path/to/project && npm run remind >> /var/log/clinic-reminders.log 2>&1
```

2. systemd timer (recommended for servers)

Create `send-reminders.service` and `send-reminders.timer` in `/etc/systemd/system/` (examples in `deployment/`). Then enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now send-reminders.timer
```

3. Container / orchestrator

Run the CLI periodically using your job scheduler (Kubernetes CronJob, AWS EventBridge invoking Lambda, etc). Use the same command:

```bash
node /app/scripts/send_reminders.js --minutes 60
```

## Environment

- `DATABASE_URL` — Postgres connection string
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` — optional for real SMS
- `ENABLE_REMINDER_SCHEDULER` — set `true` to enable in-process scheduler (not recommended for clustered deployments)
- `REMINDER_INTERVAL_MINUTES` — interval used by in-process scheduler

## Logs and monitoring

Ship logs to a central system (ELK/Datadog) and monitor the number of notifications written to the `notification` table.
