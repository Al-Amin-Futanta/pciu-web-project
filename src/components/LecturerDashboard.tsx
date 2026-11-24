import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileText,
  Lock,
  Pencil,
  ScanSearch,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type {
  Assignment,
  Course,
  IntegrityReport,
  Submission,
  SubmissionReview,
} from '../shared/types';
import { formatAcademicDate, getCountdown } from '../lib/time';

interface LecturerDashboardProps {
  courses: Course[];
  assignments: Assignment[];
  submissions: Submission[];
  integrityReports: IntegrityReport[];
  reviews: SubmissionReview[];
  pendingExtensionsCount: number;
  nowMs: number;
  onEditAssignment: (assignment: Assignment) => void;
  onInspectSubmission: (submissionId: string) => void;
}

export function LecturerDashboard({
  courses,
  assignments,
  submissions,
  integrityReports,
  reviews,
  pendingExtensionsCount,
  nowMs,
  onEditAssignment,
  onInspectSubmission,
}: LecturerDashboardProps) {
  const [courseFilter, setCourseFilter] = useState<string>('all');

  const activeCount = assignments.filter((a) => a.status !== 'canceled').length;
  const awaitingReviewCount = submissions.filter(
    (s) => !reviews.some((r) => r.submissionId === s.id)
  ).length;
  const highRiskCount = integrityReports.filter((r) => r.riskLevel === 'high').length;

  const filteredAssignments = assignments.filter(
    (a) => courseFilter === 'all' || a.courseId === courseFilter
  );

  return (
    <div className="space-y-8">
      {/* Lecturer 4-Column Summary Strip */}
      <section className="grid grid-cols-2 divide-y divide-[#E2DDD3] rounded-lg border border-[#E2DDD3] bg-white dark:divide-[#293752] dark:border-[#293752] dark:bg-[#131C2E] sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">Active Assignments</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#14213D] dark:text-white tabular-nums">
            {activeCount}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">Student Files Received</p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#14213D] dark:text-white tabular-nums">
            {submissions.length}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">
            Awaiting AI Check &amp; Confirmation
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold text-[#B4690E] dark:text-white tabular-nums">
            {awaitingReviewCount}
          </p>
        </div>
        <div className="p-5">
          <p className="text-xs text-[#5A6475] dark:text-white/75">High AI / Plagiarism Flags</p>
          <p
            className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
              highRiskCount > 0 ? 'text-[#8C2D38] dark:text-rose-300' : 'text-[#1F6E52] dark:text-emerald-300'
            }`}
          >
            {highRiskCount}
          </p>
        </div>
      </section>

      {/* Incoming Student File Queue */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#14213D] dark:text-white">
              Incoming Student Files · Open &amp; Run AI Check Before Feedback
            </h2>
            <p className="text-xs text-[#5A6475] dark:text-white/80">
              Open any student submission to view the document, run AI &amp; plagiarism detection,
              and send confirmation + feedback ({pendingExtensionsCount} extension petitions pending).
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#E2DDD3] bg-white dark:border-[#293752] dark:bg-[#131C2E]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E2DDD3] bg-[#FAF8F4] text-[#5A6475] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white/80">
              <tr>
                <th className="px-4 py-3 font-semibold">Student</th>
                <th className="px-4 py-3 font-semibold">Assignment &amp; File</th>
                <th className="px-4 py-3 font-semibold">AI Detection Status</th>
                <th className="px-4 py-3 font-semibold">Confirmation Status</th>
                <th className="px-4 py-3 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DDD3]/70 dark:divide-[#293752]">
              {submissions.map((sub) => {
                const assign = assignments.find((a) => a.id === sub.assignmentId);
                const report = integrityReports.find(
                  (r) => r.submissionId === sub.id && r.submissionVersion === sub.version
                );
                const rev = reviews.find((r) => r.submissionId === sub.id);
                return (
                  <tr key={sub.id} className="hover:bg-[#FAF8F4]/70 dark:hover:bg-[#1A263D]/60">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <p className="font-semibold text-[#1E2430] dark:text-white">{sub.studentName}</p>
                      <p className="font-mono text-[11px] text-[#5A6475] dark:text-white/75">
                        {sub.studentCode}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-[#14213D] dark:text-white">
                        {assign ? `${assign.courseCode} · ${assign.title}` : sub.assignmentId}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-[#5A6475] dark:text-white/75">
                        {sub.fileName} · {Math.max(1, Math.round(sub.fileSize / 1024))} KB ·{' '}
                        {formatAcademicDate(sub.submittedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 font-mono whitespace-nowrap tabular-nums">
                      {report ? (
                        <span
                          className={`flex items-center gap-1.5 font-semibold ${
                            report.riskLevel === 'high'
                              ? 'text-[#8C2D38] dark:text-rose-300'
                              : report.riskLevel === 'moderate'
                                ? 'text-[#B4690E] dark:text-amber-300'
                                : 'text-[#1F6E52] dark:text-emerald-300'
                          }`}
                        >
                          {report.riskLevel === 'high' ? (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          AI {report.aiScore}% · Sim {report.plagiarismScore}%
                        </span>
                      ) : (
                        <span className="text-[#B4690E] dark:text-amber-300">Needs AI Check</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {rev ? (
                        <span className="font-mono font-semibold text-[#1F6E52] dark:text-emerald-300">
                          {rev.reviewStatus === 'revision_requested'
                            ? 'Revision Requested'
                            : 'Confirmed & Sent'}
                        </span>
                      ) : (
                        <span className="font-mono text-[#5A6475] dark:text-white/75">
                          Pending Review
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectSubmission(sub.id)}
                        className="inline-flex items-center gap-1.5 rounded-md bg-[#14213D] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1D2E54] dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 cursor-pointer"
                      >
                        <ScanSearch className="h-3.5 w-3.5" />
                        Open &amp; Verify
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Course Assignments Management */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-display text-xl font-semibold text-[#14213D] dark:text-white">
            Published Assignments &amp; Deadlines
          </h2>
          <div className="inline-flex rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1 dark:border-[#293752] dark:bg-[#131C2E]">
            <button
              type="button"
              onClick={() => setCourseFilter('all')}
              className={`rounded px-3 py-1.5 text-xs font-medium cursor-pointer ${
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
                className={`rounded px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  courseFilter === course.id
                    ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                    : 'text-[#5A6475] dark:text-white/75'
                }`}
              >
                {course.code}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {filteredAssignments.map((assign) => {
            const countdown = getCountdown(assign.dueAt, nowMs);
            const classSubs = submissions.filter((s) => s.assignmentId === assign.id);
            return (
              <article
                key={assign.id}
                className="rounded-lg border border-[#E2DDD3] bg-white p-6 dark:border-[#293752] dark:bg-[#131C2E]"
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
                            Modified
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
                    <h3 className="mt-1.5 font-display text-lg font-semibold text-[#14213D] dark:text-white">
                      {assign.title}
                    </h3>
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
                          Due {formatAcademicDate(assign.dueAt)}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-[#E2DDD3] pt-4 dark:border-[#293752]">
                  <span className="flex items-center gap-1.5 font-mono text-xs text-[#5A6475] dark:text-white/80 tabular-nums">
                    <FileText className="h-3.5 w-3.5" />
                    {classSubs.length} files submitted
                  </span>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onEditAssignment(assign)}
                      className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#1E2430] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Modify / Cancel
                    </button>
                    {classSubs[0] && (
                      <button
                        type="button"
                        onClick={() => onInspectSubmission(classSubs[0].id)}
                        className="flex items-center gap-1.5 rounded-md bg-[#14213D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1D2E54] dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 cursor-pointer"
                      >
                        <ScanSearch className="h-3.5 w-3.5" />
                        Inspect Files ({classSubs.length})
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
