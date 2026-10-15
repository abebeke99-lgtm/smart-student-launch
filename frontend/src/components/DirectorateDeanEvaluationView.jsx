import { useState } from 'react';
import LanguageToggle from './LanguageToggle';
import EvaluationDeadlineBadge from './EvaluationDeadlineBadge';

const ratingOptions = [1, 2, 3, 4, 5, 'NA'];

const criteriaGroups = [
  {
    category: 'Core Competency',
    criteria: [
      { id: 'self_development', weight: 5, label: 'Efforts of self-development in his/her specialization' },
      { id: 'subject_matter', weight: 5, label: 'Adequacy of subject matter knowledge' },
      { id: 'teaching_methodology', weight: 5, label: 'Professional Skill / Teaching Methodology' },
      { id: 'assignments', weight: 5, label: 'Willingness to accept additional teaching assignments when a compelling situation arises in the department' },
      { id: 'mentorship', weight: 5, label: 'Effectiveness as a mentor in cooperative learning, internship, etc...' },
      { id: 'curriculum', weight: 5, label: 'Active participation in the improvement of the teaching-learning process, seminars, workshops, symposia, and reviewing of teaching materials (curriculum)' },
      { id: 'community_service', weight: 5, label: 'Participation in community service affairs and volunteer activities and willingness to participate in activities other than regular teaching (mentorship)' },
      { id: 'research', weight: 5, label: 'Identifying priority areas in one’s discipline and pursuing research in that area' },
      { id: 'academic_advising', weight: 5, label: 'Participation in research projects and project proposal development' },
      { id: 'professional_growth', weight: 5, label: 'Performance as an academic advisor' },
    ],
  },
  {
    category: 'Professional Competence',
    criteria: [
      { id: 'problem_solving', weight: 5, label: 'Participation in problem identification and solving at department/college/institution' },
      { id: 'cpd_hdp', weight: 5, label: 'Participation in Comprehensive Continuous Professional Development /CCPD, HDP, ELIP' },
      { id: 'continuous_assessment', weight: 5, label: 'Continuous assessment implementation' },
      { id: 'tutorials', weight: 5, label: 'Providing and reporting tutorial activities designed for the students' },
    ],
  },
  {
    category: 'Time Management',
    criteria: [
      { id: 'class_execution', weight: 5, label: 'Executing assigned classes/invigilation on time.' },
      { id: 'consultation', weight: 5, label: 'Notifying and implementing consultation timely and giving timely feedback to students' },
      { id: 'deadlines_grading', weight: 5, label: 'Meeting deadlines (in reporting, SIMS result feeding, submission of grades/documents...etc...)' },
    ],
  },
  {
    category: 'Ethical Competence',
    criteria: [
      { id: 'resource_use', weight: 5, label: 'Showing concern for the use of resources of the department and the University' },
      { id: 'committee_teamwork', weight: 5, label: 'Willingness and participation in committee work at the department/University level and having a positive attitude to work with others, team spirit' },
      { id: 'professional_ethics', weight: 5, label: 'His/her professional ethics and being a role model (dressing, hairstyle, personality, addiction...)' },
    ],
  },
];

const criteria = criteriaGroups.flatMap((group) => group.criteria.map((criterion) => ({
  ...criterion,
  category: group.category,
})));

const categoryAm = ['መሠረታዊ ብቃት', 'የሙያ ብቃት', 'የጊዜ አጠቃቀም', 'የሥነ-ምግባር ብቃት'];
const criteriaAm = [
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
  'ቀጣይነት ያለውን ግምገማ በተግባር ማዋል',
  'ለተማሪዎች የተዘጋጁ የቱቶሪያል ተግባራትን ማቅረብና ሪፖርት ማድረግ',
  'የተመደቡ ክፍሎችንና የፈተና ተቆጣጣሪነትን በሰዓቱ ማከናወን',
  'የምክክር ጊዜን በወቅቱ ማሳወቅና መስጠት እና ለተማሪዎች በወቅቱ አስተያየት መስጠት',
  'ቀነ ገደቦችን ማክበር (ሪፖርት፣ SIMS ውጤት መግባት፣ ውጤት/ሰነዶች ማስገባት ወዘተ)',
  'የዩኒቨርሲቲ ሀብቶችን በኃላፊነትና በብቃት ይጠቀማል።',
  'በኮሚቴ ሥራ በኃላፊነት ይሳተፋል እና የቡድን መንፈስ ያሳያል።',
  'ሙያዊ ሥነ ምግባር፣ ፍትሃዊነት፣ አክብሮትና ታማኝነት ያሳያል።',
];

