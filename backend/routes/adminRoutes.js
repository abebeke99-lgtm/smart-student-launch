const express = require('express');
const { getAdminDashboardStats, getBroadcastHistory, sendBroadcast, deleteBroadcast, getDepartmentAnalytics, getSecurityLogs, getAuditLogs, setSystemMaintenanceMode, getEvaluationWindow, getEvaluationCycles, startEvaluationCycle, resetEvaluationCycle, setEvaluationWindow, getSecurityScore, getApiToken, rotateApiToken, getMfaToggle, setMfaToggle, getDatabaseHealth, createCollege, updateCollege, deleteCollege, getColleges, getManagementRoleOccupant, assignRoleWithHierarchy, resetManagementRole, resetUserPassword, resetUserPasswordDirectly, getRoleCandidates } = require('../controllers/adminController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

router.get('/dashboard-stats', authenticateToken, authorizeRoles('admin', 'systemadmin'), getAdminDashboardStats);
router.get('/broadcasts', authenticateToken, authorizeRoles('admin', 'systemadmin'), getBroadcastHistory);
router.post('/broadcasts', authenticateToken, authorizeRoles('admin', 'systemadmin'), sendBroadcast);
router.delete('/broadcasts/:id', authenticateToken, authorizeRoles('admin', 'systemadmin'), deleteBroadcast);
router.get('/department-analytics', authenticateToken, authorizeRoles('admin', 'systemadmin'), getDepartmentAnalytics);
router.get('/security-logs', authenticateToken, authorizeRoles('admin', 'systemadmin'), getSecurityLogs);
router.get('/audit-logs', authenticateToken, authorizeRoles('admin', 'systemadmin'), getAuditLogs);
router.get('/security-score', authenticateToken, authorizeRoles('admin', 'systemadmin'), getSecurityScore);
router.get('/api-token', authenticateToken, authorizeRoles('admin', 'systemadmin'), getApiToken);
router.post('/api-token/rotate', authenticateToken, authorizeRoles('admin', 'systemadmin'), rotateApiToken);
router.get('/mfa-toggle', authenticateToken, authorizeRoles('admin', 'systemadmin'), getMfaToggle);
router.post('/mfa-toggle', authenticateToken, authorizeRoles('admin', 'systemadmin'), setMfaToggle);
router.get('/db-health', authenticateToken, authorizeRoles('admin', 'systemadmin'), getDatabaseHealth);
router.post('/system/maintenance', authenticateToken, authorizeRoles('admin', 'systemadmin'), setSystemMaintenanceMode);
router.get('/system/evaluation-window', authenticateToken, getEvaluationWindow);
router.get('/system/evaluation-cycles', authenticateToken, authorizeRoles('admin', 'systemadmin'), getEvaluationCycles);
router.post('/system/evaluation-cycles', authenticateToken, authorizeRoles('admin', 'systemadmin'), startEvaluationCycle);
router.post('/system/evaluation-cycle/reset', authenticateToken, authorizeRoles('admin', 'systemadmin'), resetEvaluationCycle);
router.put('/system/evaluation-window', authenticateToken, authorizeRoles('admin', 'systemadmin'), setEvaluationWindow);
router.get('/colleges', authenticateToken, authorizeRoles('admin', 'systemadmin'), getColleges);
router.post('/colleges', authenticateToken, authorizeRoles('admin', 'systemadmin'), createCollege);
router.put('/colleges/:id', authenticateToken, authorizeRoles('admin', 'systemadmin'), updateCollege);
router.delete('/colleges/:id', authenticateToken, authorizeRoles('admin', 'systemadmin'), deleteCollege);
router.get('/management-role-occupant', authenticateToken, authorizeRoles('admin', 'systemadmin'), getManagementRoleOccupant);
router.put('/users/:id/management-role', authenticateToken, authorizeRoles('admin', 'systemadmin'), assignRoleWithHierarchy);
router.put('/users/:id/management-role/reset', authenticateToken, authorizeRoles('admin', 'systemadmin'), resetManagementRole);
router.put('/users/:id/password/reset', authenticateToken, authorizeRoles('admin', 'systemadmin'), resetUserPassword);
router.post('/reset-user-password', authenticateToken, authorizeRoles('super_admin', 'admin', 'systemadmin'), resetUserPasswordDirectly);
router.get('/role-candidates', authenticateToken, authorizeRoles('admin', 'systemadmin'), getRoleCandidates);
router.get('/registered-users/export', authenticateToken, authorizeRoles('admin', 'systemadmin'), async (req, res) => {
  const role = String(req.query.role || '').trim().toLowerCase();
  const exportableRoles = ['instructor', 'lab_assistant', 'student'];
  if (!exportableRoles.includes(role)) {
    return res.status(400).json({ message: 'Select a supported registration type to export.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT
        COALESCE(i.first_name, s.first_name, '') AS first_name,
        COALESCE(i.last_name, s.last_name, '') AS last_name,
        COALESCE(i.gender, s.gender, '') AS gender,
        COALESCE(d.name, d.department_name, '') AS department,
        u.username AS registration_username,
        COALESCE(i.phone_number, s.phone_number, '') AS phone_number
      FROM users u
      LEFT JOIN instructors i ON i.user_id = u.id
      LEFT JOIN students s ON s.user_id = u.id
      LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id, u.department_id)
      WHERE LOWER(TRIM(u.role)) = ?
      ORDER BY u.id DESC`,
      [role],
    );

    const columns = [
      ['First Name', 'first_name'],
      ['Last Name', 'last_name'],
      ['Gender', 'gender'],
      ['Department', 'department'],
      ['Username', 'registration_username'],
      ['Phone Number', 'phone_number'],
    ];
    const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      columns.map(([label]) => escapeCsv(label)).join(','),
      ...rows.map((row) => columns.map(([, key]) => escapeCsv(row[key])).join(',')),
    ].join('\r\n');

    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${role}-registered-data.csv"`,
      'Cache-Control': 'no-store',
    });
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('Failed to export registered users:', error);
    return res.status(500).json({ message: 'Unable to export registered data.' });
  }
});

module.exports = router;