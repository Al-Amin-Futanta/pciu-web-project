import { useEffect, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import type { Assignment, Course, PrivateMessage, UserProfile } from '../shared/types';
import { formatAcademicDate } from '../lib/time';

interface MessagesViewProps {
  currentUser: UserProfile;
  peers: UserProfile[];
  courses: Course[];
  assignments: Assignment[];
  messages: PrivateMessage[];
  initialPeerId?: string | null;
  initialAssignmentId?: string | null;
  onSendMessage: (payload: {
    recipientId: string;
    courseId: string;
    assignmentId?: string | null;
    body: string;
  }) => Promise<void>;
  onMarkPeerRead: (peerId: string) => void;
}

export function MessagesView({
  currentUser,
  peers,
  courses,
  assignments,
  messages,
  initialPeerId,
  initialAssignmentId,
  onSendMessage,
  onMarkPeerRead,
}: MessagesViewProps) {
  const [selectedPeerId, setSelectedPeerId] = useState<string>(
    initialPeerId || peers[0]?.id || ''
  );
  const [courseId, setCourseId] = useState<string>(courses[0]?.id ?? '');
  const [assignmentId, setAssignmentId] = useState<string>(initialAssignmentId ?? '');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (initialPeerId && peers.some((p) => p.id === initialPeerId)) {
      setSelectedPeerId(initialPeerId);
    }
    if (initialAssignmentId) {
      setAssignmentId(initialAssignmentId);
      const found = assignments.find((a) => a.id === initialAssignmentId);
      if (found) setCourseId(found.courseId);
    }
  }, [initialPeerId, initialAssignmentId, peers, assignments]);

  useEffect(() => {
    if (selectedPeerId) {
      const hasUnread = messages.some(
        (m) => m.senderId === selectedPeerId && m.recipientId === currentUser.id && !m.isRead
      );
      if (hasUnread) {
        onMarkPeerRead(selectedPeerId);
      }
    }
  }, [selectedPeerId, messages, currentUser.id, onMarkPeerRead]);

  const activePeer = peers.find((p) => p.id === selectedPeerId) ?? peers[0];
  const thread = activePeer
    ? messages.filter(
        (m) =>
          (m.senderId === currentUser.id && m.recipientId === activePeer.id) ||
          (m.senderId === activePeer.id && m.recipientId === currentUser.id)
      )
    : [];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activePeer || !draft.trim() || !courseId) return;
    setSending(true);
    try {
      await onSendMessage({
        recipientId: activePeer.id,
        courseId,
        assignmentId: assignmentId || null,
        body: draft.trim(),
      });
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid min-h-[560px] grid-cols-1 overflow-hidden rounded-lg border border-[#E2DDD3] bg-white dark:border-[#293752] dark:bg-[#131C2E] lg:grid-cols-12">
      {/* Left Peer Directory */}
      <aside className="border-b border-[#E2DDD3] bg-[#FAF8F4] dark:border-[#293752] dark:bg-[#0B1120] lg:col-span-4 lg:border-r lg:border-b-0">
        <div className="border-b border-[#E2DDD3] px-5 py-4 dark:border-[#293752]">
          <h2 className="font-display text-lg font-semibold text-[#14213D] dark:text-white">
            Private Academic Inbox
          </h2>
          <p className="mt-0.5 text-xs text-[#5A6475] dark:text-white/80">
            Confidential 1:1 student–instructor correspondence
          </p>
        </div>

        <div className="divide-y divide-[#E2DDD3] dark:divide-[#293752]">
          {peers.map((peer) => {
            const unread = messages.filter(
              (m) => m.senderId === peer.id && m.recipientId === currentUser.id && !m.isRead
            ).length;
            const lastMsg = [...messages]
              .reverse()
              .find(
                (m) =>
                  (m.senderId === peer.id && m.recipientId === currentUser.id) ||
                  (m.senderId === currentUser.id && m.recipientId === peer.id)
              );
            const isSelected = activePeer?.id === peer.id;

            return (
              <button
                key={peer.id}
                type="button"
                onClick={() => setSelectedPeerId(peer.id)}
                className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-[#131C2E]'
                    : 'hover:bg-[#F2EFE9]/70 dark:hover:bg-[#1A263D]'
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#14213D] font-mono text-xs font-semibold text-white dark:bg-white dark:text-[#14213D]">
                  {peer.avatarInitials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[#1E2430] dark:text-white truncate">
                      {peer.name}
                    </p>
                    {unread > 0 && (
                      <span className="font-mono text-xs font-semibold text-[#8C2D38] dark:text-rose-300 tabular-nums">
                        {unread} new
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5A6475] dark:text-white/75 truncate">
                    {peer.role === 'lecturer' ? peer.title : peer.studentCode}
                  </p>
                  {lastMsg && (
                    <p className="mt-1 text-xs text-[#5A6475] dark:text-white/75 truncate">
                      {lastMsg.body}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Right Conversation Thread */}
      <section className="flex flex-col lg:col-span-8">
        {activePeer ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2DDD3] px-6 py-4 dark:border-[#293752]">
              <div>
                <h3 className="font-display text-base font-semibold text-[#14213D] dark:text-white">
                  {activePeer.name}
                </h3>
                <p className="text-xs text-[#5A6475] dark:text-white/80">
                  {activePeer.department} · {activePeer.email}
                </p>
              </div>
              <select
                value={assignmentId}
                onChange={(e) => {
                  const aid = e.target.value;
                  setAssignmentId(aid);
                  const found = assignments.find((a) => a.id === aid);
                  if (found) setCourseId(found.courseId);
                }}
                aria-label="Reference assignment"
                className="max-w-xs rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3 py-1.5 text-xs text-[#1E2430] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white"
              >
                <option value="">General Course Inquiry</option>
                {assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    Re: {a.courseCode} · {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#FAF8F4]/50 p-6 dark:bg-[#0B1120]/60">
              {thread.length === 0 ? (
                <div className="py-16 text-center text-sm text-[#5A6475] dark:text-white/80">
                  No messages yet with {activePeer.name}. Start a confidential thread below.
                </div>
              ) : (
                thread.map((msg) => {
                  const isMine = msg.senderId === currentUser.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-lg border px-4 py-3 text-sm ${
                          isMine
                            ? 'border-[#14213D] bg-[#14213D] text-white dark:border-white/30 dark:bg-[#1E3A5F] dark:text-white'
                            : 'border-[#E2DDD3] bg-white text-[#1E2430] dark:border-[#293752] dark:bg-[#131C2E] dark:text-white'
                        }`}
                      >
                        {msg.assignmentTitle && (
                          <p
                            className={`mb-1 font-mono text-[11px] ${
                              isMine ? 'text-white/75' : 'text-[#5A6475] dark:text-white/75'
                            }`}
                          >
                            Re: {msg.assignmentTitle}
                          </p>
                        )}
                        <p className="leading-relaxed">{msg.body}</p>
                      </div>
                      <span className="mt-1 font-mono text-[11px] text-[#5A6475] dark:text-white/75">
                        {msg.senderName} · {formatAcademicDate(msg.createdAt)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3 border-t border-[#E2DDD3] bg-white px-6 py-4 dark:border-[#293752] dark:bg-[#131C2E]"
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Message ${activePeer.name}...`}
                className="flex-1 rounded-md border border-[#E2DDD3] bg-[#FAF8F4] px-3.5 py-2 text-sm text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#0B1120] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
                required
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="flex items-center gap-1.5 rounded-md bg-[#14213D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1D2E54] disabled:opacity-50 dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? 'Sending...' : 'Send'}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-[#5A6475] dark:text-white/80">
            Select a recipient to view private correspondence.
          </div>
        )}
      </section>
    </div>
  );
}
