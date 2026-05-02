const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/usersController');
const { verifyToken, requireRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(requireRole('admin'));

router.get('/', ctrl.getAll);
router.put('/:id/role', ctrl.updateRole);
router.put('/:id/toggle-active', ctrl.toggleActive);
router.put('/:id/reset-password', ctrl.resetPassword);
router.delete('/:id', ctrl.remove);

module.exports = router;
