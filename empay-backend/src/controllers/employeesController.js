
const db = require('../db/connection');
const bcrypt = require('bcryptjs');
const { sendCredentialsEmail } = require('../utils/emailService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for profile images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const dir = path.join(__dirname, '..', '..', 'uploads', 'profiles');
      console.log('Multer destination:', dir);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Created directory:', dir);
      }
      cb(null, dir);
    } catch (e) {
      console.error('Multer destination error:', e);
      cb(e);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = req.params.id || 'unknown';
    cb(null, `profile-${id}-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage }).single('image');

const LEAVE_TYPES = [['sick', 12], ['casual', 10], ['earned', 15]];

const COMPANY_PREFIX = 'EP'; // EmPay

// Generate EMP001-style sequential code (for employee_code field)
async function nextEmpCode(conn) {
  const [rows] = await conn.query(`SELECT MAX(CAST(SUBSTRING(employee_code, 4) AS UNSIGNED)) AS mx FROM employees`);
  const next = (rows[0].mx || 0) + 1;
  return `EMP${String(next).padStart(3, '0')}`;
}

/**
 * Generate Login ID: [EP][XX][XX][YYYY][NNNN]
 * EP   = Company prefix
 * XX   = First 2 letters of first name (uppercase)
 * XX   = First 2 letters of last name  (uppercase)
 * YYYY = Year of joining
 * NNNN = Serial number of joining in that year (per-year counter)
 * Example: John Doe joining 2023 → EPJODO20230001
 */
async function generateLoginId(conn, firstName, lastName, dateOfJoining) {
  const year = dateOfJoining
    ? new Date(dateOfJoining).getFullYear()
    : new Date().getFullYear();
  const fn = (firstName || 'XX').substring(0, 2).toUpperCase();
  const ln = (lastName  || 'XX').substring(0, 2).toUpperCase();

  // Count how many employees already have a login_id for this year → gives serial position
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM users WHERE login_id LIKE ?`,
    [`${COMPANY_PREFIX}____${year}%`]
  );
  const serial = String((rows[0].cnt || 0) + 1).padStart(4, '0');
  return `${COMPANY_PREFIX}${fn}${ln}${year}${serial}`;
}

// Compute salary components from total monthly wage
// basic_pct  : % of wage that becomes Basic
// hra_pct    : % of Basic that becomes HRA
// std_pct    : % of Basic that becomes Standard Allowance
// bonus_pct  : % of Basic that becomes Performance Bonus
// lta_pct    : % of Basic that becomes LTA
// epf_pct    : % of Basic for Employee PF
// erpf_pct   : % of Basic for Employer PF
// pt_amount  : Professional Tax (fixed amount)
function computeSalaryComponents(wage, basic_pct=50, hra_pct=50, std_pct=0, bonus_pct=8.33, lta_pct=8.33, epf_pct=12, erpf_pct=12, pt_amount=200) {
  const w    = Math.max(0, parseFloat(wage)       || 0);
  const bp   = Math.max(0, parseFloat(basic_pct)  || 0);
  const hp   = Math.max(0, parseFloat(hra_pct)    || 0);
  const sp   = Math.max(0, parseFloat(std_pct)    || 0);
  const pp   = Math.max(0, parseFloat(bonus_pct)  || 0);
  const lp   = Math.max(0, parseFloat(lta_pct)    || 0);
  const ep   = Math.max(0, parseFloat(epf_pct)    || 0);
  const erp  = Math.max(0, parseFloat(erpf_pct)   || 0);
  const pt   = Math.max(0, parseFloat(pt_amount)  || 0);

  const annualSalary    = Math.round(w * 12 * 100) / 100;
  const basicSalary     = Math.round(w * (bp / 100) * 100) / 100;
  const hraAmount       = Math.round(basicSalary * (hp / 100) * 100) / 100;
  const standardAllow   = Math.round(basicSalary * (sp / 100) * 100) / 100;
  const performanceBonus = Math.round(basicSalary * (pp / 100) * 100) / 100;
  const ltaAmount       = Math.round(basicSalary * (lp / 100) * 100) / 100;
  const employeePf      = Math.round(basicSalary * (ep / 100) * 100) / 100;
  const employerPf      = Math.round(basicSalary * (erp / 100) * 100) / 100;

  // Following Gross Salary must equal Monthly Salary rule:
  // Gross = Basic + HRA + Standard + Perf + LTA + Fixed = Wage
  // So Fixed = Wage - (Basic + HRA + Standard + Perf + LTA)
  const earningsSumBeforeFixed = basicSalary + hraAmount + standardAllow + performanceBonus + ltaAmount;
  const fixedAllowance = Math.round((w - earningsSumBeforeFixed) * 100) / 100;

  const grossSalary     = Math.round((earningsSumBeforeFixed + fixedAllowance) * 100) / 100; // should be w
  const totalDeductions = Math.round((employeePf + pt) * 100) / 100;
  const netSalary       = Math.round((grossSalary - totalDeductions) * 100) / 100;

  return {
    annualSalary, basicSalary, hraAmount, standardAllow, performanceBonus, ltaAmount,
    employeePf, employerPf, fixedAllowance, grossSalary, totalDeductions, netSalary
  };
}

