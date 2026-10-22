const bcrypt = require('bcryptjs');
const fs = require('fs');
const XLSX = require('xlsx');
const pool = require('../config/db');
const { getSystemSetting } = require('../config/audit');
const { normalizePhoneNumber, isValidRegistrationPhoneNumber } = require('../utils/phone');
const { ensureUserProfileSettings } = require('../utils/profileSettings');

const normalizeHeader = (value = '') => String(value).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

const parseRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' }).map((row) => Object.entries(row).reduce((result, [key, value]) => {
    result[normalizeHeader(key)] = value == null ? '' : String(value).trim();
    return result;
  }, {}));
};

const getValue = (row, names) => names.map((name) => row[name]).find((value) => value != null && String(value).trim())?.toString().trim() || '';
const getDefaultPasswordHash = () => bcrypt.hash(process.env.USER_DEFAULT_PASSWORD || '12345678', 12);
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

const saveRecoveryEmail = async (connection, userId, email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return;
  if (normalizedEmail.length > 254 || !isValidEmail(normalizedEmail)) {
    throw new Error('email must be a valid email address.');
  }
  const [[emailOwner]] = await connection.query(
    'SELECT user_id FROM user_profile_settings WHERE LOWER(TRIM(email)) = ? AND user_id <> ? LIMIT 1',
    [normalizedEmail, userId],
  );
  if (emailOwner) throw new Error('That email address is already linked to another account.');
  await connection.query(
    `INSERT INTO user_profile_settings (user_id, email)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email)`,
    [userId, normalizedEmail],
  );
};

const resolveDepartmentId = async (connection, value) => {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  const numericId = Number(candidate);
  if (Number.isInteger(numericId) && numericId > 0) {
    const [byId] = await connection.query('SELECT id FROM departments WHERE id = ? LIMIT 1', [numericId]);
    if (byId.length) return byId[0].id;
  }
  const [byName] = await connection.query('SELECT id FROM departments WHERE LOWER(name) = LOWER(?) OR LOWER(code) = LOWER(?) LIMIT 1', [candidate, candidate]);
  return byName[0]?.id || null;
};

const toStudent = (row = {}) => {
  const fullName = getValue(row, ['full_name', 'name']);
  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: getValue(row, ['first_name', 'firstName', 'firstname']) || parts.shift() || '',
    lastName: getValue(row, ['last_name', 'lastName', 'lastname']) || parts.join(' '),
    gender: getValue(row, ['gender']),
    studentId: getValue(row, ['student_id', 'studentId', 'studentid', 'student_number', 'username']),
    department: getValue(row, ['department_id', 'departmentId', 'department']),
    email: getValue(row, ['email']),
    phoneNumber: getValue(row, ['phone_number', 'phone', 'phoneNumber']),
    password: getValue(row, ['password']),
    semester: getValue(row, ['semester']),
    yearLevel: getValue(row, ['year_level', 'yearLevel', 'year']),
    section: getValue(row, ['section']),
    programType: getValue(row, ['program_type', 'program']) || 'regular',
    registrationDate: getValue(row, ['registration_date', 'registrationDate']),
  };
};

const missingFields = (student) => ['firstName', 'lastName', 'studentId', 'phoneNumber', 'department', 'semester', 'yearLevel', 'section']
  .filter((field) => !student[field])
  .map((field) => ({ firstName: 'first_name', lastName: 'last_name', studentId: 'student_id', phoneNumber: 'phone_number', department: 'department_id', semester: 'semester', yearLevel: 'year_level', section: 'section' }[field]));

const getConfiguredCycle = async () => {
  try {
    const value = await getSystemSetting('evaluation_window', '{}');
    const settings = JSON.parse(value || '{}');
    return settings.academicYear ? settings : null;
  } catch (error) {
    return null;
  }
};

const saveCycleEnrollment = async (connection, userId, student, cycle) => {
  if (!cycle?.academicYear) return null;
  const [[studentRow]] = await connection.query('SELECT id FROM students WHERE user_id = ? LIMIT 1', [userId]);
  if (!studentRow) return null;
  const cycleType = cycle.cycleType === 'year' ? 'year' : 'semester';
  const semester = cycleType === 'year' ? 'Annual' : String(cycle.semester || student.semester).toUpperCase();
  await connection.query(
    `INSERT INTO student_cycle_enrollments
      (student_record_id, academic_year, cycle_type, semester, department_id, year_level, section, program_type, registered_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
     ON DUPLICATE KEY UPDATE department_id = VALUES(department_id), year_level = VALUES(year_level),
       section = VALUES(section), program_type = VALUES(program_type), registered_at = VALUES(registered_at)`,
    [studentRow.id, cycle.academicYear, cycleType, semester, student.departmentId, student.yearLevel, student.section, student.programType, student.registrationDate || null],
  );
  return { academicYear: cycle.academicYear, cycleType, semester };
};

