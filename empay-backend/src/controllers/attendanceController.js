const db = require('../db/connection');

// Employee checks in
const checkIn = async (req, res) => {
  try {
    const empId = req.user.employee_id;
    if (!empId) return res.status(400).json({ success: false, message: 'No employee profile found' });

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Check if already checked in
    const [existing] = await db.execute(
      `SELECT * FROM attendance WHERE employee_id = ? AND date = ?`, [empId, today]
    );

    if (existing.length && existing[0].check_in) {
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

    if (existing.length) {
      await db.execute(`UPDATE attendance SET check_in = ?, status = 'present' WHERE employee_id = ? AND date = ?`,
        [now, empId, today]);
    } else {
      await db.execute(
        `INSERT INTO attendance (employee_id, date, check_in, status) VALUES (?, ?, ?, 'present')`,
        [empId, today, now]
      );
    }

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

    const [existing] = await db.execute(
      `SELECT * FROM attendance WHERE employee_id = ? AND date = ?`, [empId, today]
    );

    if (!existing.length || !existing[0].check_in)
      return res.status(400).json({ success: false, message: 'Please check in first' });

    if (existing[0].check_out)
      return res.status(400).json({ success: false, message: 'Already checked out today' });

    const checkIn = new Date(existing[0].check_in);
    const totalHours = (now - checkIn) / 3600000;
    let status = 'present';
    if (totalHours < 4) status = 'half_day';
    else if (totalHours >= 4 && totalHours < 8) status = 'present';

    await db.execute(
      `UPDATE attendance SET check_out = ?, total_hours = ?, status = ? WHERE employee_id = ? AND date = ?`,
      [now, totalHours.toFixed(2), status, empId, today]
    );

    res.json({ success: true, message: 'Checked out successfully', total_hours: totalHours.toFixed(2), status });
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
      `SELECT * FROM attendance WHERE employee_id = ? AND date = ?`, [empId, today]
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
    let query = `SELECT * FROM attendance WHERE employee_id = ?`;
    const params = [empId];

    if (date) {
      query += ` AND date = ?`;
      params.push(date);
    } else if (month && year) {
      query += ` AND MONTH(date) = ? AND YEAR(date) = ?`;
      params.push(month, year);
    }
    query += ` ORDER BY date DESC LIMIT 60`;

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// All attendance (Admin/HR/Payroll)
const allLogs = async (req, res) => {
  try {
    const { month, year, employee_id, date } = req.query;
    let query = `SELECT a.*, e.first_name, e.last_name, e.employee_code, e.department
                 FROM attendance a JOIN employees e ON e.id = a.employee_id WHERE 1=1`;
    const params = [];

    if (employee_id) { query += ` AND a.employee_id = ?`; params.push(employee_id); }
    if (month && year) { query += ` AND MONTH(a.date) = ? AND YEAR(a.date) = ?`; params.push(month, year); }
    if (date) { query += ` AND a.date = ?`; params.push(date); }

    query += ` ORDER BY a.date DESC, e.employee_code LIMIT 500`;
    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { checkIn, checkOut, todayStatus, myLogs, allLogs };
