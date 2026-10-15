import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Check,
  Clock3,
  Eye,
  Italic,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  MessageSquareText,
  Send,
  Smile,
  Trash2,
  Underline,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../services/api';
import { useConfirmation } from './ConfirmationDialog';

const MAX_MESSAGE_LENGTH = 500;
const AUDIENCES = [
  ['all', 'All users'],
  ['students', 'Students'],
  ['instructors', 'Instructors'],
  ['deptheads', 'Department Heads'],
  ['academicdirectorate', 'Academic Directorate'],
  ['collegedean', 'College Deans'],
  ['labassistants', 'Lab Assistants'],
];

const statusStyle = {
  sent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  scheduled: 'bg-violet-50 text-violet-700 ring-violet-200',
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  failed: 'bg-red-50 text-red-700 ring-red-200',
};

const formatAudience = (value) => AUDIENCES.find(([key]) => key === value)?.[1] || value || 'All users';
const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};
const getBroadcastTitle = (broadcast) => broadcast.title || broadcast.message?.split(/\r?\n/, 1)[0]?.slice(0, 72) || 'Untitled broadcast';

const ToolbarButton = ({ label, onClick, children }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
  >
    {children}
  </button>
);

const BroadcastManager = ({ totalUsers = 0 }) => {
  const { requestConfirmation, confirmationDialog } = useConfirmation();
  const [broadcastAudience, setBroadcastAudience] = useState('all');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [activeTab, setActiveTab] = useState('compose');
  const [broadcastHistory, setBroadcastHistory] = useState([]);
  const [counts, setCounts] = useState({ sent: 0, scheduled: 0, drafts: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState(null);
  const textareaRef = useRef(null);

  const refreshHistory = async () => {
    try {
      const result = await adminApi.getBroadcastHistory();
      const records = Array.isArray(result) ? result : result?.records;
      if (Array.isArray(records)) setBroadcastHistory(records);
      setCounts(result?.counts || { sent: 0, scheduled: 0, drafts: 0 });
      return true;
    } catch (error) {
      toast.error(error.message || 'Unable to refresh broadcast history.');
      return false;
    }
  };

  const openHistory = async () => {
    setActiveTab('history');
    await refreshHistory();
  };

  useEffect(() => {
    let active = true;
    adminApi.getBroadcastHistory()
      .then((result) => {
        if (!active) return;
        const records = Array.isArray(result) ? result : result?.records;
        if (Array.isArray(records)) setBroadcastHistory(records);
        setCounts(result?.counts || { sent: 0, scheduled: 0, drafts: 0 });
      })
      .catch((error) => toast.error(error.message || 'Unable to load broadcast history.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const metrics = useMemo(() => [
    { label: 'Total Users', value: Number(totalUsers || 0).toLocaleString(), description: 'Registered users in the system', icon: Users, tone: 'blue' },
    { label: 'Messages Sent', value: Number(counts.sent || 0).toLocaleString(), description: 'Total broadcast messages sent', icon: Send, tone: 'emerald' },
  ], [counts.sent, totalUsers]);

  const insertAtSelection = (before, after = '') => {
    const input = textareaRef.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = broadcastMessage.slice(start, end);
    const insertion = `${before}${selected || (after ? 'text' : '')}${after}`;
    const nextMessage = `${broadcastMessage.slice(0, start)}${insertion}${broadcastMessage.slice(end)}`.slice(0, MAX_MESSAGE_LENGTH);
    setBroadcastMessage(nextMessage);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = Math.min(start + insertion.length, nextMessage.length);
      input.setSelectionRange(cursor, cursor);
    });
  };

  const insertLink = () => {
    const url = window.prompt('Enter the link URL:');
    if (!url?.trim()) return;
    const input = textareaRef.current;
    const selected = input ? broadcastMessage.slice(input.selectionStart, input.selectionEnd) : '';
    if (selected) {
      insertAtSelection('[', `](${url.trim()})`);
    } else {
      insertAtSelection(`[link text](${url.trim()})`);
    }
  };

  const insertList = (ordered = false) => {
    const input = textareaRef.current;
    const prefix = ordered ? '1. ' : '• ';
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const selected = broadcastMessage.slice(start, end);
    const lines = selected ? selected.split(/\r?\n/).map((line, index) => `${ordered ? `${index + 1}.` : '•'} ${line}`).join('\n') : prefix;
    const nextMessage = `${broadcastMessage.slice(0, start)}${lines}${broadcastMessage.slice(end)}`.slice(0, MAX_MESSAGE_LENGTH);
    setBroadcastMessage(nextMessage);
    requestAnimationFrame(() => {
      input.focus();
      const cursor = Math.min(start + lines.length, nextMessage.length);
      input.setSelectionRange(cursor, cursor);
    });
  };

  const clearComposer = () => {
    setBroadcastAudience('all');
    setBroadcastMessage('');
  };

  const saveBroadcast = async () => {
    const message = broadcastMessage.trim();
    if (!message) {
      toast.error('Enter an announcement before sending.');
      return;
    }
    setSaving(true);
    try {
      const response = await adminApi.sendBroadcast({
        audience: broadcastAudience,
        message,
      });
      const sentBroadcast = {
        ...(response && typeof response === 'object' ? response : {}),
        title: response?.title || message.split(/\r?\n/, 1)[0].slice(0, 72) || 'Untitled broadcast',
        audience: response?.audience || broadcastAudience,
        message: response?.message || message,
        recipient_count: response?.recipient_count || 0,
        status: 'sent',
        created_at: response?.created_at || new Date().toISOString(),
      };
      setBroadcastHistory((current) => [
        sentBroadcast,
        ...current.filter((item) => String(item.id) !== String(sentBroadcast.id)),
      ]);
      setCounts((current) => ({ ...current, sent: current.sent + 1 }));
      toast.success('Broadcast sent successfully.');
      clearComposer();
    } catch (error) {
      toast.error(error.message || 'Unable to save the broadcast.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    void saveBroadcast();
  };

  const deleteBroadcast = async (item) => {
    if (!await requestConfirmation({
      title: 'Delete Broadcast Confirmation',
      description: `Are you sure you want to delete this ${item.status} broadcast?`,
      confirmLabel: 'Delete Broadcast',
      variant: 'danger',
    })) return;
    try {
      await adminApi.deleteBroadcast(item.id);
      toast.success('Broadcast deleted.');
      await refreshHistory();
    } catch (error) {
      toast.error(error.message || 'Unable to delete this broadcast.');
    }
  };

  return (
    <>
    <section className="space-y-4" aria-label="Broadcast manager">
      <div className="grid gap-3 md:grid-cols-2">
        {metrics.map(({ label, value, description, icon: Icon, tone }) => {
          const tones = {
            blue: 'bg-blue-50 text-blue-700',
            emerald: 'bg-emerald-50 text-emerald-700',
            violet: 'bg-violet-50 text-violet-700',
          };
          return (
            <article key={label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tones[tone]}`}><Icon size={21} /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="text-2xl font-bold leading-tight text-slate-900">{value}</p>
                <p className="truncate text-xs text-slate-500">{description}</p>
              </div>
            </article>
          );
        })}
      </div>

      {activeTab === 'compose' ? (
      <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Megaphone size={20} /></span>
            <div>
              <h3 className="font-semibold text-slate-900">Compose Broadcast</h3>
              <p className="text-sm text-slate-500">Create and send a new announcement to your selected audience.</p>
            </div>
          </div>
          <button type="button" onClick={() => void openHistory()} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <Clock3 size={16} />Broadcast History
          </button>
        </div>

        <label className="mb-3 block max-w-xl">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Audience <span className="text-red-500">*</span></span>
          <select value={broadcastAudience} onChange={(event) => setBroadcastAudience(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
            {AUDIENCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <span className="mt-1 block text-xs text-slate-500">Choose who should receive this announcement.</span>
        </label>

        <label htmlFor="broadcast-message" className="mb-1 block text-sm font-semibold text-slate-700">Message <span className="text-red-500">*</span></label>
        <div className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <div role="toolbar" aria-label="Message formatting" className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1">
            <ToolbarButton label="Bold" onClick={() => insertAtSelection('**', '**')}><Bold size={16} /></ToolbarButton>
            <ToolbarButton label="Italic" onClick={() => insertAtSelection('*', '*')}><Italic size={16} /></ToolbarButton>
            <ToolbarButton label="Underline" onClick={() => insertAtSelection('__', '__')}><Underline size={16} /></ToolbarButton>
            <span className="mx-1 h-5 border-l border-slate-300" />
            <ToolbarButton label="Insert link" onClick={insertLink}><Link2 size={16} /></ToolbarButton>
            <ToolbarButton label="Bulleted list" onClick={() => insertList(false)}><List size={16} /></ToolbarButton>
            <ToolbarButton label="Numbered list" onClick={() => insertList(true)}><ListOrdered size={16} /></ToolbarButton>
            <ToolbarButton label="Insert emoji" onClick={() => insertAtSelection('🙂')}><Smile size={16} /></ToolbarButton>
          </div>
          <textarea
            id="broadcast-message"
            ref={textareaRef}
            value={broadcastMessage}
            onChange={(event) => setBroadcastMessage(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            rows={5}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder="Write your announcement here..."
            required
            className="block w-full resize-y border-0 bg-white p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <div className="border-t border-slate-100 px-3 py-1.5 text-right text-xs text-slate-500">{broadcastMessage.length}/{MAX_MESSAGE_LENGTH} characters</div>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
            <Megaphone size={16} />{saving ? 'Sending...' : 'Send Broadcast'}
          </button>
        </div>
      </form>
      ) : (
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="broadcast-history-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><MessageSquareText size={18} /></span>
            <div>
              <h3 id="broadcast-history-title" className="font-semibold text-slate-900">Recent Broadcasts</h3>
              <p className="text-sm text-slate-500">View your latest broadcast messages and their status.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={refreshHistory} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Refresh</button>
            <button type="button" onClick={() => setActiveTab('compose')} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-blue-800">
              <Megaphone size={15} />Compose Broadcast
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Title</th>
                <th className="px-3 py-2.5">Audience</th>
                <th className="px-3 py-2.5">Date &amp; Time</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {broadcastHistory.map((item, index) => (
                <tr key={item.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="px-3 py-3 text-xs text-slate-500">{index + 1}</td>
                  <td className="max-w-xs px-3 py-3">
                    <span className="block truncate font-medium text-slate-800">{getBroadcastTitle(item)}</span>
                    <span className="block truncate text-xs text-slate-500">{item.message}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600"><span className="inline-flex items-center gap-2"><Users size={14} className="text-blue-600" />{formatAudience(item.audience)}</span></td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{formatDate(item.scheduled_at || item.created_at)}</td>
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle[item.status] || statusStyle.draft}`}>
                      {item.status === 'sent' ? <Check size={13} /> : item.status === 'scheduled' ? <Clock3 size={13} /> : item.status === 'failed' ? <X size={13} /> : <MessageSquareText size={13} />}
                      {item.status ? item.status[0].toUpperCase() + item.status.slice(1) : 'Draft'}
                    </span>
                    {item.status === 'failed' && item.failure_reason && <p className="mt-1 max-w-40 text-xs text-red-600">{item.failure_reason}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setViewing(item)} aria-label={`View ${getBroadcastTitle(item)}`} title="View broadcast" className="rounded-md border border-slate-200 p-1.5 text-blue-700 transition hover:bg-blue-50"><Eye size={15} /></button>
                      {item.status !== 'sent' && (
                        <button type="button" onClick={() => void deleteBroadcast(item)} aria-label={`Delete ${getBroadcastTitle(item)}`} title="Delete broadcast" className="rounded-md border border-slate-200 p-1.5 text-slate-600 transition hover:bg-red-50 hover:text-red-700"><Trash2 size={15} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !broadcastHistory.length && <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">No broadcasts recorded yet.</td></tr>}
              {loading && <tr><td colSpan="6" className="px-4 py-10 text-center text-sm text-slate-500">Loading broadcasts...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {viewing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewing(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="broadcast-detail-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="broadcast-detail-title" className="text-lg font-semibold text-slate-900">{getBroadcastTitle(viewing)}</h3>
                <p className="mt-1 text-sm text-slate-500">{formatAudience(viewing.audience)} · {formatDate(viewing.scheduled_at || viewing.created_at)}</p>
              </div>
              <button type="button" onClick={() => setViewing(null)} aria-label="Close broadcast details" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">{viewing.message}</p>
            {viewing.failure_reason && <p className="mt-3 text-sm text-red-700">Delivery error: {viewing.failure_reason}</p>}
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setViewing(null)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">Close</button>
            </div>
          </section>
        </div>
      )}
    </section>
    {confirmationDialog}
    </>
  );
};

export default BroadcastManager;
