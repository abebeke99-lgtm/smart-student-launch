import React from 'react';
import { criteriaApi } from '../services/api';
import LanguageToggle from './LanguageToggle';
import { getQuestionText, groupCriteriaByCategory } from '../utils/evaluationCriteria';
import { validateEvaluationFeedback } from '../utils/validateEvaluationFeedback';

const RATING_SCALE = [1, 2, 3, 4, 5, 'NA'];
const supervisorCriteriaAmharic = [
  'በልዩ ሙያው የራስ እድገት ጥረት ማድረግ',
  'የትምህርት ጉዳይ እውቀት በቂነት',
  'ሙያዊ ብቃት / የማስተማር ዘዴ',
  'በክፍሉ አስገዳጅ ሁኔታ ሲከሰት ተጨማሪ የማስተማር ስራዎችን ለመቀበል ፈቃደኛነት',
  'በትብብር ትምህርት፣ በልምምድ ወዘተ እንደ አማካሪ ውጤታማነት',
  'የማስተማርና የመማር ሂደትን፣ ሴሚናርን፣ ወርክሾፕን፣ ሲምፖዚየምን እና የትምህርት ቁሳቁሶችን በማሻሻል ንቁ ተሳትፎ',
  'በማህበረሰብ አገልግሎትና በበጎ ፈቃድ ተግባራት ተሳትፎ እና ከመደበኛ ማስተማር ውጭ ተግባራትን ለመሳተፍ ፈቃደኛነት',
  'በየሙያው የቅድሚያ ትኩረት የሚሰጣቸውን መስኮች መለየትና በዚያ መስክ ምርምር ማካሄድ',
  'በምርምር ፕሮጀክትና በፕሮጀክት ፕሮፖዛል ዝግጅት ተሳትፎ',
  'እንደ አካዳሚክ አማካሪ የሚያሳየው አፈጻጸም',
  'በክፍል፣ በኮሌጅ ወይም በተቋም ደረጃ ችግርን በመለየትና በመፍታት ተሳትፎ',
  'በአጠቃላይ ቀጣይነት ያለው ሙያዊ ልማት /CCPD፣ HDP፣ ELIP ተሳትፎ',
  'ቀጣይነት ያለው ግምገማን በተግባር ማዋል',
  'ለተማሪዎች የተዘጋጁ የቱቶሪያል ተግባራትን ማቅረብና ሪፖርት ማድረግ',
  'የተመደቡ ክፍሎችንና የፈተና ተቆጣጣሪነትን በሰዓቱ ማከናወን',
  'የምክክር ጊዜን በወቅቱ ማሳወቅና መስጠት እና ለተማሪዎች በወቅቱ አስተያየት መስጠት',
  'ቀነ ገደቦችን ማክበር (ሪፖርት፣ SIMS ውጤት መግባት፣ ውጤት/ሰነዶች ማስገባት ወዘተ)',
  'የክፍሉንና የዩኒቨርሲቲውን ሀብት አጠቃቀም መከታተል',
  'በክፍል/ዩኒቨርሲቲ ደረጃ በኮሚቴ ስራዎች ፈቃደኛ ሆኖ መሳተፍ፣ ከሌሎች ጋር በቡድን መስራት',
  'ሙያዊ ስነ-ምግባርና አርአያ መሆን (አለባበስ፣ የፀጉር አቀራረብ፣ ባህሪ፣ ሱስ ወዘተ)',
];
const categoryAmharic = {
  'Core Competency': 'መሠረታዊ ብቃት',
  'Professional Competence': 'የሙያ ብቃት',
  'Time Management': 'የጊዜ አጠቃቀም',
  'Ethical Competence': 'የሥነ-ምግባር ብቃት',
  'Subject Matter Competence': 'የትምህርት ጉዳይ ብቃት',
  'Safety Management': 'የደህንነት አስተዳደር',
  'Laboratory Support': 'የላብራቶሪ ድጋፍ',
  'Laboratory Operations': 'የላብራቶሪ አሰራር',
  'Documentation': 'ሰነድ አያያዝ',
  'Testing and Records': 'ምርመራና መዝገብ',
  'Communication': 'ግንኙነት',
  'Equipment and Facilities': 'መሳሪያና ተቋማት',
  'Equipment Cleaning': 'የመሳሪያ ጽዳት',
  'Maintenance Reporting': 'የጥገና ሪፖርት',
  'Stock Management': 'የእቃ ክምችት አስተዳደር',
  'Procurement Support': 'የግዥ ድጋፍ',
  'Assigned Duties': 'የተመደቡ ተግባራት',
  'Student Support': 'የተማሪ ድጋፍ',
  'External Correspondence': 'የውጭ ግንኙነት',
  'Professional Development': 'ሙያዊ ልማት',
  'Teamwork': 'የቡድን ስራ',
};
const araDeptHeadCriteriaAmharic = [
  'የትምህርት ጉዳይ እውቀትና ተግባራዊ ብቃት ደረጃ',
  'የደህንነት ጥንቃቄን በፖስተሮች፣ በምልክቶችና በደህንነት አሰራሮች በማቅረብ ማስፈጸምና መከታተል',
  'መምህራንንና ተማሪዎችን በናሙና ትንተና፣ በመሳሪያ ጥገናና አጠቃቀም፣ በተቋማትና በአጠቃላይ ክትትል መርዳት',
  'በአፈጻጸም ቀናት የላብራቶሪ ድጋፍ ተግባራትንና የአሰራር ሂደቶችን መጻፍ',
  'የማረጋገጫ ዘዴዎችን፣ ሂደቶችንና ሪፖርቶችን መጻፍ',
  'መደበኛ ምርመራ ማካሄድ፣ መረጃ መመዝገብና መሙላት',
  'የትንተና ውጤትን ማሳወቅና ሪፖርትን በግልጽና በወቅቱ መጻፍ',
  'የላብራቶሪ መሳሪያዎችንና ተቋማትን መንከባከብና መጠበቅ',
  'መሳሪያዎችን ለመንከባከብ፣ ለማጠብና ለማጽዳት መርዳት',
  'ከአቅም በላይ ሲሆን የመሳሪያዎችን ዋና የጥገና ፍላጎት ማሳወቅ',
  'አደጋዎችን፣ ያልተለመዱ ክስተቶችን፣ መጥፎ ባህሪንና በተሳሳተ አጠቃቀም የተከሰቱ የመሳሪያ ብልሽቶችን ከምክንያታቸው ጋር በወቅቱ ማሳወቅ',
  'አዲስና መተኪያ መሳሪያዎችን ማዘዝና የክምችት ደረጃን በትክክል መመዝገብ',
  'በላብራቶሪ ጥቅም ላይ የሚውሉ መሳሪያዎችን በመግዛት መርዳት',
  'በኮሌጅ/ክፍል የሚመደቡ ሌሎች ተግባራትን ለመቀበል ፈቃደኛ መሆን',
  'በላብራቶሪ፣ በመስክና በስራ ወቅት ተማሪዎችን መርዳት',
  'ተማሪዎች ለመስክ ጉብኝት ከመውጣታቸው በፊት ከአስተናጋጅ ኩባንያ ወይም ኢንዱስትሪ ጋር የሚደረግ ደብዳቤ ልውውጥን ማመቻቸት',
  'በክፍለ ጊዜዎች የጊዜ አጠቃቀም (ላብራቶሪ፣ ወርክሾፕ ወዘተ)',
  'በክፍል፣ በኮሌጅና በዩኒቨርሲቲ የሚዘጋጁ ሴሚናሮችን መከታተል',
  'በትምህርት መማሪያ ሠራዊት/በትብብር የቡድን ስራ በንቃት ለመሳተፍ ፈቃደኛ መሆን',
];
const supervisorCriteria = [
  ['Core Competency', 'Efforts of self-development in his/her specialization'],
  ['Core Competency', 'Adequacy of subject matter knowledge'],
  ['Core Competency', 'Professional Skill / Teaching Methodology'],
  ['Core Competency', 'Willingness to accept additional teaching assignments when compelling situation arises in the department'],
  ['Core Competency', 'Effectiveness as a mentor in cooperative learning, internship etc...'],
  ['Core Competency', 'Active participation in improvement of teaching-learning process, seminars, workshop, symposia and reviewing of teaching materials (curriculum)'],
  ['Core Competency', 'Participation in community service affairs and volunteer activities and willingness to participate in activities other than regular teaching (mentorship)'],
  ['Core Competency', 'Identifying priority areas in one’s discipline and pursuing research in that area'],
  ['Core Competency', 'Participation in research project and project proposal development'],
  ['Core Competency', 'Performance as an academic advisor'],
  ['Professional Competence', 'Participation in problem identification and solving at department/college/institution'],
  ['Professional Competence', 'Participation in Comprehensive Continuous Professional Development /CCPD, HDP, ELIP'],
  ['Professional Competence', 'Continuous assessment implementation'],
  ['Professional Competence', 'Providing and reporting tutorial activities designed for the students'],
  ['Time Management', 'Executing assigned classes/invigilation on time.'],
  ['Time Management', 'Notifying and implementing consultation timely and Giving timely feedback to students'],
  ['Time Management', 'Meeting deadlines (in reporting, SIMS result feeding, submission of grade/ documents...etc…)'],
  ['Ethical Competence', 'Showing concern for the use of resources of the department and the University'],
  ['Ethical Competence', 'Willingness and participation in committee works at department /University level and Having positive attitude to work with others, team spirit'],
  ['Ethical Competence', 'His/her professional ethics and being a role model (dressing, hair style, personality, addiction…)'],
].map(([category, criterion_text], index) => ({
  id: `supervisor-${index + 1}`,
  category,
  criterion_text,
  criterion_text_am: supervisorCriteriaAmharic[index],
}));

