import { useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, BookOpen, CalendarDays, Clock3, Layers3, Send, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { registrationApi } from '../services/api';

const initialForm = { name: '', code: '', yearLevel: '', semester: '', creditHours: '' };

const CourseRegistration = () => {
  const { user } = useAuth();
  const departmentId = user?.department_id || user?.departmentId || user?.department || null;
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      course_name: form.name.trim(),
      course_code: form.code.trim(),
      department_id: departmentId,
      year_level: form.yearLevel,
      semester: form.semester,
      credit_hours: Number(form.creditHours),
      is_lab: false,
      section: null,
    };
    if (!payload.course_name || !payload.course_code) {
      toast.error('Please enter the course name and course code.');
      return;
    }

    try {
      setSaving(true);
      await registrationApi.createCourse(payload);
      setForm(initialForm);
      toast.success('Course registered successfully.');
    } catch (error) {
      toast.error(error?.message || 'Unable to register course.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <header className="flex items-center gap-4 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-white px-5 py-5 shadow-sm sm:px-6">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
          <CalendarDays aria-hidden="true" size={28} />
        </span>
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Course Registration</h2>
          <p className="mt-1 text-sm text-slate-600">Register standard lecture courses for your department.</p>
        </div>
      </header>

      <fieldset className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm">
        <legend className="sr-only">Course Details</legend>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white shadow-sm">1</span>
          <div>
            <h3 className="font-semibold text-slate-900">Course Details</h3>
            <p className="text-xs text-slate-500">Enter the basic information about the course.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-3 sm:px-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Course Name <span className="text-red-600">*</span></span>
            <span className="relative mt-2 block">
              <BookOpen aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Database Systems" className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required />
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Course Code <span className="text-red-600">*</span></span>
            <span className="relative mt-2 block">
              <Tag aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="e.g. IT 301" className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required />
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Credit Hours <span className="text-red-600">*</span></span>
            <span className="relative mt-2 block">
              <Clock3 aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="number" min="1" value={form.creditHours} onChange={(event) => setForm({ ...form, creditHours: event.target.value })} placeholder="e.g. 3" className="h-11 w-full rounded-lg border border-slate-300 pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required />
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50/30 shadow-sm">
        <legend className="sr-only">Offering Information</legend>
        <div className="flex items-center gap-3 border-b border-emerald-100/80 px-5 py-4 sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white shadow-sm">2</span>
          <div>
            <h3 className="font-semibold text-slate-900">Offering Information</h3>
            <p className="text-xs text-slate-500">Specify the academic level and semester for this course.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 sm:px-6">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Year Level <span className="text-red-600">*</span></span>
            <span className="relative mt-2 block">
              <Layers3 aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select value={form.yearLevel} onChange={(event) => setForm({ ...form, yearLevel: event.target.value })} className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                <option value="">Select year level</option>
                {[1, 2, 3, 4, 5, 6, 7].map((year) => <option key={year} value={`Year ${year}`}>Year {year}</option>)}
              </select>
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Semester <span className="text-red-600">*</span></span>
            <span className="relative mt-2 block">
              <CalendarDays aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <select value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" required>
                <option value="">Select semester</option>
                <option value="Semester I">Semester I</option>
                <option value="Semester II">Semester II</option>
              </select>
            </span>
          </label>
        </div>
      </fieldset>

      <footer className="flex justify-center rounded-xl bg-blue-50/80 px-5 py-4">
        <button type="submit" disabled={saving} className="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          <Send aria-hidden="true" size={15} />
          {saving ? 'Saving...' : 'Register Course'}
          {!saving && <ArrowRight aria-hidden="true" size={16} />}
        </button>
      </footer>
    </form>
  );
};

export default CourseRegistration;
