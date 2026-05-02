const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function init() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false,
  });

  console.log('✅ Connected to MySQL');

  await conn.query(`CREATE DATABASE IF NOT EXISTS empay_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE empay_db`);
  console.log('✅ Database created/selected');

  const createTables = [
    // Users — includes login_id column
    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','employee','hr_officer','payroll_officer') NOT NULL DEFAULT 'employee',
      login_id VARCHAR(50),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // Employees — full extended schema
    `CREATE TABLE IF NOT EXISTS employees (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT UNIQUE NOT NULL,
      employee_code VARCHAR(50) UNIQUE NOT NULL,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      department VARCHAR(100),
      designation VARCHAR(100),
      date_of_joining DATE,
      phone VARCHAR(20),
      address TEXT,
      pan_number VARCHAR(20),
      uan_number VARCHAR(20),
      bank_account VARCHAR(50),
      bank_name VARCHAR(100),
      ifsc_code VARCHAR(20),
      uam_id VARCHAR(50),
      wage DECIMAL(12,2) DEFAULT 0.00,
      basic_salary DECIMAL(12,2) DEFAULT 0.00,
      hra DECIMAL(12,2) DEFAULT 0.00,
      standard_allowance DECIMAL(12,2) DEFAULT 1500.00,
      performance_bonus DECIMAL(12,2) DEFAULT 0.00,
      lta DECIMAL(12,2) DEFAULT 2000.00,
      fixed_allowance DECIMAL(12,2) DEFAULT 0.00,
      pf_rate DECIMAL(5,2) DEFAULT 12.00,
      prof_tax_amount DECIMAL(10,2) DEFAULT 200.00,
      working_days_per_week INT DEFAULT 5,
      break_time_hrs DECIMAL(4,2) DEFAULT 1.0,
      birth_date DATE,
      gender VARCHAR(20),
      marital_status VARCHAR(30),
      nationality VARCHAR(100),
      personal_email VARCHAR(255),
      permanent_address TEXT,
      manager_id INT,
      location VARCHAR(100),
      about TEXT,
      skills TEXT,
      certifications TEXT,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,

    // Attendance events (check-in / check-out log — multiple per day allowed)
    `CREATE TABLE IF NOT EXISTS attendance_events (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_id INT NOT NULL,
      timestamp DATETIME NOT NULL,
      event_type ENUM('check_in','check_out') NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,

    // Attendance summary (daily totals — one row per employee per day)
    `CREATE TABLE IF NOT EXISTS attendance_summary (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_id INT NOT NULL,
      date DATE NOT NULL,
      total_hours DECIMAL(5,2) DEFAULT 0.00,
      status ENUM('present','absent','half_day','on_leave') DEFAULT 'absent',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_attendance_summary (employee_id, date),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS time_off_requests (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_id INT NOT NULL,
      leave_type ENUM('sick','casual','earned','maternity','paternity','unpaid') NOT NULL DEFAULT 'casual',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days INT DEFAULT 1,
      reason TEXT,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      reviewed_by INT,
      reviewed_at DATETIME,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    )`,

    `CREATE TABLE IF NOT EXISTS leave_balances (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_id INT NOT NULL,
      leave_type ENUM('sick','casual','earned','maternity','paternity','unpaid') NOT NULL,
      total_allocated INT DEFAULT 0,
      used INT DEFAULT 0,
      year INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_balance (employee_id, leave_type, year),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    )`,

    `CREATE TABLE IF NOT EXISTS payroll (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_id INT NOT NULL,
      pay_period_month INT NOT NULL,
      pay_period_year INT NOT NULL,
      working_days INT DEFAULT 26,
      days_worked DECIMAL(5,1) DEFAULT 0,
      basic_salary DECIMAL(12,2) DEFAULT 0,
      hra DECIMAL(12,2) DEFAULT 0,
      standard_allowance DECIMAL(12,2) DEFAULT 0,
      performance_bonus DECIMAL(12,2) DEFAULT 0,
      lta DECIMAL(12,2) DEFAULT 0,
      fixed_allowance DECIMAL(12,2) DEFAULT 0,
      gross_earnings DECIMAL(12,2) DEFAULT 0,
      pf_employee DECIMAL(12,2) DEFAULT 0,
      pf_employer DECIMAL(12,2) DEFAULT 0,
      professional_tax DECIMAL(12,2) DEFAULT 0,
      tds DECIMAL(12,2) DEFAULT 0,
      total_deductions DECIMAL(12,2) DEFAULT 0,
      net_pay DECIMAL(12,2) DEFAULT 0,
      status ENUM('draft','processed','paid') DEFAULT 'draft',
      generated_by INT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_payroll (employee_id, pay_period_month, pay_period_year),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
    )`,
  ];

  for (const sql of createTables) await conn.query(sql);
  console.log('✅ All tables created');

  // Also run safe ALTER TABLE migrations in case DB already existed with old schema
  const alterations = [
    // Add login_id to users if missing
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS login_id VARCHAR(50)`,
    // Add extended employee columns if missing
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS wage DECIMAL(12,2) DEFAULT 0.00`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS bank_name VARCHAR(100)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS uam_id VARCHAR(50)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS pf_rate DECIMAL(5,2) DEFAULT 12.00`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS prof_tax_amount DECIMAL(10,2) DEFAULT 200.00`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS working_days_per_week INT DEFAULT 5`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS break_time_hrs DECIMAL(4,2) DEFAULT 1.0`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS birth_date DATE`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(30)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS nationality VARCHAR(100)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS permanent_address TEXT`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS manager_id INT`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS location VARCHAR(100)`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS about TEXT`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS skills TEXT`,
    `ALTER TABLE employees ADD COLUMN IF NOT EXISTS certifications TEXT`,
  ];

  for (const sql of alterations) {
    try { await conn.query(sql); } catch (e) { /* ignore if column already exists */ }
  }

  // If old 'attendance' table exists (with check_in/check_out columns), migrate it
  try {
    const [tables] = await conn.query(`SHOW TABLES LIKE 'attendance'`);
    if (tables.length > 0) {
      console.log('ℹ️  Found old attendance table — migrating data...');
      // Create attendance_events from old check_in/check_out data
      await conn.query(`
        INSERT IGNORE INTO attendance_events (employee_id, timestamp, event_type)
        SELECT employee_id, check_in, 'check_in' FROM attendance WHERE check_in IS NOT NULL
      `);
      await conn.query(`
        INSERT IGNORE INTO attendance_events (employee_id, timestamp, event_type)
        SELECT employee_id, check_out, 'check_out' FROM attendance WHERE check_out IS NOT NULL
      `);
      // Migrate summary data
      await conn.query(`
        INSERT IGNORE INTO attendance_summary (employee_id, date, total_hours, status, notes, created_at, updated_at)
        SELECT employee_id, date, total_hours, status, notes, created_at, updated_at FROM attendance
      `);
      await conn.query(`DROP TABLE attendance`);
      console.log('✅ Old attendance table migrated and dropped');
    }
  } catch (e) { /* ignore */ }

  // Seed data
  const adminHash = await bcrypt.hash('Admin@1234', 10);
  const hrHash = await bcrypt.hash('HR@1234', 10);
  const payHash = await bcrypt.hash('Payroll@1234', 10);
  const empHash = await bcrypt.hash('Employee@1234', 10);

  await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role,login_id) VALUES (?,?,'admin','EPSYAD20230001')`, ['admin@empay.com', adminHash]);
  await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role,login_id) VALUES (?,?,'hr_officer','EPRIKO20230001')`, ['hr@empay.com', hrHash]);
  await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role,login_id) VALUES (?,?,'payroll_officer','EPVINI20230001')`, ['payroll@empay.com', payHash]);

  const empUsers = [
    ['john.doe@empay.com', empHash, 'employee', 'EPJODO20230001'],
    ['jane.smith@empay.com', empHash, 'employee', 'EPJASM20230002'],
    ['rahul.kumar@empay.com', empHash, 'employee', 'EPRAKUM20230003'],
    ['priya.sharma@empay.com', empHash, 'employee', 'EPPRS20230004'],
    ['amit.verma@empay.com', empHash, 'employee', 'EPAMVE20230005'],
  ];
  for (const [e, h, r, lid] of empUsers) {
    await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role,login_id) VALUES (?,?,?,?)`, [e, h, r, lid]);
  }

  const [[adminRow]] = await conn.execute(`SELECT id FROM users WHERE email='admin@empay.com'`);
  const [[hrRow]]    = await conn.execute(`SELECT id FROM users WHERE email='hr@empay.com'`);
  const [[payRow]]   = await conn.execute(`SELECT id FROM users WHERE email='payroll@empay.com'`);
  const [empRows]    = await conn.execute(`SELECT id,email FROM users WHERE role='employee' ORDER BY id`);

  // [user_id, code, first, last, dept, desig, wage, basic, hra, fixed]
  const profiles = [
    [adminRow.id,'EMP001','System','Admin','Administration','System Administrator',80000,40000,16000,10033],
    [hrRow.id,   'EMP002','Riya','Kapoor','Human Resources','HR Officer',55000,27500,11000,6908],
    [payRow.id,  'EMP003','Vikram','Nair','Finance','Payroll Officer',60000,30000,12000,7533],
  ];
  const empProfiles = [
    ['EMP004','John','Doe','Engineering','Software Engineer',70000,35000,14000,8783],
    ['EMP005','Jane','Smith','Engineering','Senior Developer',90000,45000,18000,11283],
    ['EMP006','Rahul','Kumar','Marketing','Marketing Executive',45000,22500,9000,5658],
    ['EMP007','Priya','Sharma','Design','UI/UX Designer',55000,27500,11000,6908],
    ['EMP008','Amit','Verma','Sales','Sales Manager',65000,32500,13000,8158],
  ];

  for (const [uid,code,fn,ln,dept,desig,wage,basic,hra,fixed] of profiles) {
    await conn.execute(
      `INSERT IGNORE INTO employees
        (user_id,employee_code,first_name,last_name,department,designation,date_of_joining,
         wage,basic_salary,hra,standard_allowance,performance_bonus,lta,fixed_allowance)
       VALUES (?,?,?,?,?,?,'2023-01-01',?,?,?,967,?,?,?)`,
      [uid,code,fn,ln,dept,desig,wage,basic,hra,Math.round(basic*0.0933),Math.round(basic*0.0933),fixed]
    );
  }
  for (let i = 0; i < empRows.length && i < empProfiles.length; i++) {
    const [code,fn,ln,dept,desig,wage,basic,hra,fixed] = empProfiles[i];
    await conn.execute(
      `INSERT IGNORE INTO employees
        (user_id,employee_code,first_name,last_name,department,designation,date_of_joining,
         wage,basic_salary,hra,standard_allowance,performance_bonus,lta,fixed_allowance)
       VALUES (?,?,?,?,?,?,'2023-06-01',?,?,?,967,?,?,?)`,
      [empRows[i].id,code,fn,ln,dept,desig,wage,basic,hra,Math.round(basic*0.0933),Math.round(basic*0.0933),fixed]
    );
  }

  // Backfill login_id on users that have none
  await conn.query(`
    UPDATE users u JOIN employees e ON e.user_id = u.id
    SET u.login_id = e.employee_code WHERE u.login_id IS NULL
  `);

  const [allEmps] = await conn.execute(`SELECT id FROM employees`);
  const year = new Date().getFullYear();
  for (const {id} of allEmps) {
    for (const [lt, alloc] of [['sick',12],['casual',10],['earned',15]]) {
      await conn.execute(
        `INSERT IGNORE INTO leave_balances (employee_id,leave_type,total_allocated,used,year) VALUES (?,?,?,0,?)`,
        [id,lt,alloc,year]
      );
    }
  }

  console.log('✅ Seed data inserted');
  console.log('\n📋 Login Credentials:');
  console.log('  Admin:           admin@empay.com    / Admin@1234');
  console.log('  HR Officer:      hr@empay.com       / HR@1234');
  console.log('  Payroll Officer: payroll@empay.com  / Payroll@1234');
  console.log('  Employees:       *@empay.com        / Employee@1234');
  console.log('\n🚀 Database ready! Run: npm run dev');

  await conn.end();
}

init().catch(err => { console.error('❌ Init failed:', err.message); process.exit(1); });
