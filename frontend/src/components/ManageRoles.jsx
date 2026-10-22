import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Info,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
  UserMinus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { resolveApiAssetUrl } from '../../config';
import { adminApi, departmentApi } from '../services/api';
import { useUiText } from '../hooks/useUiText';

const ROLE_OPTIONS = [
  { value: 'vice_president', label: 'Vice President' },
  { value: 'academic_directorate', label: 'Academic Directorate' },
  { value: 'college_dean', label: 'College Dean' },
  { value: 'dept_head', label: 'Department Head' },
];

const CANDIDATE_ROLES = ['instructor', 'dept_head', 'college_dean'];

const getInitials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';

const CandidateAvatar = ({ candidate, sizeClass = 'h-10 w-10' }) => {
  const imageUrl = resolveApiAssetUrl(candidate?.profile_picture);
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-100 text-xs font-semibold text-blue-700 ${sizeClass}`}>
      {getInitials(candidate?.full_name || candidate?.username || '')}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
};

const CandidateProfileDropdown = ({ candidates, selected, onChange, disabled, loading }) => {
  const t = useUiText();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const filteredCandidates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) => (
      [candidate.full_name, candidate.username, candidate.department_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));
  }, [candidates, searchTerm]);

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (disabled) setIsOpen(false);
  }, [disabled]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        id="management-candidate"
        aria-label={selected ? `${t('Selected candidate')}: ${selected.full_name || selected.username}` : t('Select candidate')}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        className="flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-left text-sm outline-none transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        {selected ? (
          <>
            <CandidateAvatar candidate={selected} sizeClass="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-slate-800">{selected.full_name || selected.username}</span>
              <span className="block truncate text-xs text-slate-500">{selected.department_name || t('Department not assigned')}</span>
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-slate-500">
            {loading ? t('Loading candidates...') : t('Select Candidate')}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <label className="sticky top-0 z-10 flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <input
              type="search"
              aria-label={t('Search instructor by name or department')}
              placeholder={t('Search instructor by name or department...')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>
          <div role="listbox" aria-labelledby="management-candidate" className="max-h-56 overflow-y-auto p-1.5">
          {filteredCandidates.length ? filteredCandidates.map((candidate) => {
            const isSelected = String(candidate.id) === String(selected?.id);
            return (
              <button
                key={candidate.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(String(candidate.id));
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
              >
                <CandidateAvatar candidate={candidate} sizeClass="h-9 w-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{candidate.full_name || candidate.username}</span>
                  <span className="block truncate text-xs text-slate-500">{candidate.department_name || t('Department not assigned')}</span>
                </span>
                {isSelected && <Check className="h-4 w-4 shrink-0 text-blue-700" />}
              </button>
            );
          }) : (
            <p className="px-3 py-4 text-center text-sm text-slate-500">
              {loading
                ? t('Loading candidates...')
                : searchTerm.trim()
                  ? t('No instructor found.')
                  : 'No eligible candidates for this selection.'}
            </p>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

const ManageRoles = ({ onRoleAssigned }) => {
  const t = useUiText();
  const [candidates, setCandidates] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [role, setRole] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [userId, setUserId] = useState('');
  const [occupant, setOccupant] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([adminApi.getRoleCandidates(), adminApi.getColleges(), departmentApi.getAll()])
      .then(([staff, collegeRows, departmentRows]) => {
        if (!active) return;
        setCandidates((Array.isArray(staff) ? staff : []).filter((user) => String(user.role).toLowerCase() !== 'student'));
        setColleges(Array.isArray(collegeRows) ? collegeRows : []);
        setDepartments(Array.isArray(departmentRows) ? departmentRows : []);
      })
      .catch((error) => toast.error(error.message || t('Unable to load role assignment data.')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!role || (role === 'college_dean' && !collegeId) || (role === 'dept_head' && (!collegeId || !departmentId))) {
      setOccupant(null);
      return undefined;
    }
    let active = true;
    adminApi.getManagementRoleOccupant({
      role,
      college_id: role === 'college_dean' ? collegeId : undefined,
      department_id: role === 'dept_head' ? departmentId : undefined,
    })
      .then((current) => { if (active) { setOccupant(current); setUserId(''); } })
      .catch((error) => toast.error(error.message || t('Unable to check the current occupant.')));
    return () => { active = false; };
  }, [collegeId, departmentId, role]);

  const scopedCandidates = useMemo(() => {
    let eligible = candidates.filter((user) => CANDIDATE_ROLES.includes(String(user.role).toLowerCase()));
    if (role === 'college_dean') {
      eligible = eligible.filter((user) => ['instructor', 'dept_head'].includes(String(user.role).toLowerCase()));
    } else if (role === 'dept_head') {
      eligible = eligible.filter((user) => String(user.role).toLowerCase() === 'instructor');
    }
    if (collegeId) {
      eligible = eligible.filter((user) => String(user.college_id) === String(collegeId));
    }
    if (departmentId) {
      eligible = eligible.filter((user) => String(user.department_id) === String(departmentId));
    }

    return eligible;
  }, [candidates, collegeId, departmentId, role]);

  const filteredDepartments = useMemo(
    () => departments.filter((department) => String(department.college_id) === String(collegeId)),
    [collegeId, departments],
  );

  const selectedUser = useMemo(
    () => candidates.find((user) => String(user.id) === String(userId)) || null,
    [candidates, userId],
  );
  const scopeReady = Boolean(
    role
    && (role !== 'college_dean' || collegeId)
    && (role !== 'dept_head' || (collegeId && departmentId)),
  );
  const canAssign = scopeReady
    && Boolean(userId)
    && !occupant
    && scopedCandidates.some((user) => String(user.id) === String(userId));

  const resetForm = () => {
    setRole('');
    setCollegeId('');
    setDepartmentId('');
    setUserId('');
    setOccupant(null);
  };

  const assignRole = async (event) => {
    event.preventDefault();
    if (!role || !userId) return toast.error(t('Select a role and eligible instructor.'));
    if (role === 'college_dean' && !collegeId) return toast.error(t('Select a college before choosing an instructor.'));
    if (role === 'dept_head' && !collegeId) return toast.error(t('Select a college before choosing a department.'));
    if (role === 'dept_head' && !departmentId) return toast.error(t('Select a department before choosing an instructor.'));
    if (occupant) return toast.error(t('Remove the current occupant before assigning this role.'));
    if (!scopedCandidates.some((user) => String(user.id) === String(userId))) return toast.error(t('The selected instructor is not eligible for this scope.'));
    setSaving(true);
    try {
      await adminApi.assignManagementRole(userId, role, {
        college_id: ['college_dean', 'dept_head'].includes(role) ? Number(collegeId) : null,
        department_id: role === 'dept_head' ? Number(departmentId) : null,
      });
      toast.success(t('Role assigned successfully.'));
      onRoleAssigned?.(Number(userId), role);
      if (selectedUser) {
        setOccupant(selectedUser);
        setCandidates((current) => current.map((user) => (
          user.id === selectedUser.id ? { ...user, role } : user
        )));
      }
      setUserId('');
    } catch (error) {
      toast.error(error.message || t('Unable to assign role.'));
    } finally {
      setSaving(false);
    }
  };

  const removeOccupant = async () => {
    if (!occupant) return;
    setRemoving(true);
    try {
      await adminApi.resetManagementRole(occupant.id);
      setOccupant(null);
      setCandidates((current) => current.map((user) => (user.id === occupant.id ? { ...user, role: 'instructor' } : user)));
      toast.success(t('Current role occupant removed.'));
    } catch (error) {
      toast.error(error.message || t('Unable to remove the current occupant.'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="min-h-full bg-[#edf4fb] px-4 py-5 sm:px-6" aria-labelledby="manage-roles-title">
      <div className="mx-auto max-w-4xl">
        <header className="mb-5 flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
            <UserRound size={23} />
          </div>
          <div>
            <h2 id="manage-roles-title" className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{t('Manage Roles')}</h2>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">{t('Assign institutional roles to academic staff only.')}</p>
          </div>
        </header>

        <form onSubmit={assignRole} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="role-card-title">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><ShieldCheck size={20} /></div>
              <div>
                <h3 id="role-card-title" className="font-semibold text-slate-800">{t('Role')}</h3>
                <p className="text-sm text-slate-500">{t('Select the role you want to assign.')}</p>
              </div>
            </div>

            <label htmlFor="management-role" className="sr-only">{t('Select role')}</label>
            <div className="relative">
              <select
                id="management-role"
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  setCollegeId('');
                  setDepartmentId('');
                  setUserId('');
                  setOccupant(null);
                }}
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              >
                <option value="">{t('Select Role')}</option>
                {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{t(option.label)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            <div className="mt-3">
              <label htmlFor="management-college" className="mb-1 block text-sm font-medium text-slate-700">{t('College')}</label>
              <div className="relative">
                <select
                  id="management-college"
                  value={collegeId}
                  onChange={(event) => {
                    setCollegeId(event.target.value);
                    setDepartmentId('');
                    setUserId('');
                  }}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  required={role === 'college_dean' || role === 'dept_head'}
                  disabled={loading || !role}
                >
                  <option value="">{t('Select College')}{['college_dean', 'dept_head'].includes(role) ? '' : ` (${t('optional')})`}</option>
                  {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="management-department" className="mb-1 block text-sm font-medium text-slate-700">{t('Department')}</label>
              <div className="relative">
                <select
                  id="management-department"
                  value={departmentId}
                  onChange={(event) => {
                    setDepartmentId(event.target.value);
                    setUserId('');
                  }}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  required={role === 'dept_head'}
                  disabled={loading || !role || !collegeId}
                >
                  <option value="">{t('Select Department')}{role === 'dept_head' ? '' : ` (${t('optional')})`}</option>
                  {filteredDepartments.map((department) => (
                    <option key={department.id} value={department.id}>{department.department_name || department.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="mt-3">
              <span id="management-candidate-label" className="mb-1 block text-sm font-medium text-slate-700">{t('Candidate')}</span>
              <CandidateProfileDropdown
                candidates={scopedCandidates}
                selected={selectedUser}
                onChange={setUserId}
                disabled={loading || !scopeReady || Boolean(occupant)}
                loading={loading}
              />
            </div>

            {occupant && (
              <div role="alert" className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <span>{t('Current')} {t(ROLE_OPTIONS.find((option) => option.value === role)?.label)}: <strong>{occupant.full_name}</strong></span>
                <button type="button" onClick={removeOccupant} disabled={removing} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs font-semibold disabled:opacity-50">
                  <UserMinus size={14} />{removing ? t('Removing...') : t('Remove')}
                </button>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button type="submit" disabled={loading || saving || !canAssign} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                <UserRound size={16} />{saving ? t('Assigning...') : t('Assign Role')}
              </button>
              <button type="button" onClick={resetForm} className="inline-flex min-h-11 min-w-28 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <RotateCcw size={16} />{t('Reset')}
              </button>
            </div>

            <div className="mt-5 flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-slate-700">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
              <div>
                <p className="font-semibold text-slate-800">{t('Institutional roles can only be assigned to eligible academic staff.')}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{t('Only verified active staff members are allowed to receive institutional roles.')}</p>
              </div>
            </div>
        </form>
      </div>
    </section>
  );
};

export default ManageRoles;
