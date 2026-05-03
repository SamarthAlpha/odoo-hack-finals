const db = require('../db/connection');

const getStats = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();

    const [[{ total_employees }]] = await db.execute(`SELECT COUNT(*) as total_employees FROM employees WHERE status='active'`);
    
    // Use CURDATE() for consistency with MySQL timezone setting
    const [[{ present_today }]] = await db.execute(
      `SELECT COUNT(*) as present_today FROM attendance_summary WHERE date = CURDATE() AND status IN ('present', 'half_day')`
    );
    const [[{ on_leave_today }]] = await db.execute(
      `SELECT COUNT(*) as on_leave_today FROM attendance_summary WHERE date = CURDATE() AND status = 'on_leave'`
    );
    const [[{ pending_leaves }]] = await db.execute(
      `SELECT COUNT(*) as pending_leaves FROM time_off_requests WHERE status = 'pending'`
    );

    // Dynamic: count employees currently checked in (last event is 'check_in')
    const [[{ currently_working }]] = await db.execute(
      `SELECT COUNT(*) as currently_working FROM (
         SELECT employee_id, MAX(timestamp) as last_ts 
         FROM attendance_events 
         WHERE DATE(timestamp) = CURDATE() 
         GROUP BY employee_id
       ) t JOIN attendance_events e ON e.employee_id = t.employee_id AND e.timestamp = t.last_ts
       WHERE e.event_type = 'check_in'`
    );

    const [[payrollStats]] = await db.execute(
      `SELECT SUM(net_pay) as total_payroll, COUNT(*) as payroll_count
       FROM payroll WHERE pay_period_month = ? AND pay_period_year = ? AND status != 'draft'`,
      [month, year]
    );

    // Department wise headcount
    const [deptStats] = await db.execute(
      `SELECT department, COUNT(*) as count FROM employees WHERE status='active' AND department IS NOT NULL GROUP BY department`
    );

    // Monthly attendance trend (last 6 months)
    const [attendanceTrend] = await db.execute(
      `SELECT MONTH(date) as month, YEAR(date) as year,
              SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present_count,
              SUM(CASE WHEN status='half_day' THEN 1 ELSE 0 END) as half_day_count,
              SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent_count
       FROM attendance_summary
       WHERE date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY YEAR(date), MONTH(date)
       ORDER BY year, month`
    );

    // Leave type distribution (approved requests only for better accuracy)
    const [leaveDistribution] = await db.execute(
      `SELECT leave_type, COUNT(*) as count FROM time_off_requests 
       WHERE status = 'approved' AND (YEAR(start_date) = ? OR YEAR(end_date) = ?) 
       GROUP BY leave_type`, [year, year]
    );

    res.json({
      success: true,
      data: {
        total_employees,
        present_today,
        currently_working,
        on_leave_today,
        absent_today: Math.max(0, total_employees - present_today - on_leave_today),
        pending_leaves,
        total_payroll: payrollStats.total_payroll || 0,
        payroll_count: payrollStats.payroll_count || 0,
        dept_stats: deptStats,
        attendance_trend: attendanceTrend,
        leave_distribution: leaveDistribution,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getStats };
