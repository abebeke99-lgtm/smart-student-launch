const pool = require('../config/db');

const getSystemStats = async (req, res) => {
  try {
    // Fetch all stats with safe fallbacks for missing tables
    const [
      studentEvaluatorsRows,
      participatingDepartmentsRows,
      completedEvaluationsRows,
      instructorCountRows,
    ] = await Promise.all([
      // Active Students / Student Evaluators - distinct students who submitted evaluations
      pool.query(`
        SELECT COUNT(DISTINCT student_id) AS activeStudentEvaluators
        FROM student_evaluation_submissions
        WHERE status = 'submitted' AND student_id IS NOT NULL
      `).catch(() => [[{ activeStudentEvaluators: 0 }]]),
      
      // Participating Departments - all departments with at least one active record
      pool.query(`
        SELECT COUNT(DISTINCT d.id) AS participatingDepartments
        FROM departments d
        WHERE d.id IS NOT NULL
      `).catch(() => [[{ participatingDepartments: 0 }]]),
      
      // Completed Evaluation Reports / Submissions
      pool.query(`
        SELECT COUNT(*) AS completedEvaluations
        FROM student_evaluation_submissions
        WHERE status = 'submitted'
      `).catch(() => [[{ completedEvaluations: 0 }]]),
      
      // Evaluated Instructors / Academic Staff - count of distinct instructors
      pool.query(`
        SELECT COUNT(DISTINCT user_id) AS evaluatedInstructors
        FROM instructors
        WHERE user_id IS NOT NULL
      `).catch(() => [[{ evaluatedInstructors: 0 }]]),
    ]);

    // Build response with safe defaults for missing tables
    const systemStats = {
      activeStudentEvaluators: Number(studentEvaluatorsRows[0][0]?.activeStudentEvaluators || 0),
      evaluatedInstructors: Number(instructorCountRows[0][0]?.evaluatedInstructors || 0),
      participatingDepartments: Number(participatingDepartmentsRows[0][0]?.participatingDepartments || 0),
      completedEvaluations: Number(completedEvaluationsRows[0][0]?.completedEvaluations || 0),
      qualityAssuranceReviews: 0, // Default to 0 when dept_head_evaluations table doesn't exist
      peerEvaluations: 0, // Default to 0 when peer_evaluation_submissions table doesn't exist
      improvementPlans: 0, // Default to 0 when instructor_evaluation_results table doesn't exist
      systemUptime: 99, // Placeholder system uptime
    };

    return res.json({
      success: true,
      message: { en: 'System statistics retrieved successfully.', am: 'የሥርዓቱ ስታቲስቲክስ በተሳካ ሁኔታ ተገኝቷል።' },
      data: systemStats,
    });
  } catch (error) {
    console.error('Unable to retrieve public system statistics:', error);
    // Return safe defaults instead of 500 error
    return res.json({
      success: true,
      message: { en: 'System statistics retrieved with defaults.', am: 'የሥርዓቱ ስታቲስቲክስ ነባሪ ዋጋዎች ጋር ተገኝቷል።' },
      data: {
        activeStudentEvaluators: 0,
        evaluatedInstructors: 0,
        participatingDepartments: 0,
        completedEvaluations: 0,
        qualityAssuranceReviews: 0,
        peerEvaluations: 0,
        improvementPlans: 0,
        systemUptime: 99,
      },
    });
  }
};

