const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db');
const { signToken, getTokenFromRequest } = require('../middleware/auth');
const { jwtSecret } = require('../config');
const { validateSignup, validateLogin, handleValidation } = require('../middleware/validation');

const SALT_ROUNDS = 12;

const getCookieOptions = (req) => {
  const secureCookie = req.secure || req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'Lax',
    path: '/',
    maxAge: 24 * 60 * 60 * 1000
  };
};

const issueSession = (req, res, user) => {
  const token = signToken(user);
  res.cookie('patient_session', token, getCookieOptions(req));

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      dob: user.dob,
      providerId: user.provider_id || null
    }
  });
};

// POST /auth/signup — creates a real user record with a hashed password.
const handleSignup = async (req, res) => {
  const { firstName, lastName, email, phone, dob, password, role } = req.body || {};

  try {
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await db.query('SELECT id FROM app_user WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Only allow self-registration as patient or provider; admin accounts should
    // be created by an existing admin, not via public signup.
    const requestedRole = role === 'provider' ? 'provider' : 'patient';
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const { rows } = await db.query(
      `INSERT INTO app_user (email, password_hash, role, first_name, last_name, phone, dob)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, role, first_name, last_name, phone, dob, provider_id`,
      [normalizedEmail, passwordHash, requestedRole, firstName, lastName, phone || null, dob || null]
    );

    return issueSession(req, res, rows[0]);
  } catch (err) {
    console.error('signup failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
};

router.post('/signup', validateSignup, handleValidation, handleSignup);
router.post('/register', validateSignup, handleValidation, handleSignup);

// POST /auth/login — verifies the submitted password against the stored hash.
router.post('/login', validateLogin, handleValidation, async (req, res) => {
  const { email, password } = req.body || {};

  try {
    const normalizedEmail = String(email).trim().toLowerCase();
    const { rows } = await db.query('SELECT * FROM app_user WHERE email = $1', [normalizedEmail]);

    if (rows.length === 0) {
      // Same generic error whether the email doesn't exist or the password is
      // wrong — don't reveal which one it was.
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return issueSession(req, res, user);
  } catch (err) {
    console.error('login failed', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

router.get('/me', async (req, res) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    const { rows } = await db.query(
      'SELECT id, email, role, first_name, last_name, phone, dob FROM app_user WHERE id = $1',
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const user = rows[0];
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        dob: user.dob
      }
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('patient_session', { path: '/' });
  return res.json({ message: 'Logged out successfully' });
});

module.exports = router;
