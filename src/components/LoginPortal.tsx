import { useState, type FormEvent } from 'react';
import { BookOpen, GraduationCap, KeyRound, ShieldCheck } from 'lucide-react';
import type { UserProfile, UserRole } from '../shared/types';

interface LoginPortalProps {
  demoUsers: UserProfile[];
  onLogin: (payload: { email: string; passcode: string; role: UserRole }) => Promise<void>;
}

export function LoginPortal({ demoUsers, onLogin }: LoginPortalProps) {
  const [portalRole, setPortalRole] = useState<UserRole>('student');
  const [email, setEmail] = useState('m.lin@verity.edu');
  const [passcode, setPasscode] = useState('verity2026');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleUsers = demoUsers.filter((u) => u.role === portalRole);

  const handleRoleSwitch = (nextRole: UserRole) => {
    setPortalRole(nextRole);
    setError(null);
    const first = demoUsers.find((u) => u.role === nextRole);
    if (first) {
      setEmail(first.email);
      setPasscode('verity2026');
    } else {
      setEmail('');
      setPasscode('');
    }
  };

  const handleDemoFill = (user: UserProfile) => {
    setError(null);
    setEmail(user.email);
    setPasscode('verity2026');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onLogin({ email, passcode, role: portalRole });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1E2430]">
      <header className="border-b border-[#E2DDD3] bg-[#FAF8F4]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-semibold tracking-tight text-[#14213D]">
            Verity Academic
          </span>
          <span className="font-mono text-xs text-[#5A6475]">
            University Coursework &amp; Integrity Portal
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-12 lg:items-start">
        {/* Left Editorial Introduction */}
        <section className="space-y-6 lg:col-span-6 lg:pt-6">
          <p className="font-mono text-xs text-[#5A6475]">
            Separate Student &amp; Faculty Workspaces · Zero-Grade Feedback Workflow
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-[#14213D] [text-wrap:balance]">
            One seamless academic portal for file submissions, AI verification, and timely feedback.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[#5A6475]">
            Students upload real PDF, Word, and text documents directly from their computer with
            live deadline tracking and extension petitions. Lecturers open submitted files inline,
            run AI-authorship and plagiarism checks before responding, and issue verified receipt
            confirmations and written feedback.
          </p>

          <div className="grid grid-cols-1 gap-4 border-t border-[#E2DDD3] pt-6 sm:grid-cols-2">
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-5">
              <GraduationCap className="h-5 w-5 text-[#14213D]" />
              <h2 className="mt-3 font-display text-base font-semibold text-[#14213D]">
                Student Portal
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5A6475]">
                Submit PDF, DOC/DOCX, or TXT files from your computer, track automated deadlines,
                request extensions, and view confirmation receipts and feedback.
              </p>
            </div>
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-5">
              <BookOpen className="h-5 w-5 text-[#14213D]" />
              <h2 className="mt-3 font-display text-base font-semibold text-[#14213D]">
                Lecturer Portal
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5A6475]">
                Open student documents in a built-in viewer, run Gemini AI &amp; cohort plagiarism
                checks prior to feedback, and broadcast instant schedule updates.
              </p>
            </div>
          </div>
        </section>

        {/* Right Separate Role Sign-In Card */}
        <section className="rounded-lg border border-[#E2DDD3] bg-white p-8 lg:col-span-6">
          {/* Role Portal Tabs */}
          <div className="grid grid-cols-2 rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1">
            <button
              type="button"
              onClick={() => handleRoleSwitch('student')}
              className={`flex items-center justify-center gap-2 rounded py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                portalRole === 'student'
                  ? 'bg-white text-[#14213D]'
                  : 'text-[#5A6475] hover:text-[#1E2430]'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Student Login
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('lecturer')}
              className={`flex items-center justify-center gap-2 rounded py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                portalRole === 'lecturer'
                  ? 'bg-white text-[#14213D]'
                  : 'text-[#5A6475] hover:text-[#1E2430]'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Lecturer Login
            </button>
          </div>

          <div className="mt-6">
            <h2 className="font-display text-2xl font-semibold text-[#14213D]">
              {portalRole === 'student'
                ? 'Sign in to Student Dashboard'
                : 'Sign in to Lecturer Dashboard'}
            </h2>
            <p className="mt-1 text-xs text-[#5A6475]">
              {portalRole === 'student'
                ? 'Access your enrolled coursework, file upload portal, and feedback receipts.'
                : 'Access submitted student files, AI detection tools, and course management.'}
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-[#8C2D38]/30 bg-[#8C2D38]/5 px-4 py-3 text-xs text-[#8C2D38]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1E2430]" htmlFor="login-email">
                University Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  portalRole === 'student' ? 'm.lin@verity.edu' : 'e.vance@verity.edu'
                }
                className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1E2430]" htmlFor="login-passcode">
                Portal Passcode
              </label>
              <div className="relative mt-1.5">
                <input
                  id="login-passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter portal passcode"
                  className="w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2.5 font-mono text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none"
                  required
                />
                <KeyRound className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#5A6475]" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-[#14213D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D2E54] disabled:opacity-50 cursor-pointer"
            >
              {submitting
                ? 'Verifying Session...'
                : portalRole === 'student'
                  ? 'Enter Student Dashboard'
                  : 'Enter Lecturer Dashboard'}
            </button>
          </form>

          {/* One-Click Demo Fill */}
          <div className="mt-6 border-t border-[#E2DDD3] pt-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#14213D]">
                One-Click Demo Fill ({portalRole === 'student' ? 'Students' : 'Faculty'})
              </p>
              <span className="flex items-center gap-1 font-mono text-[11px] text-[#5A6475]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1F6E52]" />
                scrypt verified
              </span>
            </div>

            <div className="mt-3 space-y-2">
              {roleUsers.map((user) => {
                const isFilled = email.toLowerCase() === user.email.toLowerCase();
                return (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleDemoFill(user)}
                    className={`flex w-full items-center justify-between rounded-md border px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
                      isFilled
                        ? 'border-[#14213D] bg-[#FAF8F4]'
                        : 'border-[#E2DDD3] bg-white hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#14213D] font-mono text-[11px] font-semibold text-white">
                        {user.avatarInitials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1E2430] truncate">
                          {user.name}
                        </p>
                        <p className="font-mono text-[11px] text-[#5A6475] truncate">
                          {user.email}
                          {user.studentCode ? ` · ${user.studentCode}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-medium text-[#14213D] shrink-0">
                      {isFilled ? 'Selected' : 'Fill'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
