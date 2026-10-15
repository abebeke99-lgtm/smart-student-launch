const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../config/db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const { getActiveEvaluationCycle } = require('../config/evaluationCycles');
const { ensureUserProfileSettings } = require('../utils/profileSettings');
const {
  isAllowedDepartmentHeadTargetRole,
  normalizeRole,
} = require('../utils/departmentHeadEvaluation');
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const allowedPhotoTypes = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (allowedPhotoTypes[file.mimetype]) return callback(null, true);
    return callback(new Error('Upload a JPG, PNG, WEBP, GIF, or AVIF image.'));
  },
});
const ADMIN_DEFAULT_PASSWORD = process.env.ADMIN_DEFAULT_PASSWORD || 'admin@123';
const USER_DEFAULT_PASSWORD = process.env.USER_DEFAULT_PASSWORD || process.env.DEFAULT_PASSWORD || '12345678';
const parseIsLab = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  if (['true', '1', 'yes', 'y', 'lab', 'lab class'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'lecture', 'lecture course'].includes(normalized)) return false;
  return null;
};
const isValidName = (value) => {
  const normalized = String(value || '').trim();
  return normalized.length >= 3 && normalized.length <= 30;
};
const isValidPhoneNumber = (value) => /^(09|07)\d{8}$/.test(String(value || '').trim());
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const saveProfileEmail = async (connection, userId, email) => {
  if (email === undefined) return;
  const normalizedEmail = String(email || '').trim().toLowerCase() || null;
  await connection.query(
    `INSERT INTO user_profile_settings (user_id, email)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email)`,
    [userId, normalizedEmail],
  );
};

const getDefaultPasswordForRole = (role) => {
  if (String(role || '').toLowerCase() === 'admin') return ADMIN_DEFAULT_PASSWORD;
  return USER_DEFAULT_PASSWORD;
};

router.use(authenticateToken);
router.use(authorizeRoles('admin', 'systemadmin', 'dept_head', 'department_head'));

const resolveDepartmentId = async (value) => {
  if (value == null) return null;
  const candidate = String(value).trim();
  if (!candidate) return null;

  const numericId = Number(candidate);
  if (Number.isFinite(numericId) && Number.isInteger(numericId) && numericId > 0) {
    const [rows] = await pool.query('SELECT id FROM departments WHERE id = ? LIMIT 1', [numericId]);
    if (rows.length) return rows[0].id;
  }

  const lowerCandidate = candidate.toLowerCase();
  const [rows] = await pool.query(
    'SELECT id FROM departments WHERE LOWER(name) = ? OR LOWER(code) = ? LIMIT 1',
    [lowerCandidate, lowerCandidate]
  );

  return rows.length ? rows[0].id : null;
};

const findExistingDepartmentHead = async (department, excludeUserId = null) => {
  if (!department || !String(department).trim()) return null;

  const resolvedDepartmentId = await resolveDepartmentId(department);
  if (!resolvedDepartmentId) {
    return null;
  }

  const query = `SELECT u.id FROM users u
    INNER JOIN instructors i ON u.id = i.user_id
    WHERE i.department_id = ? AND u.role = ? AND u.status != ?${excludeUserId ? ' AND u.id != ?' : ''} LIMIT 1`;
  const params = [resolvedDepartmentId, 'dept_head', 'inactive'];
  if (excludeUserId) params.push(excludeUserId);
  const [rows] = await pool.query(query, params);
  if (rows.length) return rows[0];

  // Fallback: if a dept_head user exists without an instructor row, check legacy department text field
  const legacyQuery = `SELECT id FROM users WHERE department = ? AND role = ? AND status != ?${excludeUserId ? ' AND id != ?' : ''} LIMIT 1`;
  const legacyParams = [String(department).trim(), 'dept_head', 'inactive'];
  if (excludeUserId) legacyParams.push(excludeUserId);
  const [legacyRows] = await pool.query(legacyQuery, legacyParams);
  return legacyRows.length ? legacyRows[0] : null;
};

