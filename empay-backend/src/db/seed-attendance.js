const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedAttendance() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const today = new Date().toISOString().split('T')[0];
  console.log('Seeding demo attendance for', today);

  const [emps] = await conn.query('SELECT id, employee_code FROM employees ORDER BY employee_code');
  console.log('Found', emps.length, 'employees');

  for (let i = 0; i < emps.length; i++) {
    const emp = emps[i];
    let status, checkIn = null, checkOut = null;

    // Distribute statuses: present, present+out, on_leave, absent
    if (i % 4 === 0) { status = 'present'; checkIn = '09:05:00'; }
    else if (i % 4 === 1) { status = 'present'; checkIn = '08:55:00'; checkOut = '17:30:00'; }
    else if (i % 4 === 2) { status = 'on_leave'; }
    else { status = 'absent'; }

    await conn.query(
      `INSERT INTO attendance (employee_id, date, status, check_in, check_out)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status=VALUES(status), check_in=VALUES(check_in), check_out=VALUES(check_out)`,
      [emp.id, today, status, checkIn, checkOut]
    );
    console.log(`  ${emp.employee_code} → ${status}`);
  }

  // Add approved time-off requests for on_leave employees
  const onLeaveEmps = emps.filter((_, i) => i % 4 === 2);
  for (const emp of onLeaveEmps) {
    const [existing] = await conn.query(
      `SELECT id FROM time_off_requests WHERE employee_id=? AND start_date=?`, [emp.id, today]
    );
    if (!existing.length) {
      await conn.query(
        `INSERT INTO time_off_requests (employee_id, leave_type, start_date, end_date, total_days, reason, status, reviewed_at)
         VALUES (?, 'casual', ?, ?, 1, 'Personal work', 'approved', NOW())`,
        [emp.id, today, today]
      );
    }
  }

  console.log('\nDone! Refresh the Employees page to see status indicators.');
  await conn.end();
}

seedAttendance().catch(e => { console.error('Error:', e.message); process.exit(1); });
