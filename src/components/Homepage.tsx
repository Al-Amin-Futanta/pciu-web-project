import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { submitContactInquiry } from '../lib/api';

interface HomepageProps {
  onNavigateLogin: () => void;
  onScrollSection: (sectionId: 'about' | 'contact') => void;
}

const HERO_IMAGE_PATH = '/src/assets/images/hero_university_campus_1795537556542.jpg';

export function Homepage({ onNavigateLogin, onScrollSection }: HomepageProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleLabel, setRoleLabel] = useState('Student');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    submittedAt: string;
  } | null>(null);

  const handleContactSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setContactError(null);
    setSubmitting(true);
    try {
      const result = await submitContactInquiry({
        fullName,
        email,
        roleLabel,
        message,
      });
      setConfirmation({ id: result.id, submittedAt: result.createdAt });
      setFullName('');
      setEmail('');
      setMessage('');
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : 'Unable to send your message right now.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FAF8F4] text-[#1E2430] dark:bg-[#0B1120] dark:text-white">
      {/* HERO SECTION */}
      <section className="mx-auto max-w-[1380px] px-6 py-12 lg:py-16">
        <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
          <div className="flex flex-col justify-center space-y-6 lg:col-span-6">
            <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
              University Coursework &amp; Academic Integrity Ecosystem
            </p>
            <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-semibold leading-[1.1] tracking-tight text-[#14213D] dark:text-white [text-wrap:balance]">
              Seamless digital coursework, verified with human oversight.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#5A6475] dark:text-white/85">
              Verity Academic replaces fragmented paper hand-ins and disconnected review tools with
              one unified portal. Students upload real documents directly from their computer, while
              lecturers open files inline, run AI and plagiarism verification prior to feedback,
              and confirm receipt without manual administrative overhead.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={onNavigateLogin}
                className="inline-flex items-center gap-2 rounded-md bg-[#14213D] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1D2E54] dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap cursor-pointer"
              >
                <span>Open Portal Login</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onScrollSection('about')}
                className="inline-flex items-center rounded-md border border-[#E2DDD3] bg-white px-5 py-3 text-sm font-medium text-[#14213D] transition-colors hover:bg-[#F2EFE9] dark:border-[#293752] dark:bg-[#131C2E] dark:text-white dark:hover:bg-[#1A263D] whitespace-nowrap cursor-pointer"
              >
                Learn About the Portal
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[280px] overflow-hidden rounded-lg border border-[#E2DDD3] bg-[#F2EFE9] dark:border-[#293752] dark:bg-[#131C2E]">
              {!imgFailed ? (
                <img
                  src={HERO_IMAGE_PATH}
                  alt="Students working with laptops and notebooks inside a quiet sunlit university reading hall"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center p-8 text-center">
                  <BookOpen className="h-10 w-10 text-[#14213D] dark:text-white" />
                  <p className="mt-3 font-display text-lg font-semibold text-[#14213D] dark:text-white">
                    Verity Academic Reading Hall
                  </p>
                  <p className="mt-1 text-xs text-[#5A6475] dark:text-white/80">
                    Dedicated Student &amp; Faculty Submission Environment
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section
        id="about"
        className="border-t border-[#E2DDD3] bg-white py-16 dark:border-[#293752] dark:bg-[#131C2E]"
      >
        <div className="mx-auto max-w-[1380px] px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
                About Verity Academic
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#14213D] dark:text-white [text-wrap:balance]">
                Designed for university rigor without paper bottlenecks.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#5A6475] dark:text-white/85">
                Every workflow is built around separate Student and Faculty workspaces, strict
                server-side data isolation, and transparent communication from upload to receipt
                confirmation.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-8">
              <article className="rounded-lg border border-[#E2DDD3] bg-[#FAF8F4] p-6 dark:border-[#293752] dark:bg-[#0B1120]">
                <h3 className="font-display text-lg font-semibold text-[#14213D] dark:text-white">
                  01. Direct Computer File Submissions
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5A6475] dark:text-white/85">
                  Students upload real PDF, Word (.doc/.docx), and plain-text (.txt) assignments
                  directly from their PC or laptop with optional submission notes and instant server
                  timestamps.
                </p>
              </article>

              <article className="rounded-lg border border-[#E2DDD3] bg-[#FAF8F4] p-6 dark:border-[#293752] dark:bg-[#0B1120]">
                <h3 className="font-display text-lg font-semibold text-[#14213D] dark:text-white">
                  02. Built-In Viewer &amp; AI Detection Gate
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5A6475] dark:text-white/85">
                  Lecturers open submitted student documents inline or download originals, then run
                  sentence-level AI-authorship and cohort plagiarism checks before sending feedback.
                </p>
              </article>

              <article className="rounded-lg border border-[#E2DDD3] bg-[#FAF8F4] p-6 dark:border-[#293752] dark:bg-[#0B1120]">
                <h3 className="font-display text-lg font-semibold text-[#14213D] dark:text-white">
                  03. Receipt Confirmation &amp; Written Feedback
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5A6475] dark:text-white/85">
                  Focused entirely on constructive feedback rather than automated scoring—students
                  receive verified confirmation receipts, instructor notes, and revision requests.
                </p>
              </article>

              <article className="rounded-lg border border-[#E2DDD3] bg-[#FAF8F4] p-6 dark:border-[#293752] dark:bg-[#0B1120]">
                <h3 className="font-display text-lg font-semibold text-[#14213D] dark:text-white">
                  04. Live Deadlines, Alerts &amp; Private Messaging
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5A6475] dark:text-white/85">
                  Automated countdown timers track due dates in real time, cancellation or update
                  notices reach students immediately, and confidential 1:1 threads link directly to
                  each course.
                </p>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT US SECTION */}
      <section
        id="contact"
        className="border-t border-[#E2DDD3] bg-[#FAF8F4] py-16 dark:border-[#293752] dark:bg-[#0B1120]"
      >
        <div className="mx-auto max-w-[1380px] px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* Left Academic Contact Directory */}
            <div className="space-y-6 lg:col-span-5">
              <div>
                <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
                  Contact Us
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-[#14213D] dark:text-white [text-wrap:balance]">
                  Academic Support &amp; Department Inquiries
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5A6475] dark:text-white/85">
                  Need onboarding assistance for your department, student account verification, or
                  file submission help? Reach our Academic Technology Desk directly.
                </p>
              </div>

              <div className="space-y-4 border-t border-[#E2DDD3] pt-6 text-sm dark:border-[#293752]">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#14213D] dark:text-white" />
                  <div>
                    <p className="font-semibold text-[#14213D] dark:text-white">
                      Portal Support Desk
                    </p>
                    <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
                      support@verity.edu · registrar@verity.edu
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#14213D] dark:text-white" />
                  <div>
                    <p className="font-semibold text-[#14213D] dark:text-white">
                      Campus Administration Office
                    </p>
                    <p className="text-xs text-[#5A6475] dark:text-white/80">
                      Alder Hall, Suite 210 · Office of Academic Computing
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#14213D] dark:text-white" />
                  <div>
                    <p className="font-semibold text-[#14213D] dark:text-white">Support Hours</p>
                    <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
                      Monday – Friday · 08:30 – 17:30 University Local Time
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1F6E52] dark:text-white" />
                  <div>
                    <p className="font-semibold text-[#14213D] dark:text-white">
                      Data Privacy &amp; Security
                    </p>
                    <p className="text-xs text-[#5A6475] dark:text-white/80">
                      Role-scoped access control protects all student files and private instructor
                      correspondence.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Working Contact Form */}
            <div className="rounded-lg border border-[#E2DDD3] bg-white p-8 dark:border-[#293752] dark:bg-[#131C2E] lg:col-span-7">
              <h3 className="font-display text-xl font-semibold text-[#14213D] dark:text-white">
                Send an Inquiry
              </h3>
              <p className="mt-1 text-xs text-[#5A6475] dark:text-white/80">
                Messages are logged directly with our Academic Support Desk for timely follow-up.
              </p>

              {confirmation && (
                <div className="mt-5 flex items-start gap-3 rounded-md border border-[#1F6E52]/35 bg-[#1F6E52]/10 p-4 dark:border-emerald-400/40 dark:bg-emerald-500/15">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#1F6E52] dark:text-white" />
                  <div>
                    <p className="text-sm font-semibold text-[#1F6E52] dark:text-white">
                      Inquiry Received ({confirmation.id})
                    </p>
                    <p className="mt-0.5 text-xs text-[#1E2430] dark:text-white/90">
                      Thank you for contacting Verity Academic. Our support team has recorded your
                      message and will reply via university email.
                    </p>
                  </div>
                </div>
              )}

              {contactError && (
                <div className="mt-5 rounded-md border border-[#8C2D38]/35 bg-[#8C2D38]/10 px-4 py-3 text-xs text-[#8C2D38] dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-white">
                  {contactError}
                </div>
              )}

              <form onSubmit={handleContactSubmit} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-xs font-semibold text-[#1E2430] dark:text-white"
                    >
                      Full Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g., Jordan Patel"
                      className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1E2430] placeholder:text-[#5A6475]/70 focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-xs font-semibold text-[#1E2430] dark:text-white"
                    >
                      University Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@verity.edu"
                      className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1E2430] placeholder:text-[#5A6475]/70 focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contact-role"
                    className="block text-xs font-semibold text-[#1E2430] dark:text-white"
                  >
                    Role / Affiliation
                  </label>
                  <select
                    id="contact-role"
                    value={roleLabel}
                    onChange={(e) => setRoleLabel(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2.5 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:focus:border-white"
                  >
                    <option value="Student">Student</option>
                    <option value="Lecturer / Faculty">Lecturer / Faculty</option>
                    <option value="Department Administrator">Department Administrator</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-xs font-semibold text-[#1E2430] dark:text-white"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    placeholder="Share your question regarding courses, submissions, or faculty onboarding..."
                    className="mt-1.5 w-full rounded-md border border-[#E2DDD3] bg-[#FAF8F4] p-3.5 text-sm text-[#1E2430] placeholder:text-[#5A6475]/70 focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                    required
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-md bg-[#14213D] px-6 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#1D2E54] disabled:opacity-50 dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 cursor-pointer"
                  >
                    {submitting ? 'Sending Inquiry...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* QUIET FOOTER */}
      <footer className="border-t border-[#E2DDD3] bg-white py-8 dark:border-[#293752] dark:bg-[#131C2E]">
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-4 px-6 text-xs text-[#5A6475] dark:text-white/80">
          <span className="font-display text-sm font-semibold text-[#14213D] dark:text-white">
            Verity Academic
          </span>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => onScrollSection('about')}
              className="hover:text-[#14213D] dark:hover:text-white cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => onScrollSection('contact')}
              className="hover:text-[#14213D] dark:hover:text-white cursor-pointer"
            >
              Contact Us
            </button>
            <button
              type="button"
              onClick={onNavigateLogin}
              className="hover:text-[#14213D] dark:hover:text-white cursor-pointer"
            >
              Portal Login
            </button>
          </div>
          <span className="font-mono text-[11px]">
            © 2026 Verity University Portal
          </span>
        </div>
      </footer>
    </div>
  );
}
