
const db = require('../db/connection');

// Proper salary formula from employee stored parameters
function calcComponents(emp, ratio) {
  const wage = parseFloat(emp.wage) || 0;
  const bp   = parseFloat(emp.basic_pct) || 50;
  const hp   = parseFloat(emp.hra_pct) || 50;
  const sp   = parseFloat(emp.standard_allowance_pct) || 0;
  const pp   = parseFloat(emp.perf_pct) || 8.33;
  const lp   = parseFloat(emp.lta_pct) || 8.33;
  const ep   = parseFloat(emp.employee_pf_pct) || 12;
  const erp  = parseFloat(emp.employer_pf_pct) || 12;
  const ptAmt = parseFloat(emp.prof_tax_amount) || 200;

  // Full-month components (using existing formulas)
  const basic = Math.round(wage * (bp / 100) * 100) / 100;
  const hra   = Math.round(basic * (hp / 100) * 100) / 100;
  const std   = Math.round(basic * (sp / 100) * 100) / 100;
  const perf  = Math.round(basic * (pp / 100) * 100) / 100;
  const lta   = Math.round(basic * (lp / 100) * 100) / 100;
  
  const earningsSumBeforeFixed = basic + hra + std + perf + lta;
  const fixed = Math.round((wage - earningsSumBeforeFixed) * 100) / 100;

  // Pro-rate all earnings by attendance ratio
  const r = ratio;
  const pBasic = Math.round(basic * r * 100) / 100;
  const pHra   = Math.round(hra * r * 100) / 100;
  const pStd   = Math.round(std * r * 100) / 100;
  const pPerf  = Math.round(perf * r * 100) / 100;
  const pLta   = Math.round(lta * r * 100) / 100;
  const pFixed = Math.round(fixed * r * 100) / 100;
  
  const gross = Math.round((pBasic + pHra + pStd + pPerf + pLta + pFixed) * 100) / 100;

  // Deductions on prorated basic
  const pfEmp   = Math.round(pBasic * (ep / 100) * 100) / 100;
  const pfEr    = Math.round(pBasic * (erp / 100) * 100) / 100;
  const pt      = gross >= 15000 ? ptAmt : 0;
  const tds     = 0;
  const totalDed = Math.round((pfEmp + pt + tds) * 100) / 100;
  const netPay  = Math.round((gross - totalDed) * 100) / 100;

  return {
    basic: pBasic, hra: pHra, standardAllowance: pStd, performanceBonus: pPerf,
    lta: pLta, fixedAllowance: pFixed, grossEarnings: gross,
    pfEmployee: pfEmp, pfEmployer: pfEr, professionalTax: pt, tds, totalDeductions: totalDed, netPay,
  };
}