const saveStudent = async (connection, student) => {
  if (!isValidRegistrationPhoneNumber(String(student.phoneNumber || ''))) {
    throw new Error('Phone number must contain only numbers and be exactly 10 digits starting with 09 or 07.');
  }
  const phoneNumber = normalizePhoneNumber(student.phoneNumber);
  const departmentId = await resolveDepartmentId(connection, student.department);
  if (!departmentId) throw new Error('Department was not found.');
  const passwordValue = student.password || process.env.USER_DEFAULT_PASSWORD || '12345678';
  const passwordHash = await bcrypt.hash(passwordValue, 12);
  const [existing] = await connection.query(
    'SELECT u.id FROM users u INNER JOIN students s ON s.user_id = u.id WHERE s.student_id = ? LIMIT 1',
    [student.studentId]
  );
  let userId;

  if (existing.length) {
    userId = existing[0].id;
    await connection.query('UPDATE users SET username = ?, role = ? WHERE id = ?', [student.studentId, 'student', userId]);
  } else {
    const [userResult] = await connection.query(
      'INSERT INTO users (username, password_hash, role, status, is_first_login) VALUES (?, ?, ?, ?, ?)',
      [student.studentId, passwordHash, 'student', 'active', 1]
    );
    userId = userResult.insertId;
  }

  await connection.query(`INSERT INTO students
    (user_id, student_id, phone_number, first_name, last_name, department_id, semester, year_level, section, program_type, gender)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE student_id = VALUES(student_id), phone_number = VALUES(phone_number), first_name = VALUES(first_name), last_name = VALUES(last_name), department_id = VALUES(department_id), semester = VALUES(semester), year_level = VALUES(year_level), section = VALUES(section), program_type = VALUES(program_type), gender = VALUES(gender)`, [userId, student.studentId, phoneNumber, student.firstName, student.lastName, departmentId, student.semester, student.yearLevel, student.section, student.programType, student.gender]);
  await saveRecoveryEmail(connection, userId, student.email);

  return { userId, departmentId };
};

const registerStudent = async (req, res) => {
  const student = toStudent(req.body || {});
  const missing = missingFields(student);
  if (missing.length) return res.status(400).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
  if (!isValidRegistrationPhoneNumber(student.phoneNumber)) return res.status(400).json({ success: false, message: 'Phone number must contain only numbers and be exactly 10 digits starting with 09 or 07.' });
  if (student.email && (student.email.length > 254 || !isValidEmail(student.email))) return res.status(400).json({ success: false, message: 'email must be a valid email address.' });
  if (student.email) await ensureUserProfileSettings();
  const cycle = await getConfiguredCycle();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const data = await saveStudent(connection, student);
    data.enrollmentCycle = await saveCycleEnrollment(connection, data.userId, { ...student, departmentId: data.departmentId }, cycle);
    await connection.commit();
    return res.status(201).json({ success: true, message: 'Student registered successfully.', data });
  } catch (error) {
    await connection.rollback();
    console.error('Single student registration failed:', error);
    return res.status(500).json({ success: false, message: 'Student registration failed.', error: error.message });
  } finally {
    connection.release();
  }
};

