import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { evaluationApi } from '../services/api';
import {
  createOfficialLetterMetadata,
  OfficialLetterEndorsements,
  OfficialLetterHeader,
  OfficialLetterMetadataFields,
  OfficialLetterReference,
} from './OfficialLetterMetadata';

const formatAcademicYear = (value) => String(value || '').split(',').map((year) => {
  const trimmed = year.trim();
  return /^\d{4}$/.test(trimmed) ? `${trimmed} E.C.` : trimmed;
}).filter(Boolean).join(', ');

const formatSemester = (value) => String(value || '').split(',').map((semester) => {
  const trimmed = semester.trim();
  if (!trimmed) return '';
  return /^semester\b/i.test(trimmed) ? trimmed : `Semester ${trimmed}`;
}).filter(Boolean).join(', ');

const isDepartmentCertificateRole = (role) => (
  ['instructor', 'lab_assistant', 'ara'].includes(
    String(role || '').trim().toLowerCase().replace(/[-\s]+/g, '_'),
  )
);

const getRemarks = (score) => {
  if (score > 90) {
    return [
      'The evaluation results show that you have exceptionally fulfilled your responsibilities with outstanding dedication.',
      'We strongly believe you will maintain and even elevate your excellent performance in the coming semester.',
    ];
  }
  if (score >= 75) {
    return [
      'The evaluation results show that you have effectively fulfilled your responsibilities.',
      'We believe you will maintain and improve your performance in the coming semester.',
    ];
  }
  return [
    'The evaluation results indicate that while efforts were made, there are key areas that require closer attention.',
    'We encourage you to refocus your efforts and significantly improve your performance in the coming semester.',
  ];
};

const ResultBreakdown = ({ certificate, hasStudentEvaluation, studentEvaluationsPending }) => {
  const score = (value) => Number(value || 0).toFixed(2).replace(/\.?0+$/, '');
  const rows = hasStudentEvaluation
    ? [
      [studentEvaluationsPending ? 'Evaluation by students (pending)' : 'Evaluation by students', 50, Number(certificate.studentAverage) * 0.5],
      ['Evaluation by colleagues', 20, Number(certificate.peerAverage) * 0.2],
      ['Evaluation by department head/supervisor', 30, Number(certificate.deptHeadScore) * 0.3],
    ]
    : [
      ['Evaluation by colleagues', 40, Number(certificate.peerAverage) * 0.4],
      ['Evaluation by department head/supervisor', 60, Number(certificate.deptHeadScore) * 0.6],
    ];

  return (
    <table className="mt-5 w-full border-collapse border border-black">
      <thead>
        <tr>
          <th className="border border-black p-2">S/No</th>
          <th className="border border-black p-2">Evaluation type</th>
          <th className="border border-black p-2">Value (%)</th>
          <th className="border border-black p-2">Result (Score)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, weight, value], index) => (
          <tr key={label}>
            <td className="border border-black p-2 text-center">{index + 1}</td>
            <td className="border border-black p-2">{label}</td>
            <td className="border border-black p-2 text-center">{weight}%</td>
            <td className="border border-black p-2 text-center">{score(value)}</td>
          </tr>
        ))}
        <tr>
          <td className="border border-black p-2 text-right font-bold" colSpan="3">Total Score</td>
          <td className="border border-black p-2 text-center font-bold">{score(certificate.totalScore)}</td>
        </tr>
      </tbody>
    </table>
  );
};

const DepartmentHeadBreakdown = ({ certificate, hasStudentEvaluation }) => {
  const score = (value) => Number(value || 0).toFixed(2).replace(/\.?0+$/, '');
  const columns = hasStudentEvaluation
    ? [
      ['Colleagues', 20, Number(certificate.peerAverage) * 0.2],
      ['Supervisor', 30, Number(certificate.deptHeadScore) * 0.3],
      ['From', 50, Number(certificate.studentAverage) * 0.5],
    ]
    : [
      ['Colleagues', 40, Number(certificate.peerAverage) * 0.4],
      ['Supervisor', 60, Number(certificate.deptHeadScore) * 0.6],
    ];

  return (
    <table className="mt-5 w-full border-collapse border border-black text-center">
      <thead>
        <tr>
          <th className="border border-black p-2" rowSpan="2">No</th>
          <th className="border border-black p-2" rowSpan="2">Name</th>
          <th className="border border-black p-2" colSpan={columns.length + 1}>{certificate.semester || 'Semester'} Efficiency evaluation result</th>
        </tr>
        <tr>
          {columns.map(([label, weight]) => <th key={label} className="border border-black p-2">{label} ({weight}%)</th>)}
          <th className="border border-black p-2">Total (100%)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-black p-2">1</td>
          <td className="border border-black p-2">{certificate.instructorName}</td>
          {columns.map(([label, , value]) => <td key={label} className="border border-black p-2">{score(value)}</td>)}
          <td className="border border-black p-2 font-bold">{score(certificate.totalScore)}</td>
        </tr>
      </tbody>
    </table>
  );
};