const araDeptHeadCriteria = [
  ['Subject Matter Competence', 'Level of his/her subject matter knowledge and practical skill'],
  ['Safety Management', 'Enforce and follow up safety precaution by providing posters, symbols, and safety procedures.'],
  ['Laboratory Support', 'Assist faculty and students in the analysis of samples, maintenance, upkeep of instruments, facilities, and general supervision'],
  ['Laboratory Operations', 'Laboratory support activities during performance days and writing operating procedures'],
  ['Documentation', 'Write methods of validation, procedure and report'],
  ['Testing and Records', 'Carry out routine test, recording and filling data'],
  ['Communication', 'Communicate analytical result and writing report in clear and timely manner'],
  ['Equipment and Facilities', 'Maintaining and care of laboratory equipment and facilities'],
  ['Equipment Cleaning', 'Assist in maintaining, washing and cleaning equipment'],
  ['Maintenance Reporting', 'Report major maintenance requirement of equipment when a need become beyond his/her capacity'],
  ['Safety and Incident Reporting', 'Report accident, unusual events, misbehaviour, and failures of equipment due to mal operation/careless handling with the causing agents timely'],
  ['Stock Management', 'Order new and replacement equipment and keep accurate record of stock levels'],
  ['Procurement Support', 'Assisting purchase of instrument for use in the laboratory'],
  ['Assigned Duties', 'Willingness to accept any other duties assigned to him/her, by the College/Department as required'],
  ['Student Support', 'Assist students during lab/field/ work'],
  ['External Correspondence', 'Facilitate every correspondence to be made with the hosting company or industry before students go out for field visit'],
  ['Time Management', 'Time utilization during class sessions (laboratory, workshop etc…)'],
  ['Professional Development', 'Attending seminars organized by the Department/College/University'],
  ['Teamwork', 'Willing to actively participate in education learning army/cooperative team work'],
].map(([category, criterion_text], index) => ({
  id: `ara-dept-head-${index + 1}`,
  number: index + 1,
  category,
  criterion_text,
  criterion_text_am: araDeptHeadCriteriaAmharic[index],
}));

