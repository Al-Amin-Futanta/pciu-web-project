import { useState, type FormEvent } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileText,
  Lock,
  MessageSquare,
  RotateCcw,
  Upload,
  XCircle,
} from 'lucide-react';
import type {
  Assignment,
  Course,
  Submission,
  SubmissionReview,
  UserProfile,
} from '../shared/types';
import { fetchSubmissionFileBlob } from '../lib/api';
import { formatAcademicDate, getCountdown } from '../lib/time';

interface StudentDashboardProps {
  currentUser: UserProfile;
  courses: Course[];
  assignments: Assignment[];
  submissions: Submission[];
  reviews: SubmissionReview[];
  unreadMessagesCount: number;
  nowMs: number;
  mode: 'dashboard' | 'submissions';
  onOpenSubmitModal: (assignment: Assignment, initialTab: 'submit' | 'extension') => void;
  onAcknowledgeFeedback: (submissionId: string, note: string) => Promise<void>;
  onOpenMessageLecturer: (assignmentId: string) => void;
}

export function StudentDashboard({
  currentUser,
  courses,
  assignments,
  submissions,
  reviews,
  unreadMessagesCount,
  nowMs,
  mode,
  onOpenSubmitModal,
  onAcknowledgeFeedback,
  onOpenMessageLecturer,
}: StudentDashboardProps) {
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [selectedSubId, setSelectedSubId] = useState<string>(submissions[0]?.id ?? '');
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const activeCount = assignments.filter((a) => a.status !== 'canceled').length;
  const confirmedCount = reviews.filter((r) => r.reviewStatus === 'confirmed').length;

  const filteredAssignments = assignments.filter(
    (a) => courseFilter === 'all' || a.courseId === courseFilter
  );

  const handleDownloadOwnFile = async (sub: Submission) => {
    const { objectUrl } = await fetchSubmissionFileBlob(sub.id, true);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = sub.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  if (mode === 'submissions') {
    const activeSub = submissions.find((s) => s.id === selectedSubId) ?? submissions[0];
    const activeAssign = activeSub
      ? assignments.find((a) => a.id === activeSub.assignmentId)
      : undefined;
    const activeReview = activeSub
      ? reviews.find((r) => r.submissionId === activeSub.id)
      : undefined;

    if (submissions.length === 0) {
      return (
        <div className="rounded-lg border border-[#E2DDD3] bg-white p-12 text-center dark:border-[#293752] dark:bg-[#131C2E]">
          <FileText className="mx-auto h-9 w-9 text-[#5A6475]/60 dark:text-white/75" />
          <h2 className="mt-3 font-display text-xl font-semibold text-[#14213D] dark:text-white">
            No Files Uploaded Yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#5A6475] dark:text-white/80">
            Upload your PDF, Word, or text assignment from the Student Dashboard to receive your
            submission confirmation receipt and instructor feedback.
          </p>
        </div>
      );
    }

    const handleReplySubmit = async (e: FormEvent) => {
      e.preventDefault();
      if (!activeSub || !replyDraft.trim()) return;
      setSendingReply(true);
      try {
        await onAcknowledgeFeedback(activeSub.id, replyDraft.trim());
        setReplyDraft('');
      } finally {
        setSendingReply(false);
      }
    };

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Submission Receipt List */}
        <aside className="space-y-2 lg:col-span-4">
          {submissions.map((sub) => {
            const assign = assignments.find((a) => a.id === sub.assignmentId);
            const rev = reviews.find((r) => r.submissionId === sub.id);
            const isSelected = activeSub?.id === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubId(sub.id)}
                className={`w-full rounded-lg border p-4 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#14213D] bg-white dark:border-white dark:bg-[#131C2E]'
                    : 'border-[#E2DDD3] bg-[#FAF8F4] hover:bg-white dark:border-[#293752] dark:bg-[#0B1120] dark:hover:bg-[#131C2E]'
                }`}
              >
                <p className="font-mono text-xs text-[#5A6475] dark:text-white/75">
                  {assign?.courseCode} · v{sub.version}
                </p>
                <p className="mt-1 font-display text-base font-semibold text-[#14213D] dark:text-white">
                  {assign?.title ?? sub.assignmentId}
                </p>
                <p className="mt-1 font-mono text-xs text-[#5A6475] dark:text-white/75 truncate">
                  {sub.fileName}
                </p>
                <div className="mt-2.5 font-mono text-xs font-semibold">
                  {rev?.reviewStatus === 'confirmed' ? (
                    <span className="flex items-center gap-1.5 text-[#1F6E52] dark:text-white">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Receipt Confirmed &amp; Feedback Sent
                    </span>
                  ) : rev?.reviewStatus === 'revision_requested' ? (
                    <span className="flex items-center gap-1.5 text-[#B4690E] dark:text-white">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Revision Requested
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-[#14213D] dark:text-white">
                      <Clock className="h-3.5 w-3.5" />
                      File Received · Awaiting Feedback
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </aside>

        {/* Right Receipt Confirmation & Qualitative Feedback Panel (ZERO GRADES) */}
        {activeSub && activeAssign && (
          <section className="space-y-5 lg:col-span-8">
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-6 dark:border-[#293752] dark:bg-[#131C2E]">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2DDD3] pb-4 dark:border-[#293752]">
                <div>
                  <p className="font-mono text-xs text-[#5A6475] dark:text-white/75">
                    {activeAssign.courseCode} · Official Submission Receipt
                  </p>
                  <h2 className="mt-1 font-display text-2xl font-semibold text-[#14213D] dark:text-white">
                    {activeAssign.title}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  {activeSub.hasStoredFile && (
                    <button
                      type="button"
                      onClick={() => handleDownloadOwnFile(activeSub)}
                      className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#14213D] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download My File
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenMessageLecturer(activeAssign.id)}
                    className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#14213D] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Message Lecturer
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 border-b border-[#E2DDD3] pb-4 text-xs dark:border-[#293752] sm:grid-cols-3">
                <div>
                  <p className="text-[#5A6475] dark:text-white/75">Uploaded File</p>
                  <p className="mt-0.5 font-mono font-semibold text-[#14213D] dark:text-white truncate">
                    {activeSub.fileName}
                  </p>
                </div>
                <div>
                  <p className="text-[#5A6475] dark:text-white/75">Server Receipt Timestamp</p>
                  <p className="mt-0.5 font-mono text-[#1E2430] dark:text-white tabular-nums">
                    {formatAcademicDate(activeSub.submittedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[#5A6475] dark:text-white/75">File Size &amp; Version</p>
                  <p className="mt-0.5 font-mono text-[#1E2430] dark:text-white tabular-nums">
                    {Math.max(1, Math.round(activeSub.fileSize / 1024))} KB · Version {activeSub.version}
                  </p>
                </div>
              </div>

              {/* Confirmation & Lecturer Feedback Section */}
              {activeReview ? (
                <div className="mt-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#1F6E52]/30 bg-[#1F6E52]/5 px-4 py-3 dark:border-emerald-400/40 dark:bg-emerald-500/15">
                    <span className="flex items-center gap-2 text-xs font-semibold text-[#1F6E52] dark:text-white">
                      <FileCheck2 className="h-4 w-4" />
                      {activeReview.reviewStatus === 'revision_requested'
                        ? 'Submission Received — Revision Requested by Lecturer'
                        : 'Submission Receipt Confirmed by Lecturer'}
                    </span>
                    <span className="font-mono text-[11px] text-[#5A6475] dark:text-white/80">
                      Confirmed {formatAcademicDate(activeReview.confirmedAt)}
                    </span>
                  </div>

                  <div className="rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-4 dark:border-[#293752] dark:bg-[#0B1120]">
                    <p className="text-xs font-semibold text-[#14213D] dark:text-white">
                      Written Feedback from {activeReview.lecturerName}
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#1E2430] dark:text-white/90">
                      {activeReview.feedback}
                    </p>
                  </div>

                  {activeReview.reviewStatus === 'revision_requested' && (
                    <button
                      type="button"
                      onClick={() => onOpenSubmitModal(activeAssign, 'submit')}
                      className="flex items-center gap-1.5 rounded-md bg-[#14213D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D2E54] dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Revised File from Computer
                    </button>
                  )}

                  <form
                    onSubmit={handleReplySubmit}
                    className="border-t border-[#E2DDD3] pt-4 dark:border-[#293752]"
                  >
                    <label className="block text-xs font-semibold text-[#14213D] dark:text-white">
                      Acknowledge Confirmation or Reply to Feedback
                    </label>
                    {activeReview.studentReply && (
                      <p className="mt-1.5 rounded border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-xs text-[#1E2430] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white">
                        <strong>Your previous reply:</strong> {activeReview.studentReply}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={replyDraft}
                        onChange={(e) => setReplyDraft(e.target.value)}
                        placeholder="Write a brief confirmation reply or follow-up note..."
                        className="flex-1 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-xs text-[#1E2430] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50"
                      />
                      <button
                        type="submit"
                        disabled={sendingReply || !replyDraft.trim()}
                        className="rounded-md border border-[#14213D] px-4 py-2 text-xs font-semibold text-[#14213D] hover:bg-[#14213D] hover:text-white disabled:opacity-40 dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-[#14213D] whitespace-nowrap cursor-pointer"
                      >
                        {sendingReply ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="mt-5 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-4 text-xs text-[#5A6475] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white/85">
                  Your file <strong>{activeSub.fileName}</strong> has been safely recorded on the
                  server. You will receive an instant notification once your lecturer confirms
                  receipt and shares written feedback.
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student 4-Column Summary Strip */}
      <section className="grid grid-cols-2 divide-y divide-[#E2DDD3] rounded-lg border border-[#E2DDD3] bg-white dark:divide-[#293752] dark:border-[#293752] dark:bg-[#131C2E] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">Active Coursework</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#14213D] dark:text-white tabular-nums">
            {activeCount}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">Files Submitted</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#14213D] dark:text-white tabular-nums">
            {submissions.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">Confirmed by Lecturer</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#1F6E52] dark:text-white tabular-nums">
            {confirmedCount}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">Unread Messages</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#B4690E] dark:text-white tabular-nums">
            {unreadMessagesCount}
          </p>
        </div>
      </section>

      {/* Course Segmented Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1 dark:border-[#293752] dark:bg-[#131C2E]">
          <button
            type="button"
            onClick={() => setCourseFilter('all')}
            className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
              courseFilter === 'all'
                ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                : 'text-[#5A6475] dark:text-white/75'
            }`}
          >
            All Courses
          </button>
          {courses.map((course) => (
            <button
              key={course.id}
              type="button"
              onClick={() => setCourseFilter(course.id)}
              className={`rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                courseFilter === course.id
                  ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                  : 'text-[#5A6475] dark:text-white/75'
              }`}
            >
              {course.code}
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
          Signed in as {currentUser.name} · Upload PDF, DOC/DOCX, or TXT from your computer
        </p>
      </div>

      {/* Student Coursework Cards */}
      <div className="space-y-4">
        {filteredAssignments.map((assign) => {
          const effectiveDue = assign.effectiveDueAt ?? assign.dueAt;
          const countdown = getCountdown(effectiveDue, nowMs);
          const hasPersonalExt = assign.effectiveDueAt && assign.effectiveDueAt !== assign.dueAt;
          const mySub = submissions.find((s) => s.assignmentId === assign.id);
          const myRev = mySub ? reviews.find((r) => r.submissionId === mySub.id) : undefined;

          return (
            <article
              key={assign.id}
              className="rounded-lg border border-[#E2DDD3] bg-white p-6 transition-colors hover:border-[#14213D]/30 dark:border-[#293752] dark:bg-[#131C2E] dark:hover:border-white/40"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#5A6475] dark:text-white/80">
                    <span className="font-mono font-semibold text-[#14213D] dark:text-white">
                      {assign.courseCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{assign.courseTitle}</span>
                    {assign.status === 'modified' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-[#B4690E] dark:text-amber-300">
                          Updated by Lecturer
                        </span>
                      </>
                    )}
                    {assign.status === 'canceled' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#8C2D38] dark:text-rose-300">
                          ✕ Canceled
                        </span>
                      </>
                    )}
                  </div>

                  <h2 className="mt-1.5 font-display text-xl font-semibold text-[#14213D] dark:text-white">
                    {assign.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#5A6475] dark:text-white/80">
                    {assign.description}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  {assign.status === 'canceled' ? (
                    <div className="flex items-center justify-end gap-1.5 font-mono text-xs font-semibold text-[#8C2D38] dark:text-rose-300">
                      <XCircle className="h-4 w-4" />
                      CANCELED
                    </div>
                  ) : (
                    <>
                      <div
                        className={`flex items-center justify-end gap-1.5 font-mono text-sm font-semibold tabular-nums ${
                          countdown.isOverdue
                            ? 'text-[#8C2D38] dark:text-rose-300'
                            : countdown.isUrgent
                              ? 'text-[#B4690E] dark:text-amber-300'
                              : 'text-[#1F6E52] dark:text-emerald-300'
                        }`}
                      >
                        {countdown.isOverdue ? (
                          <Lock className="h-3.5 w-3.5" />
                        ) : (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                        <span>{countdown.label}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-[#5A6475] dark:text-white/75 tabular-nums">
                        Due {formatAcademicDate(effectiveDue)}
                        {hasPersonalExt ? ' (Extended)' : ''}
                      </p>
                    </>
                  )}
                </div>
              </div>

              {assign.modificationNote && (
                <div className="mt-4 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-4 py-2.5 text-xs text-[#1E2430] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white">
                  <span className="font-semibold text-[#14213D] dark:text-white">
                    Instructor Notice:{' '}
                  </span>
                  {assign.modificationNote}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#E2DDD3] pt-4 dark:border-[#293752]">
                <div className="text-xs text-[#5A6475] dark:text-white/80">
                  {myRev ? (
                    <span
                      className={`flex items-center gap-1.5 font-mono font-semibold ${
                        myRev.reviewStatus === 'revision_requested'
                          ? 'text-[#B4690E] dark:text-amber-300'
                          : 'text-[#1F6E52] dark:text-emerald-300'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {myRev.reviewStatus === 'revision_requested'
                        ? `Revision Requested (${mySub?.fileName})`
                        : `Receipt Confirmed & Feedback Ready (${mySub?.fileName})`}
                    </span>
                  ) : mySub ? (
                    <span className="flex items-center gap-1.5 font-mono text-[#14213D] dark:text-white">
                      <CheckCircle2 className="h-4 w-4 text-[#1F6E52] dark:text-emerald-300" />
                      File Received: {mySub.fileName} (v{mySub.version}) · Awaiting confirmation
                    </span>
                  ) : (
                    <span>Upload PDF, DOC/DOCX, or TXT file from your computer</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {assign.status !== 'canceled' && (
                    <button
                      type="button"
                      onClick={() => onOpenSubmitModal(assign, 'extension')}
                      className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#1E2430] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] whitespace-nowrap cursor-pointer"
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      Request Extension
                    </button>
                  )}

                  {mySub && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubId(mySub.id);
                        onOpenMessageLecturer(assign.id);
                      }}
                      className="rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#14213D] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] whitespace-nowrap cursor-pointer"
                    >
                      Message Lecturer
                    </button>
                  )}

                  {assign.status !== 'canceled' &&
                    !countdown.isOverdue &&
                    (!mySub ||
                      assign.allowResubmission ||
                      myRev?.reviewStatus === 'revision_requested') && (
                      <button
                        type="button"
                        onClick={() => onOpenSubmitModal(assign, 'submit')}
                        className="flex items-center gap-1.5 rounded-md bg-[#14213D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D2E54] dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {mySub ? 'Upload New File' : 'Submit File'}
                      </button>
                    )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