const ResultCertificateActions = ({ title = 'Final Result Certificates', audience = 'department' }) => {
  const [results, setResults] = useState([]);
  const [certificate, setCertificate] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [error, setError] = useState('');
  const isDepartmentHeadLetter = audience === 'college';
  const hasStudentEvaluation = certificate
    ? Boolean(
      certificate.is_teaching ??
      certificate.isTeaching ??
      certificate.hasTeachingLoad ??
      certificate.hasStudentEvaluation,
    )
    : false;
  const studentDispatchCount = Number(certificate?.studentDispatchCount || 0);
  const studentSubmissionCount = Number(certificate?.studentSubmissionCount || 0);
  const studentEvaluationsPending = studentDispatchCount > studentSubmissionCount;
  const studentProgressUnknown = studentDispatchCount === 0 && hasStudentEvaluation;

  useEffect(() => {
    evaluationApi.getFinalResults(audience === 'college' ? { audience: 'department_head' } : undefined)
      .then((data) => setResults(data?.results || []))
      .catch((loadError) => setError(loadError?.message || 'Unable to load final results.'));
  }, [audience]);

  useEffect(() => {
    if (!certificate) return undefined;
    document.body.classList.add('print-result-letter');
    return () => document.body.classList.remove('print-result-letter');
  }, [certificate]);

  const openCertificate = async (result) => {
    try {
      const data = await evaluationApi.getFinalResultCertificate(
        result.instructorId,
        audience === 'college' ? { audience: 'department_head' } : undefined,
      );
      const nextCertificate = data?.certificate || null;
      setCertificate(nextCertificate);
      if (nextCertificate) {
        const departmentCode = String(nextCertificate.departmentName || 'DEPT').replace(/\s+/g, '').slice(0, 8).toUpperCase();
        setMetadata(createOfficialLetterMetadata({
          referencePrefix: `MAU/${departmentCode}`,
          referenceId: nextCertificate.resultId,
          year: formatAcademicYear(nextCertificate.academicYear),
          semester: formatSemester(nextCertificate.semester),
        }));
      }
    } catch (loadError) {
      setError(loadError?.message || 'Unable to load result certificate.');
    }
  };

  const year = metadata?.year || String(new Date().getFullYear());
  const semester = metadata?.semester || 'the current semester';
  const refNo = metadata?.referenceNumber || `MAU/DEPT/${certificate?.resultId || 'N/A'}/${new Date().getFullYear()}`;
  const date = metadata?.date || new Date().toISOString().slice(0, 10);
  const isComputingCollege = /computing\s+and\s+informatics/i.test(certificate?.collegeName || '');
  const isInformationTechnology = /information\s+technology/i.test(certificate?.departmentName || '');
  const remarks = getRemarks(Number(certificate?.totalScore || 0));
  const printLetter = certificate && metadata && (
    <div className="result-letter fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 print:static print:overflow-visible print:bg-white print:p-0">
      <article className="result-letter__page mx-auto min-h-[297mm] max-w-[210mm] bg-white p-6 text-[13px] leading-relaxed text-black shadow-2xl sm:p-10 print:min-h-0 print:max-h-none print:max-w-none print:overflow-visible print:p-4 print:shadow-none">
        <OfficialLetterHeader
          office={isDepartmentHeadLetter ? 'College of Natural and Computational Sciences' : (certificate.departmentName || 'Department')}
          college={certificate.collegeName || 'College of Natural and Computational Sciences'}
          amharicOffice={isDepartmentHeadLetter
            ? 'የኮሌጅ ዲን ጽሕፈት ቤት'
            : isInformationTechnology
              ? 'የኢንፎርማሽን ቴክኖሎጂ ትምህርት ክፍል'
              : 'የትምህርት ክፍል'}
          amharicCollege={isComputingCollege ? 'የኮምፒውቲንግና ኢንፎርማቲክስ ኮሌጅ' : 'ኮሌጅ'}
        />
        <OfficialLetterMetadataFields value={metadata} onChange={setMetadata} />
        <OfficialLetterReference metadata={{ ...metadata, referenceNumber: refNo, date }} />
        <p className="mt-5 font-bold">To: {certificate.instructorName}</p>
        {!isDepartmentHeadLetter && <p className="mt-1 font-semibold">{certificate.departmentName || 'Department'}</p>}
        <h3 className="mt-4 text-base font-bold underline">
          Subject: {isDepartmentHeadLetter
            ? `Notifying Department Heads ${year} ${semester} Efficiency Result`
            : `To notify ${year} ${semester} efficiency evaluation result`}
        </h3>
        <p className="mt-2" lang="am">ጉዳዩ፡ የ{year} {semester} የውጤታማነት ምዘና ውጤት</p>
        <p className="mt-3">Dear Sir/Madam,</p>
        {isDepartmentHeadLetter ? (
          <>
            <p className="mt-2">
              As mentioned in the subject above, colleagues and the College Dean have evaluated the performance of Department Heads.
              Accordingly, {certificate.collegeName || 'the college'} would like to inform {certificate.instructorName} of the {year} {semester} efficiency evaluation result, as follows.
            </p>
            {!hasStudentEvaluation && (
              <p className="mt-2">
                <strong>Note:</strong> Student evaluation was not included in this efficiency evaluation because
                {certificate.hasTeachingLoad ? ' no student evaluation scores were available for the selected semester.' : ' no courses were taught during the selected semester.'}
              </p>
            )}
          </>
        ) : (
          <p className="mt-2">
            As mentioned in the subject above, {certificate.departmentName || 'the department'} would like to inform you of your {year} academic year, {semester} efficiency evaluation result.
            Based on evaluations by {hasStudentEvaluation ? 'students, colleagues, and the immediate supervisor' : 'colleagues and the immediate supervisor'}, your overall performance score is {Number(certificate.totalScore || 0).toFixed(2).replace(/\.?0+$/, '')}%.
            {' '}The summary of the overall evaluations is given in the table below.
          </p>
        )}
        {studentEvaluationsPending && (
          <p className="mt-2 text-xs">
            <strong>Note:</strong> Student evaluations are still pending ({studentSubmissionCount} of {studentDispatchCount} submitted).
            The published result reflects the currently included evaluation categories.
          </p>
        )}
        {studentProgressUnknown && (
          <p className="mt-2 text-xs">
            <strong>Note:</strong> Student evaluation is included in the published result; individual dispatch completion data is unavailable.
          </p>
        )}
        {isDepartmentHeadLetter
          ? <DepartmentHeadBreakdown certificate={certificate} hasStudentEvaluation={hasStudentEvaluation} />
          : <ResultBreakdown certificate={certificate} hasStudentEvaluation={hasStudentEvaluation} studentEvaluationsPending={studentEvaluationsPending} />}
        <div className="mt-4">
          <p className="font-bold">Remarks / አስተያየት</p>
          {remarks.map((remark) => <p key={remark} className="mt-1">➢ {remark}</p>)}
        </div>

        <OfficialLetterEndorsements
          signerTitle={isDepartmentHeadLetter ? 'College Dean' : 'Department Head'}
          organization="Mekdela Amba University"
          showSignerDetails={false}
          ccRecipients={[
            'Human Resource Directorate',
            'Educational Quality Improvement Directorate',
            certificate.departmentName || 'Department',
            certificate.collegeName || 'College',
          ]}
        />

        <div className="mt-5 flex justify-end gap-3 print:hidden">
          <button type="button" onClick={() => { setCertificate(null); setMetadata(null); }} className="rounded-lg border px-4 py-2 text-sm font-semibold">Close</button>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
            <Printer className="h-4 w-4" /> Print Official Letter
          </button>
        </div>
      </article>
    </div>
  );
  const visibleResults = audience === 'college'
    ? results
    : results.filter((result) => isDepartmentCertificateRole(result.role));

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">Export official result letters within your role-based scope.</p>
          </div>
          <Download className="h-5 w-5 text-blue-700" />
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
              <tr><th className="px-3 py-3">Name</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Department</th><th className="px-3 py-3">Final Score</th><th className="px-3 py-3">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleResults.map((result) => (
                <tr key={result.resultId}>
                  <td className="px-3 py-3 font-medium">{result.instructorName}</td>
                  <td className="px-3 py-3 capitalize">{String(result.role).replaceAll('_', ' ')}</td>
                  <td className="px-3 py-3">{result.departmentName || '-'}</td>
                  <td className="px-3 py-3 font-semibold">{Number(result.totalScore || 0).toFixed(2)}</td>
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => void openCertificate(result)} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white">
                      <Printer className="h-4 w-4" /> Export / Print
                    </button>
                  </td>
                </tr>
              ))}
              {!results.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No finalized results are available.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {printLetter}
    </>
  );
};

export default ResultCertificateActions;
