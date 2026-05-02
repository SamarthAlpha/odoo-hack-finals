const db = require('./src/db/connection'); 
async function main() { 
  const month = 5; const year = 2026; const employee_id = null; const date = null;
  let empQuery = `SELECT e.id as employee_id, e.first_name, e.last_name, e.employee_code, e.department FROM employees e JOIN users u ON u.id = e.user_id WHERE e.status = 'active' AND u.role = 'employee'`;
  const [emps] = await db.execute(empQuery);

  let query = `SELECT a.*,
               (SELECT MIN(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_in') as check_in,
               (SELECT MAX(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_out') as check_out
               FROM attendance_summary a JOIN employees e ON e.id = a.employee_id JOIN users u ON u.id = e.user_id WHERE u.role = 'employee'`;
  const [existing] = await db.execute(query);

  let leaveQuery = `SELECT employee_id, start_date, end_date FROM time_off_requests WHERE status='approved'`;
  const [leaves] = await db.execute(leaveQuery);

  const todayStr = new Date().toISOString().split('T')[0];
  let startD, endD;

  if (month && year) {
    startD = new Date(Date.UTC(year, month - 1, 1));
    const todayDate = new Date();
    const todayUTC = new Date(Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()));
    const endOfMonthUTC = new Date(Date.UTC(year, month, 0));
    endD = endOfMonthUTC > todayUTC ? todayUTC : endOfMonthUTC;
  }
  
  console.log("Range:", startD, endD);

  const existingMap = {};
  for (const r of existing) {
    let dStr = r.date;
    if (typeof r.date !== 'string') dStr = r.date.toISOString().split('T')[0];
    existingMap[r.employee_id + '_' + dStr] = r;
  }

  const result = [];
  const isOnLeave = (empId, dStr) => {
    return leaves.some(l => {
      if (l.employee_id !== empId) return false;
      const sd = typeof l.start_date === 'string' ? l.start_date.split('T')[0] : l.start_date.toISOString().split('T')[0];
      const ed = typeof l.end_date === 'string' ? l.end_date.split('T')[0] : l.end_date.toISOString().split('T')[0];
      return dStr >= sd && dStr <= ed;
    });
  };

  for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
    const dStr = d.toISOString().split('T')[0];
    for (const emp of emps) {
      const key = emp.employee_id + '_' + dStr;
      if (existingMap[key]) {
        result.push({ ...emp, ...existingMap[key], date: dStr });
      } else {
        result.push({
          ...emp, date: dStr, status: isOnLeave(emp.employee_id, dStr) ? 'on_leave' : 'absent',
          total_hours: '0.00', check_in: null, check_out: null
        });
      }
    }
  }

  result.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.employee_code.localeCompare(b.employee_code);
  });

  console.log("Length:", result.length);
  console.log("First 3:", result.slice(0,3));
  process.exit(0);
} 
main();
