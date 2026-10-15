import { useEffect, useState } from 'react';
import { adminData } from '../data/adminOptions';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  GraduationCap,
  List,
  Search,
  Send,
  Trash2,
  Users,
  Pencil,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, evaluationApi, registrationApi } from '../services/api';
import { useConfirmation } from '../components/ConfirmationDialog';

const isPublishedFlag = (value) => [1, '1', true].includes(value);

const PublishEvaluation = ({ departmentId }) => {
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [target, setTarget] = useState('student');
  const [assignments, setAssignments] = useState([]);
  const [filters, setFilters] = useState({ program_type: '', year_level: '', semester: '', section: '' });
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [departmentStaff, setDepartmentStaff] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [labAssistantPrompt, setLabAssistantPrompt] = useState(null);
  const [selectedLabAssistantId, setSelectedLabAssistantId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPublishedOnly, setShowPublishedOnly] = useState(false);
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('');
  const currentAcademicYear = activeCycle?.academicYear || String(new Date().getFullYear());
  const academicYear = selectedAcademicYear || currentAcademicYear;
  const isCurrentAcademicYear = academicYear === currentAcademicYear;
  const academicYearOptions = [...new Set([
    currentAcademicYear,
    selectedAcademicYear,
    ...adminData.academicYears.map(({ name }) => name),
    ...assignments.map((assignment) => assignment.academic_year).filter(Boolean).map(String),
  ].filter(Boolean))].sort((first, second) => second.localeCompare(first));
  const cycleSemesterValue = String(activeCycle?.semester || '').trim();
  const isYearCycle = activeCycle?.cycleType === 'year'
    || /^(annual|year|full academic year)$/i.test(cycleSemesterValue);
  const activeSemester = isYearCycle ? '' : cycleSemesterValue;
  const cycleSemester = isYearCycle
    ? 'Full academic year'
    : `Semester ${cycleSemesterValue || 'I'}`;

  useEffect(() => {
    adminApi.getEvaluationWindow()
      .then(setActiveCycle)
      .catch((error) => {
        console.warn('Unable to load the active evaluation cycle:', error);
        setActiveCycle(null);
      });
  }, []);

  const unpublish = async () => {
    const unpublishConfirmed = await requestConfirmation({
      title: target === 'student' ? 'Withdraw Student Evaluations' : 'Withdraw Peer Evaluations',
      description: target === 'student'
        ? 'Are you sure you want to withdraw this student evaluation batch?'
        : 'Are you sure you want to withdraw peer evaluations for this department?',
      confirmLabel: 'Withdraw Evaluations',
      variant: 'danger',
    });
    if (!unpublishConfirmed) return;
    if (!isCurrentAcademicYear) {
      toast.error(`Only the active academic year (${currentAcademicYear}) can be changed.`);
      return;
    }
    setPublishing(true);
    try {
      const payload = target === 'student'
        ? { department_id: departmentId, ...filters, semester: activeSemester || filters.semester, academic_year: academicYear }
        : { academic_year: academicYear, semester: cycleSemester };
      const result = target === 'student'
        ? await evaluationApi.unpublishStudent(payload)
        : await evaluationApi.unpublishDepartmentPeerEvaluations(payload);
      toast.success(result?.message || 'Evaluation unpublished successfully.');
      const rows = await evaluationApi.getPublishAssignments({ department: departmentId, academic_year: academicYear, semester: activeSemester });
      setAssignments(Array.isArray(rows) ? rows : []);
    } catch (error) {
      toast.error(error.message || 'Unable to unpublish evaluation.');
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const loadAssignments = async () => {
      setLoading(true);
      setAssignments([]);
      try {
        const rows = await evaluationApi.getPublishAssignments({ department: departmentId, academic_year: academicYear, semester: activeSemester });
        if (!cancelled) {
          const normalizedRows = Array.isArray(rows) ? rows : [];
          setAssignments(normalizedRows);
        }
      } catch (error) {
        if (!cancelled) toast.error(error.message || 'Unable to load course assignments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (departmentId) void loadAssignments();
    return () => { cancelled = true; };
  }, [departmentId, academicYear, activeSemester]);

  useEffect(() => {
    let cancelled = false;
    const loadDepartmentStaff = async () => {
      try {
        const rows = await registrationApi.getUsers();
        const staff = (Array.isArray(rows) ? rows : [])
          .filter((user) => String(user.department_id || user.departmentId || '') === String(departmentId))
          .filter((user) => ['instructor', 'dept_head', 'lab_assistant', 'college_dean', 'academic_directorate'].includes(String(user.role).toLowerCase()))
          .filter((user) => String(user.status || 'active').toLowerCase() === 'active')
          .map((user) => ({
            ...user,
            displayName: user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || user.email || 'Unnamed Staff',
          }));
        if (!cancelled) setDepartmentStaff(staff);
      } catch (error) {
        if (!cancelled) {
          setDepartmentStaff([]);
          toast.error(error.message || 'Unable to load department instructors.');
        }
      }
    };
    if (departmentId) void loadDepartmentStaff();
    return () => { cancelled = true; };
  }, [departmentId]);

  const updateFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));
  const matchingAssignments = assignments.filter((assignment) => Object.entries(filters).every(([field, value]) => !value || String(assignment[field] || '').toLowerCase() === value.toLowerCase()));
  const publishedAssignments = matchingAssignments.filter((assignment) => isPublishedFlag(target === 'student' ? assignment.is_student_published : assignment.is_peer_published));
  const targetAlreadyPublished = matchingAssignments.length > 0 && publishedAssignments.length === matchingAssignments.length;
  const targetHasPublishedAssignments = publishedAssignments.length > 0;
  const hasCompleteStudentBatch = Boolean(filters.program_type && filters.year_level && (activeSemester || filters.semester) && filters.section);
  const options = (field) => [...new Set(assignments.map((assignment) => assignment[field]).filter(Boolean))];
  const searchedAssignments = matchingAssignments.filter((assignment) => {
    const searchableText = [
      assignment.course_code,
      assignment.course_name,
      assignment.instructor_name,
      assignment.program_type,
      assignment.year_level,
      assignment.section,
    ].join(' ').toLowerCase();
    const isPublished = target === 'student' ? assignment.is_student_published : assignment.is_peer_published;
    return searchableText.includes(searchQuery.trim().toLowerCase())
      && (!showPublishedOnly || [1, '1', true].includes(isPublished));
  });
  const availableInstructorCount = departmentStaff
    .filter((staff) => String(staff.role).toLowerCase() === 'instructor')
    .length;
  const availableCourseCount = new Set(
    assignments.map((assignment) => assignment.course_id).filter(Boolean),
  ).size;
  const conflictWarningCount = (() => {
    const seenSlots = new Set();
    let conflicts = 0;
    assignments.forEach((assignment) => {
      const slot = [
        assignment.course_id,
        assignment.year_level,
        assignment.semester,
        assignment.section,
      ].map((part) => String(part || '').trim().toLowerCase()).join(':');
      if (seenSlots.has(slot)) conflicts += 1;
      seenSlots.add(slot);
    });
    return conflicts;
  })();

  const editAssignmentFilters = (assignment) => {
    setTarget('student');
    setFilters({
      program_type: assignment.program_type || '',
      year_level: assignment.year_level || '',
      semester: assignment.semester || '',
      section: assignment.section || '',
    });
  };

  const deletePublishedEvaluation = async (assignment) => {
    if (!isPublishedFlag(assignment.is_student_published)) {
      toast.error('This course does not have a published student evaluation to delete.');
      return;
    }
    if (!await requestConfirmation({
      title: 'Withdraw Published Evaluation',
      description: `Withdraw student evaluation forms for ${assignment.program_type || 'all programs'}, ${assignment.year_level || 'all years'}, Semester ${assignment.semester || 'all'}, Section ${assignment.section || 'all'}? This removes forms for all courses in this cohort.`,
      confirmLabel: 'Withdraw Forms',
      variant: 'danger',
    })) return;
    setPublishing(true);
    try {
      const result = await evaluationApi.unpublishStudent({
        department_id: departmentId,
        course_id: assignment.course_id,
        program_type: assignment.program_type || '',
        year_level: assignment.year_level || '',
        semester: assignment.semester || activeSemester,
        section: assignment.section || '',
        academic_year: assignment.academic_year || academicYear,
      });
      toast.success(result?.message || 'Published evaluation withdrawn.');
      await refreshAssignments();
    } catch (error) {
      toast.error(error?.message || 'Unable to withdraw the published evaluation.');
    } finally {
      setPublishing(false);
    }
  };

  const publish = async () => {
    if (!isCurrentAcademicYear) {
      toast.error(`Evaluation forms can only be published for the active academic year (${currentAcademicYear}).`);
      return;
    }
    if (target === 'student' && !hasCompleteStudentBatch) {
      toast.error('Select program type, year level, semester, and section before publishing.');
      return;
    }
    if (target === 'student' && !labAssistantPrompt) {
      setLabAssistantPrompt({ assignments: matchingAssignments, mode: 'question' });
      setSelectedLabAssistantId('');
      return;
    }
    if (targetAlreadyPublished) {
      toast.error(target === 'student' ? 'Evaluation form has already been published for this section/batch.' : 'Peer evaluations have already been published for this department.');
      return;
    }
    if (target === 'student' && labAssistantPrompt?.mode === 'assistant') {
      await publishStudentWithLabAssistant();
      return;
    }
    setPublishing(true);
    try {
      const payload = { department_id: departmentId, ...filters, semester: activeSemester || filters.semester, academic_year: academicYear };
      const result = target === 'student'
        ? await evaluationApi.publishStudent(payload)
        : await evaluationApi.publishDepartmentPeerEvaluations({
          academic_year: academicYear,
          semester: cycleSemester,
        });
      if (result?.isAlreadyPublished) {
        toast.error(result.message || 'Evaluation has already been published.');
        return;
      }
      toast.success(result?.message || `Evaluation published to ${target}s.`);
      const rows = await evaluationApi.getPublishAssignments({ department: departmentId, academic_year: academicYear, semester: activeSemester });
      const normalizedRows = Array.isArray(rows) ? rows : [];
      setAssignments(normalizedRows);
    } catch (error) {
      if (error.response?.data?.isAlreadyPublished || error.message?.toLowerCase().includes('already published')) {
      }
      toast.error(error.message || 'Unable to publish evaluation.');
    } finally {
      setPublishing(false);
    }
  };

  const refreshAssignments = async () => {
    const rows = await evaluationApi.getPublishAssignments({ department: departmentId, academic_year: academicYear, semester: activeSemester });
    setAssignments(Array.isArray(rows) ? rows : []);
  };

  const publishStudentOnly = async () => {
    if (!isCurrentAcademicYear) {
      toast.error(`Evaluation forms can only be published for the active academic year (${currentAcademicYear}).`);
      return;
    }
    setPublishing(true);
    try {
      const result = targetAlreadyPublished
        ? null
        : await evaluationApi.publishStudent({ department_id: departmentId, ...filters, semester: activeSemester || filters.semester, academic_year: academicYear });
      toast.success(result?.message || 'Evaluation published to the assigned lecture instructor.');
      setLabAssistantPrompt(null);
      await refreshAssignments();
    } catch (error) {
      toast.error(error.message || 'Unable to publish evaluation.');
    } finally {
      setPublishing(false);
    }
  };

  const publishStudentWithLabAssistant = async () => {
    if (!isCurrentAcademicYear) {
      toast.error(`Evaluation forms can only be published for the active academic year (${currentAcademicYear}).`);
      return;
    }
    if (!selectedLabAssistantId) {
      toast.error('Select a Lab Assistant before publishing.');
      return;
    }
    setPublishing(true);
    try {
      for (const assignment of labAssistantPrompt.assignments) {
        await evaluationApi.publishStudent({
          department_id: departmentId,
          course_id: assignment.course_id,
          program_type: assignment.program_type || filters.program_type,
          section: assignment.section || filters.section,
          year_level: assignment.year_level || filters.year_level,
          semester: assignment.semester || activeSemester || filters.semester,
          academic_year: academicYear,
          lab_assistant_id: Number(selectedLabAssistantId),
        });
      }
      toast.success('Evaluation published to students and the assigned Lab Assistant.');
      setLabAssistantPrompt(null);
      await refreshAssignments();
    } catch (error) {
      toast.error(error.message || 'Unable to publish evaluation.');
    } finally {
      setPublishing(false);
    }
  };

  const selectClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm';
  const labels = {
    program_type: { label: 'Program Type', icon: BookOpen },
    year_level: { label: 'Year Level', icon: GraduationCap },
    semester: { label: 'Semester', icon: Clock3 },
    section: { label: 'Section', icon: Users },
  };

  return (
    <>
    <section className="space-y-4">
      <header className="relative flex min-h-24 items-center justify-between gap-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-sky-100 via-blue-50 to-cyan-50 px-5 py-4 shadow-sm sm:px-7">
        <div className="relative z-10 min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-blue-700">
            <span>Department Head Dashboard</span><ArrowRight size={13} aria-hidden="true" /><span>Publish Evaluation Form</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Publish Evaluation Form</h2>
          <p className="mt-1 text-xs text-slate-600">Activate evaluation forms separately from course assignment.</p>
        </div>
        <label className="relative z-10 flex shrink-0 items-center gap-2 rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-[11px] font-semibold text-slate-700 shadow-sm">
          <CalendarDays size={16} className="text-blue-700" aria-hidden="true" />
          <span className="hidden sm:inline">Academic Year:</span>
          <select aria-label="Academic year" value={academicYear} onChange={(event) => {
            setSelectedAcademicYear(event.target.value === currentAcademicYear ? '' : event.target.value);
            setFilters({ program_type: '', year_level: '', semester: '', section: '' });
          }} className="max-w-28 cursor-pointer appearance-none bg-transparent pr-4 font-bold text-slate-800 outline-none">
            {academicYearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <ChevronDown size={13} className="pointer-events-none absolute right-2 text-slate-400" aria-hidden="true" />
        </label>
        <div className="pointer-events-none absolute right-36 top-1/2 hidden -translate-y-1/2 items-center gap-3 text-blue-500/70 sm:flex">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70 shadow-sm"><FileText size={30} aria-hidden="true" /></span>
          <span className="h-10 w-10 rounded-full bg-cyan-200/50" />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Assigned Courses', value: assignments.length, note: 'Courses with assignments', icon: BookOpen, iconTheme: 'bg-blue-600', cardTheme: 'border-blue-100 from-blue-50/80 to-white', labelTheme: 'text-blue-700' },
          { label: 'Available Instructors', value: availableInstructorCount, note: 'Ready for evaluation', icon: Users, iconTheme: 'bg-emerald-500', cardTheme: 'border-emerald-100 from-emerald-50/80 to-white', labelTheme: 'text-emerald-700' },
          { label: 'Available Courses', value: availableCourseCount, note: 'Courses in this department', icon: GraduationCap, iconTheme: 'bg-purple-600', cardTheme: 'border-purple-100 from-purple-50/80 to-white', labelTheme: 'text-purple-700' },
          { label: 'Conflict Warnings', value: conflictWarningCount, note: 'Duplicate course sections', icon: AlertTriangle, iconTheme: 'bg-rose-500', cardTheme: 'border-rose-100 from-rose-50/80 to-white', labelTheme: 'text-rose-700' },
        ].map(({ label, value, note, icon: Icon, iconTheme, cardTheme, labelTheme }) => (
          <article key={label} className={`flex min-h-24 items-center gap-3 rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${cardTheme}`}>
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${iconTheme}`}><Icon size={19} aria-hidden="true" /></span>
            <div className="min-w-0 flex-1">
              <h3 className={`truncate text-xs font-semibold ${labelTheme}`}>{label}</h3>
              <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
              <p className="truncate text-[10px] text-slate-500">{note}</p>
            </div>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm" aria-hidden="true"><ArrowRight size={14} /></span>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        {!isCurrentAcademicYear && (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800" role="status">
            Viewing {academicYear}. Publishing and withdrawal actions are available only for the active academic year ({currentAcademicYear}).
          </p>
        )}
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Send size={17} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900">Publish Evaluation Form</h3>
            <p className="text-xs text-slate-500">Select the cohort that should receive the evaluation form.</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
            {['student', 'instructor'].map((value) => <button key={value} type="button" onClick={() => setTarget(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${target === value ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>{value === 'student' ? 'Students' : 'Instructors'}</button>)}
          </div>
        </div>

        {target === 'student' ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            {Object.entries(labels).map(([field, { label, icon: Icon }]) => (
              <label key={field} className="min-w-0">
                <span className="mb-1.5 block text-[11px] font-semibold text-slate-600">{label}</span>
                <span className="relative block">
                  <Icon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" aria-hidden="true" />
                  <select value={filters[field]} onChange={updateFilter(field)} className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <option value="">All</option>{options(field).map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </span>
              </label>
            ))}
            <div className="flex items-end">
              <button type="button" disabled={publishing || loading || !isCurrentAcademicYear || !hasCompleteStudentBatch || targetAlreadyPublished} onClick={publish} className="inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 xl:w-auto">
                <Send size={14} aria-hidden="true" />
                {targetAlreadyPublished ? 'Already Published' : publishing ? 'Publishing...' : 'Publish Evaluation to students'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-xs text-slate-500">Publish a peer evaluation to active instructors in this department.</p>
            <button type="button" disabled={publishing || loading || !isCurrentAcademicYear || departmentStaff.filter((staff) => String(staff.role).toLowerCase() === 'instructor').length < 2 || targetAlreadyPublished} onClick={publish} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
              <Send size={14} aria-hidden="true" />
              {targetAlreadyPublished ? 'Already Published' : publishing ? 'Publishing...' : 'Publish Evaluation to Instructors'}
            </button>
          </div>
        )}

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-500">{target === 'student' ? (loading ? 'Loading assignments...' : !hasCompleteStudentBatch ? 'Choose program type, year level, semester, and section to target one student cohort.' : `${matchingAssignments.length} assigned course${matchingAssignments.length === 1 ? '' : 's'} match the selected filters.`) : `${departmentStaff.length} active academic staff in this department.`}</p>
          {(target === 'instructor' || targetHasPublishedAssignments) && (
            <button type="button" disabled={publishing || !isCurrentAcademicYear || !targetHasPublishedAssignments} onClick={unpublish} className="rounded-lg border border-amber-200 px-3 py-1.5 font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50">{publishing ? 'Withdrawing...' : target === 'student' ? 'Withdraw selected batch' : 'Unpublish Peer Evaluation'}</button>
          )}
        </div>
      </section>

      {target === 'student' ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><List size={17} aria-hidden="true" /></span>
              <div><h3 className="text-base font-bold text-slate-900">Published Evaluation Forms</h3><p className="text-xs text-slate-500">Manage course evaluation forms in your department.</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative sm:w-64">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <span className="sr-only">Search courses, instructors, and sections</span>
                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search courses, instructors, sections..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
              </label>
              <button type="button" aria-pressed={showPublishedOnly} onClick={() => setShowPublishedOnly((current) => !current)} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition ${showPublishedOnly ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                <Filter size={14} aria-hidden="true" />{showPublishedOnly ? 'Published' : 'All Forms'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[850px] w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="w-12 px-4 py-3">#</th><th className="px-4 py-3">Course</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Year / Section</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {searchedAssignments.map((assignment, index) => {
                  const instructorName = assignment.instructor_name || 'Instructor';
                  const initials = instructorName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'I';
                  const isPublished = isPublishedFlag(assignment.is_student_published);
                  const badgeThemes = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-cyan-100 text-cyan-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700'];
                  return (
                    <tr key={assignment.id} className="transition hover:bg-blue-50/40">
                      <td className="px-4 py-3 font-semibold text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className={`flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-[9px] font-bold ${badgeThemes[index % badgeThemes.length]}`}>{assignment.course_code || 'Course'}</span>
                          <span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{assignment.course_name || 'Course details'}</span><span className="block text-[10px] text-slate-400">{assignment.semester || cycleSemester}</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">{initials}</span>
                          <span className="truncate font-semibold text-slate-700">{instructorName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{assignment.program_type || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{assignment.year_level || '—'} / {assignment.section || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {isPublished ? <CheckCircle2 size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}{isPublished ? 'Published' : 'Not Published'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button type="button" onClick={() => editAssignmentFilters(assignment)} className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 font-semibold text-blue-700 transition hover:bg-blue-100" aria-label={`Edit filters for ${assignment.course_name || assignment.course_code}`}><Pencil size={12} aria-hidden="true" />Edit</button>
                          <button type="button" disabled={publishing || !isCurrentAcademicYear || !isPublished} onClick={() => void deletePublishedEvaluation(assignment)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Withdraw evaluation for ${assignment.course_name || assignment.course_code}`}><Trash2 size={12} aria-hidden="true" />Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!searchedAssignments.length && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center">
                    <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText size={21} aria-hidden="true" /></span>
                    <span className="block text-sm font-semibold text-slate-700">{loading ? 'Loading assignments...' : 'No Evaluation Forms Published'}</span>
                    <span className="mt-1 block text-xs text-slate-500">{assignments.length ? 'There are no evaluation forms that match the selected filters.' : 'There are no assigned courses matching the selected filters.'}</span>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {searchedAssignments.length ? 1 : 0}–{searchedAssignments.length} of {searchedAssignments.length} results</span><span>Academic Year {academicYear}</span>
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 p-4"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Users size={17} aria-hidden="true" /></span><div><h3 className="text-base font-bold text-slate-900">Department Instructors</h3><p className="text-xs text-slate-500">Active academic staff who can participate in peer evaluation.</p></div></div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Instructor</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {departmentStaff.map((staff, index) => {
                  const isLabAssistant = ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(String(staff.role).toLowerCase());
                  const initials = staff.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'I';
                  return <tr key={staff.id} className="hover:bg-blue-50/40"><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3"><span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-[9px] font-bold text-blue-700">{initials}</span><span className="font-semibold text-slate-800">{staff.displayName}</span></span></td><td className="px-4 py-3 capitalize text-slate-600">{isLabAssistant ? 'Lab Assistant (ARA)' : String(staff.role).replaceAll('_', ' ')}</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Active</span></td></tr>;
                })}
                {!departmentStaff.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">No active academic staff found for this department.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {labAssistantPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Lab Assistant Assignment</h3>
            {labAssistantPrompt.mode === 'question' ? (
              <>
                <p className="mt-2 text-sm text-slate-600">Does this course/section require a Lab Assistant?</p>
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" disabled={publishing} onClick={() => void publishStudentOnly()} className="rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700">No</button>
                  <button type="button" disabled={publishing} onClick={() => setLabAssistantPrompt((current) => ({ ...current, mode: 'assistant' }))} className="rounded-xl bg-ieps-blue-600 px-5 py-2 text-sm font-semibold text-white">Yes</button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-600">Select the active Lab Assistant assigned to this course/section.</p>
                <select value={selectedLabAssistantId} onChange={(event) => setSelectedLabAssistantId(event.target.value)} className={`${selectClass} mt-4`}>
                  <option value="">Select Lab Assistant</option>
                  {departmentStaff
                    .filter((staff) => ['lab_assistant', 'ara', 'lab assistant', 'lab-assistant'].includes(String(staff.role).toLowerCase()) && staff.instructor_id)
                    .map((staff) => <option key={staff.id} value={staff.instructor_id}>{staff.displayName}</option>)}
                </select>
                <div className="mt-5 flex justify-end gap-3">
                  <button type="button" onClick={() => setLabAssistantPrompt(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
                  <button type="button" disabled={publishing || !selectedLabAssistantId} onClick={() => void publishStudentWithLabAssistant()} className="rounded-xl bg-ieps-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{publishing ? 'Publishing...' : 'Assign & Publish'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
    {confirmationDialog}
    </>
  );
};

export default PublishEvaluation;
