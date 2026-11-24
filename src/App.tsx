import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, Plus, X } from 'lucide-react';
import type {
  Assignment,
  BootstrapPayload,
  NotificationItem,
  PrivateMessage,
  ReviewStatus,
  UserProfile,
  UserRole,
} from './shared/types';
import {
  acknowledgeFeedback,
  buildWebSocketUrl,
  createAssignment,
  decideExtension,
  fetchBootstrap,
  fetchDemoUsers,
  getAuthToken,
  loginWithCredentials,
  logoutSession,
  markNotificationsRead,
  markPeerMessagesRead,
  requestExtension,
  runIntegrityScan,
  saveSubmissionReview,
  sendPrivateMessage,
  submitAssignmentFile,
  updateAssignment,
} from './lib/api';
import { AssignmentModal } from './components/AssignmentModal';
import { AuditLogView } from './components/AuditLogView';
import { ExtensionsView } from './components/ExtensionsView';
import { Homepage } from './components/Homepage';
import { LecturerDashboard } from './components/LecturerDashboard';
import { LecturerInspector } from './components/LecturerInspector';
import { LoginPortal } from './components/LoginPortal';
import { MessagesView } from './components/MessagesView';
import { NotificationDrawer } from './components/NotificationDrawer';
import { StudentDashboard } from './components/StudentDashboard';
import { SubmissionModal } from './components/SubmissionModal';
import { TopNav, type NavTab, type PublicView } from './components/TopNav';

