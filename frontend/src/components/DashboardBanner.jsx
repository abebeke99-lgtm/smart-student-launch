import campusPhoto from '../assets/campus.jpg';

const roleTitles = {
  systemadmin: 'SYSTEM ADMINISTRATOR',
  depthead: 'DEPARTMENT HEAD',
  dept_head: 'DEPARTMENT HEAD',
  college_dean: 'COLLEGE DEAN',
  dean: 'COLLEGE DEAN',
  academic_directorate: 'ACADEMIC DIRECTORATE',
  academic_director: 'ACADEMIC DIRECTORATE',
  directorate: 'ACADEMIC DIRECTORATE',
  student: 'STUDENT',
};

const pageTitles = {
  overview: 'System Overview',
  evaluate: 'Evaluation Workspace',
  'peer-evaluation': 'Peer Evaluation',
  reports: 'Reports and Certificates',
  'my-performance': 'My Performance',
};

const DashboardBanner = ({ role = 'systemadmin', pageKey = 'overview' }) => (
  <section className="mb-6 flex h-36 max-h-36 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md" aria-label="Dashboard overview">
    <div className="flex min-w-0 flex-1 flex-col justify-center px-6 py-4 sm:px-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">{roleTitles[role] || 'IEPS DASHBOARD'}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{pageTitles[pageKey] || 'Dashboard'}</h1>
      <p className="mt-2 text-sm text-slate-500">Mekdela Amba University evaluation, performance, and reporting workspace.</p>
    </div>
    <div className="hidden w-1/3 max-w-[280px] overflow-hidden bg-gradient-to-r from-white via-blue-50/40 to-transparent sm:block">
      <img src={campusPhoto} alt="" className="h-full w-full object-cover opacity-90 mix-blend-multiply" />
    </div>
  </section>
);

export default DashboardBanner;