const getIEPSFocusAreas = async (req, res) => {
  try {
    // Define IEPS platform focus areas/modules
    // These represent the core evaluation modules within the IEPS system
    const focusAreas = [
      {
        id: 1,
        nameEn: 'Student Evaluations',
        nameAm: 'የተማሪ ግምገማዎች',
        iconType: 'users',
        descriptionEn: 'Comprehensive course and instructor evaluation system where students provide structured feedback on teaching quality, course content relevance, and learning outcomes. Real-time evaluation tracking and department-level aggregation.',
        descriptionAm: 'ተማሪዎች ስለ ትምህርት ጥራት፣ ኮርስ ይዘት ተዛማጅነት እና ትምህርታዊ ውጤቶች የተዋቀረ ግምገማ የሚሰጡበት ሰፊ ኮርስ እና አስተምህር ግምገማ ስርዓት። በእውነተኛ ጊዜ ግምገማ ክትትል እና የክፍል ደረጃ ትምህርታዊ ውጤቶች።',
        moduleLink: '/student-dashboard',
        iconColor: 'blue',
      },
      {
        id: 2,
        nameEn: 'Department Head Reviews',
        nameAm: 'የክፍል ኮላ ግምገማ',
        iconType: 'briefcase',
        descriptionEn: 'Administrative oversight and quality assurance framework for department heads to review instructor performance, conduct peer evaluations, and manage departmental evaluation cycles. Tracks evaluation completion rates and generates quality reports.',
        descriptionAm: 'የክፍል ሂዳት አስተምህር አፈጻጸም ለመገምገም፣ አጓዳይ ግምገማዎችን ለመመራት እና የክፍሉ ግምገማ ዑደቶችን ለመቆጣጠር የሥርዓተ አስተዳደር ቁጥጥር እና ጥራት ማረጋገጫ ፍሬም ወርክ። የግምገማ ቅደም ተከተል ታሪክ እና ጥራት ሪፖርቶች ያመነጫል።',
        moduleLink: '/dept-head/dashboard',
        iconColor: 'amber',
      },
      {
        id: 3,
        nameEn: 'Instructor Self-Assessment',
        nameAm: 'አስተምህር ራስ-ግምገማ',
        iconType: 'award',
        descriptionEn: 'Self-reflection and portfolio development platform enabling instructors to document teaching philosophy, professional development goals, research contributions, and career advancement plans. Supports evidence-based performance documentation.',
        descriptionAm: 'አስተምህራን ስልታቸውን ስሌት ፍልስፍናን፣ ባሙያ ልማት ግቦችን፣ ምርምር አስተዋጽኦን እና የካሪየር ማስተጋገር योजናዎችን ሰነዱ ለማስቻል ራስ-ተገንዘብ እና ፖርትፎሊዮ ልማት ፕላትፎርም። ማስረጃ-ተመሰረተ አፈጻጸም ሰነድ ይደግፋል።',
        moduleLink: '/instructor-dashboard',
        iconColor: 'green',
      },
      {
        id: 4,
        nameEn: 'Analytics & Reports',
        nameAm: 'ትንተና እና ሪፖርቶች',
        iconType: 'chart',
        descriptionEn: 'Institutional performance analytics and comprehensive reporting system providing dashboards for evaluation trends, departmental comparisons, instructor performance rankings, and strategic insights for academic improvement initiatives.',
        descriptionAm: 'ተቋማዊ አፈጻጸም ትንተና እና ሰፊ ሪፖርታ ስርዓት ፍምርት ግምገማ አዝማሚያ፣ የክፍል ንፅፅር፣ አስተምህር አፈጻጸም ደረጃ መለያ እና ስልታዊ ምስጢር ሰጪ ሰሌዳ ሪፖርቶች እና በአካዳሚክ ማሳደግ ባህሪያት ላይ ስልታዊ ግንዛቤ ቅርጫት ሪፖርት አቅርቦታ።',
        moduleLink: '/directorate/dashboard',
        iconColor: 'indigo',
      },
    ];

    return res.json({
      success: true,
      message: { 
        en: 'IEPS focus areas retrieved successfully.',
        am: 'የIEPS ትኩረት ያላቸው ቦታ በተሳካ ሁኔታ ተገኝቷል።'
      },
      data: focusAreas,
    });
  } catch (error) {
    console.error('Unable to retrieve IEPS focus areas:', error);
    return res.status(500).json({
      success: false,
      message: { 
        en: 'Unable to retrieve focus areas.',
        am: 'ትኩረት ያላቸው ቦታዎችን ማግኘት አልተቻለም።'
      },
      data: null,
    });
  }
};

