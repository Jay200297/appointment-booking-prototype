const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

// Most free managed Postgres hosts (Render, Railway, Supabase, etc.) require
// SSL and use self-signed certs, so we can't verify them with a standard CA.
// Set DATABASE_SSL=true in production; leave unset for local/Docker Postgres.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});
let queryMock = null;

const query = async (text, params) => {
  if (queryMock) {
    return queryMock(text, params);
  }
  return pool.query(text, params);
};

module.exports = {
  query,
  getClient: () => {
    if (queryMock) {
      return {
        query: async (text, params) => queryMock(text, params),
        release: () => {}
      };
    }
    return pool.connect();
  },
  setQueryMock: (fn) => {
    queryMock = fn;
  },
  clearQueryMock: () => {
    queryMock = null;
  }
};
