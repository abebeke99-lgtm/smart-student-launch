const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const adminRoutes = require('../routes/adminRoutes');
const secureRoutes = require('../routes/secureRoutes');

const originalQuery = pool.query;
const originalGetConnection = pool.getConnection;
const token = jwt.sign(
  { id: 42, role: 'systemadmin' },
  process.env.JWT_SECRET || 'change-this-secret',
  { expiresIn: '1h' }
);
const adminToken = jwt.sign(
  { id: 43, role: 'admin' },
  process.env.JWT_SECRET || 'change-this-secret',
  { expiresIn: '1h' }
);

(async () => {
  try {
    pool.query = async (...args) => {
      const sql = String(args[0] || '');
      if (sql.includes('SELECT COALESCE(i.department_id, s.department_id) AS department_id')) {
        return [[{ department_id: null }]];
      }

      if (sql.includes('FROM users u') && sql.includes('LEFT JOIN instructors i')) {
        return [[]];
      }

      return [[]];
    };

    let responseStatus = null;
    let responseBody = null;

    const req = {
      method: 'GET',
      url: '/users',
      headers: { authorization: `Bearer ${token}` },
      query: {},
      user: { id: 42, role: 'systemadmin' },
    };

    const res = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    await new Promise((resolve, reject) => {
      secureRoutes.handle(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    assert.notEqual(responseStatus, 403, 'systemadmin should be allowed to access secure user management routes');
    assert.deepEqual(responseBody, [], 'systemadmin should receive user list data without a forbidden response');

    const transactionQueries = [];
    pool.query = async (...args) => {
      const sql = String(args[0] || '');
      if (sql.includes('SELECT role, department_id FROM users WHERE id = ? LIMIT 1')) {
        return [[{ role: 'instructor', department_id: 7 }]];
      }
      if (sql.includes('SELECT id FROM departments WHERE id = ? LIMIT 1')) {
        return [[{ id: 7 }]];
      }
      return [[]];
    };
    pool.getConnection = async () => ({
      beginTransaction: async () => {},
      query: async (...args) => {
        const sql = String(args[0] || '');
        transactionQueries.push(sql);
        return sql.includes('SELECT id FROM instructors') ? [[]] : [{ affectedRows: 1 }];
      },
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    });

    responseStatus = null;
    responseBody = null;
    const updateReq = {
      method: 'PUT',
      url: '/users/57',
      headers: { authorization: `Bearer ${token}` },
      body: {
        role: 'instructor',
        username: 'instructor57',
        first_name: 'Abbu',
        last_name: 'Blay',
        phone_number: '0938514517',
        department_id: 7,
        gender: 'Male',
        status: 'active',
      },
      user: { id: 42, role: 'systemadmin' },
    };
    await new Promise((resolve, reject) => {
      secureRoutes.handle(updateReq, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    assert.equal(responseStatus, null, 'instructor update should succeed when its profile row is missing');
    assert.match(responseBody.message, /Instructor updated successfully/);
    assert.ok(transactionQueries.some((sql) => sql.includes('INSERT INTO instructors')),
      'missing instructor profile should be inserted during the update');

    responseStatus = null;
    responseBody = null;
    const assignmentsReq = {
      method: 'GET',
      url: '/users/57/course-assignments',
      headers: { authorization: `Bearer ${token}` },
      query: {},
      user: { id: 42, role: 'systemadmin' },
    };
    await new Promise((resolve, reject) => {
      adminRoutes.handle(assignmentsReq, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    assert.equal(responseStatus, null, 'missing instructor profile should not fail assignment loading');
    assert.deepEqual(responseBody, { departmentName: '', assignments: [] });

    pool.query = async (sql) => {
      if (String(sql).includes('FROM audit_logs')) {
        return [[{
          id: 9,
          action_title: 'LOGIN',
          description: 'test login',
          performed_by: 'test-user',
          ip_address: '192.0.2.10',
          user_agent: 'Test Browser',
          device_id: 'test-device-id',
          network_interface_name: 'Ethernet',
          network_interface_mac: '00:11:22:33:44:55',
          created_at: new Date('2026-10-01T00:00:00Z'),
        }]];
      }
      return [{ affectedRows: 1 }];
    };
    responseStatus = null;
    responseBody = null;
    const auditReq = {
      method: 'GET',
      url: '/audit-logs',
      headers: { authorization: `Bearer ${token}` },
      query: {},
      user: { id: 42, role: 'systemadmin' },
    };
    await new Promise((resolve, reject) => {
      adminRoutes.handle(auditReq, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    assert.equal(responseBody.data[0].user_agent, 'Test Browser');
    assert.equal(responseBody.data[0].device_id, 'test-device-id');
    assert.equal(responseBody.data[0].network_interface_mac, '00:11:22:33:44:55');

    let deleteSql = '';
    let deleteParams = [];
    pool.query = async (sql, params) => {
      deleteSql = String(sql);
      deleteParams = params;
      return [{ affectedRows: 1 }];
    };
    responseStatus = null;
    responseBody = null;
    const deleteReq = {
      method: 'DELETE',
      url: '/users/57',
      headers: { authorization: `Bearer ${token}` },
      query: {},
      user: { id: 42, role: 'systemadmin' },
    };
    await new Promise((resolve, reject) => {
      secureRoutes.handle(deleteReq, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    assert.match(deleteSql, /DELETE FROM users WHERE id = \?/i,
      'user deletion should physically delete the database row');
    assert.deepEqual(deleteParams, [57]);
    assert.match(responseBody.message, /deleted successfully/i);

    responseStatus = null;
    responseBody = null;
    const adminDeleteReq = {
      method: 'DELETE',
      url: '/users/58',
      headers: { authorization: `Bearer ${adminToken}` },
      query: {},
      user: { id: 43, role: 'admin' },
    };
    await new Promise((resolve, reject) => {
      secureRoutes.handle(adminDeleteReq, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
    });

    assert.equal(responseStatus, null, 'authenticated admin should be allowed to delete a user');
    assert.match(deleteSql, /DELETE FROM users WHERE id = \?/i);
    assert.deepEqual(deleteParams, [58]);
    assert.match(responseBody.message, /deleted successfully/i);
  } catch (error) {
    console.error('secureRoutes systemadmin access test failed:', error);
    process.exitCode = 1;
  } finally {
    pool.query = originalQuery;
    pool.getConnection = originalGetConnection;
  }
})();
