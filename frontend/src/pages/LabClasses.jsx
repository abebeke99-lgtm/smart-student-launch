import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { registrationApi } from '../services/api';
import { useUiText } from '../hooks/useUiText';

const LabClasses = () => {
  const t = useUiText();
  const navigate = useNavigate();
  const { user } = useAuth();
  const departmentId = user?.department_id || user?.departmentId || user?.department || null;
  const [form, setForm] = useState({ name: '', yearLevel: '', semester: '', section: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await registrationApi.createCourse({
        course_name: form.name.trim(),
        department_id: departmentId,
        year_level: form.yearLevel,
        semester: form.semester,
        section: form.section,
        is_lab: true,
      });
      setForm({ name: '', yearLevel: '', semester: '', section: '' });
      toast.success(t('Lab Class registered successfully.'));
    } catch (error) {
      toast.error(error?.message || t('Unable to register Lab Class.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <button type="button" onClick={() => navigate('/dept-head-dashboard')} className="text-sm font-semibold text-blue-700 hover:text-blue-900">← {t('Department Head Dashboard')}</button>
      <header>
        <h1 className="text-xl font-bold text-slate-900">{t('Lab Classes')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('Register a lab class and assign its academic offering.')}</p>
      </header>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">{t('Course Name')} <span className="text-red-600">*</span></span>
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t('e.g. IT 3rd Year Lab')} className="mt-2 h-11 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500" required />
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('Year Level')} <span className="text-red-600">*</span></span>
            <select value={form.yearLevel} onChange={(event) => setForm({ ...form, yearLevel: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" required><option value="">{t('Select year level')}</option>{[1, 2, 3, 4, 5, 6, 7].map((year) => <option key={year} value={`Year ${year}`}>{t(`Year ${year}`)}</option>)}</select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('Semester')} <span className="text-red-600">*</span></span>
            <select value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" required><option value="">{t('Select semester')}</option><option value="Semester I">{t('Semester I')}</option><option value="Semester II">{t('Semester II')}</option></select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">{t('Section')} <span className="text-red-600">*</span></span>
            <select value={form.section} onChange={(event) => setForm({ ...form, section: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm" required><option value="">{t('Select section')}</option>{'A B C D E F G H I J K L'.split(' ').map((section) => <option key={section} value={section}>{t('Section')} {section}</option>)}</select>
          </label>
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{saving ? t('Saving...') : t('Register Lab Class')}</button>
      </form>
    </section>
  );
};

export default LabClasses;
