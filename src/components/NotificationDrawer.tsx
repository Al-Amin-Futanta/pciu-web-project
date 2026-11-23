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
        return <AlertTriangle className="h-4 w-4 text-[#8C2D38]" />;
      case 'new_message':
        return <MessageSquare className="h-4 w-4 text-[#14213D]" />;
      default:
        return <FileCheck2 className="h-4 w-4 text-[#1F6E52]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#14213D]/25 backdrop-blur-[1px]">
      <div className="flex h-full w-full max-w-md flex-col border-l border-[#E2DDD3] bg-[#FAF8F4] shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E2DDD3] bg-white px-6 py-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#14213D]">
              Real-Time Alerts
            </h2>
            <p className="text-xs text-[#5A6475]">
              {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All notifications reviewed'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="flex items-center gap-1.5 rounded-md border border-[#E2DDD3] px-3 py-1.5 text-xs font-medium text-[#14213D] hover:bg-[#F2EFE9] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="rounded-md p-1.5 text-[#5A6475] hover:bg-[#F2EFE9] hover:text-[#1E2430] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E2DDD3]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <BellOff className="h-8 w-8 text-[#5A6475]/60" />
              <p className="mt-3 text-sm font-medium text-[#1E2430]">No alerts yet</p>
              <p className="mt-1 text-xs text-[#5A6475]">
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
                  item.isRead ? 'bg-[#FAF8F4] hover:bg-[#F2EFE9]/70' : 'bg-white hover:bg-[#F2EFE9]'
                }`}
              >
                <div className="mt-0.5 shrink-0">{renderIcon(item.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`text-sm ${
                        item.isRead ? 'font-medium text-[#1E2430]' : 'font-semibold text-[#14213D]'
                      }`}
                    >
                      {item.title}
                    </p>
                    <span className="font-mono text-[11px] text-[#5A6475] shrink-0">
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#5A6475]">{item.body}</p>
                  {!item.isRead && (
                    <p className="mt-1.5 font-mono text-[11px] font-medium text-[#8C2D38]">
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
