const db = require('../db/connection');
const bcrypt = require('bcryptjs');

const LEAVE_TYPES = [['sick', 12], ['casual', 10], ['earned', 15]];

// Generate next employee code safely (using MAX to avoid gaps causing duplicates)
async function nextEmpCode(conn) {
  const [rows] = await conn.query(`SELECT MAX(CAST(SUBSTRING(employee_code, 4) AS UNSIGNED)) AS mx FROM employees`);
  const next = (rows[0].mx || 0) + 1;
  return `EMP${String(next).padStart(3, '0')}`;
}

// Compute salary components from total monthly wage
function computeSalaryComponents(wage) {
  const w = parseFloat(wage) || 0;
  const basic          = Math.round(w * 0.50 * 100) / 100;
  const hra            = Math.round(basic * 0.40 * 100) / 100;
  const standardAllow  = 967.00;
  const perfBonus      = Math.round(basic * 0.0933 * 100) / 100;
  const lta            = Math.round(basic * 0.0933 * 100) / 100;
  const fixedAllowance = Math.round((w - basic - hra - standardAllow - perfBonus - lta) * 100) / 100;
  return { basic, hra, standardAllow, perfBonus, lta, fixedAllowance };
}

// GET all employees (with today status)
const getAll = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT e.*, u.email, u.role, u.is_active, u.login_id,
        (SELECT status FROM attendance WHERE employee_id = e.id AND date = CURDATE() LIMIT 1) AS today_attendance,
        (SELECT 1 FROM time_off_requests WHERE employee_id = e.id AND status='approved' AND CURDATE() BETWEEN start_date AND end_date LIMIT 1) AS on_leave_today
       FROM employees e JOIN users u ON u.id = e.user_id ORDER BY e.employee_code`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET single employee
const getOne = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT e.*, u.email, u.role, u.is_active, u.login_id,
              m.first_name AS manager_first_name, m.last_name AS manager_last_name
       FROM employees e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN employees m ON m.id = e.manager_id
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET own profile
const getMyProfile = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT e.*, u.email, u.role, u.login_id FROM employees e JOIN users u ON u.id = e.user_id WHERE e.user_id = ?`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Profile not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST create employee
const create = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const {
      email, role = 'employee', first_name, last_name, department, designation,
      date_of_joining, phone, address, pan_number, uan_number, bank_account, bank_name,
      ifsc_code, uam_id, wage = 0, location, manager_id,
    } = req.body;

    // Generate temp password
    const tempPassword = `Emp@${Math.random().toString(36).slice(-6).toUpperCase()}`;
    const hash = await bcrypt.hash(tempPassword, 10);

    // Generate employee code BEFORE inserting
    const empCode = await nextEmpCode(conn);

    const [userRes] = await conn.execute(
      `INSERT INTO users (email, password_hash, role, login_id) VALUES (?, ?, ?, ?)`,
      [email, hash, role, empCode]
    );
    const userId = userRes.insertId;

    // Auto-calculate salary components from wage
    const { basic, hra, standardAllow, perfBonus, lta, fixedAllowance } = computeSalaryComponents(wage);

    const [empRes] = await conn.execute(
      `INSERT INTO employees (user_id, employee_code, first_name, last_name, department, designation,
        date_of_joining, phone, address, pan_number, uan_number, bank_account, bank_name, ifsc_code, uam_id,
        wage, basic_salary, hra, standard_allowance, performance_bonus, lta, fixed_allowance, location, manager_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, empCode, first_name, last_name, department, designation,
       date_of_joining, phone, address, pan_number, uan_number, bank_account, bank_name, ifsc_code, uam_id,
       wage, basic, hra, standardAllow, perfBonus, lta, fixedAllowance, location, manager_id || null]
    );

    const year = new Date().getFullYear();
    for (const [lt, alloc] of LEAVE_TYPES) {
      await conn.execute(
        `INSERT IGNORE INTO leave_balances (employee_id, leave_type, total_allocated, used, year) VALUES (?, ?, ?, 0, ?)`,
        [empRes.insertId, lt, alloc, year]
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { employee_id: empRes.insertId, employee_code: empCode, login_id: empCode, email, temp_password: tempPassword },
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ success: false, message: 'Email already exists' });
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    conn.release();
  }
};

// PUT update employee (general + private info + salary info)
const update = async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      const [check] = await db.execute(`SELECT user_id FROM employees WHERE id = ?`, [req.params.id]);
      if (!check.length || check[0].user_id !== req.user.id)
        return res.status(403).json({ success: false, message: 'Cannot edit others' });
    }

    const b = req.body;
    let wage = b.wage;

    // If wage changed, recompute components
    let basic = b.basic_salary, hra = b.hra, standardAllow = b.standard_allowance,
        perfBonus = b.performance_bonus, lta = b.lta, fixedAllowance = b.fixed_allowance;
    if (wage !== undefined && wage !== null) {
      const c = computeSalaryComponents(wage);
      basic = c.basic; hra = c.hra; standardAllow = c.standardAllow;
      perfBonus = c.perfBonus; lta = c.lta; fixedAllowance = c.fixedAllowance;
    }

    await db.execute(
      `UPDATE employees SET
        first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name),
        department=COALESCE(?,department), designation=COALESCE(?,designation),
        date_of_joining=COALESCE(?,date_of_joining), phone=COALESCE(?,phone),
        address=COALESCE(?,address), pan_number=COALESCE(?,pan_number),
        uan_number=COALESCE(?,uan_number), bank_account=COALESCE(?,bank_account),
        bank_name=COALESCE(?,bank_name), ifsc_code=COALESCE(?,ifsc_code),
        uam_id=COALESCE(?,uam_id), location=COALESCE(?,location),
        manager_id=COALESCE(?,manager_id), status=COALESCE(?,status),
        wage=COALESCE(?,wage), basic_salary=COALESCE(?,basic_salary),
        hra=COALESCE(?,hra), standard_allowance=COALESCE(?,standard_allowance),
        performance_bonus=COALESCE(?,performance_bonus), lta=COALESCE(?,lta),
        fixed_allowance=COALESCE(?,fixed_allowance),
        birth_date=COALESCE(?,birth_date), gender=COALESCE(?,gender),
        marital_status=COALESCE(?,marital_status), nationality=COALESCE(?,nationality),
        personal_email=COALESCE(?,personal_email), permanent_address=COALESCE(?,permanent_address),
        about=COALESCE(?,about), skills=COALESCE(?,skills), certifications=COALESCE(?,certifications),
        pf_rate=COALESCE(?,pf_rate), prof_tax_amount=COALESCE(?,prof_tax_amount),
        working_days_per_week=COALESCE(?,working_days_per_week), break_time_hrs=COALESCE(?,break_time_hrs)
       WHERE id=?`,
      [b.first_name, b.last_name, b.department, b.designation, b.date_of_joining, b.phone,
       b.address, b.pan_number, b.uan_number, b.bank_account, b.bank_name, b.ifsc_code,
       b.uam_id, b.location, b.manager_id || null, b.status,
       wage, basic, hra, standardAllow, perfBonus, lta, fixedAllowance,
       b.birth_date, b.gender, b.marital_status, b.nationality, b.personal_email, b.permanent_address,
       b.about, b.skills, b.certifications,
       b.pf_rate, b.prof_tax_amount, b.working_days_per_week, b.break_time_hrs,
       req.params.id]
    );
    res.json({ success: true, message: 'Employee updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// DELETE
const remove = async (req, res) => {
  try {
    await db.execute(`DELETE FROM employees WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAll, getOne, getMyProfile, create, update, remove, computeSalaryComponents };
