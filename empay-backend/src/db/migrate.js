const mysql = require('mysql2/promise');
require('dotenv').config();

async function addColumnIfMissing(conn, table, column, definition) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND COLUMN_NAME=?`,
    [process.env.DB_NAME || 'empay_db', table, column]
  );
  if (rows[0].cnt === 0) {
    await conn.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`  + ${table}.${column}`);
  }
}

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'empay_db',
  });
  console.log('🔄 Running migrations...');

  // employees new columns
  const empCols = [
    ['wage',                  'DECIMAL(12,2) DEFAULT 0'],
    ['working_days_per_week', 'INT DEFAULT 5'],
    ['break_time_hrs',        'DECIMAL(4,2) DEFAULT 1.0'],
    ['pf_rate',               'DECIMAL(5,2) DEFAULT 12.00'],
    ['prof_tax_amount',       'DECIMAL(10,2) DEFAULT 200.00'],
    ['birth_date',            'DATE'],
    ['gender',                'VARCHAR(20)'],
    ['marital_status',        'VARCHAR(30)'],
    ['nationality',           'VARCHAR(100)'],
    ['personal_email',        'VARCHAR(255)'],
    ['permanent_address',     'TEXT'],
    ['manager_id',            'INT'],
    ['location',              'VARCHAR(100)'],
    ['bank_name',             'VARCHAR(100)'],
    ['ifsc_code',             'VARCHAR(20)'],
    ['uam_id',                'VARCHAR(50)'],
    ['about',                 'TEXT'],
    ['skills',                'TEXT'],
    ['certifications',        'TEXT'],
  ];
  for (const [col, def] of empCols) {
    await addColumnIfMissing(conn, 'employees', col, def);
  }

  // users new columns
  await addColumnIfMissing(conn, 'users', 'login_id', 'VARCHAR(50)');

  // Backfill wage from basic_salary
  await conn.query(`UPDATE employees SET wage = basic_salary WHERE wage = 0 AND basic_salary > 0`);
  // Backfill login_id = employee_code on users
  await conn.query(`UPDATE users u JOIN employees e ON e.user_id = u.id SET u.login_id = e.employee_code WHERE u.login_id IS NULL`);

  console.log('✅ Migration complete!');
  await conn.end();
}

migrate().catch(err => { console.error('❌ Migration failed:', err.message); process.exit(1); });
