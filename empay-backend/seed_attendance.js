const mysql = require('mysql2/promise');
require('dotenv').config();

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'empay_db',
  });

  console.log("Connected to database. Starting 100% presence + Leave data seed...");

  const [employees] = await conn.execute("SELECT id, first_name, last_name FROM employees");
  
  await conn.execute("DELETE FROM attendance_events");
  await conn.execute("DELETE FROM attendance_summary");
  await conn.execute("DELETE FROM time_off_requests");

  const today = new Date();
  const startDate = new Date(2026, 2, 1); // March 1st

  let totalEvents = 0;
  let totalSummaries = 0;
  let totalLeaves = 0;

  for (const emp of employees) {
    let curr = new Date(startDate);
    
    // 1. Seed some random leave requests for each employee
    const leaveTypes = ['sick', 'casual', 'earned'];
    const leaveCount = 2 + Math.floor(Math.random() * 3); // 2 to 4 leaves per person
    
    for (let i = 0; i < leaveCount; i++) {
      const startOffset = Math.floor(Math.random() * 60); // Random day within 60 days of start
      const leaveStart = new Date(startDate);
      leaveStart.setDate(leaveStart.getDate() + startOffset);
      const leaveEnd = new Date(leaveStart);
      leaveEnd.setDate(leaveEnd.getDate() + Math.floor(Math.random() * 3)); // 1-3 days
      
      const status = Math.random() > 0.3 ? 'approved' : 'rejected';
      
      await conn.execute(
        "INSERT INTO time_off_requests (employee_id, leave_type, start_date, end_date, total_days, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [emp.id, leaveTypes[Math.floor(Math.random()*3)], leaveStart, leaveEnd, Math.ceil((leaveEnd-leaveStart)/86400000)+1, "Personal work/Health issue", status]
      );
      totalLeaves++;
    }

    // 2. Seed attendance based on presence and leaves
    while (curr <= today) {
      const dateStr = curr.toISOString().split('T')[0];
      const dayOfWeek = curr.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Check if person has an approved leave on this day
      const [onLeave] = await conn.execute(
        "SELECT id FROM time_off_requests WHERE employee_id = ? AND status = 'approved' AND ? BETWEEN DATE(start_date) AND DATE(end_date)",
        [emp.id, dateStr]
      );

      if (onLeave.length > 0) {
        await conn.execute(
          "INSERT INTO attendance_summary (employee_id, date, status, total_hours) VALUES (?, ?, 'on_leave', 0)",
          [emp.id, dateStr]
        );
        totalSummaries++;
      } else {
        // High presence: 100% weekdays, 60% weekends
        const presenceChance = isWeekend ? 0.60 : 1.0;
        
        if (Math.random() < presenceChance) {
          const status = 'present';
          let checkInHour = 8 + Math.floor(Math.random() * 2); // 8 or 9
          let checkInMin = Math.floor(Math.random() * 60);

          const checkInTime = new Date(curr);
          checkInTime.setHours(checkInHour, checkInMin, 0);
          
          const shiftDuration = 8.5 + (Math.random() * 1.5); // 8.5 to 10 hours
          const checkOutTime = new Date(checkInTime.getTime() + (shiftDuration * 3600000));
          
          await conn.execute("INSERT INTO attendance_events (employee_id, timestamp, event_type) VALUES (?, ?, 'check_in')", [emp.id, checkInTime]);
          await conn.execute("INSERT INTO attendance_events (employee_id, timestamp, event_type) VALUES (?, ?, 'check_out')", [emp.id, checkOutTime]);
          totalEvents += 2;
          await conn.execute("INSERT INTO attendance_summary (employee_id, date, status, total_hours) VALUES (?, ?, ?, ?)", [emp.id, dateStr, status, (shiftDuration).toFixed(2)]);
          totalSummaries++;
        } else if (!isWeekend) {
          await conn.execute("INSERT INTO attendance_summary (employee_id, date, status, total_hours) VALUES (?, ?, 'absent', 0)", [emp.id, dateStr]);
          totalSummaries++;
        }
      }
      curr.setDate(curr.getDate() + 1);
    }
  }

  console.log(`Seed Success: ${totalEvents} events, ${totalSummaries} summaries, ${totalLeaves} leave requests.`);
  await conn.end();
}

seed().catch(console.error);
