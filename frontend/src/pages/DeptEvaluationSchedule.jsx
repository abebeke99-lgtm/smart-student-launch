import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Filter,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { adminData } from "../data/adminOptions";
import { deptHeadApi } from "../services/api";
import { useConfirmation } from "../components/ConfirmationDialog";

const DEFAULT_ACADEMIC_YEAR = "2025/2026";

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};

const hasInvalidDateRange = (startAt, endAt) => {
  if (!startAt || !endAt) return false;
  const startTime = new Date(startAt).getTime();
  const endTime = new Date(endAt).getTime();
  return (
    !Number.isFinite(startTime) ||
    !Number.isFinite(endTime) ||
    startTime >= endTime
  );
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getScheduleStatus = (schedule) => {
  if (!schedule?.startAt || !schedule?.endAt) return "Not configured";
  const now = Date.now();
  const start = new Date(schedule.startAt).getTime();
  const end = new Date(schedule.endAt).getTime();
  if (now < start) return "Upcoming";
  if (now <= end) return "Active";
  return "Expired";
};

const statusStyles = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  Upcoming: "bg-blue-50 text-blue-700 ring-blue-100",
  Completed: "bg-purple-50 text-purple-700 ring-purple-100",
  Expired: "bg-amber-50 text-amber-700 ring-amber-100",
  "Not configured": "bg-slate-100 text-slate-600 ring-slate-200",
};