const getCollegesWithDepartments = async (req, res) => {
  try {
    // Fetch all colleges with department counts
    const collegesRows = await pool.query(`
      SELECT 
        c.id,
        c.name as collegeName,
        c.code as collegeCode,
        COUNT(DISTINCT d.id) as departmentCount,
        COUNT(DISTINCT u_instr.id) as facultyCount,
        COUNT(DISTINCT u_stud.id) as studentCount,
        COUNT(DISTINCT d.id) as programCount
      FROM colleges c
      LEFT JOIN departments d ON c.id = d.college_id
      LEFT JOIN users u_instr ON d.id = u_instr.department_id AND u_instr.role = 'instructor'
      LEFT JOIN users u_stud ON d.id = u_stud.department_id AND u_stud.role = 'student'
      GROUP BY c.id, c.name, c.code
      ORDER BY c.name ASC
    `);

    // Transform college data and fetch department-level details
    const collegesData = [];
    
    for (const college of collegesRows[0] || []) {
      try {
        // Fetch departments for this college
        const departmentsRows = await pool.query(`
          SELECT 
            d.id,
            d.name as departmentName,
            d.code as departmentCode,
            COUNT(DISTINCT u_instr.id) as facultyCount,
            COUNT(DISTINCT u_stud.id) as studentCount
          FROM departments d
          LEFT JOIN users u_instr ON d.id = u_instr.department_id AND u_instr.role = 'instructor'
          LEFT JOIN users u_stud ON d.id = u_stud.department_id AND u_stud.role = 'student'
          WHERE d.college_id = ?
          GROUP BY d.id, d.name, d.code
          ORDER BY d.name ASC
        `, [college.id]);

        // Fetch evaluation metrics for this college (using safe defaults for non-existent tables)
        const evaluationMetricsRows = await pool.query(`
          SELECT 
            COUNT(DISTINCT u_instr.id) as evaluatedInstructors,
            COUNT(DISTINCT u_stud.id) as evaluatingStudents,
            COUNT(DISTINCT ses.id) as completedEvaluations,
            0 as deptHeadEvaluations
          FROM departments d
          LEFT JOIN users u_instr ON d.id = u_instr.department_id AND u_instr.role = 'instructor'
          LEFT JOIN users u_stud ON d.id = u_stud.department_id AND u_stud.role = 'student'
          LEFT JOIN student_evaluation_submissions ses ON ses.status = 'submitted'
          WHERE d.college_id = ?
          LIMIT 1
        `, [college.id]).catch(() => [[{ 
          evaluatedInstructors: 0, 
          evaluatingStudents: 0, 
          completedEvaluations: 0, 
          deptHeadEvaluations: 0 
        }]]);

        const metrics = evaluationMetricsRows[0]?.[0] || {
          evaluatedInstructors: 0,
          evaluatingStudents: 0,
          completedEvaluations: 0,
          deptHeadEvaluations: 0,
        };

        collegesData.push({
          id: college.id,
          nameEn: college.collegeName,
          nameAm: college.collegeName, // TODO: Add bilingual support in database
          code: college.collegeCode,
          departmentCount: Number(college.departmentCount) || 0,
          facultyCount: Number(college.facultyCount) || 0,
          studentCount: Number(college.studentCount) || 0,
          programCount: Number(college.programCount) || 0,
          departments: (departmentsRows[0] || []).map(d => ({
            id: d.id,
            name: d.departmentName,
            code: d.departmentCode,
            facultyCount: Number(d.facultyCount) || 0,
            studentCount: Number(d.studentCount) || 0,
          })),
          evaluationMetrics: {
            evaluatedInstructors: Number(metrics.evaluatedInstructors) || 0,
            evaluatingStudents: Number(metrics.evaluatingStudents) || 0,
            completedEvaluations: Number(metrics.completedEvaluations) || 0,
            deptHeadEvaluations: Number(metrics.deptHeadEvaluations) || 0,
          },
        });
      } catch (collegeError) {
        console.error(`Error processing college ${college.id}:`, collegeError);
        // Skip this college and continue with next one
        continue;
      }
    }

    return res.json({
      success: true,
      message: { 
        en: 'Colleges and departments retrieved successfully.',
        am: 'ኮሌጆች እና ክፍሎች በተሳካ ሁኔታ ተገኝቷል።'
      },
      data: collegesData,
    });
  } catch (error) {
    console.error('Unable to retrieve colleges with departments:', error);
    // Return safe fallback instead of 500 error
    return res.json({
      success: true,
      message: { 
        en: 'Colleges and departments retrieved (with fallback data).',
        am: 'ኮሌጆች እና ክፍሎች ተገኝቷል (ከወደቅ ዳታ ጋር)።'
      },
      data: [],
    });
  }
};

module.exports = { getSystemStats, getIEPSFocusAreas, getCollegesWithDepartments };