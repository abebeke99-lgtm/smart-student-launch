const pool = require('./backend/config/db');
(async () => {
  try {
    const [students] = await pool.query('SELECT id, user_id, first_name, last_name, department_id, year_level, semester, section FROM students WHERE department_id = 4 AND year_level = "3rd Year" AND semester = "I" AND section = "A"');
    console.log('MATCHING STUDENTS:', JSON.stringify(students, null, 2));
    if (students.length) {
      const userIds = students.map((s) => s.user_id);
      const [users] = await pool.query('SELECT id, username, role, status, created_at FROM users WHERE id IN (?)', [userIds]);
      console.log('USER RECORDS:', JSON.stringify(users, null, 2));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