router.get('/users', async (req, res) => {
  try {
    const { role, year_level, year, section, department, department_id, search } = req.query;

    const whereClauses = [];
    const params = [];

    if (role) {
      const normalizedRole = String(role).trim().toLowerCase();
      if (['instructors', 'instructor_staff'].includes(normalizedRole)) {
        whereClauses.push(`LOWER(TRIM(u.role)) IN (
          'instructor', 'academic_directorate', 'academic_director', 'directorate',
          'college_dean', 'dean', 'dept_head', 'department_head',
          'lab_assistant', 'ara', 'lab assistant', 'lab-assistant'
        )`);
      } else {
        whereClauses.push('LOWER(TRIM(u.role)) = ?');
        params.push(normalizedRole);
      }
    }

    if (req.user.role === 'dept_head') {
      const currentDepartmentId = await resolveDepartmentId(req.user.department_id || req.user.departmentId || req.user.department);
      if (!currentDepartmentId) {
        return res.status(403).json({ message: 'Your department is not defined. Contact an administrator.' });
      }
      whereClauses.push('(i.department_id = ? OR s.department_id = ? OR u.department_id = ?)');
      params.push(currentDepartmentId, currentDepartmentId, currentDepartmentId);
    } else if (department_id) {
      whereClauses.push('(i.department_id = ? OR s.department_id = ? OR u.department_id = ?)');
      params.push(department_id, department_id, department_id);
    } else if (department) {
      whereClauses.push('(d.name = ? OR d.code = ? OR i.department_id = ? OR s.department_id = ? OR u.department_id = ?)');
      const departmentValue = String(department).trim();
      params.push(departmentValue, departmentValue, departmentValue, departmentValue, departmentValue);
    }

    const resolvedYear = year_level || year;
    if (resolvedYear) {
      whereClauses.push('s.year_level = ?');
      params.push(String(resolvedYear).trim());
    }

    if (section) {
      whereClauses.push('s.section = ?');
      params.push(String(section).trim());
    }

    if (search) {
      const term = `%${String(search).trim()}%`;
      whereClauses.push(`(u.username LIKE ? OR i.phone_number LIKE ? OR s.student_id LIKE ?
        OR CONCAT_WS(' ', i.first_name, i.last_name) LIKE ? OR CONCAT_WS(' ', s.first_name, s.last_name) LIKE ?)`);
      params.push(term, term, term, term, term);
    }

    const query = `SELECT u.id,
      i.id AS instructor_id,
      u.username,
      u.role,
      u.status,
      '' AS department,
      COALESCE(d.name, '') AS department_name,
      '' AS college,
      '' AS academic_year,
      COALESCE(s.semester, '') AS semester,
      COALESCE(s.year_level, '') AS year,
      COALESCE(s.section, '') AS section,
      '' AS specialization,
      '' AS learning_level,
      COALESCE(s.student_id, '') AS student_id,
      COALESCE(s.phone_number, i.phone_number, '') AS phone_number,
      COALESCE(i.gender, s.gender, '') AS gender,
      COALESCE(s.program_type, '') AS program_type,
      COALESCE(u.created_at, '') AS registration_date,
      COALESCE(CONCAT(i.first_name, ' ', i.last_name), CONCAT(s.first_name, ' ', s.last_name), u.username) AS full_name,
      COALESCE(i.first_name, s.first_name, '') AS first_name,
      COALESCE(i.last_name, s.last_name, '') AS last_name,
      COALESCE(i.department_id, s.department_id, u.department_id) AS department_id,
      ups.profile_picture
      FROM users u
      LEFT JOIN instructors i ON u.id = i.user_id
      LEFT JOIN students s ON u.id = s.user_id
      LEFT JOIN user_profile_settings ups ON ups.user_id = u.id
      LEFT JOIN departments d ON d.id = COALESCE(i.department_id, s.department_id, u.department_id)
      ${whereClauses.length ? ' WHERE ' + whereClauses.join(' AND ') : ''}
      ORDER BY u.id DESC`;
    const [rows] = await pool.query(query, params);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

router.post('/users', async (req, res) => {
  try {
    const {
      full_name,
      email,
      username,
      password,
      role = 'student',
      department,
      department_id,
      department_name,
      phone_number,
      college,
      academic_year,
      semester,
      year,
      section,
      specialization,
      learning_level,
      student_id,
      program_type,
      gender,
    } = req.body;

    const errors = {};
    if (!isValidName(full_name)) errors.full_name = 'full_name must be between 3 and 30 characters';
    if (!username || !String(username).trim()) errors.username = 'username is required';
    if (email && (String(email).trim().length > 254 || !isValidEmail(email))) errors.email = 'email must be a valid email address';
    if (['instructor', 'lab_assistant', 'dept_head'].includes(role) && !isValidPhoneNumber(phone_number)) errors.phone_number = 'phone_number must start with 09 or 07 and contain exactly 10 digits';
    if (role === 'student' && (!section || !String(section).trim())) errors.section = 'section is required for students';
    if (role === 'student' && (!year || !String(year).trim())) errors.year = 'year is required for students';

    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    const passwordValue = typeof password === 'string' && password.trim() ? password.trim() : getDefaultPasswordForRole(role);
    const hashedPassword = await bcrypt.hash(String(passwordValue).trim(), 10);
    const userFields = {
      username: String(username).trim(),
      password_hash: hashedPassword,
      role,
      is_first_login: 1,
      gender: typeof gender === 'string' && gender.trim() ? gender.trim() : null,
    };
    const profileFields = {
      full_name: String(full_name).trim(),
      email: typeof email === 'string' && email.trim() ? email.trim() : null,
      department: typeof department === 'string' && department.trim() ? department.trim() : null,
      department_name: typeof department_name === 'string' && department_name.trim() ? department_name.trim() : null,
      college: typeof college === 'string' && college.trim() ? college.trim() : null,
      academic_year: typeof academic_year === 'string' && academic_year.trim() ? academic_year.trim() : null,
      semester: typeof semester === 'string' && semester.trim() ? semester.trim() : null,
      year: typeof year === 'string' && year.trim() ? year.trim() : null,
      section: typeof section === 'string' && section.trim() ? section.trim() : null,
      specialization: typeof specialization === 'string' && specialization.trim() ? specialization.trim() : null,
      learning_level: typeof learning_level === 'string' && learning_level.trim() ? learning_level.trim() : null,
      student_id: typeof student_id === 'string' && student_id.trim() ? student_id.trim() : null,
      program_type: typeof program_type === 'string' && program_type.trim() ? program_type.trim() : null,
      gender: typeof gender === 'string' && gender.trim() ? gender.trim() : null,
    };

    const resolvedDepartmentId = await resolveDepartmentId(department_id ?? department ?? department_name);
    const [[departmentRow]] = resolvedDepartmentId
      ? await pool.query('SELECT college_id FROM departments WHERE id = ? LIMIT 1', [resolvedDepartmentId])
      : [[]];
    userFields.college_id = departmentRow?.college_id || null;
    if (role === 'dept_head') {
      if (!resolvedDepartmentId) {
        return res.status(400).json({ message: 'Please select a valid department before assigning a Department Head.' });
      }

      const existing = await findExistingDepartmentHead(resolvedDepartmentId);
      if (existing) {
        return res.status(409).json({ message: 'Department Head already exists for this department. Please update or reassign the existing Department Head.' });
      }
    }

    if (email && String(email).trim()) {
      await ensureUserProfileSettings();
      const [[emailOwner]] = await pool.query(
        "SELECT user_id FROM user_profile_settings WHERE LOWER(TRIM(email)) = ? LIMIT 1",
        [String(email).trim().toLowerCase()],
      );
      if (emailOwner) {
        return res.status(409).json({ message: 'That email address is already linked to another account.' });
      }
    }

    // Use transaction to create user and role-specific records
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const columns = Object.keys(userFields);
      const values = columns.map((column) => userFields[column]);
      const placeholders = columns.map(() => '?').join(', ');
      const [result] = await conn.query(`INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders})`, values);
      const newUserId = result.insertId;

      if (profileFields.email) {
        await conn.query(
          `INSERT INTO user_profile_settings (user_id, full_name, email)
           VALUES (?, ?, ?)`,
          [newUserId, profileFields.full_name, profileFields.email.toLowerCase()],
        );
      }

      if (role === 'student') {
        // insert into students table
        const studentInsert = `INSERT INTO students (user_id, student_id, first_name, last_name, department_id, semester, year_level, section, program_type, gender) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const studentValues = [
          newUserId,
          profileFields.student_id || null,
          profileFields.full_name || null,
          null,
          resolvedDepartmentId || null,
          profileFields.semester || null,
          profileFields.year || null,
          profileFields.section || null,
          profileFields.program_type || null,
          profileFields.gender || null,
        ];
        await conn.query(studentInsert, studentValues);
      } else if (role === 'instructor' || role === 'dept_head') {
        const instructorInsert = `INSERT INTO instructors (user_id, phone_number, first_name, last_name, department_id, gender) VALUES (?, ?, ?, ?, ?, ?)`;
        const instructorValues = [
          newUserId,
          profileFields.phone_number || null,
          profileFields.full_name || null,
          null,
          resolvedDepartmentId || null,
          profileFields.gender || null,
        ];
        await conn.query(instructorInsert, instructorValues);
      }

      await conn.commit();
      res.status(201).json({ id: newUserId, message: 'User created successfully' });
    } catch (sqlErr) {
      try { await conn.rollback(); } catch (e) {}
      console.error('Secure user creation transaction failed:', sqlErr);
      return res.status(500).json({ message: 'Failed to create user', error: sqlErr.message });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error('Secure user creation failed:', error);
    res.status(500).json({ message: 'Failed to create user', error: error.message, code: error.code, sql: error.sql });
  }
});

router.put('/users/:id', profilePhotoUpload.single('photo'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const {
      full_name,
      email,
      username,
      password,
      role,
      first_name,
      last_name,
      department,
      department_id,
      department_name,
      phone_number,
      college,
      academic_year,
      semester,
      year,
      section,
      specialization,
      learning_level,
      student_id,
      program_type,
      gender,
      status,
    } = req.body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : undefined;

    const [existingUserRows] = await pool.query('SELECT role, department_id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!existingUserRows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateProfilePhoto = async (connection = pool) => {
      if (!req.file) return;
      const extension = allowedPhotoTypes[req.file.mimetype];
      const filename = `user-${userId}-${Date.now()}${extension}`;
      req.file.filename = filename;
      await connection.query(
        `INSERT INTO user_profile_settings
          (user_id, profile_picture, profile_picture_data, profile_picture_mime_type)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          profile_picture = VALUES(profile_picture),
          profile_picture_data = VALUES(profile_picture_data),
          profile_picture_mime_type = VALUES(profile_picture_mime_type)`,
        [userId, `/uploads/profile/${filename}`, req.file.buffer, req.file.mimetype],
      );
    };

    const currentUser = existingUserRows[0];
    const isAdmin = ['admin', 'systemadmin'].includes(String(req.user?.role || '').trim().toLowerCase());
    if (!isAdmin && ['username', 'email', 'full_name', 'first_name', 'last_name'].some((field) => req.body?.[field] !== undefined)) {
      return res.status(403).json({ message: 'Only an administrator can change account names, usernames, or email addresses.' });
    }
    const newRole = typeof role === 'string' && role.trim() ? role.trim() : currentUser.role;
    const isPhotoOnlyUpdate = Boolean(req.file && !Object.keys(req.body || {}).length);
    const instructorRoles = ['instructor', 'lab_assistant', 'dept_head', 'college_dean', 'academic_directorate'];
    const normalizedDepartment = department !== undefined && String(department).trim() ? String(department).trim() : currentUser.department_id;
    const legacyNameParts = String(full_name || '').trim().split(/\s+/).filter(Boolean);
    const firstName = typeof first_name === 'string' && first_name.trim() ? first_name.trim() : legacyNameParts[0] || '';
    const lastName = typeof last_name === 'string' && last_name.trim() ? last_name.trim() : legacyNameParts.slice(1).join(' ');
    const normalizedFullName = `${firstName} ${lastName}`.trim();
    const isEmailOnlyUpdate = normalizedEmail !== undefined
      && Object.keys(req.body || {}).every((key) => key === 'email');

    const errors = {};
    if (username !== undefined && !username?.trim()) errors.username = 'username is required';
    if ((first_name !== undefined || last_name !== undefined || full_name !== undefined)
      && (!firstName || !lastName || !isValidName(normalizedFullName))) {
      errors.first_name = 'first_name and last_name must form a name between 3 and 30 characters';
    }
    if (instructorRoles.includes(newRole) && phone_number !== undefined && !isValidPhoneNumber(phone_number)) errors.phone_number = 'phone_number must start with 09 or 07 and contain exactly 10 digits';
    if (normalizedEmail && (normalizedEmail.length > 254 || !isValidEmail(normalizedEmail))) errors.email = 'email must be a valid email address';
    if (newRole === 'student' && (section === undefined || !String(section).trim())) errors.section = 'section is required for students';
    if (newRole === 'student' && (year === undefined || !String(year).trim())) errors.year = 'year is required for students';

    if (Object.keys(errors).length) {
      return res.status(400).json({ message: 'Validation failed', errors });
    }

    if (normalizedEmail !== undefined) {
      await ensureUserProfileSettings();
      if (normalizedEmail) {
        const [[emailOwner]] = await pool.query(
          'SELECT user_id FROM user_profile_settings WHERE LOWER(TRIM(email)) = ? AND user_id <> ? LIMIT 1',
          [normalizedEmail, userId],
        );
        if (emailOwner) {
          return res.status(409).json({ message: 'That email address is already linked to another account.' });
        }
      }
    }

    if (newRole === 'dept_head') {
      const resolvedDepartmentId = await resolveDepartmentId(department_id ?? department ?? currentUser.department_id);
      if (!resolvedDepartmentId) {
        return res.status(400).json({ message: 'Please select a valid department before assigning a Department Head.' });
      }

      const existing = await findExistingDepartmentHead(resolvedDepartmentId, userId);
      if (existing) {
        return res.status(409).json({ message: 'Department Head already exists for this department. Please update or reassign the existing Department Head.' });
      }
    }

    if (newRole === 'student' && !isPhotoOnlyUpdate && !isEmailOnlyUpdate) {
      const resolvedDepartmentId = await resolveDepartmentId(department_id ?? department ?? currentUser.department_id);
      const studentId = typeof student_id === 'string' && student_id.trim() ? student_id.trim() : null;
      if (!studentId || !firstName || !lastName || !resolvedDepartmentId || !String(year || '').trim() || !String(section || '').trim()) {
        return res.status(400).json({ message: 'student_id, first_name, last_name, department_id, year, and section are required for students.' });
      }

      if (req.file) await ensureUserProfileSettings();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [studentResult] = await connection.query(
          `UPDATE students
           SET student_id = ?, phone_number = ?, first_name = ?, last_name = ?, department_id = ?, semester = ?, year_level = ?, section = ?, program_type = ?, gender = COALESCE(?, gender)
           WHERE user_id = ?`,
          [studentId, phone_number || null, firstName, lastName, resolvedDepartmentId, semester || null, year, section, program_type || 'regular', typeof gender === 'string' && gender.trim() ? gender.trim() : null, userId]
        );
        if (!studentResult.affectedRows) {
          await connection.rollback();
          return res.status(404).json({ message: 'Student record not found.' });
        }
        await connection.query('UPDATE users SET username = ?, department_id = ?, status = ? WHERE id = ?', [studentId, resolvedDepartmentId, status || 'active', userId]);
        await updateProfilePhoto(connection);
        await saveProfileEmail(connection, userId, normalizedEmail);
        await connection.commit();
        return res.json({ id: userId, student_id: studentId, profile_picture: req.file ? `/uploads/profile/${req.file.filename}` : undefined, message: 'Student updated successfully.' });
      } catch (studentError) {
        await connection.rollback();
        throw studentError;
      } finally {
        connection.release();
      }
    }

    if (instructorRoles.includes(newRole) && !isPhotoOnlyUpdate && !isEmailOnlyUpdate) {
      const resolvedDepartmentId = await resolveDepartmentId(department_id ?? department ?? currentUser.department_id);
      if (!firstName || !lastName || !resolvedDepartmentId || !String(phone_number || '').trim()) {
        return res.status(400).json({ message: 'first_name, last_name, phone_number, and department_id are required for instructors.' });
      }
      if (req.file) await ensureUserProfileSettings();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [instructorResult] = await connection.query(
          `UPDATE instructors
           SET phone_number = ?, first_name = ?, last_name = ?, department_id = ?, gender = COALESCE(?, gender)
           WHERE user_id = ?`,
          [String(phone_number).trim(), firstName, lastName, resolvedDepartmentId, typeof gender === 'string' && gender.trim() ? gender.trim() : null, userId]
        );
        if (!instructorResult.affectedRows) {
          await connection.rollback();
          return res.status(404).json({ message: 'Instructor record not found.' });
        }
        await connection.query('UPDATE users SET department_id = ?, status = ? WHERE id = ?', [resolvedDepartmentId, status || 'active', userId]);
        await updateProfilePhoto(connection);
        await saveProfileEmail(connection, userId, normalizedEmail);
        await connection.commit();
        return res.json({ id: userId, profile_picture: req.file ? `/uploads/profile/${req.file.filename}` : undefined, message: 'Instructor updated successfully.' });
      } catch (instructorError) {
        await connection.rollback();
        throw instructorError;
      } finally {
        connection.release();
      }
    }

    const userFields = {
      username: typeof username === 'string' && username.trim() ? username.trim() : undefined,
      password_hash: typeof password === 'string' && password.trim() ? await bcrypt.hash(password.trim(), 10) : undefined,
      role: typeof role === 'string' && role.trim() ? role.trim() : undefined,
      department: normalizedDepartment,
      department_name: typeof department_name === 'string' && department_name.trim() ? department_name.trim() : undefined,
      college: typeof college === 'string' && college.trim() ? college.trim() : undefined,
      academic_year: typeof academic_year === 'string' && academic_year.trim() ? academic_year.trim() : undefined,
      semester: typeof semester === 'string' && semester.trim() ? semester.trim() : undefined,
      year: typeof year === 'string' && year.trim() ? year.trim() : undefined,
      section: typeof section === 'string' && section.trim() ? section.trim() : undefined,
      specialization: typeof specialization === 'string' && specialization.trim() ? specialization.trim() : undefined,
      learning_level: typeof learning_level === 'string' && learning_level.trim() ? learning_level.trim() : undefined,
      student_id: typeof student_id === 'string' && student_id.trim() ? student_id.trim() : undefined,
      gender: typeof gender === 'string' && gender.trim() ? gender.trim() : undefined,
      status: typeof status === 'string' && status.trim() ? status.trim() : undefined,
    };

    const updateEntries = Object.entries(userFields).filter(([, value]) => value !== undefined);
    if (!updateEntries.length && !req.file && normalizedEmail === undefined) {
      return res.status(400).json({ message: 'No valid fields provided to update' });
    }

    if (req.file) await ensureUserProfileSettings();
    if (updateEntries.length) {
      const updateClause = updateEntries.map(([key]) => `${key} = ?`).join(', ');
      const updateValues = updateEntries.map(([, value]) => value);
      updateValues.push(userId);

      const [result] = await pool.query(`UPDATE users SET ${updateClause} WHERE id = ?`, updateValues);
      if (!result.affectedRows) {
        return res.status(404).json({ message: 'User not found' });
      }
    }
    await updateProfilePhoto();
    if (normalizedEmail !== undefined) {
      await saveProfileEmail(pool, userId, normalizedEmail);
    }

    if (['instructor', 'lab_assistant', 'dept_head'].includes(newRole) && phone_number !== undefined) {
      await pool.query('UPDATE instructors SET phone_number = ? WHERE user_id = ?', [String(phone_number).trim(), userId]);
    }

    res.json({ id: userId, profile_picture: req.file ? `/uploads/profile/${req.file.filename}` : undefined, message: 'User updated successfully' });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('Secure user update failed:', error);
    res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    if (!result.affectedRows) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Secure user delete failed:', error);
    res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
});

router.get('/courses', async (req, res) => {
  try {
    const { department_id } = req.query;
    const whereClauses = [];
    const params = [];

    if (req.user.role === 'dept_head') {
      const currentDepartmentId = await resolveDepartmentId(req.user.department_id || req.user.departmentId || req.user.department);
      if (!currentDepartmentId) {
        return res.status(403).json({ message: 'Your department is not defined. Contact an administrator.' });
      }
      whereClauses.push('c.department_id = ?');
      params.push(currentDepartmentId);
    } else if (department_id) {
      whereClauses.push('c.department_id = ?');
      params.push(department_id);
    }

    const [departmentColumns] = await pool.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'departments'
         AND COLUMN_NAME IN ('name', 'department_name')
       ORDER BY FIELD(COLUMN_NAME, 'name', 'department_name')
       LIMIT 1`
    );

    const departmentNameColumn = departmentColumns.length
      ? (departmentColumns[0].COLUMN_NAME === 'department_name' ? 'd.department_name' : 'd.name')
      : "'N/A'";

    const query = `
      SELECT
        c.id,
        c.code,
        c.name,
        c.department_id,
        c.year_level,
        c.semester,
        c.credit_hours,
        CASE WHEN lc.course_id IS NULL THEN 0 ELSE 1 END AS is_lab,
        lc.section AS section,
        ${departmentNameColumn} AS department_name
      FROM courses c
      LEFT JOIN lab_classes lc ON lc.course_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      ${whereClauses.length ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      ORDER BY c.id DESC
    `;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching courses:', error.message);
    res.status(500).json({ message: 'Failed to fetch courses', error: error.message });
  }
});

router.post('/courses/bulk-upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Please choose a CSV file.' });

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: '' }) : [];
    if (!rows.length) return res.status(400).json({ message: 'The CSV file contains no rows.' });

    const normalizeRow = (row) => Object.entries(row).reduce((result, [key, value]) => {
      const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, '_');
      result[normalizedKey] = String(value ?? '').trim();
      return result;
    }, {});
    const normalizedRows = rows.map(normalizeRow);
    const requiredFields = ['course_name', 'course_code', 'credit_hours', 'year_level', 'semester'];
    const missingHeaders = requiredFields.filter((field) => !Object.prototype.hasOwnProperty.call(normalizedRows[0], field));
    if (missingHeaders.length) return res.status(400).json({ message: `Missing required CSV headers: ${missingHeaders.join(', ')}` });

    let departmentId = req.body.department_id || req.body.departmentId || null;
    if (req.user.role === 'dept_head') {
      departmentId = await resolveDepartmentId(req.user.department_id || req.user.departmentId || req.user.department);
      if (!departmentId) return res.status(403).json({ message: 'Your department is not defined. Contact an administrator.' });
    } else if (departmentId) {
      departmentId = await resolveDepartmentId(departmentId);
    }
    if (!departmentId) return res.status(400).json({ message: 'A valid department is required.' });

    const seenCodes = new Set();
    const coursesToCreate = [];
    for (const [index, row] of normalizedRows.entries()) {
      const missingFields = requiredFields.filter((field) => !row[field]);
      const creditHours = Number(row.credit_hours);
      if (missingFields.length) return res.status(400).json({ message: `Row ${index + 2} is missing: ${missingFields.join(', ')}` });
      if (!Number.isInteger(creditHours) || creditHours <= 0) return res.status(400).json({ message: `Row ${index + 2} has invalid credit_hours.` });
      const isLab = parseIsLab(row.is_lab);
      if (isLab === null) return res.status(400).json({ message: `Row ${index + 2} has invalid is_lab. Use true/false, yes/no, or 1/0.` });
      if (isLab && !row.section) return res.status(400).json({ message: `Row ${index + 2} is missing section for a Lab Class.` });
      const code = row.course_code.toLowerCase();
      if (seenCodes.has(code)) return res.status(400).json({ message: `Duplicate course_code in row ${index + 2}: ${row.course_code}` });
      seenCodes.add(code);
      coursesToCreate.push({ name: row.course_name, code: row.course_code, creditHours, yearLevel: row.year_level, semester: row.semester, section: row.section || null, isLab });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const course of coursesToCreate) {
        const [existing] = await connection.query('SELECT id FROM courses WHERE department_id = ? AND LOWER(code) = LOWER(?) LIMIT 1', [departmentId, course.code]);
        if (existing.length) throw new Error(`Course code already exists: ${course.code}`);
      }
      const createdCourses = [];
      for (const course of coursesToCreate) {
        const [result] = await connection.query(
          'INSERT INTO courses (code, name, department_id, year_level, semester, credit_hours) VALUES (?, ?, ?, ?, ?, ?)',
          [course.code, course.name, departmentId, course.yearLevel, course.semester, course.creditHours]
        );
        if (course.isLab) {
          await connection.query(
            `INSERT INTO lab_classes (course_id, section) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE section = VALUES(section)`,
            [result.insertId, course.section],
          );
        }
        createdCourses.push({ id: result.insertId, code: course.code, name: course.name, department_id: departmentId, year_level: course.yearLevel, semester: course.semester, credit_hours: course.creditHours, is_lab: course.isLab, section: course.isLab ? course.section : null });
      }
      await connection.commit();
      return res.status(201).json({ created: createdCourses.length, courses: createdCourses, message: 'Courses uploaded successfully.' });
    } catch (error) {
      await connection.rollback();
      return res.status(400).json({ message: error.message });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Bulk course upload failed:', error);
    return res.status(500).json({ message: 'Unable to upload courses.', error: error.message });
  }
});