// Generate payroll
const generate = async (req, res) => {
  try {
    const { month, year, employee_ids } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });

    // Working days = weekdays in month
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0 && day !== 6) workingDays++;
    }

    let empQuery = `SELECT * FROM employees WHERE status = 'active'`;
    const params = [];
    if (employee_ids && employee_ids.length > 0) {
      empQuery += ` AND id IN (${employee_ids.map(() => '?').join(',')})`;
      params.push(...employee_ids);
    }
    const [employees] = await db.execute(empQuery, params);
    const results = [];

    for (const emp of employees) {
      const [attRows] = await db.execute(
        `SELECT status, COUNT(*) as cnt FROM attendance WHERE employee_id=? AND MONTH(date)=? AND YEAR(date)=? GROUP BY status`,
        [emp.id, month, year]
      );
      let daysWorked = 0;
      for (const row of attRows) {
        if (row.status === 'present') daysWorked += row.cnt * 1.0;
        else if (row.status === 'half_day') daysWorked += row.cnt * 0.5;
        else if (row.status === 'on_leave') daysWorked += row.cnt * 1.0;
      }
      // Default to full month if no attendance recorded yet
      if (daysWorked === 0 && attRows.length === 0) daysWorked = workingDays;

      const ratio = workingDays > 0 ? daysWorked / workingDays : 1;
      const c = calcComponents(emp, ratio);

      await db.execute(
        `INSERT INTO payroll (employee_id, pay_period_month, pay_period_year, working_days, days_worked,
          basic_salary, hra, standard_allowance, performance_bonus, lta, fixed_allowance,
          gross_earnings, pf_employee, pf_employer, professional_tax, tds, total_deductions, net_pay,
          status, generated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'processed',?)
         ON DUPLICATE KEY UPDATE
          working_days=VALUES(working_days), days_worked=VALUES(days_worked),
          basic_salary=VALUES(basic_salary), hra=VALUES(hra),
          standard_allowance=VALUES(standard_allowance), performance_bonus=VALUES(performance_bonus),
          lta=VALUES(lta), fixed_allowance=VALUES(fixed_allowance),
          gross_earnings=VALUES(gross_earnings), pf_employee=VALUES(pf_employee),
          pf_employer=VALUES(pf_employer), professional_tax=VALUES(professional_tax),
          tds=VALUES(tds), total_deductions=VALUES(total_deductions),
          net_pay=VALUES(net_pay), status='processed', generated_by=VALUES(generated_by)`,
        [emp.id, month, year, workingDays, daysWorked.toFixed(1),
         c.basic, c.hra, c.standardAllowance, c.performanceBonus, c.lta, c.fixedAllowance,
         c.grossEarnings, c.pfEmployee, c.pfEmployer, c.professionalTax, c.tds,
         c.totalDeductions, c.netPay, req.user.id]
      );
      results.push({ employee_id: emp.id, employee_code: emp.employee_code, net_pay: c.netPay });
    }

    res.json({ success: true, message: `Payroll generated for ${results.length} employees`, data: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all payroll records
const getAll = async (req, res) => {
  try {
    const { month, year, employee_id } = req.query;
    let query = `SELECT p.*, e.first_name, e.last_name, e.employee_code, e.department, e.designation,
                        e.pan_number, e.uan_number, e.bank_account, e.bank_name, e.wage, u.email
                 FROM payroll p
                 JOIN employees e ON e.id = p.employee_id
                 JOIN users u ON u.id = e.user_id WHERE 1=1`;
    const params = [];
    if (month) { query += ` AND p.pay_period_month=?`; params.push(month); }
    if (year)  { query += ` AND p.pay_period_year=?`;  params.push(year); }
    if (employee_id) { query += ` AND p.employee_id=?`; params.push(employee_id); }
    // Employees can only see their own
    if (req.user.role === 'employee') {
      query += ` AND e.user_id=?`; params.push(req.user.id);
    }
    query += ` ORDER BY p.pay_period_year DESC, p.pay_period_month DESC, e.employee_code`;
    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get payslip
const getPayslip = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, e.first_name, e.last_name, e.employee_code, e.department, e.designation,
              e.pan_number, e.uan_number, e.bank_account, e.bank_name, e.date_of_joining, u.email
       FROM payroll p
       JOIN employees e ON e.id = p.employee_id
       JOIN users u ON u.id = e.user_id WHERE p.id=?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update payroll status/bonus
const update = async (req, res) => {
  try {
    const { status } = req.body;
    if (status) {
      await db.execute(`UPDATE payroll SET status=? WHERE id=?`, [status, req.params.id]);
    }
    res.json({ success: true, message: 'Payroll updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Validate entire payrun (month+year) → mark all as 'paid'
const validatePayrun = async (req, res) => {
  try {
    const { month, year } = req.body;
    if (!month || !year) return res.status(400).json({ success: false, message: 'Month and year required' });
    await db.execute(
      `UPDATE payroll SET status='paid' WHERE pay_period_month=? AND pay_period_year=? AND status != 'paid'`,
      [month, year]
    );
    res.json({ success: true, message: `Payrun for ${month}/${year} validated and marked as paid` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Payroll dashboard stats: warnings + monthly employer cost + employee count
const getDashboardStats = async (req, res) => {
  try {
    // Warnings
    const [[{ no_bank }]] = await db.execute(
      `SELECT COUNT(*) as no_bank FROM employees WHERE status='active' AND (bank_account IS NULL OR bank_account='')`
    );
    const [[{ no_manager }]] = await db.execute(
      `SELECT COUNT(*) as no_manager FROM employees WHERE status='active' AND (manager_id IS NULL)`
    );

    // Last 6 months employer cost (gross_earnings = employer cost proxy)
    const [monthlyCost] = await db.execute(
      `SELECT pay_period_month as month, pay_period_year as year,
              SUM(gross_earnings) as employer_cost, COUNT(DISTINCT employee_id) as emp_count
       FROM payroll
       WHERE STR_TO_DATE(CONCAT(pay_period_year,'-',pay_period_month,'-01'),'%Y-%m-%d') >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY pay_period_year, pay_period_month
       ORDER BY pay_period_year, pay_period_month`
    );

    // Pay runs summary
    const [payrunSummary] = await db.execute(
      `SELECT pay_period_month as month, pay_period_year as year,
              COUNT(*) as total, SUM(gross_earnings) as gross, SUM(net_pay) as net,
              SUM(pf_employer) as employer_cost,
              SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count
       FROM payroll
       GROUP BY pay_period_year, pay_period_month
       ORDER BY pay_period_year DESC, pay_period_month DESC`
    );

    res.json({
      success: true,
      data: { warnings: { no_bank, no_manager }, monthly_cost: monthlyCost, payrun_summary: payrunSummary }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { generate, getAll, getPayslip, update, validatePayrun, getDashboardStats };


