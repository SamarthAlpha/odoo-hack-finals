
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ctrl = require('../controllers/timeoffController');
const { verifyToken, requireRole } = require('../middleware/auth');

// Multer config — store in uploads/timeoff, keep original extension
const TIMEOFF_DIR = path.join(__dirname, '..', '..', 'uploads', 'timeoff');
if (!fs.existsSync(TIMEOFF_DIR)) fs.mkdirSync(TIMEOFF_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure directory still exists at upload time
    if (!fs.existsSync(TIMEOFF_DIR)) fs.mkdirSync(TIMEOFF_DIR, { recursive: true });
    cb(null, TIMEOFF_DIR);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random()*1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const fileFilter = (req, file, cb) => {
  const allowedExt = /\.(jpeg|jpg|png|gif|pdf|doc|docx)$/i;
  if (allowedExt.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error('Only images (jpg/png/gif), PDF, and Word documents are allowed'));
  }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB

router.use(verifyToken);

router.get('/my', ctrl.myRequests);
router.get('/balances/:employee_id', ctrl.getBalances);
router.get('/balances', ctrl.getBalances);
router.post('/apply', requireRole('employee'), upload.single('document'), ctrl.apply);
router.get('/', requireRole('admin', 'hr_officer', 'payroll_officer'), ctrl.allRequests);
router.put('/:id/approve', requireRole('admin', 'payroll_officer', 'hr_officer'), ctrl.approve);
router.put('/:id/reject', requireRole('admin', 'payroll_officer', 'hr_officer'), ctrl.reject);
router.get('/all-balances', requireRole('admin', 'hr_officer', 'payroll_officer'), ctrl.getAllBalances);
router.post('/allocate', requireRole('admin', 'hr_officer'), ctrl.allocate);

module.exports = router;


