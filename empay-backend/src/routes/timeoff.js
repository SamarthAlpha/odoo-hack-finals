const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/timeoffController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

router.get('/my', ctrl.myRequests);
router.get('/balances/:employee_id', ctrl.getBalances);
router.get('/balances', ctrl.getBalances);
router.post('/apply', requireRole('employee'), ctrl.apply);
router.get('/', requireRole('admin', 'hr_officer', 'payroll_officer'), ctrl.allRequests);
router.put('/:id/approve', requireRole('admin', 'payroll_officer'), ctrl.approve);
router.put('/:id/reject', requireRole('admin', 'payroll_officer'), ctrl.reject);
router.post('/allocate', requireRole('admin', 'hr_officer'), ctrl.allocate);

module.exports = router;