export default function App() {
  const [demoUsers, setDemoUsers] = useState<UserProfile[]>([]);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const [publicView, setPublicView] = useState<PublicView>('home');
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('verity_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [notifOpen, setNotifOpen] = useState(false);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const [assignmentModal, setAssignmentModal] = useState<{
    mode: 'create' | 'edit';
    assignment?: Assignment | null;
  } | null>(null);
  const [submissionModal, setSubmissionModal] = useState<{
    assignment: Assignment;
    initialTab: 'submit' | 'extension';
  } | null>(null);
  const [inspectSubmissionId, setInspectSubmissionId] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<{
    peerId: string;
    assignmentId: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((title: string, body: string) => {
    setToast({ title, body });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const payload = await fetchBootstrap();
    setData(payload);
    return payload;
  }, []);

  const connectWebSocket = useCallback(
    (token: string) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const ws = new WebSocket(buildWebSocketUrl(token));
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            event: string;
            payload?: unknown;
          };

          if (msg.event === 'notification:new' && msg.payload) {
            const notif = msg.payload as NotificationItem;
            setData((prev) => {
              if (!prev) return prev;
              if (prev.notifications.some((n) => n.id === notif.id)) return prev;
              return {
                ...prev,
                notifications: [notif, ...prev.notifications],
              };
            });
            showToast(notif.title, notif.body);
          } else if (msg.event === 'message:received' && msg.payload) {
            const incoming = msg.payload as PrivateMessage;
            setData((prev) => {
              if (!prev) return prev;
              if (prev.messages.some((m) => m.id === incoming.id)) return prev;
              return {
                ...prev,
                messages: [...prev.messages, incoming],
              };
            });
          } else if (msg.event === 'workspace:sync') {
            refreshBootstrap().catch(() => {});
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = (ev) => {
        if (ev.code !== 4001 && getAuthToken() === token) {
          window.setTimeout(() => {
            if (getAuthToken() === token) {
              connectWebSocket(token);
            }
          }, 3000);
        }
      };
    },
    [refreshBootstrap, showToast]
  );

  // Load public demo directory for the separate Login Portal
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const users = await fetchDemoUsers();
        if (active) setDemoUsers(users);
      } catch (err) {
        if (active) {
          setInitError(err instanceof Error ? err.message : 'Unable to reach portal server.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      wsRef.current?.close();
    };
  }, []);

  // Sync Dark / Bright mode across Homepage, Portal Login, and all dashboards
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      window.localStorage.setItem('verity_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage access restriction
    }
  }, [darkMode]);

  // Automated deadline countdown ticker
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const scrollToSection = useCallback((sectionId: 'about' | 'contact') => {
    window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }, []);

  const handleSelectPublicView = useCallback(
    (view: PublicView, sectionId?: 'about' | 'contact') => {
      setPublicView(view);
      if (view === 'home') {
        if (sectionId) {
          scrollToSection(sectionId);
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [scrollToSection]
  );

  const handleLogin = async (payload: {
    email: string;
    passcode: string;
    role: UserRole;
  }) => {
    const { token } = await loginWithCredentials(payload);
    await refreshBootstrap();
    setActiveTab('dashboard');
    setInspectSubmissionId(null);
    setMessageTarget(null);
    connectWebSocket(token);
  };

  const handleSignOut = () => {
    wsRef.current?.close();
    wsRef.current = null;
    logoutSession();
    setData(null);
    setPublicView('login');
    setActiveTab('dashboard');
    setNotifOpen(false);
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] text-[#1E2430] dark:bg-[#0B1120] dark:text-white">
        <TopNav
          currentUser={null}
          publicView={publicView}
          activeTab={activeTab}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onSelectPublicView={handleSelectPublicView}
          onSelectTab={setActiveTab}
          onSignOut={handleSignOut}
          unreadMessages={0}
          pendingExtensions={0}
        />
        <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-12">
          <div className="h-12 w-56 animate-pulse rounded-md bg-[#E2DDD3]/60 dark:bg-[#1A263D]" />
          <div className="h-96 animate-pulse rounded-lg border border-[#E2DDD3] bg-white dark:border-[#293752] dark:bg-[#131C2E]" />
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] text-[#1E2430] dark:bg-[#0B1120] dark:text-white">
        <TopNav
          currentUser={null}
          publicView={publicView}
          activeTab={activeTab}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onSelectPublicView={handleSelectPublicView}
          onSelectTab={setActiveTab}
          onSignOut={handleSignOut}
          unreadMessages={0}
          pendingExtensions={0}
        />
        <div className="flex min-h-[calc(100vh-73px)] items-center justify-center p-6">
          <div className="max-w-md rounded-lg border border-[#E2DDD3] bg-white p-8 text-center dark:border-[#293752] dark:bg-[#131C2E]">
            <AlertTriangle className="mx-auto h-8 w-8 text-[#8C2D38] dark:text-rose-400" />
            <h1 className="mt-3 font-display text-xl font-semibold text-[#14213D] dark:text-white">
              Portal Connection Error
            </h1>
            <p className="mt-2 text-sm text-[#5A6475] dark:text-white/80">{initError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-md bg-[#14213D] px-4 py-2 text-xs font-semibold text-white dark:bg-white dark:text-[#14213D] cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Public visitors see Clean Homepage (About & Contact Us) or separate Portal Login page
  if (!data) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] text-[#1E2430] dark:bg-[#0B1120] dark:text-white">
        <TopNav
          currentUser={null}
          publicView={publicView}
          activeTab={activeTab}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onSelectPublicView={handleSelectPublicView}
          onSelectTab={setActiveTab}
          onSignOut={handleSignOut}
          unreadMessages={0}
          pendingExtensions={0}
        />

        {publicView === 'home' ? (
          <Homepage
            onNavigateLogin={() => handleSelectPublicView('login')}
            onScrollSection={scrollToSection}
          />
        ) : (
          <LoginPortal
            demoUsers={demoUsers}
            onLogin={handleLogin}
            onBackHome={() => handleSelectPublicView('home')}
          />
        )}
      </div>
    );
  }

  const {
    currentUser,
    peers,
    courses,
    assignments,
    submissions,
    integrityReports,
    reviews,
    extensions,
    messages,
    notifications,
    auditLogs,
  } = data;

  const unreadNotifs = notifications.filter((n) => !n.isRead);
  const unreadUrgentAlerts = unreadNotifs.filter(
    (n) => n.type === 'assignment_canceled' || n.type === 'assignment_modified'
  );
  const unreadMessagesCount = messages.filter(
    (m) => m.recipientId === currentUser.id && !m.isRead
  ).length;
  const pendingExtensionsCount = extensions.filter((e) => e.status === 'pending').length;

  // Handlers
  const handleCreateAssignment = async (payload: {
    courseId: string;
    title: string;
    description: string;
    instructions: string;
    dueAt: string;
    allowResubmission: boolean;
  }) => {
    await createAssignment(payload);
    await refreshBootstrap();
    showToast('Assignment Published', `"${payload.title}" is now live for enrolled students.`);
  };

  const handleUpdateAssignment = async (
    id: string,
    payload: {
      title?: string;
      instructions?: string;
      dueAt?: string;
      status?: 'active' | 'modified' | 'canceled';
      modificationNote?: string;
    }
  ) => {
    await updateAssignment(id, payload);
    await refreshBootstrap();
    showToast(
      payload.status === 'canceled' ? 'Assignment Canceled' : 'Assignment Updated',
      'Instant alerts have been dispatched to all enrolled students.'
    );
  };

  const handleSubmitFile = async (params: {
    assignmentId: string;
    file: File;
    studentNote?: string;
  }) => {
    const result = await submitAssignmentFile(params);
    await refreshBootstrap();
    showToast(
      `File Received (${result.fileName})`,
      `Version ${result.version} (${result.wordCount} words) archived with server timestamp receipt.`
    );
  };

  const handleRequestExtension = async (payload: {
    assignmentId: string;
    requestedDueAt: string;
    reason: string;
  }) => {
    await requestExtension(payload);
    await refreshBootstrap();
    showToast('Extension Petition Sent', 'Your instructor has been notified in real time.');
  };

  const handleRunScan = async (submissionId: string) => {
    await runIntegrityScan(submissionId);
    await refreshBootstrap();
    showToast(
      'AI & Plagiarism Check Complete',
      'Sentence-level highlights verified. Receipt confirmation & feedback is now unlocked.'
    );
  };

  const handleSaveReview = async (
    submissionId: string,
    payload: { reviewStatus: ReviewStatus; feedback: string }
  ) => {
    await saveSubmissionReview(submissionId, payload);
    await refreshBootstrap();
    showToast(
      payload.reviewStatus === 'revision_requested'
        ? 'Revision Requested'
        : 'Receipt Confirmed & Feedback Sent',
      'The student has been notified with your confirmation and written feedback.'
    );
  };

  const handleAcknowledgeFeedback = async (submissionId: string, note: string) => {
    await acknowledgeFeedback(submissionId, note);
    await refreshBootstrap();
    showToast('Reply Delivered', 'Your instructor received your feedback acknowledgment.');
  };

  const handleDecideExtension = async (
    id: string,
    payload: { status: 'approved' | 'denied'; lecturerNote: string }
  ) => {
    await decideExtension(id, payload);
    await refreshBootstrap();
    showToast(
      `Extension ${payload.status === 'approved' ? 'Approved' : 'Declined'}`,
      'Student deadline and notification status updated immediately.'
    );
  };

  const handleSendMessage = async (payload: {
    recipientId: string;
    courseId: string;
    assignmentId?: string | null;
    body: string;
  }) => {
    await sendPrivateMessage(payload);
    await refreshBootstrap();
  };

  const handleMarkAllRead = async () => {
    await markNotificationsRead();
    await refreshBootstrap();
  };

  const handleSelectNotification = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markNotificationsRead(notif.id);
      await refreshBootstrap();
    }
    setNotifOpen(false);
    if (notif.type === 'new_message') {
      setActiveTab('messages');
    } else if (notif.type === 'extension_requested' || notif.type === 'extension_decision') {
      setActiveTab('extensions');
    } else if (notif.type === 'feedback_posted' || notif.type === 'submission_received') {
      if (notif.linkAssignmentId) {
        const sub = submissions.find((s) => s.assignmentId === notif.linkAssignmentId);
        if (sub) setInspectSubmissionId(sub.id);
      }
      setActiveTab('submissions');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleMarkPeerRead = async (peerId: string) => {
    await markPeerMessagesRead(peerId);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map((m) =>
          m.senderId === peerId && m.recipientId === currentUser.id
            ? { ...m, isRead: true }
            : m
        ),
      };
    });
  };

  const mastheadTitle = () => {
    if (currentUser.role === 'lecturer') {
      if (activeTab === 'dashboard') return 'Lecturer Coursework & Submission Queue';
      if (activeTab === 'submissions') return 'Document Viewer, AI Check & Feedback';
      if (activeTab === 'extensions') return 'Student Extension Petitions';
      if (activeTab === 'messages') return 'Student Correspondence';
      return 'Security & Integrity Audit Ledger';
    }
    if (activeTab === 'dashboard') return 'Student Coursework & File Upload Portal';
    if (activeTab === 'submissions') return 'Submission Receipts & Instructor Feedback';
    if (activeTab === 'extensions') return 'Deadline Extension Petitions';
    return 'Instructor Correspondence';
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#1E2430] dark:bg-[#0B1120] dark:text-white">
      <TopNav
        currentUser={currentUser}
        publicView={publicView}
        activeTab={activeTab}
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onSelectPublicView={handleSelectPublicView}
        onSelectTab={setActiveTab}
        onSignOut={handleSignOut}
        unreadMessages={unreadMessagesCount}
        pendingExtensions={pendingExtensionsCount}
      />

      <main className="mx-auto max-w-[1380px] px-6 py-8">
        {/* Urgent Real-Time Alert Strip for Students (Assignment Canceled / Modified) */}
        {currentUser.role === 'student' && unreadUrgentAlerts.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#8C2D38]/35 bg-white px-5 py-4 dark:border-rose-400/40 dark:bg-[#131C2E]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#8C2D38] dark:text-white" />
              <div>
                <p className="text-sm font-semibold text-[#8C2D38] dark:text-white">
                  {unreadUrgentAlerts[0].title}
                </p>
                <p className="mt-0.5 text-xs text-[#1E2430] dark:text-white/85">
                  {unreadUrgentAlerts[0].body}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectNotification(unreadUrgentAlerts[0])}
                className="rounded-md border border-[#8C2D38]/35 px-3 py-1.5 text-xs font-semibold text-[#8C2D38] hover:bg-[#8C2D38]/5 dark:border-rose-400/50 dark:text-white dark:hover:bg-rose-500/20 cursor-pointer"
              >
                Review Update
              </button>
              <button
                type="button"
                onClick={async () => {
                  await markNotificationsRead(unreadUrgentAlerts[0].id);
                  await refreshBootstrap();
                }}
                aria-label="Dismiss alert"
                className="rounded p-1 text-[#5A6475] hover:bg-[#F2EFE9] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Workspace Masthead & Secondary Toolbar */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-6 border-b border-[#E2DDD3] pb-6 dark:border-[#293752]">
          <div>
            <p className="font-mono text-xs text-[#5A6475] dark:text-white/80">
              {currentUser.role === 'lecturer' ? 'Lecturer Portal' : 'Student Portal'} ·{' '}
              {currentUser.name} · {currentUser.department}
              {currentUser.studentCode ? ` · ${currentUser.studentCode}` : ''}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-semibold tracking-tight text-[#14213D] dark:text-white [text-wrap:balance]">
              {mastheadTitle()}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="flex items-center gap-2 rounded-md border border-[#E2DDD3] bg-white px-3.5 py-2 text-xs font-medium text-[#1E2430] hover:border-[#14213D]/40 dark:border-[#293752] dark:bg-[#131C2E] dark:text-white dark:hover:border-white/50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bell className="h-3.5 w-3.5 text-[#14213D] dark:text-white" />
              <span>Alerts</span>
              {unreadNotifs.length > 0 && (
                <span className="font-mono font-semibold text-[#8C2D38] dark:text-rose-300 tabular-nums">
                  ({unreadNotifs.length})
                </span>
              )}
            </button>

            {currentUser.role === 'lecturer' && (
              <button
                type="button"
                onClick={() => setAssignmentModal({ mode: 'create', assignment: null })}
                className="flex items-center gap-1.5 rounded-md bg-[#14213D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D2E54] dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Publish Assignment
              </button>
            )}
          </div>
        </div>

        {/* SEPARATE PORTAL ROUTING: STUDENT DASHBOARD vs LECTURER DASHBOARD */}
        {currentUser.role === 'student' ? (
          <>
            {(activeTab === 'dashboard' || activeTab === 'submissions') && (
              <StudentDashboard
                currentUser={currentUser}
                courses={courses}
                assignments={assignments}
                submissions={submissions}
                reviews={reviews}
                unreadMessagesCount={unreadMessagesCount}
                nowMs={nowMs}
                mode={activeTab}
                onOpenSubmitModal={(assignment, initialTab) =>
                  setSubmissionModal({ assignment, initialTab })
                }
                onAcknowledgeFeedback={handleAcknowledgeFeedback}
                onOpenMessageLecturer={(assignmentId) => {
                  const lecturerPeer = peers.find((p) => p.role === 'lecturer');
                  if (lecturerPeer) {
                    setMessageTarget({ peerId: lecturerPeer.id, assignmentId });
                    setActiveTab('messages');
                  }
                }}
              />
            )}

            {activeTab === 'extensions' && (
              <ExtensionsView
                currentUser={currentUser}
                extensions={extensions}
                onDecide={handleDecideExtension}
              />
            )}

            {activeTab === 'messages' && (
              <MessagesView
                currentUser={currentUser}
                peers={peers}
                courses={courses}
                assignments={assignments}
                messages={messages}
                initialPeerId={messageTarget?.peerId}
                initialAssignmentId={messageTarget?.assignmentId}
                onSendMessage={handleSendMessage}
                onMarkPeerRead={handleMarkPeerRead}
              />
            )}
          </>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <LecturerDashboard
                courses={courses}
                assignments={assignments}
                submissions={submissions}
                integrityReports={integrityReports}
                reviews={reviews}
                pendingExtensionsCount={pendingExtensionsCount}
                nowMs={nowMs}
                onEditAssignment={(assignment) =>
                  setAssignmentModal({ mode: 'edit', assignment })
                }
                onInspectSubmission={(submissionId) => {
                  setInspectSubmissionId(submissionId);
                  setActiveTab('submissions');
                }}
              />
            )}

            {activeTab === 'submissions' && (
              <LecturerInspector
                assignments={assignments}
                submissions={submissions}
                integrityReports={integrityReports}
                reviews={reviews}
                initialSubmissionId={inspectSubmissionId}
                onRunScan={handleRunScan}
                onSaveReview={handleSaveReview}
                onOpenMessageThread={(peerId, assignmentId) => {
                  setMessageTarget({ peerId, assignmentId });
                  setActiveTab('messages');
                }}
              />
            )}

            {activeTab === 'extensions' && (
              <ExtensionsView
                currentUser={currentUser}
                extensions={extensions}
                onDecide={handleDecideExtension}
              />
            )}

            {activeTab === 'messages' && (
              <MessagesView
                currentUser={currentUser}
                peers={peers}
                courses={courses}
                assignments={assignments}
                messages={messages}
                initialPeerId={messageTarget?.peerId}
                initialAssignmentId={messageTarget?.assignmentId}
                onSendMessage={handleSendMessage}
                onMarkPeerRead={handleMarkPeerRead}
              />
            )}

            {activeTab === 'audit' && <AuditLogView logs={auditLogs} />}
          </>
        )}
      </main>

      {/* Modals & Drawers */}
      <NotificationDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onSelectNotification={handleSelectNotification}
      />

      {assignmentModal && (
        <AssignmentModal
          mode={assignmentModal.mode}
          courses={courses}
          assignment={assignmentModal.assignment}
          onClose={() => setAssignmentModal(null)}
          onCreate={handleCreateAssignment}
          onUpdate={handleUpdateAssignment}
        />
      )}

      {submissionModal && (
        <SubmissionModal
          assignment={submissionModal.assignment}
          existingSubmission={submissions.find(
            (s) =>
              s.assignmentId === submissionModal.assignment.id &&
              s.studentId === currentUser.id
          )}
          initialTab={submissionModal.initialTab}
          onClose={() => setSubmissionModal(null)}
          onSubmitFile={handleSubmitFile}
          onRequestExtension={handleRequestExtension}
        />
      )}

      {/* Real-time Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 max-w-sm rounded-lg border border-[#14213D]/25 bg-white px-5 py-4 shadow-lg dark:border-[#293752] dark:bg-[#131C2E]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[#14213D] dark:text-white">{toast.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#5A6475] dark:text-white/80">
                {toast.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Close alert"
              className="rounded p-1 text-[#5A6475] hover:bg-[#F2EFE9] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
