import { useEffect, useMemo, useRef, useState } from 'react';
import { Database, Search } from 'lucide-react';
import { adminApi, departmentApi, registrationApi } from '../services/api';
import { resolveApiAssetUrl } from '../../config';
import { useConfirmation } from './ConfirmationDialog';
import { useUiText } from '../hooks/useUiText';

const PAGE_SIZE = 10;
const toUpdateFormData = (fields, photo) => {
  const formData = new FormData();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (photo) formData.append('photo', photo);
  return formData;
};

const ProfilePhotoInput = ({ photo, currentPhoto, onChange }) => {
  const t = useUiText();
  const [preview, setPreview] = useState(resolveApiAssetUrl(currentPhoto));

  useEffect(() => {
    if (!photo) {
      setPreview(resolveApiAssetUrl(currentPhoto));
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photo);
    setPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [currentPhoto, photo]);

  return (
    <div className="flex items-center gap-4 sm:col-span-2">
      <img
        src={preview || `https://ui-avatars.com/api/?name=User&background=dbeafe&color=1e3a8a`}
        alt={t('User profile')}
        className="h-16 w-16 rounded-full border border-slate-200 object-cover"
      />
      <label className="text-sm font-medium text-slate-700">
        {t('Profile Photo')}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
          className="mt-1 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:font-semibold file:text-blue-700"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">{t('JPG, PNG, WEBP, or GIF; up to 5 MB.')}</span>
      </label>
    </div>
  );
};

const programLabel = (value) => (value === 'extension' ? 'Extension' : value ? 'Regular' : '-');
const roleLabel = (value) => ({
  instructor: 'Instructor',
  academic_directorate: 'Academic Director',
  academic_director: 'Academic Director',
  directorate: 'Academic Director',
  college_dean: 'College Dean',
  dean: 'College Dean',
  dept_head: 'Department Head',
  department_head: 'Department Head',
  lab_assistant: 'Lab Assistant',
  ara: 'Lab Assistant',
  'lab assistant': 'Lab Assistant',
  'lab-assistant': 'Lab Assistant',
}[String(value || '').trim().toLowerCase()] || value || '-');
const getNameParts = (row) => {
  const legacyParts = String(row.full_name || row.fullName || '').trim().split(/\s+/).filter(Boolean);
  return {
    first_name: row.first_name || row.firstName || legacyParts[0] || '',
    last_name: row.last_name || row.lastName || legacyParts.slice(1).join(' ') || '',
  };
};

const ViewDataView = ({ instructors = [], students = [], users = [], departments = [], initialTab = 'instructors', initialQuery = '', onResetPassword, resettingPasswordUserId, onUserDeleted }) => {
  const t = useUiText();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [managedInstructors, setManagedInstructors] = useState(instructors);
  const [managedStudents, setManagedStudents] = useState(students);
  const [managedUsers, setManagedUsers] = useState(users);
  const [managedColleges, setManagedColleges] = useState([]);
  const [collegesError, setCollegesError] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingAccount, setEditingAccount] = useState(null);
  const [studentSaving, setStudentSaving] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [managedDepartments, setManagedDepartments] = useState(departments);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [editingCollege, setEditingCollege] = useState(null);
  const [recordSaving, setRecordSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const contextMenuRef = useRef(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const { requestConfirmation, confirmationDialog } = useConfirmation();

  useEffect(() => {
    setManagedInstructors(instructors);
  }, [instructors]);

  useEffect(() => {
    setManagedStudents(students);
  }, [students]);

  useEffect(() => {
    setManagedUsers(users);
  }, [users]);

  useEffect(() => {
    setManagedDepartments(departments);
  }, [departments]);

  useEffect(() => {
    let isCurrent = true;
    adminApi.getColleges()
      .then((rows) => {
        if (isCurrent) setManagedColleges(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        if (isCurrent) setCollegesError(error?.message || t('Unable to load colleges.'));
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  const handleDeleteRecord = async (record, type) => {
    const label = type === 'department'
      ? record.name || record.department_name || t('this department')
      : record.full_name || record.fullName || record.username || t('this instructor');
    if (!await requestConfirmation({
      title: type === 'department' ? t('Delete Department Confirmation') : t('Delete User Confirmation'),
      description: `${t('Are you sure you want to delete')} ${label}? ${t('This action cannot be undone.')}`,
      confirmLabel: type === 'department' ? t('Delete Department') : t('Delete User'),
      variant: 'danger',
    })) return;
    setStudentError('');
    try {
      if (type === 'department') {
        await departmentApi.deleteDepartment(record.id);
        setManagedDepartments((current) => current.filter((row) => row.id !== record.id));
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(String(record.id));
          return next;
        });
      } else {
        await registrationApi.deleteUser(record.id);
        setManagedInstructors((current) => current.filter((row) => row.id !== record.id));
        setManagedUsers((current) => current.filter((row) => row.id !== record.id));
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(String(record.id));
          return next;
        });
        setEditingInstructor(null);
        onUserDeleted?.(record.id);
      }
    } catch (deleteError) {
      setStudentError(deleteError?.message || `${t('Unable to delete')} ${t(type)}.`);
    }
  };

  const handleInstructorSubmit = async (event) => {
    event.preventDefault();
    if (!editingInstructor) return;
    setRecordSaving(true);
    setStudentError('');
    try {
      const response = await registrationApi.updateUser(editingInstructor.id, toUpdateFormData({
        role: editingInstructor.role || 'instructor',
        username: editingInstructor.username,
        first_name: editingInstructor.first_name,
        last_name: editingInstructor.last_name,
        phone_number: editingInstructor.phone_number,
        department_id: editingInstructor.department_id,
        gender: editingInstructor.gender,
      }, editingInstructor.photoFile));
      setManagedInstructors((current) => current.map((row) => (
        row.id === editingInstructor.id
          ? { ...row, ...editingInstructor, profile_picture: response?.profile_picture || row.profile_picture, fullName: `${editingInstructor.first_name} ${editingInstructor.last_name}`.trim(), full_name: `${editingInstructor.first_name} ${editingInstructor.last_name}`.trim(), phoneNumber: editingInstructor.phone_number, departmentId: editingInstructor.department_id }
          : row
      )));
      setEditingInstructor(null);
    } catch (saveError) {
      setStudentError(saveError?.message || t('Unable to update instructor.'));
    } finally {
      setRecordSaving(false);
    }
  };

  const handleDepartmentSubmit = async (event) => {
    event.preventDefault();
    if (!editingDepartment) return;
    setRecordSaving(true);
    setStudentError('');
    try {
      const updated = await departmentApi.updateDepartment(editingDepartment.id, {
        college_id: editingDepartment.college_id || editingDepartment.collegeId,
        department_name: editingDepartment.name,
        department_code: editingDepartment.code,
      });
      setManagedDepartments((current) => current.map((row) => (row.id === editingDepartment.id ? { ...row, ...editingDepartment, ...updated } : row)));
      setEditingDepartment(null);
    } catch (saveError) {
      setStudentError(saveError?.message || t('Unable to update department.'));
    } finally {
      setRecordSaving(false);
    }
  };

  const handleCollegeSubmit = async (event) => {
    event.preventDefault();
    if (!editingCollege) return;
    setRecordSaving(true);
    setCollegesError('');
    try {
      const updatedCollege = await adminApi.updateCollege(editingCollege.id, {
        name: editingCollege.name,
        code: editingCollege.code,
      });
      setManagedColleges((current) => current.map((college) => (
        college.id === editingCollege.id ? { ...college, ...updatedCollege } : college
      )));
      setEditingCollege(null);
    } catch (saveError) {
      setCollegesError(saveError?.message || t('Unable to update college.'));
    } finally {
      setRecordSaving(false);
    }
  };

  const handleDeleteCollege = async (college) => {
    const collegeName = college.name || t('this college');
    if (!await requestConfirmation({
      title: t('Delete College Confirmation'),
      description: `${t('Are you sure you want to delete')} ${collegeName}? ${t('This action cannot be undone.')}`,
      confirmLabel: t('Delete College'),
      variant: 'danger',
    })) return;
    setCollegesError('');
    try {
      await adminApi.deleteCollege(college.id);
      setManagedColleges((current) => current.filter((row) => row.id !== college.id));
      setContextMenu(null);
    } catch (deleteError) {
      setCollegesError(deleteError?.message || t('Unable to delete college.'));
    }
  };

  const handleDeleteStudent = async (student) => {
    const studentName = student.full_name || student.fullName || student.student_id || student.studentId || t('this student');
    if (!await requestConfirmation({
      title: t('Delete User Confirmation'),
      description: `${t('Are you sure you want to delete')} ${studentName}? ${t('This action cannot be undone.')}`,
      confirmLabel: t('Delete User'),
      variant: 'danger',
    })) return;
    setStudentError('');
    try {
      await registrationApi.deleteUser(student.id);
      setManagedStudents((current) => current.filter((row) => row.id !== student.id));
      setManagedUsers((current) => current.filter((row) => row.id !== student.id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(String(student.id));
        return next;
      });
      onUserDeleted?.(student.id);
    } catch (deleteError) {
      setStudentError(deleteError?.message || t('Unable to delete student.'));
    }
  };

  const openEditRecord = (row) => {
    setStudentError('');
    if (activeTab === 'instructors') {
      setEditingInstructor({
        id: row.id,
        role: row.role || 'instructor',
        username: row.username || '',
        ...getNameParts(row),
        phone_number: row.phone_number || row.phoneNumber || '',
        department_id: String(row.department_id || row.departmentId || ''),
        gender: row.gender || '',
        profile_picture: row.profile_picture || '',
        photoFile: null,
      });
    } else if (activeTab === 'students') {
      setEditingStudent({
        id: row.id,
        student_id: row.student_id || row.studentId || '',
        ...getNameParts(row),
        phone_number: row.phone_number || row.phoneNumber || '',
        department_id: String(row.department_id || row.departmentId || ''),
        semester: row.semester || '',
        year: row.year || row.year_level || '',
        section: row.section || '',
        program_type: row.program_type || row.programType || 'regular',
        gender: row.gender || '',
        profile_picture: row.profile_picture || '',
        photoFile: null,
      });
    } else if (activeTab === 'departments') {
      setEditingDepartment({
        id: row.id,
        name: row.name || row.department_name || '',
        code: row.code || row.department_code || '',
        college_id: row.college_id || row.collegeId || '',
      });
    } else if (activeTab === 'colleges') {
      setEditingCollege({ id: row.id, name: row.name || '', code: row.code || '' });
    } else {
      setEditingAccount({
        id: row.id,
        fullName: row.full_name || row.fullName || row.username,
        profile_picture: row.profile_picture || '',
        photoFile: null,
      });
    }
  };

  const handleContextMenu = (event, row) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, row });
  };

  const handleContextMenuAction = (action) => {
    const row = contextMenu?.row;
    setContextMenu(null);
    if (!row) return;

    if (action === 'select') {
      setSelectionMode(true);
      setSelectedIds((current) => {
        const next = new Set(current);
        const id = String(row.id);
        next.add(id);
        return next;
      });
    } else if (action === 'edit') {
      openEditRecord(row);
    } else if (action === 'reset') {
      onResetPassword?.(row);
    } else if (activeTab === 'colleges') {
      if (action === 'edit') openEditRecord(row);
      else if (action === 'delete') void handleDeleteCollege(row);
    } else if (activeTab === 'students') {
      void handleDeleteStudent(row);
    } else {
      void handleDeleteRecord(row, activeTab === 'departments' ? 'department' : 'instructor');
    }
  };

  useEffect(() => {
    if (!contextMenu) return undefined;
    const closeContextMenu = (event) => {
      if (!contextMenuRef.current?.contains(event.target)) setContextMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('click', closeContextMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeContextMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const handleStudentSubmit = async (event) => {
    event.preventDefault();
    if (!editingStudent) return;
    setStudentSaving(true);
    setStudentError('');
    try {
      const response = await registrationApi.updateUser(editingStudent.id, toUpdateFormData({
        role: 'student',
        username: editingStudent.student_id,
        student_id: editingStudent.student_id,
        first_name: editingStudent.first_name,
        last_name: editingStudent.last_name,
        phone_number: editingStudent.phone_number,
        department_id: editingStudent.department_id,
        semester: editingStudent.semester,
        year: editingStudent.year,
        section: editingStudent.section,
        program_type: editingStudent.program_type,
        gender: editingStudent.gender,
      }, editingStudent.photoFile));
      setManagedStudents((current) => current.map((row) => (
        row.id === editingStudent.id
          ? { ...row, ...editingStudent, profile_picture: response?.profile_picture || row.profile_picture, studentId: editingStudent.student_id, fullName: `${editingStudent.first_name} ${editingStudent.last_name}`.trim(), phoneNumber: editingStudent.phone_number, departmentId: editingStudent.department_id, year_level: editingStudent.year }
          : row
      )));
      setEditingStudent(null);
    } catch (saveError) {
      setStudentError(saveError?.message || 'Unable to update student.');
    } finally {
      setStudentSaving(false);
    }
  };

  const handleAccountPhotoSubmit = async (event) => {
    event.preventDefault();
    if (!editingAccount?.photoFile) {
      setStudentError('Choose a photo before saving.');
      return;
    }
    setRecordSaving(true);
    setStudentError('');
    const formData = new FormData();
    formData.append('photo', editingAccount.photoFile);
    try {
      const response = await registrationApi.updateUser(editingAccount.id, formData);
      setManagedUsers((current) => current.map((row) => (
        row.id === editingAccount.id
          ? { ...row, profile_picture: response?.profile_picture || row.profile_picture }
          : row
      )));
      setEditingAccount(null);
    } catch (saveError) {
      setStudentError(saveError?.message || 'Unable to update user photo.');
    } finally {
      setRecordSaving(false);
    }
  };

  const entityConfig = useMemo(() => ({
    instructors: {
      label: 'Instructors',
      rows: managedInstructors,
      searchValues: (row) => [row.username, row.email, row.phoneNumber, row.phone_number, roleLabel(row.role)],
      columns: [
        ['ID', (row) => row.id],
        ['Name', (row) => row.fullName || row.full_name || '-'],
        ['Role', (row) => t(roleLabel(row.role))],
        ['Username / Email', (row) => row.username || row.email || '-'],
        ['Phone Number', (row) => row.phoneNumber || row.phone_number || '-'],
        ['Gender', (row) => row.gender || '-'],
        ['Department', (row) => row.departmentName || row.department || '-'],
        ['Status', (row) => row.status || 'Active'],
        ['Actions', (row) => <div className="flex items-center gap-2">
          {onResetPassword ? <button type="button" disabled={String(resettingPasswordUserId) === String(row.id)} onClick={() => onResetPassword(row)} className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">{String(resettingPasswordUserId) === String(row.id) ? 'Resetting…' : 'Reset Password'}</button> : null}
          <button type="button" onClick={() => { setStudentError(''); setEditingInstructor({ id: row.id, role: row.role || 'instructor', username: row.username || '', ...getNameParts(row), phone_number: row.phone_number || row.phoneNumber || '', department_id: String(row.department_id || row.departmentId || ''), gender: row.gender || '', profile_picture: row.profile_picture || '', photoFile: null }); }} className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200">{t('Edit')}</button>
          <button type="button" onClick={() => void handleDeleteRecord(row, 'instructor')} className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-200">{t('Delete')}</button>
        </div>],
      ],
    },
    students: {
      label: 'Students',
      rows: managedStudents,
      searchValues: (row) => [row.studentId, row.student_id, row.fullName, row.full_name],
      columns: [
        ['ID', (row) => row.id],
          ['Student ID', (row) => row.student_id || row.studentId || '-'],
        ['Name', (row) => row.fullName || row.full_name || '-'],
          ['Phone Number', (row) => row.phone_number || row.phoneNumber || '-'],
        ['Department', (row) => row.departmentName || row.department || '-'],
        ['Program Type', (row) => t(programLabel(row.programType || row.program_type))],
        ['Year / Section', (row) => `${row.year || row.year_level || '-'} / ${row.section || '-'}`],
        ['Actions', (row) => (
          <div className="flex items-center gap-2">
            {onResetPassword ? <button type="button" disabled={String(resettingPasswordUserId) === String(row.id)} onClick={() => onResetPassword(row)} className="rounded-lg bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-200 disabled:cursor-wait disabled:opacity-60">{String(resettingPasswordUserId) === String(row.id) ? 'Resetting…' : 'Reset Password'}</button> : null}
            <button type="button" onClick={() => { setStudentError(''); setEditingStudent({
              id: row.id,
              student_id: row.student_id || row.studentId || '',
              ...getNameParts(row),
              phone_number: row.phone_number || row.phoneNumber || '',
              department_id: String(row.department_id || row.departmentId || ''),
              semester: row.semester || '',
              year: row.year || row.year_level || '',
              section: row.section || '',
              program_type: row.program_type || row.programType || 'regular',
              gender: row.gender || '',
              profile_picture: row.profile_picture || '',
              photoFile: null,
            }); }} className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200">{t('Edit')}</button>
            <button type="button" onClick={() => void handleDeleteStudent(row)} className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-200">{t('Delete')}</button>
          </div>
        )],
      ],
    },
    users: {
      label: 'Active Users',
      rows: managedUsers,
      searchValues: (row) => [row.fullName, row.username, row.role, roleLabel(row.role), row.departmentName, row.status],
      columns: [
        ['ID', (row) => row.id],
        ['Name', (row) => row.fullName || '-'],
        ['Role', (row) => t(roleLabel(row.role))],
        ['Username', (row) => row.username || '-'],
        ['Department', (row) => row.departmentName || row.department || '-'],
        ['Status', (row) => row.status || 'Active'],
        ['Actions', (row) => (
          <button
            type="button"
            onClick={() => {
              setStudentError('');
              setEditingAccount({
                id: row.id,
                fullName: row.full_name || row.fullName || row.username,
                profile_picture: row.profile_picture || '',
                photoFile: null,
              });
            }}
            className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200"
          >
            {t('Edit Photo')}
          </button>
        )],
      ],
    },
    departments: {
      label: 'Departments',
      rows: managedDepartments,
      searchValues: (row) => [row.name, row.department_name],
      columns: [
        ['ID', (row) => row.id],
        ['Name', (row) => row.name || '-'],
        ['Code', (row) => row.code || '-'],
        ['Category', (row) => row.category || 'Custom'],
        ['Registered On', (row) => row.registeredAt || row.created_at || '-'],
        ['Actions', (row) => <div className="flex items-center gap-2">
          <button type="button" onClick={() => { setStudentError(''); setEditingDepartment({ id: row.id, name: row.name || row.department_name || '', code: row.code || row.department_code || '', college_id: row.college_id || row.collegeId || '' }); }} className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200">{t('Edit')}</button>
          <button type="button" onClick={() => void handleDeleteRecord(row, 'department')} className="rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-200">{t('Delete')}</button>
        </div>],
      ],
    },
    colleges: {
      label: 'Colleges',
      rows: managedColleges,
      searchValues: (row) => [row.name, row.code],
      columns: [
        ['ID', (row) => row.id],
        ['Name', (row) => row.name || '-'],
        ['Code', (row) => row.code || '-'],
        ['Actions', (row) => (
          <button
            type="button"
            onClick={() => {
              setCollegesError('');
              setEditingCollege({ id: row.id, name: row.name || '', code: row.code || '' });
            }}
            className="rounded-lg bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-200"
          >
            {t('Edit')}
          </button>
        )],
      ],
    },
  }), [managedInstructors, managedDepartments, managedStudents, managedUsers, managedColleges, onResetPassword, t]);

  const activeEntity = entityConfig[activeTab];
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return activeEntity.rows.filter((row) => {
      const rowDepartment = row.departmentId || row.department_id || row.department;
      const rowYear = row.year || row.year_level;
      const rowSection = String(row.section || '').replace(/^section\s*/i, '');
      const selectedSection = sectionFilter.replace(/^section\s*/i, '');
      const matchesDepartment = departmentFilter === 'All' || String(rowDepartment) === departmentFilter;
      const matchesYear = activeTab !== 'students' || yearFilter === 'All' || String(rowYear) === yearFilter;
      const matchesSection = activeTab !== 'students' || sectionFilter === 'All' || rowSection.toLowerCase() === selectedSection.toLowerCase();
      const matchesQuery = !normalizedQuery || activeEntity.searchValues(row).some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
      return matchesDepartment && matchesYear && matchesSection && matchesQuery;
    });
  }, [activeEntity, activeTab, departmentFilter, query, sectionFilter, yearFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const firstEntry = filteredRows.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
  const lastEntry = Math.min(currentPage * PAGE_SIZE, filteredRows.length);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const selectedCount = selectedIds.size;

  const handleDeleteSelected = async () => {
    if (!selectedIds.size) return;
    const selectedRows = activeEntity.rows.filter((row) => selectedIds.has(String(row.id)));
    if (!selectedRows.length) return;
    const selectionLabel = activeTab === 'colleges'
      ? 'colleges'
      : activeTab === 'departments'
        ? 'departments'
        : activeTab === 'students'
          ? 'students'
          : 'instructors';
    if (!await requestConfirmation({
      title: t('Delete Selected Records'),
      description: `${t('Are you sure you want to delete the selected')} ${t(selectionLabel)}? ${t('This action cannot be undone.')}`,
      confirmLabel: t('Delete Selected'),
      variant: 'danger',
    })) return;

    try {
      if (activeTab === 'colleges') {
        await Promise.all(selectedRows.map((row) => adminApi.deleteCollege(row.id)));
        setManagedColleges((current) => current.filter((row) => !selectedIds.has(String(row.id))));
      } else if (activeTab === 'departments') {
        await Promise.all(selectedRows.map((row) => departmentApi.deleteDepartment(row.id)));
        setManagedDepartments((current) => current.filter((row) => !selectedIds.has(String(row.id))));
      } else if (activeTab === 'students') {
        await Promise.all(selectedRows.map((row) => registrationApi.deleteUser(row.id)));
        setManagedStudents((current) => current.filter((row) => !selectedIds.has(String(row.id))));
        setManagedUsers((current) => current.filter((row) => !selectedIds.has(String(row.id))));
      } else {
        await Promise.all(selectedRows.map((row) => registrationApi.deleteUser(row.id)));
        setManagedInstructors((current) => current.filter((row) => !selectedIds.has(String(row.id))));
        setManagedUsers((current) => current.filter((row) => !selectedIds.has(String(row.id))));
      }
      setSelectedIds(new Set());
      setSelectionMode(false);
    } catch (deleteError) {
      if (activeTab === 'colleges') {
        setCollegesError(deleteError?.message || 'Unable to delete selected colleges.');
      } else {
        setStudentError(deleteError?.message || 'Unable to delete selected records.');
      }
    }
  };

  useEffect(() => {
    setPage(1);
  }, [activeTab, departmentFilter, query, sectionFilter, yearFilter]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, [activeTab, departmentFilter, query, sectionFilter, yearFilter]);

  const toggleRowSelection = (rowId) => {
    const id = String(rowId);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const visibleIds = pageRows.map((row) => String(row.id));
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => next.has(id));
      visibleIds.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const allVisibleSelected = pageRows.length > 0 && pageRows.every((row) => selectedIds.has(String(row.id)));

  return (
    <>
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Database size={22} className="text-blue-600" aria-hidden="true" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{t('View Data')}</h2>
            <p className="mt-1 text-slate-600">{t('Browse registered accounts and departments.')}</p>
          </div>
        </div>
        <label className="relative block w-full lg:w-80">
          <span className="sr-only">{t('Search')} {t(activeEntity.label)}</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`${t('Search')} ${t(activeTab === 'instructors' ? 'username, email, or phone number' : activeTab === 'students' ? 'student ID or name' : activeTab === 'users' ? 'name, username, or role' : 'department name')}...`} className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {Object.entries(entityConfig).map(([id, entity]) => (
          <button key={id} type="button" aria-pressed={activeTab === id} onClick={() => { setActiveTab(id); setQuery(''); }} className={`rounded-xl border border-transparent px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${activeTab === id ? 'bg-blue-700 text-white shadow-md hover:bg-blue-800' : 'bg-white text-slate-700 hover:bg-slate-100 hover:text-blue-700'}`}>
            {t(entity.label)}
          </button>
        ))}
      </div>

      {['instructors', 'students', 'users'].includes(activeTab) && <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="text-sm text-slate-600"><span className="mb-1 block font-medium">{t('Department')}</span><select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="All">{t('All departments')}</option>{departments.map((department) => <option key={department.id} value={String(department.id)}>{department.name}</option>)}</select></label>
        {activeTab === 'students' && <>
          <label className="text-sm text-slate-600"><span className="mb-1 block font-medium">{t('Year Level')}</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="All">{t('All year levels')}</option>{['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year', '6th Year', '7th Year'].map((year) => <option key={year} value={year}>{t(year)}</option>)}</select></label>
          <label className="text-sm text-slate-600"><span className="mb-1 block font-medium">{t('Section')}</span><select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="All">{t('All sections')}</option>{'ABCDEFGHIJKL'.split('').map((section) => <option key={section} value={section}>{t('Section')} {section}</option>)}</select></label>
        </>}
      </div>}

      {studentError && !editingStudent && !editingInstructor && !editingDepartment && !editingAccount
        ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{studentError}</p>
        : null}
      {activeTab === 'colleges' && collegesError
        ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{collegesError}</p>
        : null}

      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_55px_-34px_rgba(37,99,235,0.24)]">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-900">{t(activeEntity.label)}</h3>
            <span className="text-sm text-slate-500">{filteredRows.length} {t(filteredRows.length === 1 ? 'record' : 'records')}</span>
          </div>
          {selectionMode ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { setSelectedIds(new Set()); setSelectionMode(false); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">{t('Done / Clear Selection')}</button>
              {selectedCount > 0 ? <button type="button" onClick={() => void handleDeleteSelected()} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-500">{t('Delete Selected')} ({selectedCount})</button> : null}
            </div>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                {selectionMode ? (
                  <th className="w-12 whitespace-nowrap px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleVisibleSelection}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={t('Select visible rows')}
                    />
                  </th>
                ) : null}
                {activeEntity.columns.map(([label]) => <th key={label} className="whitespace-nowrap px-5 py-3 font-semibold text-slate-600">{t(label)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length ? pageRows.map((row, index) => {
                return (
                  <tr key={row.id ?? index} onContextMenu={(event) => handleContextMenu(event, row)} className="hover:bg-blue-50/40">
                    {selectionMode ? (
                      <td className="whitespace-nowrap px-3 py-4 text-slate-700">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(String(row.id))}
                          onChange={() => toggleRowSelection(row.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label={`${t('Select')} ${row.fullName || row.full_name || row.username || row.name || row.student_id || row.id}`}
                        />
                      </td>
                    ) : null}
                    {activeEntity.columns.map(([label, getValue]) => <td key={`${row.id ?? index}-${label}`} className="whitespace-nowrap px-5 py-4 text-slate-700">{getValue(row)}</td>)}
                  </tr>
                );
              }) : <tr><td colSpan={activeEntity.columns.length + (selectionMode ? 1 : 0)} className="px-5 py-12 text-center text-slate-500">{t('No matching')} {t(activeEntity.label.toLowerCase())} {t('found.')}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">{t('Showing')} {firstEntry} {t('to')} {lastEntry} {t('of')} {filteredRows.length} {t('entries')}</p>
          <div className="flex items-center justify-center gap-1">
            <button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">{t('Previous')}</button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`min-w-9 rounded-lg px-3 py-2 text-sm font-semibold ${currentPage === pageNumber ? 'bg-blue-600 text-white' : 'border border-slate-300 text-slate-700 hover:bg-slate-100'}`}>{pageNumber}</button>)}
            <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">{t('Next')}</button>
          </div>
        </div>
      </div>

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          role="menu"
          className="fixed z-[60] min-w-40 rounded-xl border border-slate-200 bg-white py-2 shadow-xl"
          style={{
            left: Math.min(contextMenu.x, window.innerWidth - 176),
            top: Math.min(contextMenu.y, window.innerHeight - 184),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {activeTab === 'colleges' ? (
            <>
              <button type="button" role="menuitem" onClick={() => handleContextMenuAction('select')} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">{t('Select')}</button>
              <button type="button" role="menuitem" onClick={() => handleContextMenuAction('edit')} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">{t('Edit')}</button>
              <button type="button" role="menuitem" onClick={() => handleContextMenuAction('delete')} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">{t('Delete')}</button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" onClick={() => handleContextMenuAction('select')} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">{t('Select')}</button>
              <button type="button" role="menuitem" onClick={() => handleContextMenuAction('edit')} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100">{t('Edit User')}</button>
              <button type="button" role="menuitem" disabled={!onResetPassword || activeTab === 'departments' || String(resettingPasswordUserId) === String(contextMenu.row.id)} onClick={() => handleContextMenuAction('reset')} className="block w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">{String(resettingPasswordUserId) === String(contextMenu.row.id) ? t('Resetting…') : t('Reset Password')}</button>
              <button type="button" role="menuitem" onClick={() => handleContextMenuAction('delete')} className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">{t('Delete User')}</button>
            </>
          )}
        </div>
      ) : null}

      {editingStudent ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={handleStudentSubmit} className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{t('Edit Student')}</h3>
                <p className="mt-1 text-sm text-slate-500">{t('Update the student record and save the changes.')}</p>
              </div>
              <button type="button" onClick={() => setEditingStudent(null)} className="text-xl text-slate-500" aria-label={t('Close edit student modal')}>✕</button>
            </div>
            {studentError ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{studentError}</p> : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProfilePhotoInput photo={editingStudent.photoFile} currentPhoto={editingStudent.profile_picture} onChange={(photoFile) => setEditingStudent((current) => ({ ...current, photoFile }))} />
              <label className="text-sm font-medium text-slate-700">{t('Student ID')}<input required value={editingStudent.student_id} onChange={(event) => setEditingStudent((current) => ({ ...current, student_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('First Name')}<input required value={editingStudent.first_name} onChange={(event) => setEditingStudent((current) => ({ ...current, first_name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Last Name')}<input required value={editingStudent.last_name} onChange={(event) => setEditingStudent((current) => ({ ...current, last_name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Gender')}<select required value={editingStudent.gender} onChange={(event) => setEditingStudent((current) => ({ ...current, gender: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">{t('Select Gender')}</option><option value="male">{t('Male')}</option><option value="female">{t('Female')}</option></select></label>
              <label className="text-sm font-medium text-slate-700">{t('Phone Number')}<input value={editingStudent.phone_number} onChange={(event) => setEditingStudent((current) => ({ ...current, phone_number: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Department')}<select required value={editingStudent.department_id} onChange={(event) => setEditingStudent((current) => ({ ...current, department_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="">{t('Select department')}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">{t('Semester')}<select value={editingStudent.semester} onChange={(event) => setEditingStudent((current) => ({ ...current, semester: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="i">I</option><option value="ii">II</option></select></label>
              <label className="text-sm font-medium text-slate-700">{t('Year Level')}<input required value={editingStudent.year} onChange={(event) => setEditingStudent((current) => ({ ...current, year: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Section')}<input required value={editingStudent.section} onChange={(event) => setEditingStudent((current) => ({ ...current, section: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Program Type')}<select value={editingStudent.program_type} onChange={(event) => setEditingStudent((current) => ({ ...current, program_type: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="regular">{t('Regular')}</option><option value="extension">{t('Extension')}</option></select></label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingStudent(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{t('Cancel')}</button>
              <button type="submit" disabled={studentSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{studentSaving ? t('Saving...') : t('Save Changes')}</button>
            </div>
          </form>
        </div>
      ) : null}

      {editingInstructor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={handleInstructorSubmit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold text-slate-900">{t('Edit Instructor')}</h3><button type="button" onClick={() => setEditingInstructor(null)} className="text-xl text-slate-500" aria-label={t('Close edit instructor modal')}>✕</button></div>
            {studentError ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{studentError}</p> : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ProfilePhotoInput photo={editingInstructor.photoFile} currentPhoto={editingInstructor.profile_picture} onChange={(photoFile) => setEditingInstructor((current) => ({ ...current, photoFile }))} />
              <label className="text-sm font-medium text-slate-700">{t('Username')}<input required value={editingInstructor.username} onChange={(event) => setEditingInstructor((current) => ({ ...current, username: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('First Name')}<input required value={editingInstructor.first_name} onChange={(event) => setEditingInstructor((current) => ({ ...current, first_name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Last Name')}<input required value={editingInstructor.last_name} onChange={(event) => setEditingInstructor((current) => ({ ...current, last_name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Gender')}<select required value={editingInstructor.gender} onChange={(event) => setEditingInstructor((current) => ({ ...current, gender: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"><option value="">{t('Select Gender')}</option><option value="male">{t('Male')}</option><option value="female">{t('Female')}</option></select></label>
              <label className="text-sm font-medium text-slate-700">{t('Phone Number')}<input required value={editingInstructor.phone_number} onChange={(event) => setEditingInstructor((current) => ({ ...current, phone_number: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label>
              <label className="text-sm font-medium text-slate-700">{t('Department')}<select required value={editingInstructor.department_id} onChange={(event) => setEditingInstructor((current) => ({ ...current, department_id: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"><option value="">{t('Select department')}</option>{managedDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
            </div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditingInstructor(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{t('Cancel')}</button><button type="submit" disabled={recordSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{recordSaving ? t('Saving...') : t('Save Changes')}</button></div>
          </form>
        </div>
      ) : null}

      {editingAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={handleAccountPhotoSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{t('Edit User Photo')}</h3>
                <p className="mt-1 text-sm text-slate-500">{editingAccount.fullName}</p>
              </div>
              <button type="button" onClick={() => setEditingAccount(null)} className="text-xl text-slate-500" aria-label={t('Close edit user photo modal')}>✕</button>
            </div>
            {studentError ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{studentError}</p> : null}
            <div className="mt-5">
              <ProfilePhotoInput
                photo={editingAccount.photoFile}
                currentPhoto={editingAccount.profile_picture}
                onChange={(photoFile) => setEditingAccount((current) => ({ ...current, photoFile }))}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingAccount(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{t('Cancel')}</button>
              <button type="submit" disabled={recordSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{recordSaving ? t('Saving...') : t('Save Photo')}</button>
            </div>
          </form>
        </div>
      ) : null}

      {editingCollege ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={handleCollegeSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{t('Edit College')}</h3>
                <p className="mt-1 text-sm text-slate-500">{t('Update the college name and code.')}</p>
              </div>
              <button type="button" onClick={() => setEditingCollege(null)} className="text-xl text-slate-500" aria-label={t('Close edit college modal')}>✕</button>
            </div>
            {collegesError ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{collegesError}</p> : null}
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                {t('College Name')}
                <input required value={editingCollege.name} onChange={(event) => setEditingCollege((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                {t('College Code')}
                <input required value={editingCollege.code} onChange={(event) => setEditingCollege((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setEditingCollege(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{t('Cancel')}</button>
              <button type="submit" disabled={recordSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{recordSaving ? t('Saving...') : t('Save Changes')}</button>
            </div>
          </form>
        </div>
      ) : null}

      {editingDepartment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <form onSubmit={handleDepartmentSubmit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-xl font-bold text-slate-900">{t('Edit Department')}</h3><button type="button" onClick={() => setEditingDepartment(null)} className="text-xl text-slate-500" aria-label={t('Close edit department modal')}>✕</button></div>
            {studentError ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{studentError}</p> : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">{t('Department Name')}<input required value={editingDepartment.name} onChange={(event) => setEditingDepartment((current) => ({ ...current, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label><label className="text-sm font-medium text-slate-700">{t('Department Code')}<input required value={editingDepartment.code} onChange={(event) => setEditingDepartment((current) => ({ ...current, code: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" /></label></div>
            <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setEditingDepartment(null)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">{t('Cancel')}</button><button type="submit" disabled={recordSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{recordSaving ? t('Saving...') : t('Save Changes')}</button></div>
          </form>
        </div>
      ) : null}
    </section>
    {confirmationDialog}
    </>
  );
};

export default ViewDataView;
