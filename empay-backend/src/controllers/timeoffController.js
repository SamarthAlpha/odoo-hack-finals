const db = require('../db/connection');
const path = require('path');

// Calculate business days between two dates
const calcBusinessDays = (start, end) => {
  let count = 0;
  const cur = new Date(start);
  const endDate = new Date(end);
  while (cur <= endDate) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

// Employee: apply for time off
const apply = async (req, res) => {
  try {
    const empId = req.user.employee_id;
    if (!empId) return res.status(400).json({ success: false, message: 'No employee profile found' });

    const { leave_type, start_date, end_date, reason } = req.body;

    const totalDays = calcBusinessDays(start_date, end_date);
    const documentPath = req.file ? req.file.filename : null;

    // Sick leave requires a document for 4 or more days
    if (leave_type === 'sick' && totalDays >= 4 && !req.file) {
      return res.status(400).json({ success: false, message: 'A supporting document is required for sick leave of 4 or more days' });
    }

    // Check leave balance
    const year = new Date(start_date).getFullYear();
    if (leave_type !== 'unpaid') {
      const [bal] = await db.execute(
        `SELECT total_allocated, used FROM leave_balances WHERE employee_id = ? AND leave_type = ? AND year = ?`,
        [empId, leave_type, year]
      );
      if (bal.length) {
        const remaining = bal[0].total_allocated - bal[0].used;
        if (totalDays > remaining)
          return res.status(400).json({ success: false, message: `Insufficient ${leave_type} leave balance. Available: ${remaining} days` });
      } else {
        return res.status(400).json({ success: false, message: `No ${leave_type} leave has been allocated for ${year}.` });
      }
    }

    const [result] = await db.execute(
      `INSERT INTO time_off_requests (employee_id, leave_type, start_date, end_date, total_days, reason, document_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [empId, leave_type, start_date, end_date, totalDays, reason, documentPath]
    );
    res.status(201).json({ success: true, message: 'Time off request submitted', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Own requests
const myRequests = async (req, res) => {
  try {
    const empId = req.user.employee_id;
    const [rows] = await db.execute(
      `SELECT t.*, u.email as reviewed_by_email FROM time_off_requests t
       LEFT JOIN users u ON u.id = t.reviewed_by
       WHERE t.employee_id = ? ORDER BY t.created_at DESC`,
      [empId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// All requests (Admin/HR/Payroll)
const allRequests = async (req, res) => {
  try {
    const { status, employee_id } = req.query;
    let query = `SELECT t.*, e.first_name, e.last_name, e.employee_code, e.department,
                        u.email as reviewed_by_email
                 FROM time_off_requests t
                 JOIN employees e ON e.id = t.employee_id
                 LEFT JOIN users u ON u.id = t.reviewed_by
                 WHERE 1=1`;
    const params = [];
    if (status) { query += ` AND t.status = ?`; params.push(status); }
    if (employee_id) { query += ` AND t.employee_id = ?`; params.push(employee_id); }
    query += ` ORDER BY t.created_at DESC`;
    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Approve
const approve = async (req, res) => {
  try {
    const [req_row] = await db.execute(`SELECT * FROM time_off_requests WHERE id = ?`, [req.params.id]);
    if (!req_row.length) return res.status(404).json({ success: false, message: 'Request not found' });
    if (req_row[0].status !== 'pending')
      return res.status(400).json({ success: false, message: 'Request already processed' });

    const tor = req_row[0];
    await db.execute(
      `UPDATE time_off_requests SET status='approved', reviewed_by=?, reviewed_at=NOW() WHERE id=?`,
      [req.user.id, req.params.id]
    );

    // Deduct from leave balance
    const year = new Date(tor.start_date).getFullYear();
    if (tor.leave_type !== 'unpaid') {
      await db.execute(
        `UPDATE leave_balances SET used = used + ? WHERE employee_id = ? AND leave_type = ? AND year = ?`,
        [tor.total_days, tor.employee_id, tor.leave_type, year]
      );
    }

    // Mark attendance as on_leave for those dates
    const cur = new Date(tor.start_date);
    const endDate = new Date(tor.end_date);
    while (cur <= endDate) {
      const dateStr = cur.toISOString().split('T')[0];
      await db.execute(
        `INSERT INTO attendance_summary (employee_id, date, status) VALUES (?, ?, 'on_leave')
         ON DUPLICATE KEY UPDATE status='on_leave'`,
        [tor.employee_id, dateStr]
      );
      cur.setDate(cur.getDate() + 1);
    }

    res.json({ success: true, message: 'Time off approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject
const reject = async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    const [req_row] = await db.execute(`SELECT * FROM time_off_requests WHERE id = ?`, [req.params.id]);
    if (!req_row.length) return res.status(404).json({ success: false, message: 'Request not found' });
    if (req_row[0].status !== 'pending')
      return res.status(400).json({ success: false, message: 'Request already processed' });

    await db.execute(
      `UPDATE time_off_requests SET status='rejected', reviewed_by=?, reviewed_at=NOW(), rejection_reason=? WHERE id=?`,
      [req.user.id, rejection_reason || '', req.params.id]
    );
    res.json({ success: true, message: 'Time off rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Leave balances
const getBalances = async (req, res) => {
  try {
    const empId = req.params.employee_id || req.user.employee_id;
    const year = req.query.year || new Date().getFullYear();
    const [rows] = await db.execute(
      `SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?`, [empId, year]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Allocate leaves (HR)
const allocate = async (req, res) => {
  try {
    const { employee_id, leave_type, total_allocated, year } = req.body;
    await db.execute(
      `INSERT INTO leave_balances (employee_id, leave_type, total_allocated, used, year) VALUES (?, ?, ?, 0, ?)
       ON DUPLICATE KEY UPDATE total_allocated = ?`,
      [employee_id, leave_type, total_allocated, year || new Date().getFullYear(), total_allocated]
    );
    res.json({ success: true, message: 'Leave allocated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// All balances (Admin/HR)
const getAllBalances = async (req, res) => {
  try {
    const year = req.query.year || new Date().getFullYear();
    const [rows] = await db.execute(
      `SELECT lb.*, e.first_name, e.last_name, e.employee_code, e.department
       FROM leave_balances lb
       JOIN employees e ON e.id = lb.employee_id
       WHERE lb.year = ? ORDER BY e.employee_code ASC`,
      [year]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { apply, myRequests, allRequests, approve, reject, getBalances, allocate, getAllBalances };