router.post('/courses', async (req, res) => {
  try {
    const courseCode = req.body.course_code || req.body.code;
    const courseName = req.body.course_name || req.body.name;
    const departmentId = req.body.department_id ?? req.body.departmentId ?? null;
    const yearLevel = req.body.year_level || null;
    const semester = req.body.semester || null;
    const creditHours = req.body.credit_hours ?? req.body.creditHours ?? null;
    const isLab = parseIsLab(req.body.is_lab);
    const section = String(req.body.section || '').trim() || null;

    if (!courseCode || !courseName) {
      return res.status(400).json({ message: 'course_code and course_name are required' });
    }
    if (isLab === null) return res.status(400).json({ message: 'is_lab must be a boolean value.' });
    if (isLab && !section) return res.status(400).json({ message: 'A section is required for a Lab Class.' });

    if (creditHours !== null && (!Number.isInteger(Number(creditHours)) || Number(creditHours) <= 0)) {
      return res.status(400).json({ message: 'credit_hours must be a positive whole number' });
    }

    if (req.user.role === 'dept_head') {
      const currentDepartmentId = await resolveDepartmentId(req.user.department_id || req.user.departmentId || req.user.department);
      if (!currentDepartmentId || Number(departmentId) !== Number(currentDepartmentId)) {
        return res.status(403).json({ message: 'You can only create courses for your department.' });
      }
    }

    const connection = await pool.getConnection();
    let result;
    try {
      await connection.beginTransaction();
      [result] = await connection.query(
        'INSERT INTO courses (code, name, department_id, year_level, semester, credit_hours) VALUES (?, ?, ?, ?, ?, ?)',
        [courseCode, courseName, departmentId, yearLevel, semester, creditHours || 3]
      );
      if (isLab) {
        await connection.query(
          `INSERT INTO lab_classes (course_id, section) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE section = VALUES(section)`,
          [result.insertId, section],
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.status(201).json({
      id: result.insertId,
      code: courseCode,
      name: courseName,
      department_id: departmentId,
      year_level: yearLevel,
      semester,
      credit_hours: creditHours || 3,
      is_lab: isLab,
      section: isLab ? section : null,
      message: 'Course created successfully',
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create course', error: error.message });
  }
});

router.put('/courses/:id', async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const courseCode = req.body.course_code || req.body.code;
    const courseName = req.body.course_name || req.body.name;
    const departmentId = req.body.department_id ?? req.body.departmentId;
    const yearLevel = req.body.year_level ?? req.body.yearLevel;
    const semester = req.body.semester;
    const creditHours = req.body.credit_hours ?? req.body.creditHours;
    const requestedIsLab = parseIsLab(req.body.is_lab, undefined);
    const requestedSection = Object.prototype.hasOwnProperty.call(req.body, 'section')
      ? String(req.body.section || '').trim() || null
      : undefined;
    if (requestedIsLab === null) return res.status(400).json({ message: 'is_lab must be a boolean value.' });

    if (!Number.isInteger(courseId) || courseId <= 0 || !courseCode || !courseName) {
      return res.status(400).json({ message: 'A valid course id, code, and name are required.' });
    }
    if (creditHours !== undefined && (!Number.isInteger(Number(creditHours)) || Number(creditHours) <= 0)) {
      return res.status(400).json({ message: 'credit_hours must be a positive whole number' });
    }

    const [courseRows] = await pool.query(
      `SELECT c.department_id, (lc.course_id IS NOT NULL) AS is_lab,
              lc.section AS section
       FROM courses c
       LEFT JOIN lab_classes lc ON lc.course_id = c.id
       WHERE c.id = ? LIMIT 1`,
      [courseId],
    );
    if (!courseRows.length) return res.status(404).json({ message: 'Course not found.' });
    if (req.user.role === 'dept_head') {
      const currentDepartmentId = await resolveDepartmentId(req.user.department_id || req.user.departmentId || req.user.department);
      if (!currentDepartmentId || Number(courseRows[0].department_id) !== Number(currentDepartmentId) || Number(departmentId) !== Number(currentDepartmentId)) {
        return res.status(403).json({ message: 'You can only manage courses for your department.' });
      }
    }

    const isLab = requestedIsLab === undefined ? Boolean(courseRows[0].is_lab) : requestedIsLab;
    const section = isLab
      ? requestedSection === undefined
        ? courseRows[0].section
        : requestedSection
      : null;
    if (isLab && !section) return res.status(400).json({ message: 'A section is required for a Lab Class.' });
    const normalizedSection = (value) => String(value || '').replace(/^section\s*/i, '').trim().toLowerCase();
    const labConfigurationChanged = Boolean(courseRows[0].is_lab) !== isLab
      || (isLab && normalizedSection(courseRows[0].section) !== normalizedSection(section));
    if (labConfigurationChanged) {
      const [assignments] = await pool.query(
        'SELECT id FROM course_assignments WHERE course_id = ? LIMIT 1',
        [courseId],
      );
      if (assignments.length) {
        return res.status(409).json({
          message: "Remove this course's assignments before changing its Lab Class type or section.",
        });
      }
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(
        'UPDATE courses SET code = ?, name = ?, department_id = ?, year_level = ?, semester = ?, credit_hours = ? WHERE id = ?',
        [courseCode, courseName, departmentId, yearLevel || null, semester || null, creditHours || 3, courseId]
      );
      if (isLab) {
        await connection.query(
          `INSERT INTO lab_classes (course_id, section) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE section = VALUES(section)`,
          [courseId, section],
        );
      } else {
        await connection.query('DELETE FROM lab_classes WHERE course_id = ?', [courseId]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ id: courseId, code: courseCode, name: courseName, department_id: departmentId, year_level: yearLevel, semester, credit_hours: creditHours || 3, is_lab: isLab, section });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update course', error: error.message });
  }
});

router.delete('/courses/:id', async (req, res) => {
  try {
    const courseId = Number(req.params.id);
    const [courseRows] = await pool.query(
      `SELECT c.department_id, (lc.course_id IS NOT NULL) AS is_lab
       FROM courses c LEFT JOIN lab_classes lc ON lc.course_id = c.id
       WHERE c.id = ? LIMIT 1`,
      [courseId],
    );
    if (!courseRows.length) return res.status(404).json({ message: 'Course not found.' });
    if (req.user.role === 'dept_head') {
      const currentDepartmentId = await resolveDepartmentId(req.user.department_id || req.user.departmentId || req.user.department);
      if (!currentDepartmentId || Number(courseRows[0].department_id) !== Number(currentDepartmentId)) {
        return res.status(403).json({ message: 'You can only manage courses for your department.' });
      }
    }
    if (courseRows[0].is_lab) {
      const [assignments] = await pool.query(
        'SELECT id FROM course_assignments WHERE course_id = ? LIMIT 1',
        [courseId],
      );
      if (assignments.length) {
        return res.status(409).json({
          message: "Remove this Lab Class's assignments before deleting it.",
        });
      }
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM lab_classes WHERE course_id = ?', [courseId]);
      await connection.query('DELETE FROM courses WHERE id = ?', [courseId]);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete course', error: error.message });
  }
});

router.get('/evaluations', async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ success: false, message: 'There is no active evaluation cycle.' });
    }
    const [rows] = await pool.query('SELECT * FROM evaluations WHERE cycle_id = ? ORDER BY id DESC', [activeCycle.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch evaluations', error: error.message });
  }
});

router.post('/evaluations', async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ success: false, message: 'There is no active evaluation cycle.' });
    }
    const { instructor_id, instructor_name, course_code, course_name, average_score = 0, completed = 0, pending = 0, status = 'pending' } = req.body;
    const [result] = await pool.query(
      'INSERT INTO evaluations (cycle_id, instructor_id, instructor_name, course_code, course_name, average_score, completed, pending, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [activeCycle.id, instructor_id, instructor_name, course_code, course_name, average_score, completed, pending, status]
    );

    res.status(201).json({ id: result.insertId, message: 'Evaluation created successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create evaluation', error: error.message });
  }
});

