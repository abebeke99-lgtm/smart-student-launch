import { useEffect, useState } from 'react';
import { FaStar } from 'react-icons/fa';
import { deanApi } from '../services/api';
import InstructorEvaluationCriteriaModal from '../components/InstructorEvaluationCriteriaModal';
import EvaluationDeadlineBadge from '../components/EvaluationDeadlineBadge';
import { useUiText } from '../hooks/useUiText';

const competencyGroups = [
  {
    title: 'Core Competency',
    criteria: [
      { id: 'self_development', number: 1, label: 'Efforts of self-development in his/her specialization' },
      { id: 'subject_matter', number: 2, label: 'Adequacy of subject matter knowledge' },
      { id: 'teaching_methodology', number: 3, label: 'Professional Skill / Teaching Methodology' },
      { id: 'assignments', number: 4, label: 'Willingness to accept additional teaching assignments when compelling situation arises in the department' },
      { id: 'mentorship', number: 5, label: 'Effectiveness as a mentor in cooperative learning, internship etc...' },
      { id: 'curriculum', number: 6, label: 'Active participation in improvement of teaching-learning process, seminars, workshop, symposia and reviewing of teaching materials (curriculum)' },
      { id: 'community_service', number: 7, label: 'Participation in community service affairs and volunteer activities and willingness to participate in activities other than regular teaching (mentorship)' },
      { id: 'research', number: 8, label: "Identifying priority areas in one's discipline and pursuing research in that area" },
      { id: 'academic_advising', number: 9, label: 'Participation in research project and project proposal development' },
      { id: 'professional_growth', number: 10, label: 'Performance as an academic advisor' },
    ],
  },
  {
    title: 'Professional Competence',
    criteria: [
      { id: 'problem_solving', number: 11, label: 'Participation in problem identification and solving at department/college/institution' },
      { id: 'cpd_hdp', number: 12, label: 'Participation in Comprehensive Professional Development / CCPD, HDP, ELIP' },
      { id: 'continuous_assessment', number: 13, label: 'Continuous assessment implementation' },
      { id: 'tutorials', number: 14, label: 'Providing and reporting tutorial activities designed for the students' },
    ],
  },
  {
    title: 'Time Management',
    criteria: [
      { id: 'class_execution', number: 15, label: 'Executing assigned classes/invigilation on time' },
      { id: 'consultation', number: 16, label: 'Notifying and implementing consultation timely and Giving timely feedback to students' },
      { id: 'deadlines_grading', number: 17, label: 'Meeting deadlines (in reporting, SIMS result feeding, submission of grade/documents...etc...)' },
    ],
  },
  {
    title: 'Ethical Competence',
    criteria: [
      { id: 'resource_use', number: 18, label: 'Showing concern for the use of resources of the department and the University' },
      { id: 'committee_teamwork', number: 19, label: 'Willingness and participation in committee works at department/University level and Having positive attitude to work with others, team spirit' },
      { id: 'professional_ethics', number: 20, label: 'His/her professional ethics and being a role model (dressing, hair style, personality, addiction...)' },
    ],
  },
];

const amharicCriteria = {
  self_development: 'ራሱን ያሳድጋል እና ሙያዊ እውቀቱን ወቅታዊ ያደርጋል።',
  subject_matter: 'በትምህርት ጉዳዩ በቂ እውቀት ያሳያል።',
  teaching_methodology: 'የተማሪዎችን ትምህርት የሚደግፉ ተገቢ የማስተማር ዘዴዎችን ይጠቀማል።',
  assignments: 'ትምህርትን የሚያጠናክሩ ስራዎችን ያዘጋጃል፣ ይሰጣል እና ይገመግማል።',
  mentorship: 'ለተማሪዎች የአካዳሚክ መምሪያና ድጋፍ ይሰጣል።',
  curriculum: 'በሥርዓተ ትምህርት እቅድና ማሻሻያ ይሳተፋል።',
  community_service: 'በማህበረሰብ አገልግሎትና ተደራሽነት ተግባራት ይሳተፋል።',
  research: 'በምርምርና ምሁራዊ ተግባራት ይሳተፋል።',
  academic_advising: 'ውጤታማ የአካዳሚክ ምክርና መምሪያ ይሰጣል።',
  professional_growth: 'ለሙያዊ ዕድገትና ለተቋሙ ግቦች ቁርጠኛ ነው።',
  problem_solving: 'የአካዳሚክና ተግባራዊ ችግሮችን በፍጥነትና በብቃት ይፈታል።',
  cpd_hdp: 'በCPD/HDP ሙያዊ ልማት ይሳተፋል እና ይተገብራል።',
  continuous_assessment: 'ቀጣይነት ያለውን ምዘና በፍትሃዊነት ይጠቀማል።',
  tutorials: 'ውጤታማ ቱቶሪያልና ተጨማሪ የትምህርት ድጋፍ ይሰጣል።',
  class_execution: 'ትምህርቶችን በየጊዜ ሰሌዳውና በታቀደው መርሃ ግብር ያከናውናል።',
  consultation: 'የምክር ሰዓቱን ይጠብቃል እና ለተማሪዎች ተደራሽ ነው።',
  deadlines_grading: 'የአካዳሚክ የጊዜ ገደቦችን ያከብራል እና ምዘናን በጊዜው ያጠናቅቃል።',
  resource_use: 'የዩኒቨርሲቲ ሀብቶችን በኃላፊነትና በብቃት ይጠቀማል።',
  committee_teamwork: 'በኮሚቴ ሥራ በኃላፊነት ይሳተፋል እና የቡድን መንፈስ ያሳያል።',
  professional_ethics: 'ሙያዊ ሥነ ምግባር፣ ፍትሃዊነት፣ አክብሮትና ታማኝነት ያሳያል።',
};