// GET all employees (with today status)
const getAll = async (req, res) => {
  try {
    // Employees only see themselves; admins/HR see all non-admin employees
    let query = `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department, e.designation, e.phone, e.location,
                        e.profile_image, e.status,
                        u.email, u.role, u.is_active, u.login_id,
        (SELECT status FROM attendance_summary WHERE employee_id = e.id AND date = CURDATE() LIMIT 1) AS today_attendance,
        (SELECT 1 FROM time_off_requests WHERE employee_id = e.id AND status='approved' AND CURDATE() BETWEEN start_date AND end_date LIMIT 1) AS on_leave_today
       FROM employees e JOIN users u ON u.id = e.user_id
       WHERE 1=1`;
    const params = [];

    if (req.user.role === 'employee') {
      // Employees can see all other employees' basic details
      // but not their own in this list (to avoid duplication on profile page)
      // query += ` AND e.user_id != ?`;
      // params.push(req.user.id);
    }
    query += ` ORDER BY e.employee_code`;

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// GET single employee
const getOne = async (req, res) => {
  try {
    const isOwnProfile = req.user.role === 'employee' && (await db.execute(`SELECT user_id FROM employees WHERE id = ?`, [req.params.id]))[0][0]?.user_id === req.user.id;

    let query;
    const canSeeFull = req.user.role === 'admin' || req.user.role === 'hr_officer' ||
                       req.user.role === 'payroll_officer' || isOwnProfile;

    if (canSeeFull) {
      // Full access for admin, HR, payroll_officer, or when viewing own profile
      query = `SELECT e.*, u.email, u.role, u.is_active, u.login_id,
                      m.first_name AS manager_first_name, m.last_name AS manager_last_name
               FROM employees e
               JOIN users u ON u.id = e.user_id
               LEFT JOIN employees m ON m.id = e.manager_id
               WHERE e.id = ?`;
    } else {
      // Limited access for employees viewing other profiles
      query = `SELECT e.id, e.employee_code, e.first_name, e.last_name, e.department, e.designation, e.phone, e.location,
                      u.email, u.role, u.is_active
               FROM employees e
               JOIN users u ON u.id = e.user_id
               WHERE e.id = ? AND u.role != 'admin'`;
    }

    const [rows] = await db.execute(query, [req.params.id]);
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

    // Generate employee code (EMP001) and login ID (EPJODO20230001) separately
    const empCode = await nextEmpCode(conn);
    const loginId = await generateLoginId(conn, first_name, last_name, date_of_joining);

    const [userRes] = await conn.execute(
      `INSERT INTO users (email, password_hash, role, login_id) VALUES (?, ?, ?, ?)`,
      [email, hash, role, loginId]
    );
    const userId = userRes.insertId;

    // Auto-calculate salary components from wage
    const c = computeSalaryComponents(wage);

    const [empRes] = await conn.execute(
      `INSERT INTO employees (user_id, employee_code, first_name, last_name, department, designation,
        date_of_joining, phone, address, pan_number, uan_number, bank_account, bank_name, ifsc_code, uam_id,
        wage, basic_salary, hra, standard_allowance, performance_bonus, lta, fixed_allowance,
        annual_salary, employee_pf, employer_pf, gross_salary, total_deductions, net_salary,
        location, manager_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, empCode, first_name, last_name, department, designation,
       date_of_joining, phone, address, pan_number, uan_number, bank_account, bank_name, ifsc_code, uam_id,
       wage, c.basicSalary, c.hraAmount, c.standardAllow, c.performanceBonus, c.ltaAmount, c.fixedAllowance,
       c.annualSalary, c.employeePf, c.employerPf, c.grossSalary, c.totalDeductions, c.netSalary,
       location, manager_id || null]
    );

    const year = new Date().getFullYear();
    for (const [lt, alloc] of LEAVE_TYPES) {
      await conn.execute(
        `INSERT IGNORE INTO leave_balances (employee_id, leave_type, total_allocated, used, year) VALUES (?, ?, ?, 0, ?)`,
        [empRes.insertId, lt, alloc, year]
      );
    }

    await conn.commit();

    // Send credentials email
    await sendCredentialsEmail({
      toName: `${first_name} ${last_name}`,
      toEmail: email,
      loginId: loginId,
      password: tempPassword
    });

    res.status(201).json({
      success: true,
      message: 'Employee created successfully',
      data: { employee_id: empRes.insertId, employee_code: empCode, login_id: loginId, email },
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
    let wage = b.wage;    // Determine which percentages to use (keep existing if not provided)
    const [existing] = await db.execute(`SELECT * FROM employees WHERE id=?`, [req.params.id]);
    const ex = existing[0] || {};

    const bPct = b.basic_pct !== undefined ? b.basic_pct : (ex.basic_pct || 50);
    const hPct = b.hra_pct   !== undefined ? b.hra_pct   : (ex.hra_pct   || 50);
    const sPct = b.standard_allowance_pct !== undefined ? b.standard_allowance_pct : (ex.standard_allowance_pct || 0);
    const pPct = b.perf_pct  !== undefined ? b.perf_pct  : (ex.perf_pct  || 8.33);
    const lPct = b.lta_pct   !== undefined ? b.lta_pct   : (ex.lta_pct   || 8.33);
    const epPct = b.employee_pf_pct !== undefined ? b.employee_pf_pct : (ex.employee_pf_pct || 12);
    const erPct = b.employer_pf_pct !== undefined ? b.employer_pf_pct : (ex.employer_pf_pct || 12);
    const ptAmt = b.prof_tax_amount !== undefined ? b.prof_tax_amount : (ex.prof_tax_amount || 200);

    // If wage or any percentage changed, recompute components
    let c = {
      basicSalary: ex.basic_salary, hraAmount: ex.hra, standardAllow: ex.standard_allowance,
      performanceBonus: ex.performance_bonus, ltaAmount: ex.lta, fixedAllowance: ex.fixed_allowance,
      annualSalary: ex.annual_salary, employeePf: ex.employee_pf, employerPf: ex.employer_pf,
      grossSalary: ex.gross_salary, totalDeductions: ex.total_deductions, netSalary: ex.net_salary
    };

    if (wage !== undefined || b.basic_pct !== undefined || b.hra_pct !== undefined ||
        b.standard_allowance_pct !== undefined || b.perf_pct !== undefined ||
        b.lta_pct !== undefined || b.employee_pf_pct !== undefined ||
        b.employer_pf_pct !== undefined || b.prof_tax_amount !== undefined) {
      c = computeSalaryComponents(wage !== undefined ? wage : ex.wage, bPct, hPct, sPct, pPct, lPct, epPct, erPct, ptAmt);
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
        annual_salary=COALESCE(?,annual_salary), employee_pf=COALESCE(?,employee_pf),
        employer_pf=COALESCE(?,employer_pf), gross_salary=COALESCE(?,gross_salary),
        total_deductions=COALESCE(?,total_deductions), net_salary=COALESCE(?,net_salary),
        basic_pct=COALESCE(?,basic_pct), hra_pct=COALESCE(?,hra_pct),
        standard_allowance_pct=COALESCE(?,standard_allowance_pct), perf_pct=COALESCE(?,perf_pct),
        lta_pct=COALESCE(?,lta_pct), employee_pf_pct=COALESCE(?,employee_pf_pct),
        employer_pf_pct=COALESCE(?,employer_pf_pct), prof_tax_amount=COALESCE(?,prof_tax_amount),
        birth_date=COALESCE(?,birth_date), gender=COALESCE(?,gender),
        marital_status=COALESCE(?,marital_status), nationality=COALESCE(?,nationality),
        personal_email=COALESCE(?,personal_email), permanent_address=COALESCE(?,permanent_address),
        about=COALESCE(?,about), skills=COALESCE(?,skills), certifications=COALESCE(?,certifications),
        work_passion=COALESCE(?,work_passion), hobbies=COALESCE(?,hobbies),
        pf_rate=COALESCE(?,pf_rate),
        working_days_per_week=COALESCE(?,working_days_per_week), break_time_hrs=COALESCE(?,break_time_hrs)
       WHERE id=?`,
      [b.first_name, b.last_name, b.department, b.designation, b.date_of_joining, b.phone,
       b.address, b.pan_number, b.uan_number, b.bank_account, b.bank_name, b.ifsc_code,
       b.uam_id, b.location, b.manager_id || null, b.status,
       wage, c.basicSalary, c.hraAmount, c.standardAllow, c.performanceBonus, c.ltaAmount, c.fixedAllowance,
       c.annualSalary, c.employeePf, c.employerPf, c.grossSalary, c.totalDeductions, c.netSalary,
       b.basic_pct, b.hra_pct, b.standard_allowance_pct, b.perf_pct, b.lta_pct,
       b.employee_pf_pct, b.employer_pf_pct, b.prof_tax_amount,
       b.birth_date, b.gender, b.marital_status, b.nationality, b.personal_email, b.permanent_address,
       b.about, b.skills, b.certifications,
       b.work_passion, b.hobbies,
       b.pf_rate, b.working_days_per_week, b.break_time_hrs,
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

const uploadImage = (req, res) => {
  console.log('--- Upload Image Request ---');
  console.log('User from token:', req.user);
  console.log('Params ID:', req.params.id);

  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Run multer first, then do the permission check
  upload(req, res, async (err) => {
    if (err) {
      console.error('Multer processing error:', err);
      return res.status(500).json({ success: false, message: 'Upload error: ' + err.message });
    }

    if (!req.file) {
      console.error('Upload failed: No file found in request');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    try {
      // Look up the employee's owner from DB (more reliable than stale JWT)
      const [empRows] = await db.execute(`SELECT user_id FROM employees WHERE id = ?`, [req.params.id]);
      if (!empRows.length) {
        fs.unlinkSync(req.file.path); // clean up uploaded file
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }

      const isAdmin = ['admin', 'hr_officer'].includes(req.user.role);
      const isOwner = empRows[0].user_id === req.user.id;

      if (!isAdmin && !isOwner) {
        fs.unlinkSync(req.file.path); // clean up uploaded file
        console.error(`Upload denied: User ${req.user.id} tried to upload for employee ${req.params.id}`);
        return res.status(403).json({ success: false, message: 'Access denied: You can only update your own profile picture' });
      }

      const imagePath = `/uploads/profiles/${req.file.filename}`;
      console.log('File saved to:', req.file.path);
      console.log('Updating DB with path:', imagePath);

      const [result] = await db.execute(`UPDATE employees SET profile_image = ? WHERE id = ?`, [imagePath, req.params.id]);
      console.log('DB Update result:', result);

      res.json({ success: true, message: 'Profile image updated', imageUrl: imagePath });
    } catch (dbErr) {
      console.error('Database error in uploadImage:', dbErr);
      // Try to clean up the file on error
      try { if (req.file) fs.unlinkSync(req.file.path); } catch(_) {}
      res.status(500).json({ success: false, message: 'Database error: ' + dbErr.message });
    }
  });
};

// PUT /employees/:id/salary  — ADMIN & PAYROLL OFFICER ONLY
// Accepts: wage, working_days_per_week, basic_pct, hra_pct, standard_allowance_fixed
// Recomputes ALL salary components and persists to DB.
const updateSalary = async (req, res) => {
  try {
    const { id } = req.params;
    const safeNum = (v, fallback) => { const n = parseFloat(v); return isNaN(n) ? fallback : n; };

    const wage                   = req.body.wage;
    const working_days_per_week  = req.body.working_days_per_week;
    const basic_pct              = req.body.basic_pct;
    const hra_pct                = req.body.hra_pct;
    const standard_allowance_pct = req.body.standard_allowance_pct;
    const perf_pct               = req.body.perf_pct;
    const lta_pct                = req.body.lta_pct;
    const employee_pf_pct        = req.body.employee_pf_pct;
    const employer_pf_pct        = req.body.employer_pf_pct;
    const prof_tax_amount        = req.body.prof_tax_amount;

    if (wage === undefined || wage === null)
      return res.status(400).json({ success: false, message: 'wage is required' });

    const pWage  = safeNum(wage, 0);
    const pBasic = safeNum(basic_pct, 50);
    const pHra   = safeNum(hra_pct, 50);
    const pStd   = safeNum(standard_allowance_pct, 0);
    const pPerf  = safeNum(perf_pct, 8.33);
    const pLta   = safeNum(lta_pct, 8.33);
    const pEpf   = safeNum(employee_pf_pct, 12);
    const pErpf  = safeNum(employer_pf_pct, 12);
    const pPt    = safeNum(prof_tax_amount, 200);
    const pWpw   = safeNum(working_days_per_week, null);

    const c = computeSalaryComponents(pWage, pBasic, pHra, pStd, pPerf, pLta, pEpf, pErpf, pPt);

    await db.execute(
      `UPDATE employees SET
         wage=?, basic_salary=?, hra=?,
         standard_allowance=?, performance_bonus=?, lta=?, fixed_allowance=?,
         basic_pct=?, hra_pct=?, standard_allowance_pct=?, perf_pct=?, lta_pct=?,
         employee_pf_pct=?, employer_pf_pct=?, prof_tax_amount=?,
         annual_salary=?, employee_pf=?, employer_pf=?, gross_salary=?, total_deductions=?, net_salary=?,
         working_days_per_week=COALESCE(?,working_days_per_week)
       WHERE id=?`,
      [
        pWage, c.basicSalary, c.hraAmount,
        c.standardAllow, c.performanceBonus, c.ltaAmount, c.fixedAllowance,
        pBasic, pHra, pStd, pPerf, pLta,
        pEpf, pErpf, pPt,
        c.annualSalary, c.employeePf, c.employerPf, c.grossSalary, c.totalDeductions, c.netSalary,
        pWpw,
        id,
      ]
    );

    res.json({
      success: true,
      message: 'Salary configuration updated',
      data: {
        ...c,
        basic_pct: pBasic, hra_pct: pHra, standard_allowance_pct: pStd,
        perf_pct: pPerf, lta_pct: pLta, employee_pf_pct: pEpf, employer_pf_pct: pErpf,
        prof_tax_amount: pPt, working_days_per_week: pWpw
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAll,
  getOne,
  getMyProfile,
  create,
  update,
  remove,
  updateSalary,
  uploadImage,
  computeSalaryComponents
};