router.get('/submissions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM evaluation_submissions ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch submissions', error: error.message });
  }
});

router.post('/submissions', async (req, res) => {
  try {
    const { submitter_role, submitter_name, instructor_name, course_code, course_name, score = 0, feedback = '', responses = {} } = req.body;
    const [result] = await pool.query(
      'INSERT INTO evaluation_submissions (submitter_role, submitter_name, instructor_name, course_code, course_name, score, feedback, responses) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [submitter_role, submitter_name, instructor_name, course_code, course_name, score, feedback, JSON.stringify(responses)]
    );

    res.status(201).json({ id: result.insertId, message: 'Submission saved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save submission', error: error.message });
  }
});

// Dept Head Evaluations - Submit or update evaluation
router.post('/dept-head/evaluations', async (req, res) => {
  try {
    const requestedTargetRole = req.body?.target_role ?? req.body?.targetRole;
    const isDepartmentHead = normalizeRole(req.user?.role) === 'dept_head';
    if (
      isDepartmentHead &&
      requestedTargetRole !== undefined &&
      !isAllowedDepartmentHeadTargetRole(requestedTargetRole)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Department Heads may only evaluate instructors and lab assistants.',
      });
    }
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ success: false, message: 'There is no active evaluation cycle.' });
    }
    const { evaluator_id, instructor_id, department_id, criteria_scores = {}, total_score = 0 } = req.body;
    let effectiveEvaluatorId = evaluator_id;
    let effectiveDepartmentId = department_id;

    if ((!isDepartmentHead && !evaluator_id) || !instructor_id) {
      return res.status(400).json({ 
        success: false, 
        message: 'evaluator_id and instructor_id are required' 
      });
    }

    if (isDepartmentHead) {
      effectiveEvaluatorId = req.user.id || req.user.user_id;
      effectiveDepartmentId = req.user.department_id;
      const [targetRows] = await pool.query(
        `SELECT i.id, i.department_id, u.role AS target_role
         FROM instructors i
         INNER JOIN users u ON u.id = i.user_id
         WHERE i.id = ? AND i.department_id = ?
           AND i.user_id <> ?
           AND LOWER(COALESCE(u.status, 'active')) = 'active'
         LIMIT 1`,
        [instructor_id, effectiveDepartmentId, effectiveEvaluatorId],
      );
      if (
        !effectiveDepartmentId ||
        !targetRows.length ||
        !isAllowedDepartmentHeadTargetRole(targetRows[0]?.target_role)
      ) {
        return res.status(403).json({
          success: false,
          message: 'You may only evaluate instructors and lab assistants in your department.',
        });
      }
    }

    // Upsert: Try to update existing evaluation, or insert if not exists
    const [existingRows] = await pool.query(
      'SELECT id FROM dept_head_evaluations WHERE evaluator_id = ? AND instructor_id = ? AND cycle_id = ? LIMIT 1',
      [effectiveEvaluatorId, instructor_id, activeCycle.id]
    );

    let result;
    if (existingRows.length > 0) {
      // Update existing evaluation
      [result] = await pool.query(
        `UPDATE dept_head_evaluations 
         SET criteria_scores = ?, total_score = ?, status = ?, updated_at = NOW()
         WHERE id = ?`,
        [JSON.stringify(criteria_scores), total_score, 'Submitted', existingRows[0].id]
      );
    } else {
      // Insert new evaluation
      [result] = await pool.query(
        `INSERT INTO dept_head_evaluations 
         (evaluator_id, instructor_id, department_id, cycle_id, criteria_scores, total_score, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [effectiveEvaluatorId, instructor_id, effectiveDepartmentId, activeCycle.id, JSON.stringify(criteria_scores), total_score, 'Submitted']
      );
    }

    res.status(201).json({ 
      success: true,
      message: 'Evaluation submitted successfully',
      data: {
        id: existingRows.length > 0 ? existingRows[0].id : result.insertId,
        total_score,
        status: 'Submitted'
      }
    });
  } catch (error) {
    console.error('Dept head evaluation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to submit evaluation', 
      error: error.message 
    });
  }
});

// Dept Head Evaluations - Get all evaluations for a department
router.get('/dept-head/evaluations', async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ success: false, message: 'There is no active evaluation cycle.' });
    }
    const departmentId = req.query.department_id || req.user.department_id;
    
    if (!departmentId) {
      return res.status(400).json({ 
        success: false, 
        message: 'department_id is required' 
      });
    }

    const [rows] = await pool.query(
      `SELECT dhe.*, i.first_name, i.last_name, i.phone_number
       FROM dept_head_evaluations dhe
       LEFT JOIN instructors i ON dhe.instructor_id = i.id
       WHERE dhe.department_id = ? AND dhe.cycle_id = ?
       ORDER BY dhe.updated_at DESC`,
      [departmentId, activeCycle.id]
    );

    res.status(200).json({ 
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Fetch dept head evaluations error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch evaluations', 
      error: error.message 
    });
  }
});

// Dept Head Evaluations - Get single evaluation
router.get('/dept-head/evaluations/:id', async (req, res) => {
  try {
    const activeCycle = await getActiveEvaluationCycle();
    if (!activeCycle) {
      return res.status(409).json({ success: false, message: 'There is no active evaluation cycle.' });
    }
    const [rows] = await pool.query(
      `SELECT dhe.*, i.first_name, i.last_name, i.phone_number
       FROM dept_head_evaluations dhe
       LEFT JOIN instructors i ON dhe.instructor_id = i.id
       WHERE dhe.id = ? AND dhe.cycle_id = ?
       LIMIT 1`,
      [req.params.id, activeCycle.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Evaluation not found' 
      });
    }

    res.status(200).json({ 
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error('Fetch single evaluation error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch evaluation', 
      error: error.message 
    });
  }
});

module.exports = router;
