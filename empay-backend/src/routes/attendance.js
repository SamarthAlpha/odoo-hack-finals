const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/attendanceController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

router.post('/checkin', requireRole('employee'), ctrl.checkIn);
router.post('/checkout', requireRole('employee'), ctrl.checkOut);
router.get('/today-status', ctrl.todayStatus);
router.get('/my', ctrl.myLogs);
router.get('/', requireRole('admin', 'hr_officer', 'payroll_officer'), ctrl.allLogs);

module.exports = router;
