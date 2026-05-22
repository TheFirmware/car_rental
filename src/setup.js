const pool = require('./db');

async function setup() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      car_name VARCHAR(255) NOT NULL,
      days INTEGER NOT NULL,
      rent_per_day INTEGER NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'completed', 'cancelled')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('Database tables ready.');
  await pool.end();
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
