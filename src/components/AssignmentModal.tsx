import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { Assignment, Course } from '../shared/types';
import { toLocalDateTimeInput } from '../lib/time';

interface AssignmentModalProps {
  mode: 'create' | 'edit';
  courses: Course[];
  assignment?: Assignment | null;
  onClose: () => void;
  onCreate: (payload: {
    courseId: string;
    title: string;
    description: string;
    instructions: string;
    dueAt: string;
    allowResubmission: boolean;
  }) => Promise<void>;
  onUpdate: (
    id: string,
    payload: {
      title?: string;
      instructions?: string;
      dueAt?: string;
      status?: 'active' | 'modified' | 'canceled';
      modificationNote?: string;
    }
  ) => Promise<void>;
}

export function AssignmentModal({
  mode,
  courses,
  assignment,
  onClose,
  onCreate,
  onUpdate,
}: AssignmentModalProps) {
  const defaultDue = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  const [courseId, setCourseId] = useState(assignment?.courseId ?? courses[0]?.id ?? '');
  const [title, setTitle] = useState(assignment?.title ?? '');
  const [description, setDescription] = useState(assignment?.description ?? '');
  const [instructions, setInstructions] = useState(assignment?.instructions ?? '');
  const [dueLocal, setDueLocal] = useState(
    toLocalDateTimeInput(assignment?.dueAt ?? defaultDue)
  );
  const [allowResubmission, setAllowResubmission] = useState(
    assignment?.allowResubmission ?? true
  );
  const [modificationNote, setModificationNote] = useState(
    assignment?.modificationNote ?? ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const isoDue = new Date(dueLocal).toISOString();
      if (mode === 'create') {
        await onCreate({
          courseId,
          title,
          description: description || title,
          instructions,
          dueAt: isoDue,
          allowResubmission,
        });
      } else if (assignment) {
        await onUpdate(assignment.id, {
          title,
          instructions,
          dueAt: isoDue,
          status: 'modified',
          modificationNote:
            modificationNote.trim() || 'Instructor updated assignment guidelines and deadline.',
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAssignment = async () => {
    if (!assignment) return;
    setError(null);
    setSubmitting(true);
    try {
      await onUpdate(assignment.id, {
        status: 'canceled',
        modificationNote:
          modificationNote.trim() || 'Assignment canceled by instructor; no file upload required.',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14213D]/30 p-4 backdrop-blur-[1px] dark:bg-black/65">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#E2DDD3] bg-white shadow-xl dark:border-[#293752] dark:bg-[#131C2E]">
        <div className="flex items-center justify-between border-b border-[#E2DDD3] px-6 py-4 dark:border-[#293752]">
          <div>
            <h2 className="font-display text-xl font-semibold text-[#14213D] dark:text-white">
              {mode === 'create' ? 'Publish New Assignment' : 'Modify or Cancel Assignment'}
            </h2>
            <p className="mt-0.5 text-xs text-[#5A6475] dark:text-white/80">
              {mode === 'create'
                ? 'Students upload PDF, DOC/DOCX, or TXT files directly from their computer and receive confirmation & written feedback.'
                : 'Changes or cancellations dispatch instant real-time alerts to all enrolled students.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-md p-1.5 text-[#5A6475] hover:bg-[#F2EFE9] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error && (
            <div className="rounded-md border border-[#8C2D38]/30 bg-[#8C2D38]/5 px-4 py-3 text-sm text-[#8C2D38] dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-white">
              {error}
            </div>
          )}

          {mode === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                Course
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:focus:border-white"
                required
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
              Assignment Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Algorithmic Governance Policy Brief"
              className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
              required
            />
          </div>

          {mode === 'create' && (
            <div>
              <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                Short Summary
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="One-line overview visible in the student dashboard"
                className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
              Submission Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              placeholder="Specify required document focus, accepted formats (PDF, DOC/DOCX, TXT), and citation expectations."
              className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                Submission Deadline
              </label>
              <input
                type="datetime-local"
                value={dueLocal}
                onChange={(e) => setDueLocal(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 font-mono text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:focus:border-white"
                required
              />
            </div>

            {mode === 'create' ? (
              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2.5 text-sm text-[#1E2430] dark:text-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowResubmission}
                    onChange={(e) => setAllowResubmission(e.target.checked)}
                    className="h-4 w-4 accent-[#14213D] dark:accent-white"
                  />
                  Allow file resubmissions before deadline
                </label>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#1E2430] dark:text-white">
                  Student Alert Note
                </label>
                <input
                  type="text"
                  value={modificationNote}
                  onChange={(e) => setModificationNote(e.target.value)}
                  placeholder="Reason for deadline shift or cancellation"
                  className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-2 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2DDD3] pt-4 dark:border-[#293752]">
            {mode === 'edit' && assignment?.status !== 'canceled' ? (
              <button
                type="button"
                disabled={submitting}
                onClick={handleCancelAssignment}
                className="rounded-md border border-[#8C2D38]/40 bg-[#8C2D38]/5 px-4 py-2 text-xs font-semibold text-[#8C2D38] hover:bg-[#8C2D38]/10 dark:border-rose-400/50 dark:bg-rose-500/15 dark:text-white dark:hover:bg-rose-500/25 whitespace-nowrap cursor-pointer"
              >
                Cancel Assignment &amp; Alert Class
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[#E2DDD3] px-4 py-2 text-xs font-medium text-[#5A6475] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-md bg-[#14213D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D2E54] disabled:opacity-50 dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap cursor-pointer"
              >
                {submitting
                  ? 'Saving...'
                  : mode === 'create'
                    ? 'Publish Assignment'
                    : 'Save Changes & Notify Class'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
