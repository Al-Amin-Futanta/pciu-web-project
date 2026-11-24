import { AlertTriangle, BellOff, CheckCheck, FileCheck2, MessageSquare, X } from 'lucide-react';
import type { NotificationItem } from '../shared/types';
import { formatRelativeTime } from '../lib/time';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectNotification: (notification: NotificationItem) => void;
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  onMarkAllRead,
  onSelectNotification,
}: NotificationDrawerProps) {
  if (!open) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'assignment_canceled':
      case 'assignment_modified':
        return <AlertTriangle className="h-4 w-4 text-[#8C2D38] dark:text-white" />;
      case 'new_message':
        return <MessageSquare className="h-4 w-4 text-[#14213D] dark:text-white" />;
      default:
        return <FileCheck2 className="h-4 w-4 text-[#1F6E52] dark:text-white" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#14213D]/25 backdrop-blur-[1px] dark:bg-black/60">
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#E2DDD3] bg-[#FAF8F4] shadow-xl dark:border-[#293752] dark:bg-[#0B1120]">
        <div className="flex items-center justify-between border-b border-[#E2DDD3] bg-white px-6 py-4 dark:border-[#293752] dark:bg-[#131C2E]">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#14213D] dark:text-white">
              Real-Time Alerts
            </h2>
            <p className="text-xs text-[#5A6475] dark:text-white/80">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All notifications reviewed'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#14213D] hover:bg-[#F2EFE9] dark:border-[#293752] dark:text-white dark:hover:bg-[#1A263D] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5 text-[#14213D] dark:text-white" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="rounded-md p-1.5 text-[#5A6475] hover:bg-[#F2EFE9] hover:text-[#1E2430] dark:text-white dark:hover:bg-[#1A263D] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E2DDD3] dark:divide-[#293752]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <BellOff className="h-8 w-8 text-[#5A6475]/60 dark:text-white/75" />
              <p className="mt-3 text-sm font-medium text-[#1E2430] dark:text-white">No alerts yet</p>
              <p className="mt-1 text-xs text-[#5A6475] dark:text-white/80">
                Deadline updates, assignment cancellations, feedback confirmations, and messages appear here instantly.
              </p>
            </div>
          ) : (
            notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectNotification(item)}
                className={`flex w-full items-start gap-3 px-6 py-4 text-left transition-colors cursor-pointer ${
                  item.isRead
                    ? 'bg-[#FAF8F4] hover:bg-[#F2EFE9]/70 dark:bg-[#0B1120] dark:hover:bg-[#1A263D]'
                    : 'bg-white hover:bg-[#F2EFE9] dark:bg-[#131C2E] dark:hover:bg-[#1A263D]'
                }`}
              >
                <div className="mt-0.5 shrink-0">{renderIcon(item.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`text-sm ${
                        item.isRead
                          ? 'font-medium text-[#1E2430] dark:text-white/90'
                          : 'font-semibold text-[#14213D] dark:text-white'
                      }`}
                    >
                      {item.title}
                    </p>
                    <span className="font-mono text-[11px] text-[#5A6475] dark:text-white/75 shrink-0">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#5A6475] dark:text-white/80">
                    {item.body}
                  </p>
                  {!item.isRead && (
                    <p className="mt-1.5 font-mono text-[11px] font-medium text-[#8C2D38] dark:text-rose-300">
                      Unread alert
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
