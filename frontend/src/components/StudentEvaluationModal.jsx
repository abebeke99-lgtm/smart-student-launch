import { useEffect, useMemo, useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import LanguageToggle from './LanguageToggle';
import { criteriaApi } from '../services/api';
import { validateEvaluationFeedback } from '../utils/validateEvaluationFeedback';

const studentAraCriteria = [
  ['Explains detailed objectives of each sessions', 'የእያንዳንዱን ክፍለ ጊዜ ዝርዝር ዓላማዎች ያብራራል'],
  ['Prepares well for course delivery', 'ለኮርስ አሰጣጥ በቂ ዝግጅት ያደርጋል'],
  ['Teaches as per the course content', 'እንደ ኮርሱ ይዘት ያስተምራል'],
  ['Prepares well for practical sessions', 'ለተግባራዊ ክፍለ ጊዜዎች በቂ ዝግጅት ያደርጋል'],
  ['Delivers the course in such a way that the students understand', 'ተማሪዎች ሊረዱት በሚችሉበት መንገድ ኮርሱን ያቀርባል'],
  ['Use of additional teaching aids', 'ተጨማሪ የማስተማሪያ እርዳታዎችን ይጠቀማል'],
  ['Answers questions raised by students', 'በንጹህ እና ግልጽ መንገድ ለተነሱ ጥያቄዎች መልስ ይሰጣል'],
  ['Uses student centered approach such as cooperative army, group work/presentations etc…', 'ተማሪን ያማከለ አቀራረብ ይጠቀማል'],
  ['Gives respect to students', 'ለተማሪዎች ክብር ይሰጣል'],
  ['Allows students to interact during class room', 'በክፍል ውስጥ ተማሪዎች እንዲሳተፉ ይፈቅዳል'],
  ['Listens to students problems', 'የተማሪዎችን ችግሮች ያደምጣል'],
  ['Ethics, behavior and commitment for knowledge transfer', 'ስነ-ምግባር፣ ባህሪ እና ለእውቀት ሽግግር ቁርጠኝነት አለው'],
  ['Impartiality based on ethnic, religion or gender', 'በጎሳ፣ በሃይማኖት ወይም በፆታ የማያዳላ አሰራር ይከተላል'],
  ['Use class beginning and ending time appropriately', 'የክፍል መጀመሪያ እና ማጠናቀቂያ ሰዓትን በአግባቡ ይጠቀማል'],
  ['Use class time appropriately', 'የክፍል ሰዓቱን በአግባቡ ይጠቀማል'],
  ['Gives time for practical sessions', 'ለተግባራዊ ክፍለ ጊዜዎች በቂ ጊዜ ይሰጣል'],
  ['Solves students’ academic problems on time', 'የተማሪዎችን የአካዳሚክ ችግሮች በሰዓቱ ይፈታል'],
].map(([criterion_text, criterion_text_am], index) => ({
  id: `ara-student-${index + 1}`,
  en: criterion_text,
  am: criterion_text_am,
}));

const getLocalizedText = (value, language) => {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  return String(value[language] ?? value.en ?? value.am ?? '');
};

export default function StudentEvaluationModal({
  open,
  onClose,
  course = {},
  dispatchItem = null,
  sections = [],
  onSubmit,
  isSubmitting = false,
  successMessage = '',
  errorMessage = '',
  mode = 'create',
  evaluationRecord = null,
}) {
  const [responses, setResponses] = useState({});
  const [feedback, setFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isEditMode, setIsEditMode] = useState(mode === 'edit');
  const [language, setLanguage] = useState('am');
  const [dynamicSections, setDynamicSections] = useState([]);
  const [highlightedCriterionId, setHighlightedCriterionId] = useState(null);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

  const targetRole = String(dispatchItem?.target_role || dispatchItem?.targetRole || course?.target_role || course?.role || 'instructor').trim().toLowerCase();
  const isAraRole = ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(targetRole);
  const criteriaType = isAraRole ? 'ara_student' : 'student';

  useEffect(() => {
    if (!open) return;
    criteriaApi.get(criteriaType, targetRole).then((rows) => {
      const grouped = (Array.isArray(rows) ? rows : []).reduce((result, criterion) => {
        const category = criterion.category || 'General';
        const section = result.find((item) => item.title.en === category);
        const item = { id: String(criterion.id), en: criterion.criterion_text, am: criterion.criterion_text_am || criterion.criterion_text };
        if (section) section.items.push(item);
        else result.push({ title: { en: category, am: category }, items: [item] });
        return result;
      }, []);
      setDynamicSections(grouped);
    }).catch(() => setDynamicSections([]));
  }, [criteriaType, open, targetRole]);

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
    setFeedback(evaluationRecord?.feedback || evaluationRecord?.comment || '');
    setStrengths(evaluationRecord?.strengths || '');
    setImprovements(evaluationRecord?.improvements || evaluationRecord?.areas_for_improvement || '');
    setSubmitError('');
    setSubmitSuccess('');
    setHighlightedCriterionId(null);
    setIsEditMode(mode === 'edit');
  }, [open, evaluationRecord, mode]);

  useEffect(() => {
    setSubmitError(errorMessage || '');
  }, [errorMessage]);

  useEffect(() => {
    setSubmitSuccess(successMessage || '');
  }, [successMessage]);

  const isReadOnly = mode === 'view' && !isEditMode;
  const isAra = isAraRole;
  const araSections = useMemo(() => ([{ title: language === 'am' ? 'የARA የአፈጻጸም መስፈርቶች' : 'ARA Performance Criteria', items: studentAraCriteria }]), [language]);
  const evaluationSections = useMemo(() => {
    const sourceSections = dynamicSections.length ? dynamicSections : (isAra ? araSections : sections);
    return sourceSections.reduce((groupedSections, section) => {
      const category = section.category || getLocalizedText(section.title, 'en') || 'General';
      const existingSection = groupedSections.find((item) => item.category === category);
      if (existingSection) {
        existingSection.items.push(...(section.items || []));
      } else {
        groupedSections.push({ ...section, category, items: [...(section.items || [])] });
      }
      return groupedSections;
    }, []);
  }, [dynamicSections, isAra, araSections, sections]);
  const currentCategory = evaluationSections[currentCategoryIndex];
  const isLastCategory = currentCategoryIndex === evaluationSections.length - 1;
  const academicYear = course.academic_year || course.academicYear || course.year || '';
  const semester = course.semester || course.semester_name || course.term || course.course_semester || '';
  const department = course.department_name || course.departmentName || course.department || '';
  const mapDepartmentToCollege = (departmentName) => {
    const normalized = String(departmentName || '').toLowerCase();
    if (['information technology', 'computer science', 'computer engineering', 'software engineering', 'computing', 'ict', 'informatics'].some((keyword) => normalized.includes(keyword))) {
      return 'College of Computing and Informatics';
    }
    if (['chemistry', 'biology', 'mathematics', 'math', 'physics', 'natural sciences', 'science', 'computational'].some((keyword) => normalized.includes(keyword))) {
      return 'CNCS';
    }
    return 'CNCS';
  };
  const hasValue = (value) => value && String(value).trim() && String(value).trim().toUpperCase() !== 'N/A';
  const displayCollege = hasValue(course.college_name || course.collegeName || course.college) ? (course.college_name || course.collegeName || course.college) : mapDepartmentToCollege(department);
  const displayDepartment = hasValue(department) ? department : 'Chemistry/Biology';
  const displayAcademicYear = hasValue(academicYear) ? academicYear : `${new Date().getFullYear() - (new Date().getMonth() + 1 >= 9 ? 7 : 8)} E.C.`;
  const displaySemester = hasValue(semester) ? semester : '2nd';
  const displayDate = new Date().toLocaleDateString();
  const headerLabels = language === 'am'
    ? { university: 'የመቅደላ አምባ ዩኒቨርሲቲ', title: isAra ? 'የአካዳሚክ እና ምርምር ረዳት (ARA) የአፈጻጸም ግምገማ ቅጽ' : 'የመምህራን/ARA መገምገሚያ መስፈርት', subtitle: isAra ? '[በተማሪዎች የሚሞላ]' : '', name: isAra ? 'የARA ስም' : 'የተገምጋሚው መምህር ስም', college: 'ኮሌጅ', department: 'የትምህርት ክፍል', course: 'የኮርሱ ስም', code: 'የኮርስ ኮድ', year: 'የትምህርት ዘመን', semester: 'ሴሚስተር', date: 'ቀን', scale: 'መለኪያ: 1 = በጣም ዝቅተኛ, 2 = ዝቅተኛ, 3 = መካከለኛ, 4 = ከፍተኛ, 5 = በጣም ከፍተኛ, NA = አይመለከተኝም' }
    : { university: 'MEKDELA AMBA UNIVERSITY', title: isAra ? 'ACADEMIC AND RESEARCH ASSISTANTS (ARA) PERFORMANCE EVALUATION FORM' : 'Instructor/ARA Evaluation Criteria', subtitle: isAra ? '[TO BE FILLED BY STUDENTS]' : '', name: isAra ? 'Name of ARA' : 'Instructor Name', college: 'College', department: 'Department', course: 'Course Name', code: 'Course Code', year: 'Academic Year', semester: 'Semester', date: 'Date', scale: 'Scale: 1 = Very Low, 2 = Low, 3 = Average, 4 = High, 5 = Very High, NA = Not Applicable' };
  const totalItems = useMemo(() => evaluationSections.reduce((sum, section) => sum + (section.items?.length || 0), 0), [evaluationSections]);
  const totalScore = useMemo(() => {
    const scores = Object.values(responses).map(Number).filter((value) => Number.isFinite(value) && value > 0);
    const sum = scores.reduce((acc, value) => acc + value, 0);
    return scores.length ? (sum / scores.length) * 20 : 0;
  }, [responses, totalItems]);

  useEffect(() => {
    setCurrentCategoryIndex(0);
  }, [evaluationSections]);

  const setAnswer = (id, value) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
    if (highlightedCriterionId === id) setHighlightedCriterionId(null);
  };

  const handleEditClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsEditMode(true);
  };

  const getUnansweredItems = (items) => (items || []).filter((item) => (
    responses[item.id] === undefined || responses[item.id] === null || responses[item.id] === ''
  ));

  const handleNextCategory = () => {
    const unansweredItems = getUnansweredItems(currentCategory?.items);
    if (unansweredItems.length > 0) {
      const firstUnanswered = unansweredItems[0];
      setHighlightedCriterionId(firstUnanswered.id);
      document.getElementById('criterion-' + firstUnanswered.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setSubmitError(`Please answer all criteria questions before continuing. ${unansweredItems.length} question(s) remaining in this category.`);
      return;
    }

    setSubmitError('');
    setHighlightedCriterionId(null);
    setCurrentCategoryIndex((index) => Math.min(index + 1, evaluationSections.length - 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');

    const feedbackError = validateEvaluationFeedback({
      [language === 'am' ? 'ተጨማሪ አስተያየት' : 'General Comments']: feedback,
      [language === 'am' ? 'ጠንካራ ጎኖች' : 'Strengths']: strengths,
      [language === 'am' ? 'የማሻሻያ መስኮች' : 'Areas for Improvement']: improvements,
    }, language);
    if (feedbackError) {
      setSubmitError(feedbackError);
      return;
    }

    if (!dispatchItem || !dispatchItem.id) {
      setSubmitError('No pending evaluation dispatch found for this course. Please contact your administrator.');
      return;
    }

    // Validate that all criteria have been answered
    const allItems = evaluationSections.reduce((acc, section) => acc.concat(section.items || []), []);
    const unansweredItems = getUnansweredItems(allItems);
    
    if (unansweredItems.length > 0) {
      const firstUnanswered = unansweredItems[0];
      setHighlightedCriterionId(firstUnanswered.id);
      document.getElementById('criterion-' + firstUnanswered.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedCriterionId(null), 3000);
      setSubmitError(`Please answer all criteria questions before submitting. ${unansweredItems.length} question(s) remaining.`);
      return;
    }

    try {
      if (typeof onSubmit === 'function') {
        await onSubmit({
          dispatch_id: dispatchItem.id,
          score: Number(totalScore.toFixed(2)),
          feedback,
          strengths,
          improvements,
          responses,
        });
        setSubmitSuccess('Evaluation submitted successfully.');
      } else {
        setSubmitError('Submit handler is not available.');
      }
    } catch (error) {
      console.error('Student evaluation submission error:', error);
      setSubmitError(error?.message || 'Unable to submit evaluation.');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
        <div className="flex items-center justify-end border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3"><LanguageToggle language={language} onChange={setLanguage} /><button type="button" onClick={onClose} aria-label={language === 'am' ? 'ዝጋ' : 'Close'} className="text-gray-500 hover:text-gray-800"><FaTimes /></button></div>
        </div>

        <div className="space-y-4 p-6 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
          <div className="border-y-2 border-gray-800 py-5 text-gray-900">
            <h2 className="text-center text-lg font-bold sm:text-xl">{headerLabels.university}</h2>
            <p className="mt-1 text-center text-sm font-semibold">{headerLabels.title}</p>
            {headerLabels.subtitle && <p className="mt-1 text-center text-sm font-semibold text-red-600">{headerLabels.subtitle}</p>}
            <div className="mt-5 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <p>{headerLabels.name}: <strong>{course.instructor_name || course.instructor || 'N/A'}</strong></p><p>{headerLabels.college}: <strong>{displayCollege}</strong></p><p>{headerLabels.department}: <strong>{displayDepartment}</strong></p>
              {!isAra && <p>{headerLabels.course}: <strong>{course.course_name || course.name || 'N/A'}</strong> | {headerLabels.code}: <strong>{course.course_code || course.code || 'N/A'}</strong></p>}
              <p>{headerLabels.year}: <strong>{displayAcademicYear}</strong></p><p>{headerLabels.semester}: <strong>{displaySemester}</strong></p>{isAra && <p>{headerLabels.date}: <strong>{displayDate}</strong></p>}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-400 pt-3 text-xs font-semibold"><span>{headerLabels.scale}</span>{mode === 'view' && !isEditMode && <span>{language === 'am' ? 'የማየት ሁኔታ' : 'View Mode'}</span>}</div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 my-4 text-sm text-gray-800">
            <p className="font-bold mb-2">መግለጫ፡</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>እያንዳንዱን የመገምገሚያ ነጥብ በጥንቃቄ አንብብ፤</li>
              <li>ካነበብከው የመገምገሚያ ነጥብ አኳያ የመምህርህን የማስተማር ዝግጅት እና ብቃት፣ የትምህርት አቀራረብና አጠቃላይ ባህርይ በሚዛናዊነት አስቀምጥ፤</li>
              <li>ካነበብከው የመገምገሚያ ነጥብ አኳያ የመምህሩን የሥራ አፈጻጸም ከበጣም ዝቅተኛ እስከ በጣም ከፍተኛ በቁጥር ተመንዝሮ ከተቀመጠው ውስጥ አንዱን በማክበር አመልክት፤</li>
              <li>መምህሩን የማይመለከተው ከሆነ ለዚሁ በተዘጋጀ ቦታ የ √ ምልክት አስቀምጥ፤</li>
              <li>በወንድ ፆታ የተገለፀው ለሴት ፆታም ያገለግላል።</li>
            </ol>
          </div>

          {submitError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{submitError}</div> : null}
          {submitSuccess ? <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">{submitSuccess}</div> : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            {currentCategory && (
              <div
                key={`section-${currentCategory.category || currentCategoryIndex}`}
                className="rounded-3xl border border-gray-200 bg-gray-50 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{getLocalizedText(currentCategory.title, language)}</h3>
                  <span className="text-sm text-gray-500">
                    Category {currentCategoryIndex + 1} of {evaluationSections.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {(currentCategory.items || []).map((item, itemIndex) => (
                    <div
                      id={`criterion-${item.id}`}
                      key={`item-${getLocalizedText(item.id, 'en') || getLocalizedText(item.en, 'en') || itemIndex}-${currentCategoryIndex}-${itemIndex}`}
                      className={`flex flex-col gap-4 rounded-2xl border p-4 transition-colors duration-300 sm:flex-row sm:items-center sm:justify-between ${
                        highlightedCriterionId === item.id
                          ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
                          : 'border-gray-100 bg-white'
                      }`}
                    >
                      <p className="flex-1 pr-4 text-sm font-medium text-gray-700">
                        <span className="mr-3 font-mono text-gray-400">{String(item.id || itemIndex + 1).replace(/[^0-9]/g, '') || itemIndex + 1}.</span>
                        {getLocalizedText(language === 'am' ? (item.am || item.labelAm || item.textAm || item.en || item.label || item.text) : (item.en || item.label || item.text), language)}
                      </p>

                      <div className="flex items-center gap-2 shrink-0">
                        {[1, 2, 3, 4, 5, 'NA'].map((value) => {
                          const selected = responses[item.id] === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => !isReadOnly && setAnswer(item.id, value)}
                              disabled={isReadOnly}
                              className={`flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-sm font-semibold transition-all duration-150 ${
                                selected
                                  ? 'scale-105 bg-blue-600 text-white shadow-md shadow-blue-200 ring-2 ring-blue-300'
                                  : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600'
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

            {isLastCategory && <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{language === 'am' ? 'አጠቃላይ ውጤት' : 'Overall score'}</p>
                  <p className="text-xs text-gray-500">{language === 'am' ? 'ከተመረጡ ደረጃዎች የተሰላ' : 'Calculated from selected ratings'}</p>
                </div>
                <div className="rounded-full bg-ieps-blue-50 px-4 py-2 text-sm font-semibold text-ieps-blue-700">{totalScore.toFixed(1)} / 100</div>
              </div>
            </div>}

            {isLastCategory && <label className="block text-sm text-gray-700">
              <span className="mb-2 block font-medium">{language === 'am' ? 'ተጨማሪ አስተያየት' : 'Additional feedback'}</span>
              <textarea
                rows={4}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                maxLength={500}
                disabled={isReadOnly}
                className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:cursor-default disabled:bg-gray-50"
                placeholder={language === 'am' ? 'ተጨማሪ አስተያየት እዚህ ያስገቡ።' : 'Add any additional feedback here.'}
              />
            </label>}

            {isLastCategory && <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm text-gray-700"><span className="mb-2 block font-medium">{isAra ? language === 'am' ? 'የአካዳሚክ እና ምርምር ረዳቱ ጥንካሬዎች' : 'Strengths of the Academic and Research Assistant.' : language === 'am' ? 'ጠንካራ ጎኖች' : 'Strengths'}</span><textarea rows={3} value={strengths} onChange={(event) => setStrengths(event.target.value)} maxLength={500} disabled={isReadOnly} className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:bg-gray-50" placeholder={language === 'am' ? 'ጠንካራ ጎኖችን ይግለጹ።' : 'Describe strengths and positive contributions.'} /></label>
              <label className="block text-sm text-gray-700"><span className="mb-2 block font-medium">{isAra ? language === 'am' ? 'የአካዳሚክ እና ምርምር ረዳቱ ሊያሻሽላቸው የሚገቡ ነጥቦች' : 'Suggested points/aspects the Academic and Research Assistant should improve.' : language === 'am' ? 'የማሻሻያ መስኮች' : 'Areas for improvement'}</span><textarea rows={3} value={improvements} onChange={(event) => setImprovements(event.target.value)} maxLength={500} disabled={isReadOnly} className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 disabled:bg-gray-50" placeholder={language === 'am' ? 'የማሻሻያ መስኮችን ይግለጹ።' : 'Describe areas needing improvement.'} /></label>
            </div>}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                {mode === 'view' && !isEditMode ? 'Close' : 'Cancel'}
              </button>

              {currentCategoryIndex > 0 && <button type="button" onClick={() => { setSubmitError(''); setHighlightedCriterionId(null); setCurrentCategoryIndex((index) => index - 1); }} className="rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Previous
              </button>}

              {!isLastCategory ? (
                <button type="button" onClick={handleNextCategory} className="rounded-full bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ieps-blue-700">
                  Next
                </button>
              ) : mode === 'view' && !isEditMode ? (
                <button type="button" onClick={handleEditClick} className="rounded-full bg-gray-700 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">
                  Edit Evaluation
                </button>
              ) : (
                <button type="submit" disabled={isSubmitting || isReadOnly} className="rounded-full bg-ieps-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ieps-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                  {isSubmitting ? 'Submitting...' : mode === 'view' ? 'Update Evaluation' : 'Submit Evaluation'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
