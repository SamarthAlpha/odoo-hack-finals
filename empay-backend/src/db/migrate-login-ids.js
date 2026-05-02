/**
 * Migration: Update all existing employees' login_id to new format
 * Format: EP + first2(first_name) + first2(last_name) + YYYY + NNNN
 * Example: John Doe, joined 2023 → EPJODO20230001
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const COMPANY_PREFIX = 'EP';

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Get all employees ordered by year of joining then by id (join order)
  const [employees] = await conn.query(
    `SELECT e.id, e.first_name, e.last_name, e.date_of_joining, u.id AS user_id, u.login_id AS old_login
     FROM employees e JOIN users u ON u.id = e.user_id
     ORDER BY YEAR(COALESCE(e.date_of_joining, NOW())), e.id`
  );

  console.log(`Found ${employees.length} employees. Updating login IDs...\n`);

  // Track per-year serial counters
  const yearCounters = {};

  for (const emp of employees) {
    const year = emp.date_of_joining
      ? new Date(emp.date_of_joining).getFullYear()
      : new Date().getFullYear();

    if (!yearCounters[year]) yearCounters[year] = 0;
    yearCounters[year]++;

    const fn = (emp.first_name || 'XX').substring(0, 2).toUpperCase();
    const ln = (emp.last_name  || 'XX').substring(0, 2).toUpperCase();
    const serial = String(yearCounters[year]).padStart(4, '0');
    const newLoginId = `${COMPANY_PREFIX}${fn}${ln}${year}${serial}`;

    await conn.query(`UPDATE users SET login_id = ? WHERE id = ?`, [newLoginId, emp.user_id]);

    console.log(`  ${emp.first_name} ${emp.last_name}  |  ${emp.old_login} → ${newLoginId}`);
  }

  console.log('\n✅ All login IDs updated successfully!');
  await conn.end();
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
