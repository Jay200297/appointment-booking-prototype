const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiry } = require('../config');

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    return bearerToken;
  }

  const cookieHeader = req.headers.cookie || '';
  const cookieToken = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith('patient_session='));

  if (!cookieToken) {
    return null;
  }

  return decodeURIComponent(cookieToken.split('=')[1]);
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id || 'demo-user',
      email: user.email || 'demo@clinic.com',
      role: user.role || 'patient',
      // For role === 'provider', this is provider.id (clinical staff record),
      // which is what clinic_provider and appointment.provider_id reference.
      // It is distinct from `id` above, which is the app_user.id (login account).
      providerId: user.provider_id || user.providerId || null
    },
    jwtSecret,
    { expiresIn: jwtExpiry }
  );
}

function authenticate(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token or session cookie' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = {
  signToken,
  authenticate,
  requireRole,
  getTokenFromRequest
};
