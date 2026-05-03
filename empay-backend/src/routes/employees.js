
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/employeesController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);

router.get('/me', ctrl.getMyProfile);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.post('/', requireRole('admin', 'hr_officer'), ctrl.create);
// Salary config — admin, payroll_officer, & hr_officer
router.put('/:id/salary', requireRole('admin', 'payroll_officer', 'hr_officer'), ctrl.updateSalary);
router.post('/:id/upload-image', ctrl.uploadImage);
router.put('/:id', requireRole('admin', 'hr_officer', 'employee'), ctrl.update);
router.delete('/:id', requireRole('admin'), ctrl.remove);

module.exports = router;





