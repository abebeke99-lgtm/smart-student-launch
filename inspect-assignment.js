const pool = require('./backend/config/db');
(async () => {
  try {
    const [instr] = await pool.query('SELECT * FROM instructors WHERE id = 5');
    console.log('INSTRUCTOR ID 5:', JSON.stringify(instr, null, 2));
    const [instrUser] = await pool.query('SELECT * FROM users WHERE id = (SELECT user_id FROM instructors WHERE id = 5)');
    console.log('USER FOR INSTRUCTOR 5:', JSON.stringify(instrUser, null, 2));
    const [students] = await pool.query('SELECT * FROM students WHERE department_id = 4 AND year_level = "3rd Year" AND semester = "I" AND section = "A"');
    console.log('STUDENTS MATCH:', JSON.stringify(students, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
})();