const completedStatuses = ['completed', 'published', 'approved'];
const isCompleted = (dean) => completedStatuses.includes(String(dean.evaluation_status || '').toLowerCase());

const normalizeRatingValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (String(value).trim().toUpperCase() === 'NA') {
    return 'NA';
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
};

const DirectorateDeanEvaluationView = ({
  deans,
  onSubmit,
  targetLabel = 'College Dean',
  scopeLabel = 'College',
}) => {
  const [selected, setSelected] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [ratings, setRatings] = useState({});
  const [language, setLanguage] = useState('en');
  const [formData, setFormData] = useState({ strengths: '', weaknesses: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [criterionErrors, setCriterionErrors] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  const openEvaluation = (dean, viewOnly = false) => {
    let savedRatings = dean.ratings || {};
    if (typeof savedRatings === 'string') {
      try {
        savedRatings = JSON.parse(savedRatings);
      } catch {
        savedRatings = {};
      }
    }

    const normalizedRatings = Object.fromEntries(criteria.flatMap((criterion, index) => {
      const value = savedRatings[criterion.id] ?? savedRatings[String(index)] ?? savedRatings[index];
      const normalized = normalizeRatingValue(value);
      return normalized === '' ? [] : [[criterion.id, normalized]];
    }));

    setSelected(dean);
    setReadOnly(viewOnly);
    setRatings(normalizedRatings);
    setFormData({ strengths: dean.strengths || '', weaknesses: dean.weaknesses || '' });
    setCurrentStep(0);
    setError('');
    setCriterionErrors([]);
  };

  const getRating = (criterion, index) => {
    const value = ratings[criterion.id] ?? ratings[String(index)] ?? ratings[index];
    return normalizeRatingValue(value);
  };

  const isAnswered = (criterion, index) => {
    const value = getRating(criterion, index);
    return value !== undefined && value !== null && value !== '';
  };

  const answeredCount = criteria.filter((criterion, index) => isAnswered(criterion, index)).length;
  const numericRatings = criteria
    .map((criterion, index) => ({ criterion, value: Number(getRating(criterion, index)) }))
    .filter(({ value }) => Number.isFinite(value));
  const totalWeight = numericRatings.reduce((sum, { criterion }) => sum + criterion.weight, 0);
  const totalScore = totalWeight
    ? (numericRatings.reduce((sum, { criterion, value }) => sum + criterion.weight * value, 0) / (totalWeight * 5)) * 100
    : 0;

  const currentGroup = criteriaGroups[currentStep];
  const currentGroupCriteria = currentGroup.criteria.map((criterion) => {
    const index = criteria.findIndex((item) => item.id === criterion.id);
    return { criterion, index };
  });
  const currentStepAnsweredCount = currentGroupCriteria.filter(({ criterion, index }) => isAnswered(criterion, index)).length;
  const isCurrentStepComplete = currentGroupCriteria.length === currentStepAnsweredCount;
  const isFinalStep = currentStep === criteriaGroups.length - 1;

  const goNextStep = () => {
    if (!isCurrentStepComplete) {
      setError(`Please rate every criterion in ${currentGroup.category} before continuing.`);
      setCriterionErrors(currentGroupCriteria
        .filter(({ criterion, index }) => !isAnswered(criterion, index))
        .map(({ criterion }) => criterion.id));
      return;
    }

    setError('');
    setCriterionErrors([]);
    setCurrentStep((step) => Math.min(step + 1, criteriaGroups.length - 1));
  };

  const goPreviousStep = () => {
    setError('');
    setCriterionErrors([]);
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const submitEvaluation = async (event) => {
    event.preventDefault();

    if (answeredCount !== criteria.length) {
      setError('Please rate every criterion before submitting.');
      setCriterionErrors(criteria
        .filter((criterion, index) => !isAnswered(criterion, index))
        .map((criterion) => criterion.id));
      return;
    }

    setSubmitting(true);
    setError('');
    setCriterionErrors([]);
    try {
      await onSubmit({ deanId: selected.deanId, ratings, totalScore, ...formData });
      setSelected(null);
      setCurrentStep(0);
    } catch (submitError) {
      setError(submitError?.message || 'Unable to submit the evaluation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!selected) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">{language === 'am' && targetLabel === 'College Dean' ? 'የኮሌጅ ዲኖችን ይገምግኙ' : `Evaluate ${targetLabel}s`}</h2>
        <p className="mt-1 text-sm text-slate-500">{language === 'am' && targetLabel === 'College Dean' ? 'ግምገማ ለመጀመር ዲን ይምረጡ።' : `Select ${targetLabel.toLowerCase()} to begin the evaluation.`}</p>
        <div className="mt-4"><LanguageToggle language={language} onChange={setLanguage} /></div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">{targetLabel}</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {deans.length ? deans.map((dean) => (
                <tr key={dean.deanId}>
                  <td className="px-4 py-4 font-medium text-slate-900">
                    {dean.full_name || dean.username || targetLabel}
                    <span className="block text-xs font-normal text-slate-500">{dean.college_name || dean.department_name || scopeLabel}</span>
                  </td>
                  <td className="px-4 py-4"><EvaluationDeadlineBadge value={dean} /></td>
                  <td className="px-4 py-4">
                    {isCompleted(dean) ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-emerald-700">✓ Evaluated ({Number(dean.score || 0).toFixed(1)}/100)</span>
                        <button type="button" onClick={() => openEvaluation(dean, true)} className="font-semibold text-blue-700 underline hover:text-blue-900">View Details</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => openEvaluation(dean)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">{language === 'am' ? 'ገምግም' : 'Evaluate'}</button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="3" className="px-4 py-8 text-center text-slate-500">{language === 'am' && targetLabel === 'College Dean' ? 'ምንም ዲኖች አልተገኙም።' : `No ${targetLabel}s found.`}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-sm sm:p-5" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="directorate-dean-evaluation-title" className="flex max-h-[calc(100vh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100vh-48px)]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Mekdela Amba University</p>
            <h2 id="directorate-dean-evaluation-title" className="mt-1 text-lg font-bold leading-tight text-slate-900">{language === 'am' && targetLabel === 'College Dean' ? 'የኮሌጅ ዲን ግምገማ' : "INSTRUCTORS' PERFORMANCE EVALUATION CHECKLIST"}</h2>
            <p className="text-xs font-semibold text-slate-600">{`(To be completed by ${targetLabel === 'College Dean' ? 'Academic Directorate' : 'Vice President'})`}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{selected.full_name || selected.username}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle language={language} onChange={setLanguage} />
            <button type="button" onClick={() => setSelected(null)} aria-label="Close evaluation" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">✕</button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="border-y border-slate-400 py-3 text-slate-900">
            <h3 className="text-center text-base font-bold">Mekdela Amba University</h3>
            <p className="mt-1 text-center text-xs font-semibold">INSTRUCTORS' PERFORMANCE EVALUATION CHECKLIST</p>
            <div className="mt-3 grid gap-x-8 gap-y-1.5 text-xs sm:grid-cols-2">
              <p>Evaluated Name: <strong>{selected.full_name || selected.username || '—'}</strong></p>
              <p>College: <strong>{selected.college_name || '—'}</strong></p>
              <p>Department: <strong>{selected.department_name || '—'}</strong></p>
              <p>Academic Year: <strong>{selected.academic_year || '—'}</strong></p>
              <p>Semester: <strong>{selected.semester || '—'}</strong></p>
            </div>
            <p className="mt-3 border-t border-slate-300 pt-2 text-[10px] font-semibold">Scale: 1 = Very Low, 2 = Low, 3 = Average, 4 = High, 5 = Very High, NA = Not Applicable</p>
          </div>

          <div className="my-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
            <p className="font-bold">Instructions:</p>
            <p className="mt-1">Read each criterion carefully and assess the person’s performance fairly. Select one score from 1–5, or NA when it does not apply.</p>
          </div>

          {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700">{language === 'am' ? categoryAm[currentStep] : currentGroup.category}</h3>
            <span className="shrink-0 text-xs text-slate-500">Category {currentStep + 1} of {criteriaGroups.length}</span>
          </div>

          <form id="directorate-dean-evaluation-form" onSubmit={submitEvaluation} className="space-y-2.5">
            {currentGroupCriteria.map(({ criterion, index }) => {
              const currentRating = getRating(criterion, index);
              const hasCriterionError = criterionErrors.includes(criterion.id);
              return (
                <div key={criterion.id} className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${hasCriterionError ? 'border-rose-500 bg-rose-50' : 'border-slate-200 bg-slate-50/60'}`}>
                  <p className="min-w-0 flex-1 text-xs font-medium leading-relaxed text-slate-700">
                    <span className="mr-2 font-mono font-bold text-slate-400">{index + 1}.</span>
                    {language === 'am' ? criteriaAm[index] : criterion.label}
                    {hasCriterionError && <span className="mt-1 block text-[11px] font-semibold text-rose-700" role="alert">⚠️ Please select a score for this criterion before proceeding.</span>}
                  </p>
                  <div className="flex shrink-0 flex-wrap gap-1.5" role="radiogroup" aria-label={criterion.label}>
                    {ratingOptions.map((rating) => {
                      const isSelected = String(currentRating) === String(rating);
                      return <button key={String(rating)} type="button" disabled={readOnly} aria-pressed={isSelected} onClick={() => {
                        setRatings((current) => ({ ...current, [criterion.id]: rating }));
                        if (criterionErrors.length === 1 && criterionErrors[0] === criterion.id) {
                          setError('');
                        }
                        setCriterionErrors((current) => current.filter((id) => id !== criterion.id));
                      }} className={`h-8 min-w-8 rounded-full border px-2 text-xs font-semibold transition disabled:cursor-default ${isSelected ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-200' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-700 disabled:hover:border-slate-200'}`}>{rating}</button>;
                    })}
                  </div>
                </div>
              );
            })}

            {isFinalStep && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <p className="rounded-lg bg-blue-50 p-3 font-semibold text-blue-800">Criteria scored: {answeredCount}/{criteria.length}</p>
                  <p className="rounded-lg bg-emerald-50 p-3 font-semibold text-emerald-800">Final score: {Number(totalScore).toFixed(1)}/100</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-slate-700">Strengths<textarea rows="2" value={formData.strengths} disabled={readOnly} onChange={(event) => setFormData((current) => ({ ...current, strengths: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal disabled:bg-slate-50" /></label>
                  <label className="text-xs font-semibold text-slate-700">Areas for improvement<textarea rows="2" value={formData.weaknesses} disabled={readOnly} onChange={(event) => setFormData((current) => ({ ...current, weaknesses: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal disabled:bg-slate-50" /></label>
                </div>
              </div>
            )}
          </form>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <button type="button" onClick={() => setSelected(null)} disabled={submitting} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">{readOnly ? 'Close' : 'Cancel'}</button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && <button type="button" onClick={goPreviousStep} disabled={submitting} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Previous</button>}
            {readOnly ? (
              <button type="button" onClick={() => setReadOnly(false)} className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-900">Edit Evaluation</button>
            ) : isFinalStep ? (
              <button type="submit" form="directorate-dean-evaluation-form" disabled={submitting || answeredCount !== criteria.length} className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Submitting…' : isCompleted(selected) ? 'Update Evaluation' : 'Submit Evaluation'}</button>
            ) : (
              <button type="button" onClick={goNextStep} disabled={submitting} className="rounded-lg bg-blue-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-900 disabled:opacity-50">Next Category</button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
};

export default DirectorateDeanEvaluationView;
