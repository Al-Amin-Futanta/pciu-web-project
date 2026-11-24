import { useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { CalendarClock, FileCheck2, Upload, X } from 'lucide-react';
import type { Assignment, Submission } from '../shared/types';
import { formatAcademicDate, toLocalDateTimeInput } from '../lib/time';

interface SubmissionModalProps {
  assignment: Assignment;
  existingSubmission?: Submission;
  initialTab?: 'submit' | 'extension';
  onClose: () => void;
  onSubmitFile: (params: {
    assignmentId: string;
    file: File;
    studentNote?: string;
  }) => Promise<void>;
  onRequestExtension: (payload: {
    assignmentId: string;
    requestedDueAt: string;
    reason: string;
  }) => Promise<void>;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt'];

export function SubmissionModal({
  assignment,
  existingSubmission,
  initialTab = 'submit',
  onClose,
  onSubmitFile,
  onRequestExtension,
}: SubmissionModalProps) {
  const [tab, setTab] = useState<'submit' | 'extension'>(initialTab);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [studentNote, setStudentNote] = useState(existingSubmission?.studentNote ?? '');
  const [isDragging, setIsDragging] = useState(false);

  const effectiveDue = assignment.effectiveDueAt ?? assignment.dueAt;
  const proposedDefault = new Date(
    Math.max(Date.now(), new Date(effectiveDue).getTime()) + 48 * 60 * 60 * 1000
  ).toISOString();

  const [requestedDueLocal, setRequestedDueLocal] = useState(
    toLocalDateTimeInput(proposedDefault)
  );
  const [extensionReason, setExtensionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelectFile = (file: File | null) => {
    setError(null);
    if (!file) return;
    const lower = file.name.toLowerCase();
    const isValidExt = ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
    if (!isValidExt) {
      setError('Unsupported file format. Please upload a .pdf, .doc, .docx, or .txt file.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('File exceeds the 12 MB portal upload limit.');
      return;
    }
    setSelectedFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndSelectFile(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    validateAndSelectFile(e.dataTransfer.files?.[0] ?? null);
  };

  const handleWorkSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedFile) {
      setError('Please choose a PDF, DOC, DOCX, or TXT file from your computer.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmitFile({
        assignmentId: assignment.id,
        file: selectedFile,
        studentNote,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExtensionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onRequestExtension({
        assignmentId: assignment.id,
        requestedDueAt: new Date(requestedDueLocal).toISOString(),
        reason: extensionReason,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request extension.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14213D]/30 p-4 backdrop-blur-[1px] dark:bg-black/65">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#E2DDD3] bg-white shadow-xl dark:border-[#293752] dark:bg-[#131C2E]">
        <div className="flex items-start justify-between border-b border-[#E2DDD3] px-6 py-4 dark:border-[#293752]">
          <div>
            <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
              {assignment.courseCode} · Due {formatAcademicDate(effectiveDue)}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-[#14213D] dark:text-white">
              {assignment.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close portal"
            className="rounded-md p-1.5 text-[#5A6475] hover:bg-[#F2EFE9] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Segmented portal switcher */}
        <div className="border-b border-[#E2DDD3] bg-[#FAF8F4] px-6 py-2.5 dark:border-[#293752] dark:bg-[#0B1120]">
          <div className="inline-flex rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1 dark:border-[#293752] dark:bg-[#131C2E]">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setTab('submit');
              }}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'submit'
                  ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                  : 'text-[#5A6475] hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white'
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              {existingSubmission ? 'Upload Updated File' : 'Upload Assignment File'}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setTab('extension');
              }}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                tab === 'extension'
                  ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                  : 'text-[#5A6475] hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white'
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" />
              Request Extension
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-5 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-4 dark:border-[#293752] dark:bg-[#0B1120]">
            <p className="text-xs font-semibold text-[#14213D] dark:text-white">Assignment Brief</p>
            <p className="mt-1 text-sm leading-relaxed text-[#1E2430] dark:text-white/90">
              {assignment.instructions}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-[#8C2D38]/30 bg-[#8C2D38]/5 px-4 py-3 text-sm text-[#8C2D38] dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-white">
              {error}
            </div>
          )}

          {tab === 'submit' ? (
            <form onSubmit={handleWorkSubmit} className="space-y-4">
              {existingSubmission && (
                <div className="flex items-center justify-between rounded-md border border-[#E2DDD3] bg-[#F2EFE9]/70 px-4 py-2.5 text-xs dark:border-[#293752] dark:bg-[#0B1120]">
                  <span className="text-[#1E2430] dark:text-white">
                    Current file on record:{' '}
                    <strong className="font-mono text-[#14213D] dark:text-white">
                      {existingSubmission.fileName}
                    </strong>{' '}
                    (v{existingSubmission.version})
                  </span>
                  <span className="font-mono text-[#5A6475] dark:text-white/75">
                    {formatAcademicDate(existingSubmission.submittedAt)}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                  Select Assignment File from Computer (PDF, DOC, DOCX, or TXT)
                </label>
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`mt-2 flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-9 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? 'border-[#14213D] bg-[#14213D]/5 dark:border-white dark:bg-white/10'
                      : 'border-[#14213D]/35 bg-[#FAF8F4] hover:border-[#14213D] dark:border-white/35 dark:bg-[#0B1120] dark:hover:border-white'
                  }`}
                >
                  {selectedFile ? (
                    <FileCheck2 className="h-8 w-8 text-[#1F6E52] dark:text-white" />
                  ) : (
                    <Upload className="h-7 w-7 text-[#14213D] dark:text-white" />
                  )}
                  <p className="mt-3 text-sm font-semibold text-[#1E2430] dark:text-white">
                    {selectedFile
                      ? selectedFile.name
                      : 'Drag and drop your file here, or click to browse PC / laptop'}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[#5A6475] dark:text-white/80">
                    {selectedFile
                      ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB · Ready for submission`
                      : 'Accepted formats: .pdf, .doc, .docx, .txt · Max 12 MB'}
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                  Optional Note for Instructor
                </label>
                <textarea
                  value={studentNote}
                  onChange={(e) => setStudentNote(e.target.value)}
                  rows={3}
                  placeholder="Optional context about your uploaded document or revisions made..."
                  className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-3 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2DDD3] pt-4 dark:border-[#293752]">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-[#E2DDD3] px-4 py-2 text-xs font-medium text-[#5A6475] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !selectedFile}
                  className="rounded-md bg-[#14213D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D2E54] disabled:opacity-50 dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                >
                  {submitting
                    ? 'Uploading & Verifying...'
                    : existingSubmission
                      ? 'Upload New File Version'
                      : 'Submit Assignment File'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleExtensionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                  Proposed New Deadline
                </label>
                <input
                  type="datetime-local"
                  value={requestedDueLocal}
                  onChange={(e) => setRequestedDueLocal(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 font-mono text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:focus:border-white"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                  Justification for Extension
                </label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  rows={4}
                  placeholder="Explain the academic conflict, medical circumstance, or research dependency..."
                  className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-3 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[#E2DDD3] pt-4 dark:border-[#293752]">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-[#E2DDD3] px-4 py-2 text-xs font-medium text-[#5A6475] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-[#14213D] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1D2E54] disabled:opacity-50 dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap cursor-pointer"
                >
                  {submitting ? 'Submitting Petition...' : 'Send Extension Request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
