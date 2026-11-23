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
          <h2 className="font-display text-2xl font-semibold text-[#14213D]">
            Deadline Extension Petitions
          </h2>
          <p className="mt-1 text-sm text-[#5A6475]">
            {currentUser.role === 'lecturer'
              ? 'Approved extensions automatically unlock each student’s personal submission deadline.'
              : 'Track the status of your extension petitions submitted through the portal.'}
          </p>
        </div>

        <div className="inline-flex rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1">
          {(['all', 'pending', 'decided'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded px-3 py-1.5 text-xs font-medium capitalize cursor-pointer ${
                filter === tab ? 'bg-white text-[#14213D]' : 'text-[#5A6475]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-12 text-center">
          <CalendarClock className="mx-auto h-8 w-8 text-[#5A6475]/60" />
          <p className="mt-3 text-sm font-medium text-[#1E2430]">No extension petitions found</p>
          <p className="mt-1 text-xs text-[#5A6475]">
            {currentUser.role === 'student'
              ? 'You can request an extension directly from any active assignment card.'
              : 'Incoming student extension requests appear here in real time.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#E2DDD3] rounded-lg border border-[#E2DDD3] bg-white">
          {filtered.map((ext) => (
            <div key={ext.id} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs text-[#5A6475]">
                    {ext.courseCode} · {ext.studentName}
                    {ext.studentCode ? ` (${ext.studentCode})` : ''}
                  </p>
                  <h3 className="mt-0.5 font-display text-lg font-semibold text-[#14213D]">
                    {ext.assignmentTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                  {ext.status === 'pending' && (
                    <span className="flex items-center gap-1.5 text-[#B4690E]">
                      <Clock className="h-3.5 w-3.5" />
                      PENDING REVIEW
                    </span>
                  )}
                  {ext.status === 'approved' && (
                    <span className="flex items-center gap-1.5 text-[#1F6E52]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      APPROVED
                    </span>
                  )}
                  {ext.status === 'denied' && (
                    <span className="flex items-center gap-1.5 text-[#8C2D38]">
                      <XCircle className="h-3.5 w-3.5" />
                      DECLINED
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 border-y border-[#E2DDD3] py-3 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-[#5A6475]">Original Deadline: </span>
                  <span className="font-mono font-medium text-[#1E2430]">
                    {formatAcademicDate(ext.originalDueAt)}
                  </span>
                </div>
                <div>
                  <span className="text-[#5A6475]">Requested New Deadline: </span>
                  <span className="font-mono font-semibold text-[#14213D]">
                    {formatAcademicDate(ext.requestedDueAt)}
                  </span>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-[#1E2430]">{ext.reason}</p>

              {ext.lecturerNote && (
                <div className="mt-3 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-4 py-2.5 text-xs text-[#1E2430]">
                  <span className="font-semibold text-[#14213D]">Instructor Note: </span>
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
                    className="min-w-[240px] flex-1 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-xs text-[#1E2430] focus:border-[#14213D] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={processingId === ext.id}
                    onClick={() => handleAction(ext.id, 'denied')}
                    className="rounded-md border border-[#8C2D38]/40 px-4 py-2 text-xs font-semibold text-[#8C2D38] hover:bg-[#8C2D38]/5 cursor-pointer"
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