const EvaluateDeptHeads = () => {
  const t = useUiText();
  const [deptHeads, setDeptHeads] = useState([]);
  const [selectedHead, setSelectedHead] = useState(null);
  const [modalMode, setModalMode] = useState('edit');
  const [scores, setScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isCompleted = (head) => ['submitted', 'completed', 'approved'].includes(String(head.status || '').toLowerCase());

  const loadDepartmentHeads = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await deanApi.getDepartmentHeads();
      setDeptHeads(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setDeptHeads([]);
      setError(loadError?.message || t('Unable to load pending Department Head evaluations.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadDepartmentHeads(); }, []);

  const openEvaluation = (head, mode = 'edit') => {
    let savedScores = head.criteria_scores || {};
    if (typeof savedScores === 'string') {
      try {
        savedScores = JSON.parse(savedScores);
      } catch {
        savedScores = {};
      }
    }
    setSelectedHead(head);
    setModalMode(mode);
    setScores(savedScores && typeof savedScores === 'object' ? savedScores : {});
    setError('');
    setMessage('');
  };

  const submitModalEvaluation = async (criteriaScores, totalScore, strengths, improvements, generalComments) => {
    setSubmitting(true);
    setError('');
    try {
      await deanApi.submitDepartmentHeadEvaluation({
        instructorId: selectedHead.instructorId,
        criteriaScores,
        totalScore,
        strengths: generalComments || strengths,
        generalComments: generalComments || strengths,
        weaknesses: improvements,
      });
      setMessage(t('Department Head evaluation submitted successfully.'));
      setSelectedHead(null);
      await loadDepartmentHeads();
    } catch (submitError) {
      setError(submitError?.message || t('Unable to submit Department Head evaluation.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (selectedHead) {
    return (
      <InstructorEvaluationCriteriaModal
        open
        onClose={() => setSelectedHead(null)}
        instructorName={selectedHead.full_name || selectedHead.name || selectedHead.email}
        evaluation={selectedHead}
        criteriaScores={scores}
        setCriteriaScores={setScores}
        onSubmit={submitModalEvaluation}
        isSubmitting={submitting}
        mode={modalMode}
        evaluatorType="dept_head"
        completionRole="College Dean"
      />
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6"><h2 className="text-xl font-bold text-slate-900">{t('Evaluate Department Heads')}</h2><p className="mt-1 text-sm text-slate-500">{t('Select a Department Head to open the evaluation criteria.')}</p></div>
      {message ? <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {error ? <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="py-8 text-center text-sm text-slate-500">{t('Loading pending evaluations...')}</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">{t('Department Head / Instructor')}</th><th className="px-4 py-3">{t('Deadline')}</th><th className="px-4 py-3">{t('Action')}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {deptHeads.length ? deptHeads.map((head) => <tr key={head.dept_head_id || head.instructorId}><td className="px-4 py-4 font-medium text-slate-900">{head.full_name || head.name || head.email}<span className="block text-xs font-normal text-slate-500">{head.department_name || head.department || t('Department')}</span></td><td className="px-4 py-4"><EvaluationDeadlineBadge value={head} /></td><td className="px-4 py-4">{isCompleted(head) ? <div className="flex flex-wrap items-center gap-3"><span className="font-semibold text-emerald-700">{t('Evaluated')} ({Number(head.score || 0).toFixed(1)}%)</span><button type="button" onClick={() => openEvaluation(head, 'view')} className="font-semibold text-blue-700 underline hover:text-blue-900">{t('View Details')}</button></div> : <button type="button" onClick={() => openEvaluation(head)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"><FaStar className="h-3 w-3" /> {t('Evaluate')}</button>}</td></tr>) : <tr><td colSpan="3" className="px-4 py-8 text-center text-sm text-slate-500">{t('No Department Head evaluations found.')}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export { competencyGroups, amharicCriteria };

export default EvaluateDeptHeads;
