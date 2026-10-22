import { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import LanguageToggle from './LanguageToggle';
import { getQuestionText, groupCriteriaByCategory } from '../utils/evaluationCriteria';
import { validateEvaluationFeedback } from '../utils/validateEvaluationFeedback';
import { useUiText } from '../hooks/useUiText';

const isLabAssistantRole = (role) => ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(String(role || '').trim().toLowerCase());

export const standardPeerEvaluationSections = [
  {
    title: 'Core Competency: Subject matter',
    titleAm: 'መሠረታዊ ብቃት፦ የትምህርት ይዘት',
    items: [
      { id: 'p1', number: 1, label: 'Contribution in preparing and searching for teaching materials.', label_am: 'የትምህርት መርጃ ቁሳቁሶችን በማዘጋጀትና በመፈለግ ያለው አስተዋጽኦ።' },
      { id: 'p2', number: 2, label: 'Continuous update of the subject matter.', label_am: 'የትምህርት ይዘቱን በቀጣይነት ማዘመን።' },
      { id: 'p3', number: 3, label: 'Delivering seminars that are relevant to his/her teaching subject.', label_am: 'ከሚያስተምረው ዘርፍ ጋር የሚዛመዱ ሴሚናሮችን ማቅረብ።' },
      { id: 'p4', number: 4, label: 'Level of subject matter knowledge and skill.', label_am: 'የትምህርት ይዘት እውቀትና ክህሎት ደረጃ።' },
    ],
  },
  {
    title: 'Core Competency: Research and Community Services',
    titleAm: 'መሠረታዊ ብቃት፦ ምርምርና የማህበረሰብ አገልግሎት',
    items: [
      { id: 'p5', number: 5, label: 'Willingness and level of engagement in community service and volunteer activities.', label_am: 'በማህበረሰብ አገልግሎትና በበጎ ፈቃድ ተግባራት የመሳተፍ ፈቃደኝነትና የተሳትፎ ደረጃ።' },
      { id: 'p6', number: 6, label: 'Participation in seminars/workshops at department, faculty or institution level during the year.', label_am: 'በዓመቱ በዲፓርትመንት፣ በፋኩልቲ ወይም በተቋም ደረጃ በሴሚናርና በወርክሾፕ ያለው ተሳትፎ።' },
      { id: 'p7', number: 7, label: 'Identifying priority areas in one’s discipline and pursuing research in that area and willingness to help colleagues in identifying areas of research and proposal development.', label_am: 'በሙያው ቅድሚያ የሚሰጣቸውን የምርምር መስኮች መለየትና ምርምር ማካሄድ፣ ባልደረቦችንም በምርምር ርዕስና በፕሮፖዛል ዝግጅት መርዳት።' },
    ],
  },
  {
    title: 'Professional Competency',
    titleAm: 'ሙያዊ ብቃት',
    items: [
      { id: 'p8', number: 8, label: 'Guidance and counseling role to students.', label_am: 'ለተማሪዎች የመመሪያና የምክር ድጋፍ መስጠት።' },
      { id: 'p9', number: 9, label: 'Contributing constructive ideas and activities that improve the teaching-learning process.', label_am: 'የማስተማርና የመማር ሂደትን የሚያሻሽሉ ገንቢ ሀሳቦችንና ተግባራትን ማበርከት።' },
      { id: 'p10', number: 10, label: 'Participation in problem identification and solving at department, college, or institution level.', label_am: 'በዲፓርትመንት፣ በኮሌጅ ወይም በተቋም ደረጃ ችግሮችን በመለየትና በመፍታት መሳተፍ።' },
      { id: 'p11', number: 11, label: 'Participation in Comprehensive Continuous Professional Development (CCPD, HDP, ELIP).', label_am: 'በቀጣይነት ሙያዊ ልማት (CCPD፣ HDP፣ ELIP) መሳተፍ።' },
      { id: 'p12', number: 12, label: 'Willingness to actively participate in cooperative learning and team teaching activities.', label_am: 'በትብብር ትምህርትና በቡድን ማስተማር ተግባራት በንቃት ለመሳተፍ ያለው ፈቃደኝነት።' },
    ],
  },
  {
    title: 'Ethical Competency',
    titleAm: 'ሥነ ምግባራዊ ብቃት',
    items: [
      { id: 'p13', number: 13, label: 'Willingness to participate and level of commitment in committee work.', label_am: 'በኮሚቴ ሥራ ለመሳተፍ ያለው ፈቃደኝነትና የቁርጠኝነት ደረጃ።' },
      { id: 'p14', number: 14, label: 'Willingness to share university resources with other colleagues.', label_am: 'የዩኒቨርሲቲ ሀብቶችን ከባልደረቦች ጋር ለመጋራት ያለው ፈቃደኝነት።' },
      { id: 'p15', number: 15, label: 'Showing cordiality to others and respecting ideas of others.', label_am: 'ለሌሎች ወዳጃዊነት ማሳየትና ሀሳባቸውን ማክበር።' },
      { id: 'p16', number: 16, label: 'Having a positive attitude to work with others (team spirit).', label_am: 'ከሌሎች ጋር ለመሥራት አዎንታዊ አመለካከትና የቡድን መንፈስ ማሳየት።' },
      { id: 'p17', number: 17, label: 'Level of respect to rules, regulations and guidelines of the institution.', label_am: 'የተቋሙን ደንቦች፣ መመሪያዎችና አሰራሮች የማክበር ደረጃ።' },
      { id: 'p18', number: 18, label: 'His/her discipline (dressing, addictions, personality, etc.).', label_am: 'የሥነ ሥርዓት ባህሪው (አለባበስ፣ ሱሶች፣ ስብዕና ወዘተ)።' },
    ],
  },
  {
    title: 'Time Management',
    titleAm: 'የጊዜ አጠቃቀም',
    items: [
      { id: 'p19', number: 19, label: 'Time management in department affairs and teaching-learning activities.', label_am: 'በዲፓርትመንት ጉዳዮችና በማስተማር-መማር ተግባራት የጊዜ አጠቃቀም።' },
      { id: 'p20', number: 20, label: 'Time utilization for consultation hours.', label_am: 'ለማማከር ሰዓታት የጊዜ አጠቃቀም።' },
    ],
  },
];

const araPeerCriteria = [
  ['Core Competency', 'Continuous update of the subject matter', 'በትምህርት ጉዳዩ ላይ ቀጣይነት ያለው እውቀት ማዘመን'],
  ['Core Competency', 'Level of his/her subject matter knowledge and practical skill', 'የትምህርት ጉዳይ እውቀትና ተግባራዊ ብቃት ደረጃ'],
  ['Professional Development', 'Participation in seminars/workshop/research at department/college/university level during the year', 'በዓመቱ በክፍል/ኮሌጅ/ዩኒቨርሲቲ ደረጃ በሴሚናር፣ ወርክሾፕና ምርምር ተሳትፎ'],
  ['Student Support', 'Guidance and counseling role to students during practical sessions', 'በተግባራዊ ክፍለ ጊዜዎች ለተማሪዎች መመሪያና ምክር መስጠት'],
  ['Laboratory Support', 'Assist faculty and students in the analysis of samples, maintenance, upkeep of instruments facilities, and general supervision', 'መምህራንንና ተማሪዎችን በናሙና ትንተና፣ በመሳሪያ ጥገናና አጠቃቀም፣ በተቋማትና በአጠቃላይ ክትትል መርዳት'],
  ['Professional Contribution', 'Contributing ideas and activities that improve the teaching learning process', 'የማስተማርና የመማር ሂደትን የሚያሻሽሉ ሀሳቦችና ተግባራትን ማበርከት'],
  ['Professional Competence', 'Participation in problem identification and solving at department level', 'በክፍል ደረጃ ችግርን በመለየትና በመፍታት ተሳትፎ'],
  ['Professional Attitude', 'Willingness and preparedness to implement reform strategies', 'የማሻሻያ ስልቶችን ለመተግበር ፈቃደኛነትና ዝግጁነት'],
  ['Teamwork', 'Willing to actively participate in education learning army/cooperative team work', 'በትምህርት መማሪያ ሠራዊት/በትብብር የቡድን ስራ በንቃት ለመሳተፍ ፈቃደኛነት'],
  ['Teaching Methodology', 'Implementation of different teaching methods in his discipline.', 'በሙያው የተለያዩ የማስተማር ዘዴዎችን መተግበር'],
  ['Institutional Commitment', 'Willingness to participate and level of commitment in committee works', 'በኮሚቴ ስራዎች ለመሳተፍ ፈቃደኛነትና የቁርጠኝነት ደረጃ'],
  ['Cooperation', 'Willingness to share university resources with other colleagues', 'የዩኒቨርሲቲ ሀብቶችን ከሌሎች ባልደረቦች ጋር ለመጋራት ፈቃደኛነት'],
  ['Interpersonal Skills', 'Showing cordiality to others and Team work spirit', 'ለሌሎች ወዳጃዊነትንና የቡድን ስራ መንፈስን ማሳየት'],
  ['Institutional Compliance', 'Level of respect to rules, regulation and guidelines of the institution', 'ለተቋሙ ደንቦች፣ መመሪያዎችና አሰራሮች የሚያሳየው ክብር ደረጃ'],
  ['Professional Conduct', 'His/her discipline (dressing, personality etc...)', 'የሥነ-ስርዓት ባህሪው (አለባበስ፣ ስብዕና ወዘተ)'],
  ['Collaboration', 'Willingness to help colleagues during laboratory work/workshop etc..', 'በላብራቶሪ ስራ/ወርክሾፕ ወቅት ባልደረቦችን ለመርዳት ፈቃደኛነት'],
  ['Safety and Reporting', 'Report accident, unusual events, misbehavior, and failures of equipment due to mal operation/careless handling with the causing agents timely', 'አደጋ፣ ያልተለመዱ ክስተቶች፣ መጥፎ ባህሪና በተሳሳተ/በግዴለሽነት አጠቃቀም የተከሰቱ የመሳሪያ ብልሽቶችን ከምክንያታቸው ጋር በወቅቱ ማሳወቅ'],
  ['Time Management', 'Time utilization of class sessions (laboratory, workshop etc...)', 'የክፍለ ጊዜዎችን ጊዜ አጠቃቀም (ላብራቶሪ፣ ወርክሾፕ ወዘተ)'],
].map(([category, criterion_text, criterion_text_am], index) => ({
  id: `ara-peer-${index + 1}`,
  number: index + 1,
  category,
  criterion_text,
  criterion_text_am,
}));

const categoryAmharic = {
  'Core Competency: Subject matter': 'መሠረታዊ ብቃት፦ የትምህርት ይዘት',
  'Core Competency: Research and Community Services': 'መሠረታዊ ብቃት፦ ምርምርና የማህበረሰብ አገልግሎት',
  'Professional Competency': 'ሙያዊ ብቃት',
  'Ethical Competency': 'ሥነ ምግባራዊ ብቃት',
  'Core Competency': 'መሠረታዊ ብቃት',
  'Professional Development': 'ሙያዊ ልማት',
  'Student Support': 'የተማሪ ድጋፍ',
  'Laboratory Support': 'የላብራቶሪ ድጋፍ',
  'Professional Contribution': 'ሙያዊ አስተዋጽኦ',
  'Professional Competence': 'የሙያ ብቃት',
  'Professional Attitude': 'ሙያዊ አመለካከት',
  'Teamwork': 'የቡድን ስራ',
  'Teaching Methodology': 'የማስተማር ዘዴ',
  'Institutional Commitment': 'የተቋም ቁርጠኝነት',
  'Cooperation': 'ትብብር',
  'Interpersonal Skills': 'የግለሰቦች ግንኙነት ችሎታ',
  'Institutional Compliance': 'የተቋም ተገዢነት',
  'Professional Conduct': 'ሙያዊ ስነ-ምግባር',
  'Collaboration': 'ትብብር ስራ',
  'Safety and Reporting': 'ደህንነትና ሪፖርት ማድረግ',
  'Time Management': 'የጊዜ አጠቃቀም',
};

export default function PeerEvaluationModal({
  open,
  onClose,
  evaluation = {},
  onSubmit,
  isSubmitting = false,
  successMessage = '',
  errorMessage = '',
  mode = 'create',
  evaluationRecord = null,
  sections = standardPeerEvaluationSections,
}) {
  const t = useUiText();
  const [responses, setResponses] = useState({});
  const [strengths, setStrengths] = useState('');
  const [suggestions, setSuggestions] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(mode === 'edit');
  const [criteria, setCriteria] = useState([]);
  const [language, setLanguage] = useState('en');
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [highlightedCriterionId, setHighlightedCriterionId] = useState(null);
  const [criterionErrors, setCriterionErrors] = useState([]);
  const standardCriteria = useMemo(
    () => sections.flatMap((section) => (section.items || section.criteria || []).map((item, index) => ({
      ...item,
      id: item.id || `peer-${section.title || section.category}-${index + 1}`,
      number: item.number || index + 1,
      category: item.category || section.category || section.title || 'General',
      criterion_text: item.criterion_text || item.label || item.text || '',
      criterion_text_am: item.criterion_text_am || item.label_am || '',
    }))),
    [sections],
  );

  useEffect(() => {
    if (!open) return;
    const targetRole = String(evaluation?.target_role || evaluation?.targetRole || '').toLowerCase();
    if (isLabAssistantRole(targetRole)) {
      setCriteria(araPeerCriteria);
      return;
    }
    setCriteria(standardCriteria);
  }, [evaluation?.target_role, evaluation?.targetRole, open, standardCriteria]);

  useEffect(() => {
    if (!open) return;

    const nextResponses = (() => {
      if (!evaluationRecord) return {};
      if (typeof evaluationRecord.responses === 'string') {
        try {
          return JSON.parse(evaluationRecord.responses);
        } catch {
          return {};
        }
      }
      return evaluationRecord.responses || {};
    })();

    setResponses(nextResponses);
    setStrengths(evaluationRecord?.strengths || '');
    setSuggestions(evaluationRecord?.suggestions || '');
    setSubmitError('');
    setSubmitSuccess('');
    setIsEditMode(mode === 'edit');
  }, [open, evaluationRecord, mode]);

  useEffect(() => {
    setSubmitError(errorMessage || '');
  }, [errorMessage]);

  useEffect(() => {
    setSubmitSuccess(successMessage || '');
  }, [successMessage]);

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
    const dept = evaluation?.department_name || evaluation?.departmentName || evaluation?.target_department_name;
    if (dept && String(dept).trim() && String(dept).trim().toUpperCase() !== 'N/A') {
      return dept;
    }
    return 'Chemistry/Biology';
  };

  const getAcademicYear = () => {
    const year = evaluation?.academic_year || evaluation?.academicYear || evaluation?.year;
    if (year && String(year).trim() && String(year).trim().toUpperCase() !== 'N/A') {
      return year;
    }
    // Calculate current Ethiopian academic year
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const ethiopianYear = month >= 9 || (month === 8 && now.getDate() >= 11) ? currentYear - 7 : currentYear - 8;
    return `${ethiopianYear} E.C.`;
  };

  const getSemester = () => {
    const sem = evaluation?.semester;
    if (sem && String(sem).trim() && String(sem).trim().toUpperCase() !== 'N/A') {
      return sem;
    }
    return 'II (2nd Semester)';
  };

  const getEvaluationDate = () => {
    // Try to use provided date first, fallback to today
    if (evaluation?.date || evaluation?.evaluation_date) {
      return new Date(evaluation.date || evaluation.evaluation_date).toLocaleDateString();
    }
    return new Date().toLocaleDateString();
  };

  const isReadOnly = mode === 'view' && !isEditMode;
  const isAra = isLabAssistantRole(evaluation?.target_role || evaluation?.targetRole);
  const isAmharic = language === 'am';
  const headerLabels = language === 'am'
    ? { university: 'የመቅደላ አምባ ዩኒቨርሲቲ', title: isAra ? 'የአካዳሚክ እና ምርምር ረዳት (ARA) የአፈጻጸም ግምገማ ቅጽ' : 'የመምህራን የእኩዮች ግምገማ ቅጽ', subtitle: 'በባልደረቦች የሚሞላ', name: isAra ? 'የARA ስም' : 'የተገምጋሚው ስም', college: 'ኮሌጅ', department: 'የትምህርት ክፍል', course: 'የኮርሱ ስም', code: 'የኮርስ ኮድ', year: 'የትምህርት ዘመን', semester: 'ሴሚስተር', scale: 'መለኪያ፦ 1 = በጣም ዝቅተኛ፣ 2 = ዝቅተኛ፣ 3 = መካከለኛ፣ 4 = ከፍተኛ፣ 5 = በጣም ከፍተኛ፣ NA = አይመለከተውም' }
    : { university: 'MEKDELA AMBA UNIVERSITY', title: isAra ? 'ACADEMIC AND RESEARCH ASSISTANTS (ARA) PERFORMANCE EVALUATION FORM' : 'INSTRUCTORS\' PERFORMANCE EVALUATION CHECKLIST (To be completed by Peers)', subtitle: 'To be completed by colleagues.', name: isAra ? 'Name of ARA' : 'Evaluated Instructor', college: 'College', department: 'Department', course: 'Course Name', code: 'Course Code', year: 'Academic Year', semester: 'Semester', scale: 'Scale: 1 = Very Low, 2 = Low, 3 = Average, 4 = High, 5 = Very High, NA = Not Applicable' };
  const criteriaSections = groupCriteriaByCategory(criteria);
  const currentCategory = criteriaSections[currentCategoryIndex];
  const isLastCategory = currentCategoryIndex === criteriaSections.length - 1;
  useEffect(() => {
    if (open) {
      setCurrentCategoryIndex(0);
      setHighlightedCriterionId(null);
      setCriterionErrors([]);
    }
  }, [open, evaluation?.id]);
  const totalItems = useMemo(() => criteriaSections.reduce((sum, section) => sum + (section.criteria?.length || 0), 0), [criteriaSections]);
  const totalScore = useMemo(() => {
    const values = Object.values(responses)
      .map((value) => (typeof value === 'string' && value.trim().toUpperCase() === 'NA' ? null : Number(value)))
      .filter((value) => Number.isFinite(value) && value > 0);
    const sum = values.reduce((acc, value) => acc + value, 0);
    return values.length ? (sum / values.length) * 20 : 0;
  }, [responses, totalItems]);

  const setAnswer = (id, value) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
    setCriterionErrors((current) => current.filter((criterionId) => criterionId !== id));
    setHighlightedCriterionId((current) => current === id ? null : current);
    setSubmitError('');
  };

  const handleEditClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditMode(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    const feedbackError = validateEvaluationFeedback({
      [language === 'am' ? 'ጥንካሬዎች' : 'Strengths']: strengths,
      [language === 'am' ? 'የማሻሻያ ሀሳቦች' : 'Areas for Improvement']: suggestions,
    }, language);
    if (feedbackError) {
      setSubmitError(feedbackError);
      return;
    }

    if (!evaluation || !evaluation.id) {
      setSubmitError(isAmharic ? 'ምንም የእኩዮች ግምገማ አልተመረጠም። እባክዎ አስተዳዳሪውን ያነጋግሩ።' : t('No peer evaluation selected. Please contact your administrator.'));
      return;
    }

    if (!isLastCategory) {
      const unanswered = (currentCategory?.criteria || []).filter((item) => responses[item.id] === undefined || responses[item.id] === null || responses[item.id] === '');
      if (unanswered.length > 0) {
        setSubmitError(isAmharic
          ? `እባክዎ የዚህን ምድብ ሁሉንም መስፈርቶች ይመልሱ። ${unanswered.length} ቀርቷል።`
          : `Please answer all questions in this category. ${unanswered.length} question(s) remaining.`);
        setHighlightedCriterionId(unanswered[0].id);
        setCriterionErrors(unanswered.map((item) => item.id));
        document.getElementById(`peer-criterion-${unanswered[0].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      setSubmitError('');
      setCriterionErrors([]);
      setCurrentCategoryIndex((index) => index + 1);
      return;
    }

    // Validate that all criteria have been answered
    const allItemIds = criteriaSections.reduce((acc, section) => acc.concat((section.criteria || []).map(item => String(item.id))), []);
    const unansweredItems = allItemIds.filter((id) => responses[id] === undefined || responses[id] === null || responses[id] === '');
    
    if (unansweredItems.length > 0) {
      setSubmitError(isAmharic
        ? `ከማስገባትዎ በፊት ሁሉንም መስፈርቶች ይመልሱ። ያልተመለሱ ጥያቄዎች፦ ${unansweredItems.length}`
        : `Please answer all criteria questions before submitting. ${unansweredItems.length} question(s) remaining.`);
      setCriterionErrors(unansweredItems);
      return;
    }

    try {
      await onSubmit({
        peer_evaluation_id: evaluation.id,
        score: Number(totalScore.toFixed(2)),
        strengths,
        suggestions,
        responses,
      });
      setSubmitSuccess(isAmharic ? 'የእኩዮች ግምገማ በተሳካ ሁኔታ ተልኳል።' : 'Peer evaluation submitted successfully.');
    } catch (error) {
      setSubmitError(error?.message || t('Unable to submit peer evaluation.'));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-5">
      <div className="flex max-h-[calc(100vh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]">
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">{headerLabels.university}</p>
            <h2 className="mt-1 text-lg font-bold leading-tight text-gray-900">{isAra ? headerLabels.title : isAmharic ? 'የእኩዮች ግምገማ' : 'INSTRUCTORS’ PERFORMANCE EVALUATION CHECKLIST'}</h2>
            <p className="text-xs text-gray-500">{headerLabels.subtitle || evaluation.instructor_name || 'Peer Evaluation'}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle language={language} onChange={setLanguage} />
            <button type="button" onClick={onClose} aria-label={language === 'am' ? 'ዝጋ' : t('Close')} className="text-gray-500 hover:text-gray-800">
              <FaTimes />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div className="border-y border-gray-400 py-3 text-gray-900">
            <h2 className="text-center text-base font-bold">{headerLabels.university}</h2>
            <p className="mt-1 text-center text-xs font-semibold">{headerLabels.title}</p>
            {headerLabels.subtitle && <p className="mt-1 text-center text-sm font-semibold text-red-600">{headerLabels.subtitle}</p>}
            <div className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <p>{headerLabels.name}: <strong>{evaluation.instructor_name || 'N/A'}</strong></p><p>{headerLabels.college}: <strong>{getCollegeName()}</strong></p><p>{headerLabels.department}: <strong>{getDepartmentName()}</strong></p>
              <p>{headerLabels.year}: <strong>{getAcademicYear()}</strong></p><p>{headerLabels.semester}: <strong>{getSemester()}</strong></p>
              <p>{language === 'am' ? 'ቀን' : 'Date'}: <strong>{getEvaluationDate()}</strong></p>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-400 pt-3 text-xs font-semibold"><span>{headerLabels.scale}</span>{mode === 'view' && !isEditMode && <span>{language === 'am' ? 'የማየት ሁኔታ' : 'View Mode'}</span>}</div>
          </div>
          {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{submitError}</div> : null}
          {submitSuccess ? <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{submitSuccess}</div> : null}

          <form id="peer-evaluation-form" onSubmit={handleSubmit} className="space-y-5">
            {currentCategory && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700">{isAmharic ? (categoryAmharic[currentCategory.category] || currentCategory.category) : currentCategory.category}</h3>
                    <span className="text-xs text-gray-500">{t('Category {current} of {total}').replace('{current}', currentCategoryIndex + 1).replace('{total}', criteriaSections.length)}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {(currentCategory.criteria || []).map((item) => (
                    <div id={`peer-criterion-${item.id}`} key={item.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${criterionErrors.includes(item.id) || highlightedCriterionId === item.id ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-200' : 'border-gray-200 bg-white'}`}>
                      <p className="flex-1 pr-2 text-xs font-medium leading-relaxed text-gray-700">
                        <span className="mr-2 font-mono font-bold text-gray-400">{item.number || String(item.id).replace(/[^0-9]/g, '') || item.id}.</span>
                        {getQuestionText(item, language)}
                        {criterionErrors.includes(item.id) && <span className="mt-1 block text-[11px] font-semibold text-rose-700" role="alert">⚠️ {t('Please select a score for this criterion before proceeding.')}</span>}
                      </p>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {[1, 2, 3, 4, 5, 'NA'].map((value) => {
                          const selected = responses[item.id] === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => { if (!isReadOnly) { setAnswer(item.id, value); setHighlightedCriterionId(null); } }}
                              disabled={isReadOnly}
                              className={`flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold transition-all duration-150 ${
                                selected
                                  ? 'scale-105 border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                                  : 'border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
                              } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                            >
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isLastCategory && <>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{isAmharic ? 'አጠቃላይ ውጤት' : 'Overall score'}</p>
                  <p className="text-xs text-gray-500">{isAmharic ? 'ከተመረጡ ውጤቶች የተሰላ' : 'Calculated from selected ratings'}</p>
                </div>
                <div className="rounded-full bg-ieps-blue-50 px-4 py-2 text-sm font-semibold text-ieps-blue-700">{totalScore.toFixed(1)} / 100</div>
              </div>
            </div>

            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">{isAra ? (isAmharic ? 'የአካዳሚክ እና ምርምር ረዳቱ ጥንካሬዎች' : 'Strengths of the Academic and Research Assistant') : isAmharic ? 'ጥንካሬዎች' : 'Strengths'}</span>
              <textarea
                rows={3}
                value={strengths}
                onChange={(event) => setStrengths(event.target.value)}
                maxLength={500}
                disabled={isReadOnly}
                className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:cursor-default disabled:bg-gray-50"
                placeholder={isAmharic ? 'ጥንካሬዎችንና አዎንታዊ አስተዋጽኦዎችን ይግለጹ።' : t('Describe strengths and positive contributions.')}
              />
            </label>
            </>}

            <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">{isAra ? (isAmharic ? 'የአካዳሚክ እና ምርምር ረዳቱ ሊያሻሽላቸው የሚገቡ ነጥቦች' : 'Suggested points/aspects the Academic and Research Assistant should improve') : isAmharic ? 'የማሻሻያ ሀሳቦች' : 'Suggestions for improvement'}</span>
              <textarea
                rows={3}
                value={suggestions}
                onChange={(event) => setSuggestions(event.target.value)}
                maxLength={500}
                disabled={isReadOnly}
                className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:cursor-default disabled:bg-gray-50"
                placeholder={isAmharic ? 'ለእድገት ገንቢ የማሻሻያ ሀሳቦችን ይስጡ።' : t('Provide constructive suggestions for growth.')}
              />
            </label>

            <div className="h-16" />
          </form>
        </div>

        <div className="sticky bottom-0 left-0 z-20 border-t border-gray-200 bg-white px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={onClose} className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              {mode === 'view' && !isEditMode ? (isAmharic ? 'ዝጋ' : t('Close')) : (isAmharic ? 'ሰርዝ' : t('Cancel'))}
            </button>

            <div className="flex flex-wrap justify-end gap-2">
            {mode === 'view' && !isEditMode ? (
              <button type="button" onClick={handleEditClick} className="rounded-full bg-gray-700 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
                {isAmharic ? 'ግምገማውን አርትዕ' : 'Edit Evaluation'}
              </button>
            ) : (
              <>
              {currentCategoryIndex > 0 && <button type="button" onClick={() => { setCurrentCategoryIndex((index) => index - 1); setSubmitError(''); }} className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700">{t('Previous')}</button>}
              <button type="submit" form="peer-evaluation-form" disabled={isSubmitting || isReadOnly} className="rounded-full bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ieps-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                {isSubmitting
                  ? (isAmharic ? 'በመላክ ላይ...' : t('Submitting...'))
                  : mode === 'view' || mode === 'edit'
                    ? (isLastCategory ? (isAmharic ? 'ግምገማውን አዘምን' : t('Update Evaluation')) : (isAmharic ? 'ቀጣይ ምድብ' : t('Next Category')))
                    : (isAmharic ? (isLastCategory ? 'የእኩዮች ግምገማ ላክ' : 'ቀጣይ ምድብ') : (isLastCategory ? t('Submit Evaluation') : t('Next Category')))}
              </button>
              </>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
