const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/payrollController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole('admin', 'payroll_officer'));

router.get('/', ctrl.getAll);
router.post('/generate', ctrl.generate);
router.get('/payslip/:id', ctrl.getPayslip);
router.put('/:id', ctrl.update);

module.exports = router;
