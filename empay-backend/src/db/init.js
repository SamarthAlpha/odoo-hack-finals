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
    `CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','employee','hr_officer','payroll_officer') NOT NULL DEFAULT 'employee',
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
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
      basic_salary DECIMAL(12,2) DEFAULT 0.00,
      hra DECIMAL(12,2) DEFAULT 0.00,
      standard_allowance DECIMAL(12,2) DEFAULT 1500.00,
      performance_bonus DECIMAL(12,2) DEFAULT 0.00,
      lta DECIMAL(12,2) DEFAULT 2000.00,
      fixed_allowance DECIMAL(12,2) DEFAULT 0.00,
      status ENUM('active','inactive') DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_id INT NOT NULL,
      date DATE NOT NULL,
      check_in DATETIME,
      check_out DATETIME,
      total_hours DECIMAL(5,2) DEFAULT 0.00,
      status ENUM('present','absent','half_day','on_leave') DEFAULT 'absent',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_attendance (employee_id, date),
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

  // Seed data
  const adminHash = await bcrypt.hash('Admin@1234', 10);
  const hrHash = await bcrypt.hash('HR@1234', 10);
  const payHash = await bcrypt.hash('Payroll@1234', 10);
  const empHash = await bcrypt.hash('Employee@1234', 10);

  await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role) VALUES (?,?,'admin')`, ['admin@empay.com', adminHash]);
  await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role) VALUES (?,?,'hr_officer')`, ['hr@empay.com', hrHash]);
  await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role) VALUES (?,?,'payroll_officer')`, ['payroll@empay.com', payHash]);

  const empUsers = [
    ['john.doe@empay.com', empHash, 'employee'],
    ['jane.smith@empay.com', empHash, 'employee'],
    ['rahul.kumar@empay.com', empHash, 'employee'],
    ['priya.sharma@empay.com', empHash, 'employee'],
    ['amit.verma@empay.com', empHash, 'employee'],
  ];
  for (const [e, h, r] of empUsers) {
    await conn.execute(`INSERT IGNORE INTO users (email,password_hash,role) VALUES (?,?,?)`, [e, h, r]);
  }

  const [[adminRow]] = await conn.execute(`SELECT id FROM users WHERE email='admin@empay.com'`);
  const [[hrRow]] = await conn.execute(`SELECT id FROM users WHERE email='hr@empay.com'`);
  const [[payRow]] = await conn.execute(`SELECT id FROM users WHERE email='payroll@empay.com'`);
  const [empRows] = await conn.execute(`SELECT id,email FROM users WHERE role='employee' ORDER BY id`);

  const profiles = [
    [adminRow.id,'EMP001','System','Admin','Administration','System Administrator',80000,32000,3000],
    [hrRow.id,'EMP002','Riya','Kapoor','Human Resources','HR Officer',55000,22000,2500],
    [payRow.id,'EMP003','Vikram','Nair','Finance','Payroll Officer',60000,24000,3000],
  ];
  const empProfiles = [
    ['EMP004','John','Doe','Engineering','Software Engineer',70000,28000,3500],
    ['EMP005','Jane','Smith','Engineering','Senior Developer',90000,36000,4500],
    ['EMP006','Rahul','Kumar','Marketing','Marketing Executive',45000,18000,2250],
    ['EMP007','Priya','Sharma','Design','UI/UX Designer',55000,22000,2750],
    ['EMP008','Amit','Verma','Sales','Sales Manager',65000,26000,3250],
  ];

  for (const [uid,code,fn,ln,dept,desig,sal,hra,fixed] of profiles) {
    await conn.execute(
      `INSERT IGNORE INTO employees (user_id,employee_code,first_name,last_name,department,designation,date_of_joining,basic_salary,hra,standard_allowance,performance_bonus,lta,fixed_allowance)
       VALUES (?,?,?,?,?,?,'2023-01-01',?,?,1500,5000,2000,?)`,
      [uid,code,fn,ln,dept,desig,sal,hra,fixed]
    );
  }
  for (let i = 0; i < empRows.length && i < empProfiles.length; i++) {
    const [code,fn,ln,dept,desig,sal,hra,fixed] = empProfiles[i];
    await conn.execute(
      `INSERT IGNORE INTO employees (user_id,employee_code,first_name,last_name,department,designation,date_of_joining,basic_salary,hra,standard_allowance,lta,fixed_allowance)
       VALUES (?,?,?,?,?,?,'2023-06-01',?,?,1500,2000,?)`,
      [empRows[i].id,code,fn,ln,dept,desig,sal,hra,fixed]
    );
  }

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
