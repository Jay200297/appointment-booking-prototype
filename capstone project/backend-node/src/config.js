const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: Number(process.env.PORT || 8000),
  jwtSecret: process.env.JWT_SECRET || 'clinic-dev-secret',
  jwtExpiry: process.env.JWT_EXPIRY || '1h'
};
