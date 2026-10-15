import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { courseAssignmentApi, departmentApi } from '../services/api';

const isLabAssistant = (role) => ['lab_assistant', 'ara'].includes(String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_'));
const isLabCourse = (value) => value === true || value === 1 || ['true', '1'].includes(String(value || '').trim().toLowerCase());
const normalizeSection = (value) => String(value || '').trim().replace(/^section\s+/i, '').toLowerCase();

const CourseAssignmentModal = ({ courses: initialCourses = [], instructors: initialInstructors = [], departmentId, onClose, onAssigned }) => {
  const [filters, setFilters] = useState({ programType: '', yearLevel: '', semester: '', section: '' });
  const [courses, setCourses] = useState(initialCourses);
  const defaultInstructors = initialInstructors;
  const [departments, setDepartments] = useState([]);
  const [allInstructors, setAllInstructors] = useState(initialInstructors);
  const [assignments, setAssignments] = useState({});
  const [instructorsMap, setInstructorsMap] = useState({});
  const rowInstructors = new Proxy(instructorsMap, {
    get: (current, courseId) => {
      const selectedDepartment = String(assignments[courseId]?.deptId || departmentId || '');
      const source = current[courseId] || allInstructors;
      const course = courses.find((item) => String(item.id) === String(courseId));
      return source.filter((instructor) => (
        String(instructor.department_id || '') === selectedDepartment
        && isLabAssistant(instructor.role) === isLabCourse(course?.is_lab)
      ));
    },
  });
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingRows] = useState({});
  const [saving, setSaving] = useState(false);
  const years = ['1st Year (Freshman)', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'];
  const sections = 'A B C D E F G H I J K L'.split(' ');
  const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm transition focus:border-ieps-blue-500 focus:outline-none focus:ring-2 focus:ring-ieps-blue-100';
  const visibleCourses = courses.filter((course) => (
    !isLabCourse(course.is_lab)
    || !course.section
    || (filters.section && normalizeSection(course.section) === normalizeSection(filters.section))
  ));

  const updateFilter = (field) => (event) => setFilters((current) => ({ ...current, [field]: event.target.value }));

  useEffect(() => {
    departmentApi.getAll().then(async (rows) => {
      const availableDepartments = Array.isArray(rows) ? rows : [];
      setDepartments(availableDepartments);
      const instructorLists = await Promise.all(availableDepartments.map((department) => (
        courseAssignmentApi.getDepartmentInstructors(department.id).catch(() => [])
      )));
      const uniqueInstructors = new Map();
      instructorLists.flat().forEach((instructor) => {
        const instructorId = instructor.instructor_id || instructor.id || instructor.user_id;
        if (instructorId) uniqueInstructors.set(String(instructorId), instructor);
      });
      setAllInstructors([...uniqueInstructors.values()]);
    }).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!filters.yearLevel || !filters.semester) {
      setCourses([]);
      setAssignments({});
      return undefined;
    }
    let cancelled = false;
    setLoadingCourses(true);
    courseAssignmentApi.getFilteredCourses({ deptId: departmentId, year: filters.yearLevel, semester: filters.semester })
      .then((rows) => { if (!cancelled) { setCourses(Array.isArray(rows) ? rows : []); setAssignments({}); } })
      .catch(() => { if (!cancelled) { setCourses([]); setAssignments({}); } })
      .finally(() => { if (!cancelled) setLoadingCourses(false); });
    return () => { cancelled = true; };
  }, [departmentId, filters.yearLevel, filters.semester]);

  const loadInstructorsForCourse = async (courseId, deptId) => {
    if (!deptId) return;
    try {
      const rows = await courseAssignmentApi.getDepartmentInstructors(deptId);
      const normalizedRows = (Array.isArray(rows) ? rows : []).map((instructor) => ({
        ...instructor,
        instructor_id: instructor.instructor_id || instructor.id || instructor.user_id,
        full_name: instructor.full_name || `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || instructor.email || 'Unnamed instructor',
      }));
      setInstructorsMap((current) => ({ ...current, [courseId]: normalizedRows }));
    } catch {
      setInstructorsMap((current) => ({ ...current, [courseId]: [] }));
    }
  };
  const loadRowInstructors = () => undefined;
  useEffect(() => {
    if (!departmentId || !courses.length) return undefined;
    const loadInitialRowInstructors = async () => {
      await Promise.all(courses.map((course) => loadInstructorsForCourse(course.id, departmentId)));
    };
    void loadInitialRowInstructors();
    return undefined;
  }, [courses, departmentId]);

  const handleDeptChange = (courseId, value) => {
    setAssignments((current) => ({ ...current, [courseId]: { ...(current[courseId] || {}), deptId: value, instructorId: '' } }));
    loadInstructorsForCourse(courseId, value || departmentId);
  };

  const updateRow = (courseId, field, value) => {
    if (field === 'instructorId') {
      setAssignments((current) => ({ ...current, [courseId]: { ...(current[courseId] || {}), instructorId: value } }));
      return;
    }
    setAssignments((current) => ({ ...current, [courseId]: { ...(current[courseId] || {}), [field]: value } }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const assignedRows = visibleCourses.map((course) => ({ courseId: course.id, instructorId: assignments[course.id]?.instructorId })).filter((row) => row.instructorId);
    if (!filters.programType || !filters.yearLevel || !filters.semester || !filters.section || !assignedRows.length) {
      toast.error('Select all filters, a section, and at least one instructor.');
      return;
    }
    setSaving(true);
    try {
      await courseAssignmentApi.batchAssignMatrix({ programType: filters.programType, yearLevel: filters.yearLevel, semester: filters.semester, section: filters.section, assignments: assignedRows });
      toast.success(`${assignedRows.length} course assignment${assignedRows.length === 1 ? '' : 's'} saved.`);
      onAssigned?.();
      onClose();
    } catch (error) {
      toast.error(error.message || 'Unable to save course assignments.');
    } finally { setSaving(false); }
  };

  const instructorLabel = (instructor) => {
    const name = instructor.full_name || instructor.instructor_name || instructor.name || instructor.email;
    const role = String(instructor.role || '').toLowerCase();
    return `${name}${role && role !== 'instructor' ? ` (${role.replaceAll('_', ' ').toUpperCase()})` : ''}`;
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm"><form onSubmit={submit} className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8"><div className="-mx-6 -mt-6 mb-6 flex items-center justify-between rounded-t-2xl bg-ieps-blue-600 px-6 py-5 sm:-mx-8 sm:-mt-8 sm:px-8"><div><h3 className="text-xl font-bold text-white">Assign Courses</h3><p className="mt-1 text-sm text-blue-100">Select an instructor independently for each course.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-blue-100 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70" aria-label="Close">✕</button></div>
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm text-slate-600"><span className="mb-2 block font-semibold text-slate-700">Program Type</span><select value={filters.programType} onChange={updateFilter('programType')} className={selectClass}><option value="">Select</option><option>Regular</option><option>Extension</option><option>Summer</option></select></label><label className="text-sm text-slate-600"><span className="mb-2 block font-semibold text-slate-700">Year Level</span><select value={filters.yearLevel} onChange={updateFilter('yearLevel')} className={selectClass}><option value="">Select</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label><label className="text-sm text-slate-600"><span className="mb-2 block font-semibold text-slate-700">Semester</span><select value={filters.semester} onChange={updateFilter('semester')} className={selectClass}><option value="">Select</option><option>I</option><option>II</option></select></label><label className="text-sm text-slate-600"><span className="mb-2 block font-semibold text-slate-700">Section</span><select value={filters.section} onChange={updateFilter('section')} className={selectClass}><option value="">Select</option>{sections.map((section) => <option key={section}>{section}</option>)}</select></label></div>
    <div className="mt-7 overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-[850px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500"><tr><th className="w-[34%] px-5 py-3.5">Course</th><th className="w-[33%] px-5 py-3.5">Instructor Department</th><th className="w-[33%] px-5 py-3.5">Instructor</th></tr></thead><tbody className="divide-y divide-slate-100">{loadingCourses ? <tr><td colSpan="3" className="px-5 py-8 text-center text-slate-500">Loading courses...</td></tr> : visibleCourses.length ? visibleCourses.map((course) => { const row = assignments[course.id] || {}; const department = row.deptId || String(departmentId || ''); const labCourse = isLabCourse(course.is_lab); const instructors = rowInstructors[course.id] || (department === String(departmentId) ? defaultInstructors.filter((instructor) => isLabAssistant(instructor.role) === labCourse) : []); return <tr key={course.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4 font-semibold text-slate-900">{course.code || course.course_code} · {course.name || course.course_title}{labCourse && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Lab Class{course.section ? ` · Section ${normalizeSection(course.section).toUpperCase()}` : ''}</span>}</td><td className="px-5 py-4"><select value={department} onChange={(event) => handleDeptChange(course.id, event.target.value)} className={selectClass}><option value={String(departmentId || '')}>Current Department</option>{departments.filter((item) => String(item.id) !== String(departmentId)).map((item) => <option key={item.id} value={item.id}>{item.name || item.department_name}</option>)}</select></td><td className="px-5 py-4"><select value={row.instructorId || ''} onChange={(event) => updateRow(course.id, 'instructorId', event.target.value)} onFocus={() => loadRowInstructors(course.id, department)} className={selectClass} disabled={loadingRows[course.id]}><option value="">{loadingRows[course.id] ? 'Loading...' : 'Select instructor'}</option>{instructors.map((instructor) => <option key={instructor.instructor_id || instructor.id || instructor.user_id} value={instructor.instructor_id || instructor.id || instructor.user_id}>{instructorLabel(instructor)}</option>)}</select></td></tr>; }) : courses.length ? <tr><td colSpan="3" className="px-5 py-8 text-center text-slate-500">No courses are registered for the selected section.</td></tr> : <tr><td colSpan="3" className="px-5 py-8 text-center text-slate-500">Select Year Level and Semester to load courses.</td></tr>}</tbody></table></div>
    <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-ieps-blue-200">Cancel</button><button type="submit" disabled={saving} className="rounded-xl bg-ieps-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ieps-blue-700 focus:outline-none focus:ring-2 focus:ring-ieps-blue-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : 'Assign Courses'}</button></div>
  </form></div>;
};

export default CourseAssignmentModal;
