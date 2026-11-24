import { useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { ExtensionRequest, UserProfile } from '../shared/types';
import { formatAcademicDate } from '../lib/time';

interface ExtensionsViewProps {
  currentUser: UserProfile;
  extensions: ExtensionRequest[];
  onDecide: (
    id: string,
    payload: { status: 'approved' | 'denied'; lecturerNote: string }
  ) => Promise<void>;
}

export function ExtensionsView({
  currentUser,
  extensions,
  onDecide,
}: ExtensionsViewProps) {
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'decided'>('all');

  const filtered = extensions.filter((ext) => {
    if (filter === 'pending') return ext.status === 'pending';
    if (filter === 'decided') return ext.status !== 'pending';
    return true;
  });

  const handleAction = async (id: string, status: 'approved' | 'denied') => {
    setProcessingId(id);
    try {
      await onDecide(id, {
        status,
        lecturerNote: notesById[id] ?? '',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#14213D] dark:text-white">
            Deadline Extension Petitions
          </h2>
          <p className="mt-1 text-sm text-[#5A6475] dark:text-white/80">
            {currentUser.role === 'lecturer'
              ? 'Approved extensions automatically unlock each student’s personal submission deadline.'
              : 'Track the status of your extension petitions submitted through the portal.'}
          </p>
        </div>

        <div className="inline-flex rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1 dark:border-[#293752] dark:bg-[#0B1120]">
          {(['all', 'pending', 'decided'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize cursor-pointer ${
                filter === tab
                  ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                  : 'text-[#5A6475] dark:text-white/75 dark:hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-12 text-center dark:border-[#293752] dark:bg-[#131C2E]">
          <CalendarClock className="mx-auto h-8 w-8 text-[#5A6475]/60 dark:text-white/75" />
          <p className="mt-3 text-sm font-medium text-[#1E2430] dark:text-white">
            No extension petitions found
          </p>
          <p className="mt-1 text-xs text-[#5A6475] dark:text-white/80">
            {currentUser.role === 'student'
              ? 'You can request an extension directly from any active assignment card.'
              : 'Incoming student extension requests appear here in real time.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E2DDD3] rounded-lg border border-[#E2DDD3] bg-white dark:divide-[#293752] dark:border-[#293752] dark:bg-[#131C2E]">
          {filtered.map((ext) => (
            <div key={ext.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
                    {ext.courseCode} · {ext.studentName}
                    {ext.studentCode ? ` (${ext.studentCode})` : ''}
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-[#14213D] dark:text-white">
                    {ext.assignmentTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                  {ext.status === 'pending' && (
                    <span className="flex items-center gap-1.5 text-[#B4690E] dark:text-amber-300">
                      <Clock className="h-3.5 w-3.5 text-[#B4690E] dark:text-white" />
                      PENDING REVIEW
                    </span>
                  )}
                  {ext.status === 'approved' && (
                    <span className="flex items-center gap-1.5 text-[#1F6E52] dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#1F6E52] dark:text-white" />
                      APPROVED
                    </span>
                  )}
                  {ext.status === 'denied' && (
                    <span className="flex items-center gap-1.5 text-[#8C2D38] dark:text-rose-300">
                      <XCircle className="h-3.5 w-3.5 text-[#8C2D38] dark:text-white" />
                      DECLINED
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 border-y border-[#E2DDD3] py-3 text-xs dark:border-[#293752] sm:grid-cols-2">
                <div>
                  <span className="text-[#5A6475] dark:text-white/75">Original Deadline: </span>
                  <span className="font-mono font-medium text-[#1E2430] dark:text-white">
                    {formatAcademicDate(ext.originalDueAt)}
                  </span>
                </div>
                <div>
                  <span className="text-[#5A6475] dark:text-white/75">
                    Requested New Deadline:{' '}
                  </span>
                  <span className="font-mono font-semibold text-[#14213D] dark:text-white">
                    {formatAcademicDate(ext.requestedDueAt)}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-[#1E2430] dark:text-white/90">
                {ext.reason}
              </p>

              {ext.lecturerNote && (
                <div className="mt-3 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-4 py-2.5 text-xs text-[#1E2430] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white">
                  <span className="font-semibold text-[#14213D] dark:text-white">
                    Instructor Note:{' '}
                  </span>
                  {ext.lecturerNote}
                </div>
              )}

              {currentUser.role === 'lecturer' && ext.status === 'pending' && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={notesById[ext.id] ?? ''}
                    onChange={(e) =>
                      setNotesById((prev) => ({ ...prev, [ext.id]: e.target.value }))
                    }
                    placeholder="Optional decision note for student..."
                    className="min-w-[240px] flex-1 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-xs text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                  />
                  <button
                    type="button"
                    disabled={processingId === ext.id}
                    onClick={() => handleAction(ext.id, 'denied')}
                    className="rounded-md border border-[#8C2D38]/40 px-4 py-2 text-xs font-semibold text-[#8C2D38] hover:bg-[#8C2D38]/5 dark:border-rose-400/50 dark:text-white dark:hover:bg-rose-500/20 cursor-pointer"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={processingId === ext.id}
                    onClick={() => handleAction(ext.id, 'approved')}
                    className="rounded-md bg-[#1F6E52] px-4 py-2 text-xs font-semibold text-white hover:bg-[#185741] cursor-pointer"
                  >
                    Approve Extension
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
