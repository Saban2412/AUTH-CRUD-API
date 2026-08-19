const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Greška pri povezivanju sa Postgresom:', err.stack);
  } else {
    console.log('🚀 Uspešno povezan na Postgres unutar Dockera!');
  }
});

module.exports = pool;