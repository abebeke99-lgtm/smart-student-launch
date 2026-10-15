import { useEffect, useState } from 'react';
import { ClipboardCheck, Eye } from 'lucide-react';
import PeerEvaluationModal from './PeerEvaluationModal';
import { courseAssignmentApi, evaluationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import PeerEvaluationDeadlineBadge from './PeerEvaluationDeadlineBadge';

const isLabAssistantRole = (role) => ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(String(role || '').trim().toLowerCase());
const isCollegeDeanRole = (role) => ['college_dean', 'dean'].includes(String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_'));
const normalizeRole = (role) => String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
const isAcademicDirectorateRole = (role) => ['academic_directorate', 'academic_director', 'directorate'].includes(normalizeRole(role));

const DeanPeerEvaluationView = () => {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadEvaluations = async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await courseAssignmentApi.getPeerTargets();
      const normalizedEvaluatorRole = normalizeRole(user?.role);
      const isCollegeDeanEvaluator = ['college_dean', 'dean'].includes(normalizedEvaluatorRole);
      setEvaluations(Array.isArray(rows)
        ? rows.filter((row) => {
          const targetRole = normalizeRole(row.target_role);
          if (isCollegeDeanEvaluator) return targetRole === 'instructor' || isAcademicDirectorateRole(targetRole);
          return !isLabAssistantRole(targetRole) && !isCollegeDeanRole(targetRole);
        })
        : []);
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load peer evaluations.');
      setEvaluations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadEvaluations(); }, [user?.id, user?.department_id, user?.role]);

  const submitEvaluation = async (payload) => {
    setSubmitting(true);
    try {
      await evaluationApi.submitPeerEvaluationForm(payload);
      setSelected(null);
      await loadEvaluations();
    } catch (submitError) {
      throw submitError;
    } finally {
      setSubmitting(false);
    }
  };

  const pendingCount = evaluations.filter((evaluation) => evaluation.id && evaluation.status === 'pending' && !evaluation.is_evaluated).length;

  return (
    <section className="space-y-6">
      <div className="rounded-lg bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Peer Evaluation</h2>
            <p className="text-sm text-gray-500">Evaluate eligible colleagues in your department on collaboration and professional performance.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">{pendingCount} pending</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Peer</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Department</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Deadline</th><th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Action</th></tr></thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">Loading peer evaluations...</td></tr> : evaluations.filter((evaluation) => {
                const targetRole = normalizeRole(evaluation.target_role);
                return ['college_dean', 'dean'].includes(normalizeRole(user?.role))
                  ? targetRole === 'instructor' || isAcademicDirectorateRole(targetRole)
                  : !isCollegeDeanRole(targetRole);
              }).map((evaluation) => {
                const completed = Boolean(evaluation.is_evaluated);
                const hasAssignment = Boolean(evaluation.id);
                const isLabAssistant = ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(String(evaluation.target_role || '').toLowerCase());
                return (
                  <tr key={evaluation.target_user_id} className="border-b border-gray-100">
                    <td className="px-4 py-4 text-sm font-medium text-gray-900">
                      <span className="block">{evaluation.instructor_name || evaluation.username || 'Colleague'}</span>
                      {isLabAssistant && <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Lab Assistant (ARA)</span>}
                      <span className="mt-1 block text-xs capitalize text-gray-500">{String(evaluation.target_role || '').replace(/[_-]/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600">{evaluation.target_department_name || '-'}</td>
                    <td className="px-4 py-4 text-sm"><PeerEvaluationDeadlineBadge item={evaluation} /></td>
                    <td className="px-4 py-4 text-sm">
                      {completed ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-600">Evaluated ({Number(evaluation.total_score || 0).toFixed(1)}/100)</span>
                          <button type="button" onClick={() => setSelected(evaluation)} className="font-semibold text-blue-600 underline transition-colors hover:text-blue-800"><Eye className="mr-1 inline h-4 w-4" />View Details</button>
                        </div>
                      ) : hasAssignment ? (
                        <button type="button" onClick={() => setSelected(evaluation)} className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-700"><ClipboardCheck className="mr-1 h-4 w-4" />Evaluate</button>
                      ) : (
                        <span className="text-xs text-gray-500">Not published yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!loading && !error && !evaluations.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">No eligible colleagues found in your department.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {error && <p className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <PeerEvaluationModal open={Boolean(selected)} onClose={() => setSelected(null)} evaluation={selected || {}} onSubmit={submitEvaluation} isSubmitting={submitting} mode={selected?.is_evaluated ? 'view' : 'create'} evaluationRecord={selected || null} />
    </section>
  );
};

export default DeanPeerEvaluationView;