const bulkRegisterStudents = async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please choose a CSV or XLSX file.' });
    }

    const rows = parseRows(req.file.buffer || fs.readFileSync(req.file.path));
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'The uploaded file contains no rows.' });
    }

    connection = await pool.getConnection();
    const studentIdentifiers = [...new Set(rows
      .map((row) => toStudent(row).studentId)
      .filter(Boolean))];
    const existingStudents = new Map();
    for (let index = 0; index < studentIdentifiers.length; index += 250) {
      const identifierChunk = studentIdentifiers.slice(index, index + 250);
      const placeholders = identifierChunk.map(() => '?').join(', ');
      const [existingRows] = await connection.query(
        `SELECT u.username, s.student_id, s.semester, s.year_level, s.section, s.program_type, s.registration_date
         FROM users u
         INNER JOIN students s ON s.user_id = u.id
         WHERE u.username IN (${placeholders}) OR s.student_id IN (${placeholders})`,
        [...identifierChunk, ...identifierChunk],
      );
      existingRows.forEach((existingStudent) => {
        if (existingStudent.username) existingStudents.set(String(existingStudent.username), existingStudent);
        if (existingStudent.student_id) existingStudents.set(String(existingStudent.student_id), existingStudent);
      });
    }

    const failures = [];
    const validStudents = rows.map((row, index) => {
      const importedStudent = toStudent(row);
      const existingStudent = existingStudents.get(importedStudent.studentId);
      const student = {
        ...importedStudent,
        semester: importedStudent.semester || existingStudent?.semester || '',
        yearLevel: importedStudent.yearLevel || existingStudent?.year_level || '',
        section: importedStudent.section || existingStudent?.section || '',
        programType: getValue(row, ['program_type', 'program']) || existingStudent?.program_type || importedStudent.programType,
        registrationDate: importedStudent.registrationDate || existingStudent?.registration_date || '',
      };
      const missing = missingFields(student);
      if (missing.length || !isValidRegistrationPhoneNumber(student.phoneNumber) || (student.email && (student.email.length > 254 || !isValidEmail(student.email)))) failures.push({ row: index + 2, message: missing.length ? `Missing required fields: ${missing.join(', ')}` : !isValidRegistrationPhoneNumber(student.phoneNumber) ? 'Phone number must contain only numbers and be exactly 10 digits starting with 09 or 07.' : 'email must be a valid email address.' });
      return { student, missing };
    });

    if (failures.length) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file contains invalid rows.',
        failures,
      });
    }

    const cycle = await getConfiguredCycle();
    if (validStudents.some(({ student }) => student.email)) await ensureUserProfileSettings();
    await connection.beginTransaction();
    transactionStarted = true;

    for (const { student } of validStudents) {
      const departmentId = await resolveDepartmentId(connection, student.department);
      if (!departmentId) throw new Error(`Department was not found for student ${student.studentId}.`);
      const [[departmentRow]] = await connection.query('SELECT college_id FROM departments WHERE id = ? LIMIT 1', [departmentId]);
      const collegeId = departmentRow?.college_id || null;

      const [[existingUser]] = await connection.query('SELECT id FROM users WHERE username = ? LIMIT 1', [student.studentId]);
      let userId = existingUser?.id;
      if (userId) {
        await connection.query('UPDATE users SET role = ?, college_id = ? WHERE id = ?', ['student', collegeId, userId]);
      } else {
        const passwordHash = await getDefaultPasswordHash();
        const [userResult] = await connection.query(
          `INSERT INTO users (username, password_hash, role, college_id, status, is_first_login)
           VALUES (?, ?, 'student', ?, 'active', 1)`,
          [student.studentId, passwordHash, collegeId]
        );
        userId = userResult.insertId;
      }

      await connection.query(
        `INSERT INTO students
          (user_id, student_id, phone_number, first_name, last_name, department_id, semester, year_level, section, gender, program_type, registration_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           user_id = VALUES(user_id),
           phone_number = VALUES(phone_number),
           first_name = VALUES(first_name),
           last_name = VALUES(last_name),
           department_id = VALUES(department_id),
           semester = VALUES(semester),
           year_level = VALUES(year_level),
           section = VALUES(section),
           gender = VALUES(gender),
           program_type = VALUES(program_type),
           registration_date = VALUES(registration_date)`,
        [
          userId,
          student.studentId,
          student.phoneNumber,
          student.firstName,
          student.lastName,
          departmentId,
          student.semester,
          student.yearLevel,
          student.section,
          student.gender,
          student.programType,
          student.registrationDate,
        ]
      );
      await saveRecoveryEmail(connection, userId, student.email);

      await saveCycleEnrollment(connection, userId, { ...student, departmentId }, cycle);
    }

    await connection.commit();
    transactionStarted = false;
    return res.status(200).json({
      success: true,
      message: 'Bulk student registration completed.',
      createdCount: validStudents.length,
      failedCount: 0,
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('Bulk student registration failed:', error);
    return res.status(500).json({ success: false, message: 'Bulk student registration failed.', error: error.message });
  } finally {
    if (connection) connection.release();
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
};

module.exports = { bulkRegisterStudents, bulkUploadStudents: bulkRegisterStudents, registerStudent };
