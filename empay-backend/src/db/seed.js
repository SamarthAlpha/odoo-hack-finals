const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'empay_db',
    multipleStatements: true,
  });

  console.log('🌱 Starting database seed...');

  try {
    const passwordHash = await bcrypt.hash('Admin@1234', 10);
    const empHash = await bcrypt.hash('Employee@1234', 10);
    const hrHash = await bcrypt.hash('HR@1234', 10);
    const payHash = await bcrypt.hash('Payroll@1234', 10);

    // Insert admin user
    await conn.execute(
      `INSERT IGNORE INTO users (email, password_hash, role) VALUES (?, ?, 'admin')`,
      ['admin@empay.com', passwordHash]
    );

    // Insert HR Officer
    await conn.execute(
      `INSERT IGNORE INTO users (email, password_hash, role) VALUES (?, ?, 'hr_officer')`,
      ['hr@empay.com', hrHash]
    );

    // Insert Payroll Officer
    await conn.execute(
      `INSERT IGNORE INTO users (email, password_hash, role) VALUES (?, ?, 'payroll_officer')`,
      ['payroll@empay.com', payHash]
    );

    // Insert sample employees
    const sampleUsers = [
      { email: 'john.doe@empay.com', pass: empHash, role: 'employee' },
      { email: 'jane.smith@empay.com', pass: empHash, role: 'employee' },
      { email: 'rahul.kumar@empay.com', pass: empHash, role: 'employee' },
      { email: 'priya.sharma@empay.com', pass: empHash, role: 'employee' },
      { email: 'amit.verma@empay.com', pass: empHash, role: 'employee' },
    ];

    for (const u of sampleUsers) {
      await conn.execute(
        `INSERT IGNORE INTO users (email, password_hash, role) VALUES (?, ?, ?)`,
        [u.email, u.pass, u.role]
      );
    }

    // Get user IDs
    const [adminRow] = await conn.execute(`SELECT id FROM users WHERE email='admin@empay.com'`);
    const [hrRow] = await conn.execute(`SELECT id FROM users WHERE email='hr@empay.com'`);
    const [payRow] = await conn.execute(`SELECT id FROM users WHERE email='payroll@empay.com'`);
    const [empRows] = await conn.execute(
      `SELECT id, email FROM users WHERE role='employee' ORDER BY id`
    );

    // Insert admin employee profile
    await conn.execute(
      `INSERT IGNORE INTO employees (user_id, employee_code, first_name, last_name, department, designation, date_of_joining, basic_salary, hra, standard_allowance, performance_bonus, lta, fixed_allowance)
       VALUES (?, 'EMP001', 'System', 'Admin', 'Administration', 'System Administrator', '2023-01-01', 80000, 32000, 1500, 5000, 2000, 3000)`,
      [adminRow[0].id]
    );

    await conn.execute(
      `INSERT IGNORE INTO employees (user_id, employee_code, first_name, last_name, department, designation, date_of_joining, basic_salary, hra, standard_allowance, lta, fixed_allowance)
       VALUES (?, 'EMP002', 'Riya', 'Kapoor', 'Human Resources', 'HR Officer', '2023-03-15', 55000, 22000, 1500, 2000, 2500)`,
      [hrRow[0].id]
    );

    await conn.execute(
      `INSERT IGNORE INTO employees (user_id, employee_code, first_name, last_name, department, designation, date_of_joining, basic_salary, hra, standard_allowance, lta, fixed_allowance)
       VALUES (?, 'EMP003', 'Vikram', 'Nair', 'Finance', 'Payroll Officer', '2023-02-01', 60000, 24000, 1500, 2000, 3000)`,
      [payRow[0].id]
    );

    const empProfiles = [
      { code: 'EMP004', first: 'John', last: 'Doe', dept: 'Engineering', desig: 'Software Engineer', salary: 70000 },
      { code: 'EMP005', first: 'Jane', last: 'Smith', dept: 'Engineering', desig: 'Senior Developer', salary: 90000 },
      { code: 'EMP006', first: 'Rahul', last: 'Kumar', dept: 'Marketing', desig: 'Marketing Executive', salary: 45000 },
      { code: 'EMP007', first: 'Priya', last: 'Sharma', dept: 'Design', desig: 'UI/UX Designer', salary: 55000 },
      { code: 'EMP008', first: 'Amit', last: 'Verma', dept: 'Sales', desig: 'Sales Manager', salary: 65000 },
    ];

    for (let i = 0; i < empRows.length; i++) {
      const p = empProfiles[i];
      const hra = Math.round(p.salary * 0.4);
      await conn.execute(
        `INSERT IGNORE INTO employees (user_id, employee_code, first_name, last_name, department, designation, date_of_joining, basic_salary, hra, standard_allowance, lta, fixed_allowance)
         VALUES (?, ?, ?, ?, ?, ?, '2023-06-01', ?, ?, 1500, 2000, ?)`,
        [empRows[i].id, p.code, p.first, p.last, p.dept, p.desig, p.salary, hra, Math.round(p.salary * 0.05)]
      );
    }

    // Seed leave balances for all employees
    const [allEmps] = await conn.execute(`SELECT id FROM employees`);
    const leaveTypes = ['sick', 'casual', 'earned'];
    const leaveDefaults = { sick: 12, casual: 10, earned: 15 };
    const year = new Date().getFullYear();

    for (const emp of allEmps) {
      for (const lt of leaveTypes) {
        await conn.execute(
          `INSERT IGNORE INTO leave_balances (employee_id, leave_type, total_allocated, used, year)
           VALUES (?, ?, ?, 0, ?)`,
          [emp.id, lt, leaveDefaults[lt], year]
        );
      }
    }

    console.log('✅ Seed completed successfully!');
    console.log('\n📋 Default Credentials:');
    console.log('  Admin:          admin@empay.com     / Admin@1234');
    console.log('  HR Officer:     hr@empay.com        / HR@1234');
    console.log('  Payroll Officer:payroll@empay.com   / Payroll@1234');
    console.log('  Employees:      *@empay.com         / Employee@1234');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await conn.end();
  }
}

seed();
