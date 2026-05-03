const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'empay_db',
  });

  const [events] = await conn.execute("SELECT * FROM attendance_events WHERE DATE(timestamp) = CURDATE()");
  console.log("--- Events ---");
  console.log(events);

  const [summary] = await conn.execute("SELECT * FROM attendance_summary WHERE date = CURDATE()");
  console.log("--- Summary ---");
  console.log(summary);

  await conn.end();
}

check().catch(console.error);