export default function InstructorEvaluationCriteriaModal({
  open,
  onClose,
  instructorName,
  evaluation = {},
  targetRole = '',
  criteriaScores = {},
  setCriteriaScores,
  onSubmit,
  isSubmitting = false,
  mode = 'edit',
  evaluatorType = 'dept_head',
  completionRole = 'Immediate Supervisor'
}) {
  const [error, setError] = React.useState('');
  const [isEditMode, setIsEditMode] = React.useState(mode === 'edit');
  const [criteria, setCriteria] = React.useState(supervisorCriteria);
  const [language, setLanguage] = React.useState('am');
  const [strengths, setStrengths] = React.useState('');
  const [improvements, setImprovements] = React.useState('');
  const [generalComments, setGeneralComments] = React.useState('');
  const [currentCategoryIndex, setCurrentCategoryIndex] = React.useState(0);
  const [highlightedCriterionId, setHighlightedCriterionId] = React.useState(null);
  const [criterionErrors, setCriterionErrors] = React.useState([]);
  const normalizedTargetRole = String(targetRole || evaluation?.role || '').trim().toLowerCase();
  const isAraTarget = ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(normalizedTargetRole);
  const resolvedEvaluatorType = isAraTarget ? 'ara_dept_head' : evaluatorType;
  const criteriaTargetRole = isAraTarget ? 'lab_assistant' : 'instructor';
  // Helper function to map department names to appropriate colleges
  const mapDepartmentToCollege = (deptName) => {
    if (!deptName) return null;
    const normalized = String(deptName).toLowerCase().trim();

    // College of Computing and Informatics mapping
    const computingKeywords = ['information technology', 'computer science', 'computer engineering', 
                               'software engineering', 'it department', 'cs department', 'computing', 'ict', 'informatics'];
    if (computingKeywords.some(keyword => normalized.includes(keyword))) {
      return 'College of Computing and Informatics';
    }

    // CNCS (Natural and Computational Sciences) mapping
    const scienceKeywords = ['chemistry', 'biology', 'mathematics', 'math', 'physics', 'natural sciences', 
                             'chemistry department', 'biology department', 'science department', 'computational'];
    if (scienceKeywords.some(keyword => normalized.includes(keyword))) {
      return 'CNCS';
    }

    return null; // No mapping found
  };

  // Robust dynamic profile data extraction with fallbacks
  const getCollegeName = () => {
    const college = evaluation?.college_name || evaluation?.collegeName;
    if (college && String(college).trim() && String(college).trim().toUpperCase() !== 'N/A') {
      return college;
    }
    // Try to map college from the department name
    const dept = evaluation?.department_name || evaluation?.departmentName || evaluation?.target_department_name;
    const mappedCollege = mapDepartmentToCollege(dept);
    if (mappedCollege) {
      return mappedCollege;
    }
    // Final fallback
    return 'CNCS';
  };

  const getDepartmentName = () => {
    const dept = evaluation?.department_name || evaluation?.departmentName;
    if (dept && String(dept).trim() && String(dept).trim().toUpperCase() !== 'N/A') {
      return dept;
    }
    // Fallback to active department assignment if available
    return 'Chemistry/Biology';
  };

  const academicYear = evaluation?.academic_year || evaluation?.academicYear || evaluation?.academicYearName || evaluation?.year || '';
  const semester = evaluation?.semester || evaluation?.semester_name || evaluation?.term || evaluation?.course_semester || '';
  
  // Dynamic fallback logic for academic year and semester
  const getAcademicYear = () => {
    if (academicYear && String(academicYear).trim() && String(academicYear).trim().toUpperCase() !== 'N/A') {
      return academicYear;
    }
    // Calculate current Ethiopian academic year
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const ethiopianYear = month >= 9 || (month === 8 && now.getDate() >= 11) ? year - 7 : year - 8;
    return `${ethiopianYear} E.C.`;
  };

  const getSemester = () => {
    if (semester && String(semester).trim() && String(semester).trim().toUpperCase() !== 'N/A') {
      return semester;
    }
    // Default to Semester II
    return 'ሴሚስተር 2 (2nd Semester)';
  };

  const displayAcademicYear = getAcademicYear();
  const displaySemester = getSemester();
  const isAmharic = language === 'am';
  const labels = isAmharic
    ? { title: 'የመምህራን/ARA ውጤታማነት ግምገማ ቅዋሙስ (በቅርብ ተቆጣጣሪ የሚሞላ)', university: 'የመቅደላ አምባ ዩኒቨርሲቲ', name: 'የተገምጋሚው ስም', college: 'ኮሌጅ', department: 'የትምህርት ክፍል', year: 'የትምህርት ዘመን', semester: 'ሴሚስተር', scale: 'መለኪያ: 1 = በጣም ዝቅተኛ, 2 = ዝቅተኛ, 3 = መካከለኛ, 4 = ከፍተኛ, 5 = በጣም ከፍተኛ, NA = አይመለከተኝም', scored: 'የተመዘኑ መስፈርቶች', average: 'አማካይ (5 ደረጃ)', final: 'የመጨረሻ ውጤት (0-100)', strengths: 'ጠንካራ ጎኖች', improvements: 'የማሻሻያ መስኮች', cancel: 'ሰርዝ', close: 'ዝጋ', edit: 'ግምገማ አርም', submit: 'ግምገማ ላክ', submitting: 'በመላክ ላይ...' }
    : { title: `INSTRUCTORS' PERFORMANCE EVALUATION CHECKLIST (To be completed by ${completionRole})`, university: 'Mekdela Amba University', name: 'Evaluated Name', college: 'College', department: 'Department', year: 'Academic Year', semester: 'Semester', scale: 'Scale: 1 = Very Low, 2 = Low, 3 = Average, 4 = High, 5 = Very High, NA = Not Applicable', scored: 'Criteria Scored', average: 'Average (5-point scale)', final: 'Final Score (0-100)', strengths: 'Strengths', improvements: 'Areas for improvement', cancel: 'Cancel', close: 'Close', edit: 'Edit Evaluation', submit: 'Submit Evaluation', submitting: 'Submitting...' };
  const displayLabels = resolvedEvaluatorType === 'ara_dept_head'
    ? {
      ...labels,
      title: isAmharic ? 'የአካዳሚክ እና ምርምር ረዳት (ARA) የአፈጻጸም ግምገማ ቅጽ' : 'ACADEMIC AND RESEARCH ASSISTANTS (ARA) PERFORMANCE EVALUATION FORM',
      university: isAmharic ? 'የመቅደላ አምባ ዩኒቨርሲቲ' : 'MEKDELA AMBA UNIVERSITY',
      departmentHeadSubtitle: isAmharic ? '[በክፍሉ ተቆጣጣሪ የሚሞላ]' : '[TO BE FILLED BY THE DEPARTMENT HEAD]',
      name: isAmharic ? 'የARA ስም' : 'Name of ARA',
      strengths: isAmharic ? 'የአካዳሚክ እና ምርምር ረዳቱ ጥንካሬዎች' : 'Strengths of the Academic and Research Assistant.',
      improvements: isAmharic ? 'የአካዳሚክ እና ምርምር ረዳቱ ሊያሻሽላቸው የሚገቡ ነጥቦች' : 'Suggested points/aspects the Academic and Research Assistant should improve.',
    }
      : labels;
  const localizedScale = isAmharic
    ? 'መለኪያ: 1 = በጣም ዝቅተኛ, 2 = ዝቅተኛ, 3 = መካከለኛ, 4 = ከፍተኛ, 5 = በጣም ከፍተኛ, NA = አይመለከተኝም'
    : 'Scale: 1 = Very Low, 2 = Low, 3 = Average, 4 = High, 5 = Very High, NA = Not Applicable';
  const instructions = isAmharic ? [
    'እያንዳንዱን የመገምገሚያ ነጥብ በጥንቃቄ አንብብ(ቢ)፤',
    'ካነበብከው(ሽው) የመገምገሚያ ነጥብ አኳያ የመምህርህን(ሽን) የማስተማር ዝግጅት እና ብቃት፣ የትምህርት አቀራረብና አጠቃላይ ባህርይ በሚዛናዊነት አስቀምጥ(ጪ)፤',
    'ካነበብከው(ሽው) የመገምገሚያ ነጥብ አኳያ የመምህሩን(ሯን) የሥራ አፈጻጸም ከበጣም ዝቅተኛ እስከ በጣም ከፍተኛ በቁጥር ተመንዝሮ ከተቀመጠው ውስጥ አንዱን በማክበር አመልክት(ቺ)፤',
    'መምህሩን/ሯን የማይመለከተው/ታት ከሆነ ለዚሁ በተዘጋጀ ቦታ የ √ ምልክት አስቀምጥ(ጪ)፤',
    'በወንድ ፆታ የተገለፀው ለሴት ፆታም ያገለግላል።',
  ] : [
    'Read each evaluation criterion carefully.',
    'Assess the instructor\'s preparation, competence, teaching approach, and general conduct fairly.',
    'Select one number from Very Low to Very High to rate performance.',
    'Mark √ in the designated place when a criterion does not apply.',
    'Masculine references also apply to the feminine gender.',
  ];

  React.useEffect(() => {
    if (!open) return;
    setCurrentCategoryIndex(0);
    setHighlightedCriterionId(null);
    setCriterionErrors([]);
    setCriteria(supervisorCriteria);
    if (resolvedEvaluatorType === 'ara_dept_head') {
      setCriteria(araDeptHeadCriteria);
      return;
    }
    criteriaApi.get(resolvedEvaluatorType, criteriaTargetRole).then((rows) => {
      if (!Array.isArray(rows) || !rows.length) {
        setCriteria(supervisorCriteria);
        return;
      }
      const orderedRows = resolvedEvaluatorType === 'dept_head' && criteriaTargetRole === 'instructor'
        ? [...rows].sort((first, second) => Number(first.id) - Number(second.id))
        : rows;
      setCriteria(orderedRows);
    }).catch(() => setCriteria(supervisorCriteria));
  }, [criteriaTargetRole, resolvedEvaluatorType, open]);

  const handleScoreChange = (criteriaId, score) => {
    setCriteriaScores(prev => ({
      ...prev,
      [criteriaId]: score
    }));
    setCriterionErrors((current) => current.filter((id) => id !== criteriaId));
    setHighlightedCriterionId((current) => current === criteriaId ? null : current);
    setError('');
  };

  React.useEffect(() => {
    if (!open) return;
    setStrengths(evaluation?.strengths || evaluation?.remarks || '');
    setImprovements(evaluation?.weaknesses || evaluation?.areas_for_improvement || '');
    setGeneralComments(evaluation?.general_comments || evaluation?.comments || '');
  }, [evaluation, open]);

  if (!open) return null;

  const isDepartmentHeadChecklist = resolvedEvaluatorType === 'dept_head' && criteriaTargetRole === 'instructor';
  const legacyDepartmentHeadScores = isDepartmentHeadChecklist
    ? Object.entries(criteriaScores)
      .filter(([key]) => /^\d+$/.test(key))
      .sort(([first], [second]) => Number(first) - Number(second))
      .map(([, score]) => score)
    : [];
  const getCriterionScore = (criterion, index) => (
    criteriaScores[criterion.id]
    ?? (isDepartmentHeadChecklist ? criteriaScores[`supervisor-${index + 1}`] : undefined)
    ?? (isDepartmentHeadChecklist ? legacyDepartmentHeadScores[index] : undefined)
  );

  const calculateAverageScore = () => {
    const scores = criteria.map((criterion, index) => Number(getCriterionScore(criterion, index))).filter((score) => Number.isFinite(score));
    if (scores.length === 0) return 0;
    return (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2);
  };

  const calculateTotalScore = () => {
    // Convert average (1-5 scale) to percentage (0-100)
    const avgScore = calculateAverageScore();
    return Math.round((avgScore / 5) * 100);
  };

  const allCriteriaScored = () => {
    return criteria.length > 0 && criteria.every((criterion, index) => {
      const score = getCriterionScore(criterion, index);
      return score !== undefined && score !== null && score !== '';
    });
  };
  const scoredCriteriaCount = criteria.filter((criterion, index) => {
    const score = getCriterionScore(criterion, index);
    return score !== undefined && score !== null && score !== '';
  }).length;
  const criteriaSections = groupCriteriaByCategory(criteria);
  const currentCategory = criteriaSections[currentCategoryIndex];
  const isLastCategory = currentCategoryIndex === criteriaSections.length - 1;

  const handleSubmit = () => {
    if (!isLastCategory) {
      const unanswered = (currentCategory?.criteria || []).filter((criterion) => {
        const score = getCriterionScore(criterion, criteria.findIndex((item) => item.id === criterion.id));
        return score === undefined || score === null || score === '';
      });
      if (unanswered.length > 0) {
        setError(`Please answer all questions in this category. ${unanswered.length} question(s) remaining.`);
        setCriterionErrors(unanswered.map((criterion) => criterion.id));
        setHighlightedCriterionId(unanswered[0].id);
        document.getElementById(`dept-head-criterion-${unanswered[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setError('');
      setCriterionErrors([]);
      setCurrentCategoryIndex((index) => index + 1);
      return;
    }
    const feedbackError = validateEvaluationFeedback({
      [language === 'am' ? 'ጥንካሬዎች' : 'Strengths']: strengths,
      [language === 'am' ? 'የማሻሻያ መስኮች' : 'Areas for Improvement']: improvements,
      [language === 'am' ? 'አጠቃላይ አስተያየቶች' : 'General Comments']: generalComments,
    }, language);
    if (feedbackError) {
      setError(feedbackError);
      return;
    }
    if (!allCriteriaScored()) {
      setError(language === 'am'
        ? 'እባክዎ ከመላክዎ በፊት ሁሉንም መስፈርቶች ይመልሱ።'
        : 'Please answer all criteria before submitting.');
      setCriterionErrors(criteria
        .filter((criterion, index) => {
          const score = getCriterionScore(criterion, index);
          return score === undefined || score === null || score === '';
        })
        .map((criterion) => criterion.id));
      return;
    }
    setCriterionErrors([]);
    const totalScore = calculateTotalScore();
    onSubmit(criteriaScores, totalScore, strengths, improvements, generalComments);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-5">
      <div className="relative flex max-h-[calc(100vh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">{displayLabels.university}</p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-gray-900">{displayLabels.title}</h2>
            {displayLabels.departmentHeadSubtitle && <p className="mt-1 text-sm font-semibold text-red-600">{displayLabels.departmentHeadSubtitle}</p>}
            <p className="mt-1 text-xs text-gray-600">{instructorName}</p>
            {!isEditMode && (
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                የማየት ሁኔታ
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle language={language} onChange={setLanguage} />
            <button
              type="button"
              onClick={onClose}
              aria-label={language === 'am' ? 'ዝጋ' : 'Close'}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <span className="text-2xl">✕</span>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4 border-y border-gray-400 py-3 text-gray-900">
          <h2 className="text-center text-base font-bold">{displayLabels.university}</h2>
          <p className="mt-1 text-center text-xs font-semibold">{displayLabels.title}</p>
          {displayLabels.departmentHeadSubtitle && <p className="mt-1 text-center text-sm font-semibold text-red-600">{displayLabels.departmentHeadSubtitle}</p>}
          <div className="mt-3 grid gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
            <p>{displayLabels.name}: <strong>{instructorName || 'N/A'}</strong></p>
            <p>{displayLabels.college}: <strong>{getCollegeName()}</strong></p>
            <p>{displayLabels.department}: <strong>{getDepartmentName()}</strong></p>
            <p>{displayLabels.year}: <strong>{displayAcademicYear}</strong></p>
            <p>{displayLabels.semester}: <strong>{displaySemester}</strong></p>
          </div>
          <p className="mt-3 border-t border-gray-300 pt-2 text-[10px] font-semibold">{localizedScale}</p>
        </div>

        {/* Instructions */}
        <div className="my-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-800">
          <p className="mb-1 font-bold">{isAmharic ? 'መግለጫ፡' : 'Instructions:'}</p>
          <ol className="list-decimal list-inside space-y-0.5">{instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
        </div>

        {/* Criteria Categories */}
        <div className="mb-4 space-y-3">
          {currentCategory && (
            <div>
              {/* Category Header */}
              <h3 className="mb-2 flex items-center justify-between gap-3 pl-1 text-xs font-bold uppercase tracking-wider text-gray-700">
                {isAmharic ? (categoryAmharic[currentCategory.category] || currentCategory.category) : currentCategory.category}
                <span className="shrink-0 normal-case font-normal tracking-normal text-gray-500">Category {currentCategoryIndex + 1} of {criteriaSections.length}</span>
              </h3>

              {/* Criteria Items */}
              <div className="space-y-2">
                {currentCategory.criteria.map((criterion) => {
                  const criterionIndex = criteria.findIndex((item) => item.id === criterion.id);
                  const currentScore = getCriterionScore(criterion, criterionIndex);
                  return (
                    <div
                      key={criterion.id}
                      id={`dept-head-criterion-${criterion.id}`}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3 transition-all ${criterionErrors.includes(criterion.id) || highlightedCriterionId === criterion.id ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200' : 'border-gray-200 bg-gray-50/70 hover:bg-gray-100/50'}`}
                    >
                      {/* Criterion Text */}
                      <p className="flex-1 pr-2 text-xs font-medium leading-relaxed text-gray-700">
                        <span className="mr-2 font-mono font-bold text-gray-400">{criterion.number || criterionIndex + 1}.</span>
                        {getQuestionText(criterion, language)}
                        {criterionErrors.includes(criterion.id) && (
                          <span className="mt-1 block text-[11px] font-semibold text-rose-700" role="alert">
                            ⚠️ Please select a score for this criterion before proceeding.
                          </span>
                        )}
                      </p>

                      {/* Circular Rating Buttons 1-5 */}
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {RATING_SCALE.map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => isEditMode && handleScoreChange(criterion.id, rating)}
                            disabled={!isEditMode}
                              className={`flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-all duration-150 ${
                              String(currentScore) === String(rating)
                                ? "scale-105 border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-200"
                                : "border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600"
                            } ${!isEditMode ? "cursor-default" : "cursor-pointer"}`}
                          >
                            {rating}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {isLastCategory && (<>
        {/* Score Summary */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <p className="text-xs text-gray-600 uppercase font-semibold">{labels.scored}</p>
            <p className="text-2xl font-bold text-ieps-blue-600">{scoredCriteriaCount}/{criteria.length}</p>
          </div>
          <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200">
            <p className="text-xs text-gray-600 uppercase font-semibold">{labels.average}</p>
            <p className="text-2xl font-bold text-purple-600">{calculateAverageScore()}</p>
          </div>
          <div className="p-4 rounded-lg bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
            <p className="text-xs text-gray-600 uppercase font-semibold">{labels.final}</p>
            <p className="text-2xl font-bold text-green-600">{calculateTotalScore()}</p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">{isAmharic ? 'ስለ መምህሩ አጠቃላይ አስተያየት' : 'General comments about the instructor'}<textarea value={generalComments} onChange={(event) => { setGeneralComments(event.target.value); setError(''); }} maxLength={500} disabled={!isEditMode} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal" /></label>
          <label className="text-sm font-medium text-gray-700">{displayLabels.strengths}<textarea value={strengths} onChange={(event) => { setStrengths(event.target.value); setError(''); }} maxLength={500} disabled={!isEditMode} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal" placeholder={isAmharic ? 'ጠንካራ ጎኖችን ይግለጹ።' : 'Describe strengths and positive contributions.'} /></label>
          <label className="text-sm font-medium text-gray-700">{displayLabels.improvements}<textarea value={improvements} onChange={(event) => { setImprovements(event.target.value); setError(''); }} maxLength={500} disabled={!isEditMode} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2 font-normal" placeholder={isAmharic ? 'የማሻሻያ መስኮችን ይግለጹ።' : 'Describe areas needing improvement.'} /></label>
        </div>
        </>)}

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 z-10 flex shrink-0 items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isEditMode ? labels.cancel : labels.close}
          </button>
          <div className="flex flex-wrap items-center justify-end gap-2">
          {!isEditMode && (
            <button
              type="button"
              onClick={() => setIsEditMode(true)}
              className="px-6 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-700 transition-colors"
            >
             {labels.edit}
            </button>
          )}
          {isEditMode && currentCategoryIndex > 0 && (
            <button type="button" onClick={() => { setCurrentCategoryIndex((index) => index - 1); setError(''); }} className="px-6 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold hover:bg-gray-50">
              Previous
            </button>
          )}
          {isEditMode && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 rounded-lg bg-ieps-blue-600 text-white font-semibold hover:bg-ieps-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? labels.submitting : (isLastCategory ? labels.submit : 'Next Category')}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
