const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed20() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'empay_db',
  });

  console.log('🌱 Scaling database to 20 employees...');

  try {
    const empHash = await bcrypt.hash('Employee@1234', 10);
    const year = 2023;

    const extraEmps = [
      { email: 'sneha.rao@empay.com', first: 'Sneha', last: 'Rao', dept: 'Engineering', desig: 'QA Engineer', salary: 50000, loginId: 'EPSNRA20230009' },
      { email: 'karan.malhotra@empay.com', first: 'Karan', last: 'Malhotra', dept: 'Operations', desig: 'Operations Lead', salary: 75000, loginId: 'EPKAMA20230010' },
      { email: 'ananya.iyer@empay.com', first: 'Ananya', last: 'Iyer', dept: 'Engineering', desig: 'Backend Developer', salary: 85000, loginId: 'EPANIY20230011' },
      { email: 'rohan.gupta@empay.com', first: 'Rohan', last: 'Gupta', dept: 'Support', desig: 'Customer Support', salary: 40000, loginId: 'EPROGU20230012' },
      { email: 'megha.singh@empay.com', first: 'Megha', last: 'Singh', dept: 'HR', desig: 'Recruiter', salary: 52000, loginId: 'EPMESI20230013' },
      { email: 'arjun.patel@empay.com', first: 'Arjun', last: 'Patel', dept: 'Engineering', desig: 'Frontend Developer', salary: 72000, loginId: 'EPARPA20230014' },
      { email: 'divya.menon@empay.com', first: 'Divya', last: 'Menon', dept: 'Product', desig: 'Product Manager', salary: 110000, loginId: 'EPDIME20230015' },
      { email: 'siddharth.jain@empay.com', first: 'Siddharth', last: 'Jain', dept: 'Finance', desig: 'Accountant', salary: 58000, loginId: 'EPSIJA20230016' },
      { email: 'tanvi.shah@empay.com', first: 'Tanvi', last: 'Shah', dept: 'Design', desig: 'Graphic Designer', salary: 48000, loginId: 'EPTASH20230017' },
      { email: 'akash.mishra@empay.com', first: 'Akash', last: 'Mishra', dept: 'Sales', desig: 'Account Executive', salary: 60000, loginId: 'EPAKMI20230018' },
      { email: 'isha.khanna@empay.com', first: 'Isha', last: 'Khanna', dept: 'Marketing', desig: 'Social Media Manager', salary: 55000, loginId: 'EPISKH20230019' },
      { email: 'varun.deshmukh@empay.com', first: 'Varun', last: 'Deshmukh', dept: 'Engineering', desig: 'DevOps Engineer', salary: 95000, loginId: 'EPVADE20230020' },
    ];

    for (const e of extraEmps) {
      // Create user
      const [userRes] = await conn.execute(
        `INSERT IGNORE INTO users (email, password_hash, role, login_id) VALUES (?, ?, 'employee', ?)`,
        [e.email, empHash, e.loginId]
      );

      if (userRes.affectedRows > 0) {
        const userId = userRes.insertId;
        const basic = Math.round(e.salary * 0.5);
        const hra = Math.round(basic * 0.4);
        const fixed = Math.round(e.salary - basic - hra - 967 - 2000 - 2000); // Rough estimate

        // Create employee profile
        const [empRes] = await conn.execute(
          `INSERT IGNORE INTO employees (user_id, employee_code, first_name, last_name, department, designation, date_of_joining, wage, basic_salary, hra, standard_allowance, performance_bonus, lta, fixed_allowance, annual_salary)
           VALUES (?, ?, ?, ?, ?, ?, '2023-08-01', ?, ?, ?, 967, 2000, 2000, ?, ?)`,
          [userId, `EMP${e.loginId.slice(-3)}`, e.first, e.last, e.dept, e.desig, e.salary, basic, hra, fixed, e.salary * 12]
        );

        if (empRes.affectedRows > 0) {
          const empId = empRes.insertId;
          // Seed leave balances
          const leaveTypes = [['sick', 12], ['casual', 10], ['earned', 15]];
          const currYear = new Date().getFullYear();
          for (const [lt, alloc] of leaveTypes) {
            await conn.execute(
              `INSERT IGNORE INTO leave_balances (employee_id, leave_type, total_allocated, used, year) VALUES (?, ?, ?, 0, ?)`,
              [empId, lt, alloc, currYear]
            );
          }
        }
      }
    }

    console.log('✅ Scaling complete! 20 employees now in database.');
  } catch (err) {
    console.error('❌ Scaling failed:', err.message);
  } finally {
    await conn.end();
  }
}

seed20();
