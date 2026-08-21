"""
generate_slots.py

Connects to Postgres, reads `provider_availability`, and generates `timeslot` rows
for a specified date range. Designed for the schema in `migrations/001_create_schema.sql`.

Usage:
  export DATABASE_URL=postgres://user:pass@host:5432/dbname
  python scripts/generate_slots.py --start 2026-08-15 --end 2026-08-21

Notes:
- `provider_availability.recurring_rule` contains a JSON blob with keys:
  - days: ["mon","tue",...]
  - start_time: "HH:MM"
  - end_time: "HH:MM"
  - slot_duration: integer minutes
  - buffer_minutes: integer minutes
- Times are interpreted in the clinic timezone (clinic.timezone)
- The script avoids duplicate timeslots using the unique constraint on (provider_id, start_ts)

"""
import os
import json
import argparse
from datetime import datetime, date, time, timedelta
from zoneinfo import ZoneInfo
import psycopg2
from psycopg2.extras import RealDictCursor

WEEKDAY_MAP = {
    'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
}


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--start', required=True, help='Start date YYYY-MM-DD')
    p.add_argument('--end', required=True, help='End date YYYY-MM-DD')
    p.add_argument('--dry-run', action='store_true', help='Do not insert, just print')
    return p.parse_args()


def daterange(start_date, end_date):
    for n in range(int((end_date - start_date).days) + 1):
        yield start_date + timedelta(n)


def main():
    args = parse_args()
    start_date = datetime.strptime(args.start, '%Y-%m-%d').date()
    end_date = datetime.strptime(args.end, '%Y-%m-%d').date()

    DATABASE_URL = os.getenv('DATABASE_URL')
    if not DATABASE_URL:
        raise SystemExit('Set DATABASE_URL env var')

    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Load provider availabilities
    cur.execute("SELECT pa.*, p.clinic_id, c.timezone FROM provider_availability pa JOIN provider p ON pa.provider_id = p.id JOIN clinic c ON p.clinic_id = c.id")
    rows = cur.fetchall()

    inserts = []

    for pa in rows:
        # recurring_rule may be text or JSON; try parse
        try:
            rule = json.loads(pa['recurring_rule']) if pa['recurring_rule'] else None
        except Exception:
            rule = None

        if not rule:
            print(f"Skipping availability {pa['id']} — no parsable recurring_rule")
            continue

        clinic_tz = ZoneInfo(pa['timezone'])
        days = [WEEKDAY_MAP[d.lower()] for d in rule.get('days', [])]
        slot_duration = int(rule.get('slot_duration', 30))
        buffer_minutes = int(rule.get('buffer_minutes', 0))
        # slot_interval: minutes between slot start times (allows staggered/overlapping slots)
        slot_interval = int(rule.get('slot_interval', slot_duration))
        # optional cap per availability block/day
        max_slots_per_day = int(rule.get('max_slots_per_day', 0))
        start_time_str = rule.get('start_time', '09:00')
        end_time_str = rule.get('end_time', '17:00')
        start_t = datetime.strptime(start_time_str, '%H:%M').time()
        end_t = datetime.strptime(end_time_str, '%H:%M').time()

        for single_date in daterange(start_date, end_date):
            if single_date.weekday() not in days:
                continue

            # skip if within availability start_date/end_date bounds
            if pa.get('start_date') and single_date < pa['start_date']:
                continue
            if pa.get('end_date') and single_date > pa['end_date']:
                continue

            # build slots for the day
            local_start_dt = datetime.combine(single_date, start_t)
            local_end_dt = datetime.combine(single_date, end_t)
            # Attach timezone
            local_start_dt = local_start_dt.replace(tzinfo=clinic_tz)
            local_end_dt = local_end_dt.replace(tzinfo=clinic_tz)

            cursor_dt = local_start_dt
            created_for_day = 0
            while cursor_dt + timedelta(minutes=slot_duration) <= local_end_dt:
                slot_start_local = cursor_dt
                slot_end_local = cursor_dt + timedelta(minutes=slot_duration)

                # Convert to UTC for DB storage
                slot_start_utc = slot_start_local.astimezone(ZoneInfo('UTC'))
                slot_end_utc = slot_end_local.astimezone(ZoneInfo('UTC'))

                inserts.append({
                    'clinic_id': pa['clinic_id'],
                    'provider_id': pa['provider_id'],
                    'service_id': None,  # can be assigned later
                    'start_ts': slot_start_utc.isoformat(),
                    'end_ts': slot_end_utc.isoformat(),
                    'status': 'available'
                })
                created_for_day += 1

                # respect a configured max per day (0 => unlimited)
                if max_slots_per_day and created_for_day >= max_slots_per_day:
                    break

                # advance by configured interval + buffer
                cursor_dt = cursor_dt + timedelta(minutes=slot_interval + buffer_minutes)

            if max_slots_per_day and created_for_day >= max_slots_per_day:
                # stop processing further days if we reached a hard global cap (optional)
                pass

    if args.dry_run:
        print('Dry run — would insert the following timeslots:')
        for s in inserts[:20]:
            print(s)
        print(f'... total {len(inserts)} slots')
        return

    # Insert into DB; use ON CONFLICT DO NOTHING to avoid duplicates (unique constraint)
    insert_sql = (
        "INSERT INTO timeslot (clinic_id, provider_id, service_id, start_ts, end_ts, status) "
        "VALUES (%(clinic_id)s, %(provider_id)s, %(service_id)s, %(start_ts)s, %(end_ts)s, %(status)s) "
        "ON CONFLICT (provider_id, start_ts) DO NOTHING"
    )

    for s in inserts:
        cur.execute(insert_sql, s)

    conn.commit()
    print(f'Inserted {len(inserts)} timeslots (attempted; conflicts ignored)')


if __name__ == '__main__':
    main()
