const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/connection');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const [users] = await db.execute(
      `SELECT u.*, e.id as employee_id, e.first_name, e.last_name, e.employee_code, e.department, e.designation
       FROM users u LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.email = ? AND u.is_active = 1`,
      [email]
    );

    if (!users.length)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      employee_id: user.employee_id,
      name: user.first_name ? `${user.first_name} ${user.last_name}` : user.email,
      employee_code: user.employee_code,
      login_id: user.login_id || user.employee_code,
      department: user.department,
      designation: user.designation,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

    res.json({ success: true, token, user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getMe = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.id, u.email, u.role, u.login_id, e.id as employee_id, e.first_name, e.last_name,
              e.employee_code, e.department, e.designation, e.phone, e.address, e.wage,
              e.pan_number, e.uan_number, e.bank_account, e.basic_salary, e.date_of_joining, e.status,
              e.profile_image
       FROM users u LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const [users] = await db.execute(`SELECT password_hash FROM users WHERE id = ?`, [req.user.id]);
    if (!users.length) return res.status(404).json({ success: false, message: 'User not found' });

    const valid = await bcrypt.compare(current_password, users[0].password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    const newHash = await bcrypt.hash(new_password, 10);
    await db.execute(`UPDATE users SET password_hash = ? WHERE id = ?`, [newHash, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { login, getMe, changePassword };





