import mauLogo from '../assets/mau.jpg';

const toLocalDateInputValue = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const createOfficialLetterMetadata = ({ referencePrefix, referenceId, year = '', semester = '' }) => ({
  referenceNumber: `${referencePrefix}/${referenceId || 'N/A'}/${new Date().getFullYear()}`,
  date: toLocalDateInputValue(),
  semester: String(semester || ''),
  year: String(year || ''),
});

export const formatOfficialLetterDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return String(value || '');
};

export const OfficialLetterMetadataFields = ({ value, onChange, className = '' }) => {
  const updateField = (field) => (event) => onChange((current) => ({ ...current, [field]: event.target.value }));
  const fieldClassName = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900';

  return (
    <section className={`print:hidden ml-auto mb-2 grid w-full max-w-[170mm] gap-2 rounded-lg border border-blue-100 bg-blue-50 p-2 sm:grid-cols-2 lg:grid-cols-4 ${className}`} aria-label="Official letter details">
      <label className="text-xs font-semibold text-slate-700">
        Ref. No.
        <input type="text" value={value.referenceNumber} onChange={updateField('referenceNumber')} className={fieldClassName} />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Date
        <input type="date" value={value.date} onChange={updateField('date')} className={fieldClassName} />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Semester
        <input type="text" value={value.semester} onChange={updateField('semester')} className={fieldClassName} />
      </label>
      <label className="text-xs font-semibold text-slate-700">
        Year
        <input type="text" value={value.year} onChange={updateField('year')} className={fieldClassName} />
      </label>
    </section>
  );
};

export const OfficialLetterHeader = ({ office, college, amharicOffice, amharicCollege }) => (
  <header className="border-b-4 border-double border-black pb-2">
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      <div className="text-left text-[10px] leading-tight">
        <p className="font-semibold">Mekdela Amba University</p>
        {college ? <p>{college}</p> : null}
        <p>{office}</p>
        <p>Gimba, Ethiopia</p>
      </div>
      <img src={mauLogo} alt="Mekdela Amba University logo" className="h-16 w-16 object-contain" />
      <div className="text-right text-[10px] font-semibold leading-tight" lang="am">
        <p>መቅደላ አምባ ዩኒቨርሲቲ</p>
        {amharicCollege ? <p>{amharicCollege}</p> : null}
        {amharicOffice ? <p>{amharicOffice}</p> : null}
        <p>ጊምባ፣ ኢትዮጵያ</p>
      </div>
    </div>
  </header>
);

export const OfficialLetterReference = ({ metadata }) => (
  <div className="mt-1 flex flex-col items-end gap-1 text-sm">
    <span><span lang="am">ቁጥር</span>/Ref. No: {metadata.referenceNumber || '—'}</span>
    <span><span lang="am">ቀን</span>/Date: {formatOfficialLetterDate(metadata.date) || '—'}</span>
  </div>
);

export const OfficialLetterEndorsements = ({ signerTitle, organization, ccRecipients, showSignerDetails = true }) => (
  <section className="mt-5 grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_auto]">
    <div className="text-sm">
      <p className="font-bold underline">CC:</p>
      <ul className="mt-1 list-inside list-disc">
        {ccRecipients.map((recipient) => <li key={recipient}>{recipient}</li>)}
      </ul>
    </div>
    <div className="flex min-h-28 items-end justify-end gap-5">
      <div className="h-20 w-20 shrink-0" aria-hidden="true" />
      {showSignerDetails ? (
        <div className="min-w-36 text-right text-sm">
          <p className="font-semibold">With Regards,</p>
          <div className="mt-5 h-8 border-b border-black" />
          <p className="mt-1 font-semibold">Authorized Signature</p>
          <p>{signerTitle}</p>
          <p className="text-xs">{organization}</p>
        </div>
      ) : <div className="min-w-36" aria-label="Signature area" />}
    </div>
  </section>
);
