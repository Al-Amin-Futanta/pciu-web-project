import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Lock,
  MessageSquare,
  RotateCcw,
  ScanSearch,
  ShieldAlert,
} from 'lucide-react';
import type {
  Assignment,
  IntegrityReport,
  ReviewStatus,
  SentenceAnalysis,
  Submission,
  SubmissionReview,
} from '../shared/types';
import { fetchSubmissionFileBlob } from '../lib/api';
import { formatAcademicDate } from '../lib/time';

interface LecturerInspectorProps {
  assignments: Assignment[];
  submissions: Submission[];
  integrityReports: IntegrityReport[];
  reviews: SubmissionReview[];
  initialSubmissionId?: string | null;
  onRunScan: (submissionId: string) => Promise<void>;
  onSaveReview: (
    submissionId: string,
    payload: { reviewStatus: ReviewStatus; feedback: string }
  ) => Promise<void>;
  onOpenMessageThread: (peerId: string, assignmentId: string) => void;
}

export function LecturerInspector({
  assignments,
  submissions,
  integrityReports,
  reviews,
  initialSubmissionId,
  onRunScan,
  onSaveReview,
  onOpenMessageThread,
}: LecturerInspectorProps) {
  const [selectedSubId, setSelectedSubId] = useState<string>(
    initialSubmissionId || submissions[0]?.id || ''
  );
  const [viewerMode, setViewerMode] = useState<'document' | 'forensics'>('document');
  const [highlightFilter, setHighlightFilter] = useState<'all' | 'ai' | 'plagiarism'>('all');
  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number | null>(null);

  const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('confirmed');
  const [feedback, setFeedback] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSubmissionId && submissions.some((s) => s.id === initialSubmissionId)) {
      setSelectedSubId(initialSubmissionId);
    } else if (!submissions.some((s) => s.id === selectedSubId)) {
      setSelectedSubId(submissions[0]?.id ?? '');
    }
  }, [initialSubmissionId, submissions, selectedSubId]);

  const activeSubmission = submissions.find((s) => s.id === selectedSubId) ?? submissions[0];
  const activeAssignment = activeSubmission
    ? assignments.find((a) => a.id === activeSubmission.assignmentId)
    : undefined;
  const activeReport = activeSubmission
    ? integrityReports.find(
        (r) =>
          r.submissionId === activeSubmission.id &&
          r.submissionVersion === activeSubmission.version
      )
    : undefined;
  const activeReview = activeSubmission
    ? reviews.find((r) => r.submissionId === activeSubmission.id)
    : undefined;

  // Load original PDF preview blob securely via authenticated endpoint
  useEffect(() => {
    let revokedUrl: string | null = null;
    let active = true;
    setPdfObjectUrl(null);
    setFileError(null);

    if (!activeSubmission || !activeSubmission.hasStoredFile) return;

    const isPdf =
      activeSubmission.fileMime === 'application/pdf' ||
      activeSubmission.fileName.toLowerCase().endsWith('.pdf');

    if (!isPdf) return;

    setFileLoading(true);
    fetchSubmissionFileBlob(activeSubmission.id, false)
      .then(({ objectUrl }) => {
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        revokedUrl = objectUrl;
        setPdfObjectUrl(objectUrl);
      })
      .catch((err) => {
        if (active) {
          setFileError(err instanceof Error ? err.message : 'Unable to preview PDF.');
        }
      })
      .finally(() => {
        if (active) setFileLoading(false);
      });

    return () => {
      active = false;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
    };
  }, [activeSubmission?.id, activeSubmission?.version, activeSubmission?.hasStoredFile]);

  useEffect(() => {
    if (activeReview) {
      setReviewStatus(activeReview.reviewStatus);
      setFeedback(activeReview.feedback);
    } else {
      setReviewStatus('confirmed');
      setFeedback('');
    }
    setSelectedSentenceIdx(null);
    setScanError(null);
    setReviewError(null);
  }, [activeSubmission?.id, activeReview?.id, activeReview?.updatedAt]);

  if (submissions.length === 0) {
    return (
      <div className="rounded-lg border border-[#E2DDD3] bg-white p-12 text-center">
        <FileText className="mx-auto h-9 w-9 text-[#5A6475]/60" />
        <h2 className="mt-3 font-display text-xl font-semibold text-[#14213D]">
          No Student Submissions Yet
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-[#5A6475]">
          Student PDF, Word, and text files will appear here as soon as they are uploaded.
        </p>
      </div>
    );
  }

  const handleDownloadOriginal = async () => {
    if (!activeSubmission) return;
    setDownloading(true);
    try {
      const { objectUrl } = await fetchSubmissionFileBlob(activeSubmission.id, true);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = activeSubmission.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Unable to download file.');
    } finally {
      setDownloading(false);
    }
  };

  const handleScan = async () => {
    if (!activeSubmission) return;
    setScanError(null);
    setScanning(true);
    try {
      await onRunScan(activeSubmission.id);
      setViewerMode('forensics');
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'AI & Plagiarism scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeSubmission) return;
    setReviewError(null);
    setSavingReview(true);
    try {
      await onSaveReview(activeSubmission.id, { reviewStatus, feedback });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Unable to publish feedback.');
    } finally {
      setSavingReview(false);
    }
  };

  const getSentenceHighlightStyle = (sentence: SentenceAnalysis, isSelected: boolean) => {
    const showAi =
      (highlightFilter === 'all' || highlightFilter === 'ai') &&
      (sentence.label === 'ai_likely' || sentence.label === 'ai_suspected');
    const showPlag =
      (highlightFilter === 'all' || highlightFilter === 'plagiarism') &&
      (sentence.label === 'plagiarism_match' || sentence.plagiarismScore >= 45);

    let bg = 'hover:bg-[#F2EFE9]';
    if (showPlag) {
      bg = 'bg-[#8C2D38]/12 underline decoration-[#8C2D38]/60 decoration-2 underline-offset-4';
    } else if (showAi && sentence.label === 'ai_likely') {
      bg = 'bg-[#B4690E]/16 underline decoration-[#B4690E]/60 decoration-2 underline-offset-4';
    } else if (showAi && sentence.label === 'ai_suspected') {
      bg = 'bg-[#B4690E]/8 underline decoration-[#B4690E]/40 decoration-dashed underline-offset-4';
    }

    return `${bg} ${
      isSelected ? 'ring-2 ring-[#14213D] ring-offset-1 rounded-xs' : 'rounded-xs'
    } transition-colors cursor-pointer px-1 py-0.5`;
  };

  const selectedSentence =
    activeReport && selectedSentenceIdx !== null
      ? activeReport.sentences.find((s) => s.index === selectedSentenceIdx)
      : undefined;

  const isPdfFile =
    activeSubmission &&
    (activeSubmission.fileMime === 'application/pdf' ||
      activeSubmission.fileName.toLowerCase().endsWith('.pdf'));

  return (
    <div className="space-y-6">
      {/* Submission Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E2DDD3] bg-white px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs font-semibold text-[#5A6475]" htmlFor="lecturer-sub-select">
            Student Submission:
          </label>
          <select
            id="lecturer-sub-select"
            value={activeSubmission?.id ?? ''}
            onChange={(e) => setSelectedSubId(e.target.value)}
            className="max-w-md rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-1.5 text-sm font-medium text-[#1E2430] focus:border-[#14213D] focus:outline-none"
          >
            {submissions.map((sub) => {
              const assign = assignments.find((a) => a.id === sub.assignmentId);
              return (
                <option key={sub.id} value={sub.id}>
                  {sub.studentName} — {assign ? `${assign.courseCode}: ${assign.title}` : ''} (
                  {sub.fileName})
                </option>
              );
            })}
          </select>
        </div>

        {activeSubmission && activeAssignment && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-[#5A6475] tabular-nums">
              {activeSubmission.fileName} · {Math.max(1, Math.round(activeSubmission.fileSize / 1024))}{' '}
              KB · v{activeSubmission.version}
            </span>
            <button
              type="button"
              disabled={downloading || !activeSubmission.hasStoredFile}
              onClick={handleDownloadOriginal}
              className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#14213D] hover:bg-[#F2EFE9] disabled:opacity-40 whitespace-nowrap cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? 'Downloading...' : 'Download File'}
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenMessageThread(activeSubmission.studentId, activeSubmission.assignmentId)
              }
              className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#14213D] hover:bg-[#F2EFE9] whitespace-nowrap cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Message Student
            </button>
          </div>
        )}
      </div>

      {/* Main Split-Pane Workspace: 60% Document Viewer / 40% AI Gate & Feedback */}
      {activeSubmission && activeAssignment && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT 7 cols: Built-In PDF/Document Viewer + AI Forensics View */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-lg border border-[#E2DDD3] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DDD3] px-6 py-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-[#14213D]">
                    {viewerMode === 'document'
                      ? 'Built-In Assignment Viewer'
                      : 'AI & Plagiarism Sentence Forensics'}
                  </h2>
                  <p className="font-mono text-xs text-[#5A6475] tabular-nums">
                    Received {formatAcademicDate(activeSubmission.submittedAt)} ·{' '}
                    {activeSubmission.wordCount} words
                  </p>
                </div>

                <div className="inline-flex rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1">
                  <button
                    type="button"
                    onClick={() => setViewerMode('document')}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                      viewerMode === 'document'
                        ? 'bg-white text-[#14213D]'
                        : 'text-[#5A6475] hover:text-[#1E2430]'
                    }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Document View
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewerMode('forensics')}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                      viewerMode === 'forensics'
                        ? 'bg-white text-[#14213D]'
                        : 'text-[#5A6475] hover:text-[#1E2430]'
                    }`}
                  >
                    <ScanSearch className="h-3.5 w-3.5" />
                    AI Highlights
                  </button>
                </div>
              </div>

              {activeSubmission.studentNote && (
                <div className="border-b border-[#E2DDD3] bg-[#FAF8F4] px-6 py-3 text-xs text-[#1E2430]">
                  <span className="font-semibold text-[#14213D]">Student Submission Note: </span>
                  {activeSubmission.studentNote}
                </div>
              )}

              {fileError && (
                <div className="mx-6 mt-4 rounded-md border border-[#8C2D38]/30 bg-[#8C2D38]/5 px-4 py-2.5 text-xs text-[#8C2D38]">
                  {fileError}
                </div>
              )}

              {/* VIEW 1: Built-in Document / PDF Viewer */}
              {viewerMode === 'document' ? (
                <div className="p-6">
                  {isPdfFile ? (
                    fileLoading ? (
                      <div className="flex h-[520px] items-center justify-center rounded-md border border-[#E2DDD3] bg-[#FAF8F4] text-xs text-[#5A6475]">
                        Loading PDF document preview...
                      </div>
                    ) : pdfObjectUrl ? (
                      <iframe
                        title={activeSubmission.fileName}
                        src={pdfObjectUrl}
                        className="h-[560px] w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4]"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-5 text-[15px] leading-[1.8] text-[#1E2430]">
                        {activeSubmission.contentText}
                      </div>
                    )
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between border-b border-[#E2DDD3] pb-2 text-xs text-[#5A6475]">
                        <span>Formatted Document Text ({activeSubmission.fileName})</span>
                        <span>Use Download File above for native Word/Text file</span>
                      </div>
                      <div className="max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-5 text-[15px] leading-[1.8] text-[#1E2430]">
                        {activeSubmission.contentText}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* VIEW 2: Sentence-Level AI & Plagiarism Forensics */
                <div>
                  {activeReport ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DDD3] bg-[#FAF8F4] px-6 py-2.5">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-[#5A6475]">
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#B4690E]/40 border border-[#B4690E]" />
                            AI-Generated Signal
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#8C2D38]/30 border border-[#8C2D38]" />
                            Plagiarism Overlap
                          </span>
                        </div>
                        <div className="inline-flex rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1">
                          {(['all', 'ai', 'plagiarism'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => setHighlightFilter(mode)}
                              className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer ${
                                highlightFilter === mode
                                  ? 'bg-white text-[#14213D]'
                                  : 'text-[#5A6475]'
                              }`}
                            >
                              {mode === 'all'
                                ? 'All'
                                : mode === 'ai'
                                  ? 'AI Writing'
                                  : 'Plagiarism'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-6">
                        <p className="text-[15px] leading-[1.85] text-[#1E2430]">
                          {activeReport.sentences.map((sentence) => (
                            <span key={sentence.index}>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedSentenceIdx(sentence.index)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setSelectedSentenceIdx(sentence.index);
                                  }
                                }}
                                className={getSentenceHighlightStyle(
                                  sentence,
                                  selectedSentenceIdx === sentence.index
                                )}
                              >
                                {sentence.text}
                              </span>{' '}
                            </span>
                          ))}
                        </p>
                      </div>

                      {selectedSentence && (
                        <div className="border-t border-[#E2DDD3] bg-[#FAF8F4] px-6 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[#14213D]">
                              Sentence #{selectedSentence.index + 1} Diagnostic
                            </p>
                            <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
                              <span
                                className={
                                  selectedSentence.aiProbability >= 60
                                    ? 'font-semibold text-[#B4690E]'
                                    : 'text-[#1F6E52]'
                                }
                              >
                                AI Probability: {selectedSentence.aiProbability}%
                              </span>
                              <span
                                className={
                                  selectedSentence.plagiarismScore >= 40
                                    ? 'font-semibold text-[#8C2D38]'
                                    : 'text-[#5A6475]'
                                }
                              >
                                Similarity: {selectedSentence.plagiarismScore}%
                              </span>
                            </div>
                          </div>
                          <p className="mt-1.5 text-sm text-[#1E2430]">{selectedSentence.reason}</p>
                          {selectedSentence.matchedSource && (
                            <p className="mt-1.5 font-mono text-xs text-[#8C2D38]">
                              Source Flag: {selectedSentence.matchedSource}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-10 text-center">
                      <ScanSearch className="mx-auto h-8 w-8 text-[#5A6475]/60" />
                      <p className="mt-3 text-sm font-medium text-[#1E2430]">
                        AI &amp; Plagiarism Check Not Yet Run
                      </p>
                      <p className="mt-1 text-xs text-[#5A6475]">
                        Run Step 1 on the right panel to inspect sentence-level AI authorship and
                        cohort similarity highlights.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 5 cols: Step 1 AI Check + Step 2 Receipt Confirmation & Feedback (NO GRADES) */}
          <div className="space-y-5 lg:col-span-5">
            {/* STEP 1: AI Detection & Plagiarism Check */}
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] font-semibold text-[#5A6475]">
                    STEP 1 · REQUIRED BEFORE FEEDBACK
                  </p>
                  <h3 className="mt-0.5 font-display text-base font-semibold text-[#14213D]">
                    AI Detection &amp; Plagiarism Check
                  </h3>
                </div>
                {activeReport && (
                  <span
                    className={`flex items-center gap-1 font-mono text-xs font-semibold shrink-0 ${
                      activeReport.riskLevel === 'high'
                        ? 'text-[#8C2D38]'
                        : activeReport.riskLevel === 'moderate'
                          ? 'text-[#B4690E]'
                          : 'text-[#1F6E52]'
                    }`}
                  >
                    {activeReport.riskLevel === 'high' ? (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    ) : activeReport.riskLevel === 'moderate' ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {activeReport.riskLevel.toUpperCase()} RISK
                  </span>
                )}
              </div>

              {scanError && (
                <div className="mt-3 rounded-md border border-[#8C2D38]/30 bg-[#8C2D38]/5 px-3.5 py-2.5 text-xs text-[#8C2D38]">
                  {scanError}
                </div>
              )}

              <button
                type="button"
                disabled={scanning}
                onClick={handleScan}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#14213D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1D2E54] disabled:opacity-50 cursor-pointer"
              >
                <ScanSearch className="h-4 w-4" />
                {scanning
                  ? 'Running AI & Plagiarism Check...'
                  : activeReport
                    ? 'Re-Run AI & Plagiarism Check'
                    : 'Run AI Detection & Plagiarism Check'}
              </button>

              {activeReport ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4 border-y border-[#E2DDD3] py-3">
                    <div>
                      <p className="text-xs text-[#5A6475]">AI Authorship Index</p>
                      <p className="mt-0.5 font-mono text-2xl font-semibold text-[#B4690E] tabular-nums">
                        {activeReport.aiScore}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#5A6475]">Plagiarism Similarity</p>
                      <p className="mt-0.5 font-mono text-2xl font-semibold text-[#8C2D38] tabular-nums">
                        {activeReport.plagiarismScore}%
                      </p>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed text-[#1E2430]">{activeReport.summary}</p>

                  {activeReport.cohortMatches.length > 0 && (
                    <div className="rounded-md border border-[#8C2D38]/25 bg-[#8C2D38]/5 p-3">
                      <p className="text-xs font-semibold text-[#8C2D38]">
                        Cohort Similarity Matches
                      </p>
                      <ul className="mt-2 space-y-2">
                        {activeReport.cohortMatches.map((m) => (
                          <li key={m.matchedSubmissionId} className="text-xs text-[#1E2430]">
                            <span className="font-semibold">{m.matchedStudentName}</span>{' '}
                            <span className="font-mono text-[#8C2D38] tabular-nums">
                              ({m.overlapPercent}% overlap)
                            </span>
                            <p className="mt-0.5 italic text-[#5A6475]">“{m.sharedExcerpt}”</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="font-mono text-[11px] text-[#5A6475]">
                    Checked by {activeReport.analyzedBy} ·{' '}
                    {formatAcademicDate(activeReport.analyzedAt)}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-xs leading-relaxed text-[#5A6475]">
                  Run the AI detection check on this file version first to unlock Step 2 (Receipt
                  Confirmation &amp; Written Feedback).
                </p>
              )}
            </div>

            {/* STEP 2: Receipt Confirmation & Qualitative Feedback (NO GRADING) */}
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-5">
              <div className="border-b border-[#E2DDD3] pb-3">
                <p className="font-mono text-[11px] font-semibold text-[#5A6475]">
                  STEP 2 · NO NUMERIC GRADING
                </p>
                <h3 className="mt-0.5 font-display text-base font-semibold text-[#14213D]">
                  Receipt Confirmation &amp; Feedback
                </h3>
              </div>

              {!activeReport ? (
                <div className="mt-4 flex items-start gap-3 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-4 text-xs text-[#5A6475]">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#B4690E]" />
                  <span>
                    Feedback is gated until you run the <strong>AI Detection Check</strong> in Step
                    1 on submission version v{activeSubmission.version}.
                  </span>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
                  {reviewError && (
                    <div className="rounded-md border border-[#8C2D38]/30 bg-[#8C2D38]/5 px-3 py-2 text-xs text-[#8C2D38]">
                      {reviewError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#1E2430]">
                      Confirmation Decision
                    </label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReviewStatus('confirmed')}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold cursor-pointer ${
                          reviewStatus === 'confirmed'
                            ? 'border-[#1F6E52] bg-[#1F6E52]/10 text-[#1F6E52]'
                            : 'border-[#E2DDD3] bg-white text-[#5A6475]'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Confirm Receipt
                      </button>
                      <button
                        type="button"
                        onClick={() => setReviewStatus('revision_requested')}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-semibold cursor-pointer ${
                          reviewStatus === 'revision_requested'
                            ? 'border-[#B4690E] bg-[#B4690E]/10 text-[#B4690E]'
                            : 'border-[#E2DDD3] bg-white text-[#5A6475]'
                        }`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Request Revision
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#1E2430]">
                      Written Feedback for Student
                    </label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={4}
                      placeholder="Confirm document receipt and share qualitative observations, citation guidance, or revision instructions..."
                      className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-3 text-xs leading-relaxed text-[#1E2430] focus:border-[#14213D] focus:outline-none"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingReview}
                    className="w-full rounded-md bg-[#14213D] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1D2E54] disabled:opacity-50 cursor-pointer"
                  >
                    {savingReview
                      ? 'Sending Confirmation...'
                      : activeReview
                        ? 'Update Confirmation & Feedback'
                        : 'Confirm Receipt & Send Feedback'}
                  </button>

                  {activeReview && (
                    <p className="font-mono text-[11px] text-[#1F6E52]">
                      Receipt confirmed on {formatAcademicDate(activeReview.confirmedAt)}
                    </p>
                  )}

                  {activeReview?.studentReply && (
                    <div className="rounded-md border border-[#1F6E52]/30 bg-[#1F6E52]/5 p-3">
                      <p className="text-xs font-semibold text-[#1F6E52]">
                        Student Reply ({formatAcademicDate(activeReview.studentReplyAt ?? '')})
                      </p>
                      <p className="mt-1 text-xs text-[#1E2430]">{activeReview.studentReply}</p>
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
