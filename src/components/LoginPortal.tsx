import { useState, type FormEvent } from 'react';
import { ArrowLeft, BookOpen, GraduationCap, KeyRound, ShieldCheck } from 'lucide-react';
import type { UserProfile, UserRole } from '../shared/types';

interface LoginPortalProps {
  demoUsers: UserProfile[];
  onLogin: (payload: { email: string; passcode: string; role: UserRole }) => Promise<void>;
  onBackHome: () => void;
}

export function LoginPortal({ demoUsers, onLogin, onBackHome }: LoginPortalProps) {
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
    <div className="min-h-[calc(100vh-73px)] bg-[#FAF8F4] text-[#1E2430] dark:bg-[#0B1120] dark:text-white">
      <main className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-6 py-12 lg:grid-cols-12 lg:items-start">
        {/* Left Role Overview */}
        <section className="space-y-6 lg:col-span-6 lg:pt-4">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5A6475] transition-colors hover:text-[#14213D] dark:text-white/80 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Homepage
          </button>

          <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
            Portal Login · Separate Student &amp; Faculty Access
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-[#14213D] dark:text-white [text-wrap:balance]">
            Sign in to your Student or Lecturer portal.
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[#5A6475] dark:text-white/85">
            Select your portal tab on the right to enter either the Student file-submission
            dashboard or the Lecturer AI-verification and feedback studio.
          </p>

          <div className="grid grid-cols-1 gap-4 border-t border-[#E2DDD3] pt-6 dark:border-[#293752] sm:grid-cols-2">
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-5 dark:border-[#293752] dark:bg-[#131C2E]">
              <GraduationCap className="h-5 w-5 text-[#14213D] dark:text-white" />
              <h2 className="mt-3 font-display text-base font-semibold text-[#14213D] dark:text-white">
                Student Dashboard
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5A6475] dark:text-white/80">
                Upload PDF, DOC/DOCX, or TXT files from your computer, track deadlines, and read
                receipt confirmations and written feedback.
              </p>
            </div>
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-5 dark:border-[#293752] dark:bg-[#131C2E]">
              <BookOpen className="h-5 w-5 text-[#14213D] dark:text-white" />
              <h2 className="mt-3 font-display text-base font-semibold text-[#14213D] dark:text-white">
                Lecturer Dashboard
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[#5A6475] dark:text-white/80">
                Open student documents inline, run AI detection checks before sending feedback, and
                manage course assignments.
              </p>
            </div>
          </div>
        </section>

        {/* Right Separate Role Sign-In Card */}
        <section className="rounded-lg border border-[#E2DDD3] bg-white p-8 dark:border-[#293752] dark:bg-[#131C2E] lg:col-span-6">
          {/* Role Portal Tabs */}
          <div className="grid grid-cols-2 rounded-md border border-[#E2DDD3] bg-[#F2EFE9] p-1 dark:border-[#293752] dark:bg-[#0B1120]">
            <button
              type="button"
              onClick={() => handleRoleSwitch('student')}
              className={`flex items-center justify-center gap-2 rounded py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
                portalRole === 'student'
                  ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                  : 'text-[#5A6475] hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white'
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
                  ? 'bg-white text-[#14213D] dark:bg-[#1A263D] dark:text-white'
                  : 'text-[#5A6475] hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Lecturer Login
            </button>
          </div>

          <div className="mt-6">
            <h2 className="font-display text-2xl font-semibold text-[#14213D] dark:text-white">
              {portalRole === 'student'
                ? 'Sign in to Student Dashboard'
                : 'Sign in to Lecturer Dashboard'}
            </h2>
            <p className="mt-1 text-xs text-[#5A6475] dark:text-white/80">
              {portalRole === 'student'
                ? 'Access your enrolled coursework, file upload portal, and feedback receipts.'
                : 'Access submitted student files, AI detection tools, and course management.'}
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-[#8C2D38]/30 bg-[#8C2D38]/5 px-4 py-3 text-xs text-[#8C2D38] dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-white">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                className="block text-xs font-semibold text-[#1E2430] dark:text-white"
                htmlFor="login-email"
              >
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
                className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:focus:border-white"
                required
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold text-[#1E2430] dark:text-white"
                htmlFor="login-passcode"
              >
                Portal Passcode
              </label>
              <div className="relative mt-1.5">
                <input
                  id="login-passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter portal passcode"
                  className="w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2.5 font-mono text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:focus:border-white"
                  required
                />
                <KeyRound className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#5A6475] dark:text-white/80" />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-[#14213D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D2E54] disabled:opacity-50 dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 cursor-pointer"
            >
              {submitting
                ? 'Verifying Session...'
                : portalRole === 'student'
                  ? 'Enter Student Dashboard'
                  : 'Enter Lecturer Dashboard'}
            </button>
          </form>

          {/* One-Click Demo Fill */}
          <div className="mt-6 border-t border-[#E2DDD3] pt-5 dark:border-[#293752]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#14213D] dark:text-white">
                One-Click Demo Fill ({portalRole === 'student' ? 'Students' : 'Faculty'})
              </p>
              <span className="flex items-center gap-1 font-mono text-[11px] text-[#5A6475] dark:text-white/80">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1F6E52] dark:text-white" />
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
                        ? 'border-[#14213D] bg-[#FAF8F4] dark:border-white dark:bg-[#1A263D]'
                        : 'border-[#E2DDD3] bg-white hover:bg-[#FAF8F4] dark:border-[#293752] dark:bg-[#0B1120] dark:hover:bg-[#1A263D]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#14213D] font-mono text-[11px] font-semibold text-white dark:bg-white dark:text-[#14213D]">
                        {user.avatarInitials}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[#1E2430] dark:text-white truncate">
                          {user.name}
                        </p>
                        <p className="font-mono text-[11px] text-[#5A6475] dark:text-white/75 truncate">
                          {user.email}
                          {user.studentCode ? ` · ${user.studentCode}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-medium text-[#14213D] dark:text-white shrink-0">
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
