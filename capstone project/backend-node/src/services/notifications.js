const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// Adapter selection: if TWILIO_* env vars exist, attempt to use Twilio; otherwise fallback to mock.
let twilioClient = null;
let twilioFrom = process.env.TWILIO_FROM_NUMBER;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    // require lazily
    const Twilio = require('twilio');
    twilioClient = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio adapter enabled');
  } catch (err) {
    console.warn('Twilio adapter unavailable, falling back to mock', err.message || err);
    twilioClient = null;
  }
}

// Look up the clinic for an appointment so we can satisfy notification.clinic_id
// when it's available. Returns null if there's no appointment_id or it isn't found.
async function resolveClinicId(appointment_id) {
  if (!appointment_id) return null;
  try {
    const { rows } = await db.query('SELECT clinic_id FROM appointment WHERE id = $1', [appointment_id]);
    return rows[0]?.clinic_id || null;
  } catch (err) {
    console.error('failed to resolve clinic_id for notification', err);
    return null;
  }
}

// Persists a notification record matching the actual `notification` table
// schema (channel/payload/status), separate from the actual send attempt so
// a DB failure here is never mistaken for the message itself failing.
async function recordNotification({ appointment_id, clinic_id, to, message, status, providerMessageId = null }) {
  const id = uuidv4();
  await db.query(
    `INSERT INTO notification(id, appointment_id, clinic_id, channel, status, attempt_count, last_attempt_at, payload, created_at)
     VALUES ($1,$2,$3,'sms',$4,1,now(),$5,now())`,
    [id, appointment_id || null, clinic_id, status, JSON.stringify({ to, message, providerMessageId })]
  );
  return id;
}

async function sendSms({ appointment_id = null, to, message, user_id = null }) {
  if (!to || !message) return { status: 'failed', error: 'missing to or message' };

  const clinicId = await resolveClinicId(appointment_id);

  if (twilioClient && twilioFrom) {
    // Send first, record second -- and record success/failure independently
    // of whether the DB write itself succeeds, so a logging hiccup can never
    // be confused with the SMS not having gone out (which could otherwise
    // cause well-meaning retry logic to send duplicate texts to a patient).
    let sendResult;
    try {
      sendResult = await twilioClient.messages.create({ body: message, from: twilioFrom, to });
    } catch (err) {
      console.error('Twilio send failed', err);
      try {
        await recordNotification({ appointment_id, clinic_id: clinicId, to, message, status: 'failed' });
      } catch (logErr) {
        console.error('additionally failed to record failed notification', logErr);
      }
      return { id: null, status: 'failed', error: String(err) };
    }

    try {
      const id = await recordNotification({
        appointment_id,
        clinic_id: clinicId,
        to,
        message,
        status: 'sent',
        providerMessageId: sendResult.sid
      });
      return { id, status: 'sent', providerId: sendResult.sid };
    } catch (logErr) {
      // The SMS genuinely sent -- only the audit record failed. Report
      // success; don't let the caller think it needs to resend.
      console.error('SMS sent but failed to record notification', logErr);
      return { id: null, status: 'sent', providerId: sendResult.sid, warning: 'not recorded in notification log' };
    }
  }

  // Fallback mock (no Twilio credentials configured) -- logs instead of
  // actually sending, still exercises the same recording path.
  console.log('SMS SEND (mock)', { to, message });
  try {
    const id = await recordNotification({ appointment_id, clinic_id: clinicId, to, message, status: 'sent' });
    return { id, status: 'sent' };
  } catch (err) {
    console.error('Failed to persist mock notification', err);
    return { id: null, status: 'failed', error: String(err) };
  }
}

module.exports = { sendSms };
