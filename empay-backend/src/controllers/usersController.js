const db = require('../db/connection');
const bcrypt = require('bcryptjs');

const getAll = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.email, u.role, u.is_active, u.login_id, u.created_at,
              e.first_name, e.last_name, e.employee_code, e.department, e.designation
       FROM users u LEFT JOIN employees e ON e.user_id = u.id
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateRole = async (req, res) => {
  try {
    const { role } = req.body;
    const validRoles = ['admin', 'employee', 'hr_officer', 'payroll_officer'];
    if (!validRoles.includes(role))
      return res.status(400).json({ success: false, message: 'Invalid role' });
    if (req.params.id == req.user.id)
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    await db.execute(`UPDATE users SET role = ? WHERE id = ?`, [role, req.params.id]);
    res.json({ success: true, message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const toggleActive = async (req, res) => {
  try {
    const [user] = await db.execute(`SELECT is_active FROM users WHERE id = ?`, [req.params.id]);
    if (!user.length) return res.status(404).json({ success: false, message: 'Not found' });
    const newStatus = user[0].is_active ? 0 : 1;
    await db.execute(`UPDATE users SET is_active = ? WHERE id = ?`, [newStatus, req.params.id]);
    res.json({ success: true, message: newStatus ? 'Activated' : 'Deactivated', is_active: newStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const remove = async (req, res) => {
  try {
    if (req.params.id == req.user.id)
      return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
    await db.execute(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reset password — generates new temp password and returns it (so frontend can email it)
const resetPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    // If no password provided, generate a random one
    const tempPass = new_password || `Emp@${Math.random().toString(36).slice(-6).toUpperCase()}`;
    const hash = await bcrypt.hash(tempPass, 10);
    await db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [hash, req.params.id]);

    // Return the plain text password so frontend can send via EmailJS
    res.json({ success: true, message: 'Password reset', new_password: tempPass });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, updateRole, toggleActive, remove, resetPassword };