const DeptEvaluationSchedule = () => {
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [departmentName, setDepartmentName] = useState("");
  const [schedule, setSchedule] = useState({ startAt: "", endAt: "" });
  const [scheduleAcademicYear, setScheduleAcademicYear] = useState("");
  const [draftSchedule, setDraftSchedule] = useState({ startAt: "", endAt: "" });
  const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");

  const hasSchedule = Boolean(schedule.startAt && schedule.endAt);
  const scheduleStatus = getScheduleStatus(schedule);
  const yearOptions = useMemo(
    () =>
      [...new Set([
        academicYear,
        ...adminData.academicYears.map(({ name }) => name),
      ])].filter(Boolean).sort((first, second) => second.localeCompare(first)),
    [academicYear],
  );

  const loadSchedule = async () => {
    setLoading(true);
    try {
      const result = await deptHeadApi.getEvaluationSchedule();
      setDepartmentName(result?.departmentName || "");
      setSchedule({
        startAt: toDateTimeLocalValue(result?.startAt),
        endAt: toDateTimeLocalValue(result?.endAt),
      });
      const savedAcademicYear = result?.academicYear || DEFAULT_ACADEMIC_YEAR;
      setScheduleAcademicYear(savedAcademicYear);
      setAcademicYear(savedAcademicYear);
    } catch (error) {
      toast.error(error?.message || "Unable to load the evaluation schedule.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchedule();
  }, []);

  const scheduleRows = useMemo(() => {
    if (!hasSchedule) return [];
    const searchableText = [
      departmentName,
      scheduleAcademicYear,
      schedule.startAt,
      schedule.endAt,
      scheduleStatus,
    ].join(" ").toLowerCase();
    if (!searchableText.includes(searchQuery.trim().toLowerCase())) return [];
    if (statusFilter !== "All Status" && statusFilter !== scheduleStatus) return [];
    return [{ id: "department-schedule", ...schedule, status: scheduleStatus }];
  }, [departmentName, hasSchedule, schedule, scheduleAcademicYear, scheduleStatus, searchQuery, statusFilter]);

  const metrics = [
    {
      label: "Total Schedules",
      value: hasSchedule ? 1 : 0,
      note: "Configured for this department",
      icon: CalendarDays,
      theme: "blue",
    },
    {
      label: "Upcoming Schedules",
      value: hasSchedule && scheduleStatus === "Upcoming" ? 1 : 0,
      note: "Not started yet",
      icon: Clock3,
      theme: "emerald",
    },
    {
      label: "Completed Schedules",
      value: 0,
      note: "Completion history is not tracked",
      icon: CheckCircle2,
      theme: "purple",
    },
    {
      label: "Expired Schedules",
      value: hasSchedule && scheduleStatus === "Expired" ? 1 : 0,
      note: "Needs renewal",
      icon: AlertCircle,
      theme: "amber",
    },
  ];
  const metricThemes = {
    blue: {
      card: "border-blue-100 from-blue-50/80 to-white",
      icon: "bg-blue-600",
      label: "text-blue-700",
    },
    emerald: {
      card: "border-emerald-100 from-emerald-50/80 to-white",
      icon: "bg-emerald-500",
      label: "text-emerald-700",
    },
    purple: {
      card: "border-purple-100 from-purple-50/80 to-white",
      icon: "bg-purple-600",
      label: "text-purple-700",
    },
    amber: {
      card: "border-amber-100 from-amber-50/80 to-white",
      icon: "bg-amber-500",
      label: "text-amber-700",
    },
  };

  const openCreateModal = () => {
    setDraftSchedule(hasSchedule ? { ...schedule } : { startAt: "", endAt: "" });
    setIsScheduleModalOpen(true);
  };

  const openEditModal = () => {
    setDraftSchedule({ ...schedule });
    setIsScheduleModalOpen(true);
  };

  const saveSchedule = async (event) => {
    event.preventDefault();
    if (!draftSchedule.startAt || !draftSchedule.endAt) {
      toast.error("Enter both a start and expiry date/time.");
      return;
    }
    if (hasInvalidDateRange(draftSchedule.startAt, draftSchedule.endAt)) {
      toast.error("Expiry must be later than the start.");
      return;
    }

    setSaving(true);
    try {
      const result = await deptHeadApi.setEvaluationSchedule({
        startAt: new Date(draftSchedule.startAt).toISOString(),
        endAt: new Date(draftSchedule.endAt).toISOString(),
        academicYear,
      });
      setSchedule({
        startAt: toDateTimeLocalValue(result?.startAt || draftSchedule.startAt),
        endAt: toDateTimeLocalValue(result?.endAt || draftSchedule.endAt),
      });
      setScheduleAcademicYear(academicYear);
      setIsScheduleModalOpen(false);
      toast.success("Department evaluation schedule saved.");
      await loadSchedule();
    } catch (error) {
      toast.error(error?.message || "Unable to save the evaluation schedule.");
    } finally {
      setSaving(false);
    }
  };

  const clearSchedule = async () => {
    if (!hasSchedule) return;
    if (!await requestConfirmation({
      title: 'Delete Evaluation Schedule',
      description: "Are you sure you want to delete this department's evaluation schedule?",
      confirmLabel: 'Delete Schedule',
      variant: 'danger',
    })) return;

    setClearing(true);
    try {
      await deptHeadApi.clearEvaluationSchedule();
      setSchedule({ startAt: "", endAt: "" });
      setScheduleAcademicYear("");
      setDraftSchedule({ startAt: "", endAt: "" });
      setIsScheduleModalOpen(false);
      setIsDetailsModalOpen(false);
      toast.success("Department evaluation schedule deleted.");
    } catch (error) {
      toast.error(error?.message || "Unable to delete the evaluation schedule.");
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
    <section className="min-h-full space-y-4 bg-slate-50 p-4 sm:p-6">
      <Link
        to="/dept-head/dashboard"
        className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 transition hover:text-blue-900"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Department Head Dashboard
      </Link>

      <header className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-sky-100 via-blue-50 to-cyan-50 px-5 py-5 shadow-sm sm:px-7">
        <div className="pointer-events-none absolute -right-12 -top-24 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <CalendarClock size={21} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-700">
                Department settings
              </p>
              <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Evaluation Schedule
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Manage evaluation periods for{" "}
                <span className="font-semibold text-slate-800">
                  {departmentName || "your department"}
                </span>
                .
              </p>
            </div>
          </div>
          <label className="relative z-10 inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-white/80 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            <CalendarDays size={16} className="text-blue-700" aria-hidden="true" />
            <span>Academic Year</span>
            <select
              aria-label="Academic year"
              value={academicYear}
              onChange={(event) => setAcademicYear(event.target.value)}
              className="max-w-28 cursor-pointer appearance-none bg-transparent pr-4 font-bold text-slate-800 outline-none"
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-2 text-slate-400"
              aria-hidden="true"
            />
          </label>
        </div>
      </header>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-900">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
        <p>
          Evaluation schedules apply only to{" "}
          <span className="font-bold">{departmentName || "your department"}</span>
          {" "}and do not affect other departments. The selected academic year is saved when you create or renew the schedule.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, note, icon: Icon, theme }) => {
          const colors = metricThemes[theme];
          return (
            <article
              key={label}
              className={`flex min-h-24 items-center gap-3 rounded-2xl border bg-gradient-to-br p-4 shadow-sm ${colors.card}`}
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${colors.icon}`}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className={`truncate text-xs font-semibold ${colors.label}`}>{label}</h2>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
                <p className="truncate text-[10px] text-slate-500">{note}</p>
              </div>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow-sm" aria-hidden="true">
                <ArrowRight size={14} />
              </span>
            </article>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CalendarDays size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">Schedule List</h2>
              <p className="text-xs text-slate-500">Manage your department evaluation period.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative sm:w-60">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <span className="sr-only">Search schedules</span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search date, department, status..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="relative">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-blue-600" aria-hidden="true" />
              <span className="sr-only">Filter schedule status</span>
              <select
                aria-label="Filter schedule status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 sm:w-36"
              >
                <option>All Status</option>
                <option>Active</option>
                <option>Upcoming</option>
                <option>Completed</option>
                <option>Expired</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            </label>
            <button
              type="button"
              onClick={openCreateModal}
              disabled={loading || saving || clearing}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={15} aria-hidden="true" />
              Create New Schedule
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[840px] w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3">#</th>
                <th className="px-4 py-3">Start Date &amp; Time</th>
                <th className="px-4 py-3">End Date &amp; Time</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scheduleRows.map((row, index) => (
                <tr key={row.id} className="transition hover:bg-blue-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-500">{index + 1}</td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold text-slate-800">
                      <CalendarDays size={14} className="text-blue-600" aria-hidden="true" />
                      {formatDate(row.startAt)}
                    </span>
                    <span className="mt-1 block pl-[22px] text-[10px] text-slate-500">{formatTime(row.startAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 font-semibold text-slate-800">
                      <CalendarDays size={14} className="text-blue-600" aria-hidden="true" />
                      {formatDate(row.endAt)}
                    </span>
                    <span className="mt-1 block pl-[22px] text-[10px] text-slate-500">{formatTime(row.endAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-slate-800">{departmentName || "Department"}</span>
                    <span className="text-[10px] text-slate-500">Department schedule</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">{scheduleAcademicYear || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusStyles[row.status]}`}>
                      <span aria-hidden="true">●</span>{row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsDetailsModalOpen(true)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                        aria-label="View schedule"
                      >
                        <Eye size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={openEditModal}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 transition hover:bg-indigo-100"
                        aria-label="Edit schedule"
                      >
                        <Pencil size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void clearSchedule()}
                        disabled={clearing}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        aria-label="Delete schedule"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!scheduleRows.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <span className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <CalendarClock size={21} aria-hidden="true" />
                    </span>
                    <span className="block text-sm font-semibold text-slate-700">
                      {loading ? "Loading schedule..." : hasSchedule ? "No schedules match your filters" : "No schedule configured"}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {hasSchedule ? "Adjust the search or status filter to see the department schedule." : "Create a schedule to set the evaluation submission period."}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[10px] text-slate-500">
          <span>Showing {scheduleRows.length} of {hasSchedule ? 1 : 0} schedules</span>
          <span>Times shown in your local timezone</span>
        </div>
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-[11px] leading-5 text-slate-600">
        <Clock3 size={15} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
        <p>Schedules can be edited or renewed before the expiry date. After expiry, create or renew a schedule for the next evaluation period.</p>
      </div>

      {(isScheduleModalOpen || isDetailsModalOpen) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving && !clearing) {
              setIsScheduleModalOpen(false);
              setIsDetailsModalOpen(false);
            }
          }}
        >
          {isScheduleModalOpen ? (
            <article className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <CalendarClock size={19} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">Department settings</p>
                    <h2 className="text-lg font-bold text-slate-900">{hasSchedule ? "Edit / Renew Schedule" : "Create New Schedule"}</h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  disabled={saving}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                  aria-label="Close schedule form"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </header>
              <form onSubmit={saveSchedule} className="space-y-5 p-5 sm:p-6">
                <p className="text-xs leading-5 text-slate-600">
                  Set or renew the evaluation submission period for{" "}
                  <span className="font-bold text-slate-800">{departmentName || "your department"}</span>.
                  Times use your local timezone.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs font-semibold text-slate-700 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      Start Date and Time
                    </span>
                    <input
                      type="datetime-local"
                      required
                      disabled={loading || saving || clearing}
                      value={draftSchedule.startAt}
                      onChange={(event) => setDraftSchedule((current) => ({ ...current, startAt: event.target.value }))}
                      className="mt-3 block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </label>
                  <label className="block rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs font-semibold text-slate-700 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-rose-500" />
                      Expiry Date and Time
                    </span>
                    <input
                      type="datetime-local"
                      required
                      disabled={loading || saving || clearing}
                      min={draftSchedule.startAt}
                      value={draftSchedule.endAt}
                      onChange={(event) => setDraftSchedule((current) => ({ ...current, endAt: event.target.value }))}
                      className="mt-3 block w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                  </label>
                </div>
                {hasInvalidDateRange(draftSchedule.startAt, draftSchedule.endAt) && (
                  <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    Expiry must be later than the start.
                  </p>
                )}
                <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-slate-600">
                  <Clock3 size={17} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
                  <p>This schedule controls evaluation submissions in your department and does not change other departments&apos; schedules.</p>
                </div>
                <div className="flex flex-col-reverse justify-end gap-3 border-t border-slate-100 pt-4 sm:flex-row">
                  {hasSchedule && (
                    <button
                      type="button"
                      onClick={() => void clearSchedule()}
                      disabled={loading || saving || clearing}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      {clearing ? "Deleting..." : "Delete schedule"}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={loading || saving || clearing || hasInvalidDateRange(draftSchedule.startAt, draftSchedule.endAt)}
                    className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Saving..." : hasSchedule ? "Save / Renew Schedule" : "Save Schedule"}
                  </button>
                </div>
              </form>
            </article>
          ) : (
            <article className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Eye size={17} aria-hidden="true" /></span>
                  <h2 className="text-base font-bold text-slate-900">Schedule Details</h2>
                </div>
                <button type="button" onClick={() => setIsDetailsModalOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close schedule details">
                  <X size={17} aria-hidden="true" />
                </button>
              </header>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700">{departmentName || "Department"}</span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusStyles[scheduleStatus]}`}><span aria-hidden="true">●</span>{scheduleStatus}</span>
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-semibold uppercase text-slate-500">Start Date and Time</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{formatDate(schedule.startAt)} · {formatTime(schedule.startAt)}</dd></div>
                  <div className="rounded-xl bg-slate-50 p-3"><dt className="text-[10px] font-semibold uppercase text-slate-500">Expiry Date and Time</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{formatDate(schedule.endAt)} · {formatTime(schedule.endAt)}</dd></div>
                </dl>
                <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => { setIsDetailsModalOpen(false); openEditModal(); }} className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Pencil size={13} aria-hidden="true" />Edit / Renew</button>
                  <button type="button" onClick={() => setIsDetailsModalOpen(false)} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800">Close</button>
                </div>
              </div>
            </article>
          )}
        </div>
      )}
    </section>
    {confirmationDialog}
    </>
  );
};

export default DeptEvaluationSchedule;
