const db = require('./src/db/connection.js');
async function run() {
  try {
    const [employees] = await db.execute('SELECT id, first_name FROM employees LIMIT 5');
    console.log('Employees:', employees);

    const empIds = employees.map(e => e.id);
    if(empIds.length === 0) process.exit(0);

    const placeholders = empIds.map(() => '?').join(',');
    await db.execute(`DELETE FROM attendance_summary WHERE employee_id IN (${placeholders}) AND date >= '2026-04-01' AND date <= '2026-04-30'`, empIds);
    await db.execute(`DELETE FROM attendance_events WHERE employee_id IN (${placeholders}) AND timestamp >= '2026-04-01 00:00:00' AND timestamp <= '2026-04-30 23:59:59'`, empIds);
    await db.execute(`DELETE FROM time_off_requests WHERE employee_id IN (${placeholders}) AND start_date >= '2026-04-01' AND start_date <= '2026-04-30'`, empIds);

    let summaryVals = [];
    let eventVals = [];
    let timeOffVals = [];
    let leaveBalanceUpdates = [];

    const monthStart = new Date('2026-04-01T00:00:00');
    const daysInMonth = 30;

    for (const emp of employees) {
      let leavesTaken = 0;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `2026-04-${String(day).padStart(2,'0')}`;
        const d = new Date(`${dateStr}T12:00:00Z`);
        const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
        
        if (isWeekend) continue; // skip weekends
        
        const r = Math.random();
        let status = 'present';
        
        if (r < 0.1) {
          status = 'on_leave';
          leavesTaken++;
          
          timeOffVals.push([emp.id, 'casual', dateStr, dateStr, 1, 'Taking a day off', 'approved']);
        } else if (r < 0.15) {
          status = 'absent';
        } else if (r < 0.2) {
          status = 'half_day';
        }

        if (status === 'present') {
          summaryVals.push([emp.id, dateStr, 'present', 8.5]);
          eventVals.push([emp.id, 'check_in', `${dateStr} 09:${String(Math.floor(Math.random()*15)).padStart(2,'0')}:00`]);
          eventVals.push([emp.id, 'check_out', `${dateStr} 17:${String(30 + Math.floor(Math.random()*20)).padStart(2,'0')}:00`]);
        } else if (status === 'half_day') {
          summaryVals.push([emp.id, dateStr, 'half_day', 4.25]);
          eventVals.push([emp.id, 'check_in', `${dateStr} 09:${String(Math.floor(Math.random()*15)).padStart(2,'0')}:00`]);
          eventVals.push([emp.id, 'check_out', `${dateStr} 13:15:00`]);
        } else {
          summaryVals.push([emp.id, dateStr, status, 0]);
        }
      }
      
      if (leavesTaken > 0) {
        leaveBalanceUpdates.push({ id: emp.id, taken: leavesTaken });
      }
    }

    if (summaryVals.length) {
      const qs = summaryVals.map(() => '(?, ?, ?, ?)').join(',');
      const flat = summaryVals.flat();
      await db.execute(`INSERT INTO attendance_summary (employee_id, date, status, total_hours) VALUES ${qs}`, flat);
    }
    
    if (eventVals.length) {
      const qs = eventVals.map(() => '(?, ?, ?)').join(',');
      const flat = eventVals.flat();
      await db.execute(`INSERT INTO attendance_events (employee_id, event_type, timestamp) VALUES ${qs}`, flat);
    }
    
    if (timeOffVals.length) {
      const qs = timeOffVals.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
      const flat = timeOffVals.flat();
      await db.execute(`INSERT INTO time_off_requests (employee_id, leave_type, start_date, end_date, total_days, reason, status) VALUES ${qs}`, flat);
    }

    console.log('Successfully seeded April data for 5 employees.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
