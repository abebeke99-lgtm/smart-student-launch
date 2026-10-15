const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const router = express.Router();

router.use(authenticateToken, authorizeRoles('admin', 'systemadmin', 'dept_head', 'department_head'));
const {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getOverview,
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
} = require('../controllers/departmentController');

router.get('/overview', getOverview);
router.post('/', createDepartment);
router.put('/:id', updateDepartment);
router.delete('/:id', deleteDepartment);
router.get('/assignments', getAssignments);
router.post('/assignments', createAssignment);
router.put('/assignments/:id', updateAssignment);
router.delete('/assignments/:id', deleteAssignment);

module.exports = router;
