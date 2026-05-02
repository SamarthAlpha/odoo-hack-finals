const db = require('../db/connection');

// Employee checks in
const checkIn = async (req, res) => {
  try {
    const empId = req.user.employee_id;
    if (!empId) return res.status(400).json({ success: false, message: 'No employee profile found' });

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Check if already checked in
    const [events] = await db.execute(
      `SELECT * FROM attendance_events WHERE employee_id = ? AND DATE(timestamp) = ? AND event_type = 'check_in'`, [empId, today]
    );

    if (events.length > 0) {
      return res.status(400).json({ success: false, message: 'Already checked in today' });
    }

    // Check if on approved leave today
    const [leave] = await db.execute(
      `SELECT id FROM time_off_requests WHERE employee_id = ? AND status='approved' AND ? BETWEEN start_date AND end_date`,
      [empId, today]
    );

    if (leave.length) {
      return res.status(400).json({ success: false, message: 'You are on approved leave today' });
    }

    // Insert event
    await db.execute(
      `INSERT INTO attendance_events (employee_id, timestamp, event_type) VALUES (?, ?, 'check_in')`,
      [empId, now]
    );

    // Update summary
    await db.execute(
      `INSERT INTO attendance_summary (employee_id, date, status, total_hours)
       VALUES (?, ?, 'present', 0)
       ON DUPLICATE KEY UPDATE status = 'present'`,
      [empId, today]
    );

    res.json({ success: true, message: 'Checked in successfully', time: now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Employee checks out
const checkOut = async (req, res) => {
  try {
    const empId = req.user.employee_id;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    const [checkInEvents] = await db.execute(
      `SELECT timestamp FROM attendance_events WHERE employee_id = ? AND DATE(timestamp) = ? AND event_type = 'check_in' ORDER BY timestamp DESC LIMIT 1`, [empId, today]
    );

    if (!checkInEvents.length)
      return res.status(400).json({ success: false, message: 'Please check in first' });

    const [checkOutEvents] = await db.execute(
      `SELECT timestamp FROM attendance_events WHERE employee_id = ? AND DATE(timestamp) = ? AND event_type = 'check_out' ORDER BY timestamp DESC LIMIT 1`, [empId, today]
    );

    if (checkOutEvents.length && checkOutEvents[0].timestamp > checkInEvents[0].timestamp)
      return res.status(400).json({ success: false, message: 'Already checked out today' });

    // Insert checkout event
    await db.execute(
      `INSERT INTO attendance_events (employee_id, timestamp, event_type) VALUES (?, ?, 'check_out')`,
      [empId, now]
    );

    const checkIn = new Date(checkInEvents[0].timestamp);
    const totalHours = (now - checkIn) / 3600000;
    
    // Get existing total_hours from summary
    const [summary] = await db.execute(
      `SELECT total_hours FROM attendance_summary WHERE employee_id = ? AND date = ?`, [empId, today]
    );
    const prevHours = summary.length && summary[0].total_hours ? parseFloat(summary[0].total_hours) : 0;
    const newTotal = prevHours + totalHours;

    let status = 'present';
    if (newTotal < 4) status = 'half_day';
    else if (newTotal >= 4 && newTotal < 8) status = 'present';

    await db.execute(
      `UPDATE attendance_summary SET total_hours = ?, status = ? WHERE employee_id = ? AND date = ?`,
      [newTotal.toFixed(2), status, empId, today]
    );

    res.json({ success: true, message: 'Checked out successfully', total_hours: newTotal.toFixed(2), status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Today's status
const todayStatus = async (req, res) => {
  try {
    const empId = req.user.employee_id;
    const today = new Date().toISOString().split('T')[0];

    const [att] = await db.execute(
      `SELECT a.*,
       (SELECT MIN(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_in') as check_in,
       (SELECT MAX(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_out') as check_out
       FROM attendance_summary a WHERE a.employee_id = ? AND a.date = ?`, [empId, today]
    );
    const [leave] = await db.execute(
      `SELECT * FROM time_off_requests WHERE employee_id = ? AND status='approved' AND ? BETWEEN start_date AND end_date`,
      [empId, today]
    );

    res.json({
      success: true,
      data: {
        attendance: att[0] || null,
        on_leave: leave.length > 0,
        leave_info: leave[0] || null,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Own attendance logs
const myLogs = async (req, res) => {
  try {
    const empId = req.user.employee_id;
    const { month, year, date } = req.query;

    let query = `SELECT a.*,
                 (SELECT MIN(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_in') as check_in,
                 (SELECT MAX(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_out') as check_out
                 FROM attendance_summary a WHERE a.employee_id = ?`;
    const params = [empId];

    if (date) { query += ` AND a.date = ?`; params.push(date); }
    if (month && year) { query += ` AND MONTH(a.date) = ? AND YEAR(a.date) = ?`; params.push(month, year); }
    
    const [existing] = await db.execute(query, params);
    
    let leaveQuery = `SELECT start_date, end_date FROM time_off_requests WHERE employee_id = ? AND status='approved'`;
    const [leaves] = await db.execute(leaveQuery, [empId]);

    const todayStr = new Date().toISOString().split('T')[0];
    let startD, endD;

    if (date) {
      if (date > todayStr) return res.json({ success: true, data: [] });
      startD = new Date(date);
      endD = new Date(date);
    } else if (month && year) {
      startD = new Date(Date.UTC(year, month - 1, 1));
      const todayDate = new Date();
      const todayUTC = new Date(Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()));
      const endOfMonthUTC = new Date(Date.UTC(year, month, 0));
      endD = endOfMonthUTC > todayUTC ? todayUTC : endOfMonthUTC;
    } else {
      const td = new Date();
      startD = new Date(Date.UTC(td.getFullYear(), td.getMonth(), 1));
      endD = new Date(Date.UTC(td.getFullYear(), td.getMonth(), td.getDate()));
    }

    const existingMap = {};
    for (const r of existing) {
      let dStr = r.date;
      if (typeof r.date !== 'string') dStr = r.date.toISOString().split('T')[0];
      existingMap[dStr] = r;
    }

    const result = [];
    const isOnLeave = (dStr) => leaves.some(l => {
      const sd = typeof l.start_date === 'string' ? l.start_date.split('T')[0] : l.start_date.toISOString().split('T')[0];
      const ed = typeof l.end_date === 'string' ? l.end_date.split('T')[0] : l.end_date.toISOString().split('T')[0];
      return dStr >= sd && dStr <= ed;
    });

    for (let d = new Date(startD); d <= endD; d.setUTCDate(d.getUTCDate() + 1)) {
      const dStr = d.toISOString().split('T')[0];
      if (existingMap[dStr]) {
        result.push({ ...existingMap[dStr], date: dStr });
      } else {
        result.push({
          employee_id: empId, date: dStr, status: isOnLeave(dStr) ? 'on_leave' : 'absent',
          total_hours: '0.00', check_in: null, check_out: null
        });
      }
    }

    result.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ success: true, data: result.slice(0, 60) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// All attendance (Admin/HR/Payroll)
const allLogs = async (req, res) => {
  try {
    const { month, year, employee_id, date } = req.query;

    let empQuery = `SELECT e.id as employee_id, e.first_name, e.last_name, e.employee_code, e.department FROM employees e JOIN users u ON u.id = e.user_id WHERE e.status = 'active'`;
    const empParams = [];
    if (employee_id) { empQuery += ` AND e.id = ?`; empParams.push(employee_id); }
    const [emps] = await db.execute(empQuery, empParams);

    let query = `SELECT a.*,
                 (SELECT MIN(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_in') as check_in,
                 (SELECT MAX(timestamp) FROM attendance_events WHERE employee_id=a.employee_id AND DATE(timestamp)=a.date AND event_type='check_out') as check_out
                 FROM attendance_summary a JOIN employees e ON e.id = a.employee_id JOIN users u ON u.id = e.user_id WHERE 1=1`;
    const params = [];
    if (employee_id) { query += ` AND a.employee_id = ?`; params.push(employee_id); }
    if (month && year) { query += ` AND MONTH(a.date) = ? AND YEAR(a.date) = ?`; params.push(month, year); }
    if (date) { query += ` AND a.date = ?`; params.push(date); }
    const [existing] = await db.execute(query, params);

    let leaveQuery = `SELECT employee_id, start_date, end_date FROM time_off_requests WHERE status='approved'`;
    const [leaves] = await db.execute(leaveQuery);

    const todayStr = new Date().toISOString().split('T')[0];
    let startD, endD;

    if (date) {
      if (date > todayStr) return res.json({ success: true, data: [] });
      startD = new Date(date);
      endD = new Date(date);
    } else if (month && year) {
      startD = new Date(Date.UTC(year, month - 1, 1));
      const todayDate = new Date();
      const todayUTC = new Date(Date.UTC(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate()));
      const endOfMonthUTC = new Date(Date.UTC(year, month, 0));
      endD = endOfMonthUTC > todayUTC ? todayUTC : endOfMonthUTC;
    } else {
      const td = new Date();
      startD = new Date(Date.UTC(td.getFullYear(), td.getMonth(), 1));
      endD = new Date(Date.UTC(td.getFullYear(), td.getMonth(), td.getDate()));
    }

    const existingMap = {};
    for (const r of existing) {
      let dStr = r.date;
      if (typeof r.date !== 'string') dStr = r.date.toISOString().split('T')[0];
      existingMap[r.employee_id + '_' + dStr] = r;
    }

    const result = [];
    const isOnLeave = (empId, dStr) => leaves.some(l => {
      if (l.employee_id !== empId) return false;
      const sd = typeof l.start_date === 'string' ? l.start_date.split('T')[0] : l.start_date.toISOString().split('T')[0];
      const ed = typeof l.end_date === 'string' ? l.end_date.split('T')[0] : l.end_date.toISOString().split('T')[0];
      return dStr >= sd && dStr <= ed;
    });

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

    res.json({ success: true, data: result.slice(0, 1000) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { checkIn, checkOut, todayStatus, myLogs, allLogs };
