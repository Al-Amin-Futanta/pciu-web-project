import { LogOut } from 'lucide-react';
import type { UserProfile } from '../shared/types';

export type NavTab = 'dashboard' | 'submissions' | 'extensions' | 'messages' | 'audit';

interface TopNavProps {
  currentUser: UserProfile;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onSignOut: () => void;
  unreadMessages: number;
  pendingExtensions: number;
}

export function TopNav({
  currentUser,
  activeTab,
  onSelectTab,
  onSignOut,
  unreadMessages,
  pendingExtensions,
}: TopNavProps) {
  const navItems: Array<{ id: NavTab; label: string; count?: number }> =
    currentUser.role === 'lecturer'
      ? [
          { id: 'dashboard', label: 'Overview' },
          { id: 'submissions', label: 'Review Studio' },
          { id: 'extensions', label: 'Extensions', count: pendingExtensions },
          { id: 'messages', label: 'Messages', count: unreadMessages },
          { id: 'audit', label: 'Audit Log' },
        ]
      : [
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'submissions', label: 'My Submissions' },
          { id: 'extensions', label: 'Extensions' },
          { id: 'messages', label: 'Messages', count: unreadMessages },
        ];

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2DDD3] bg-[#FAF8F4]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className="font-display text-xl font-semibold tracking-tight text-[#14213D] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14213D]"
        >
          Verity Academic
        </button>

        {/* Zone 2: Separate navigation per role */}
        <nav className="hidden md:flex items-center gap-7" aria-label="Primary Navigation">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14213D] ${
                  isActive ? 'text-[#14213D]' : 'text-[#5A6475] hover:text-[#1E2430]'
                }`}
              >
                <span>{item.label}</span>
                {item.count !== undefined && item.count > 0 && (
                  <span className="ml-1.5 font-mono text-xs text-[#8C2D38] tabular-nums">
                    ({item.count})
                  </span>
                )}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[#14213D]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Sign Out control */}
        <button
          type="button"
          onClick={onSignOut}
          className="flex items-center gap-2 rounded-lg border border-[#E2DDD3] bg-white px-3.5 py-2 text-xs font-semibold text-[#14213D] transition-colors hover:border-[#14213D]/40 hover:bg-[#F2EFE9] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D]"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>

      {/* Mobile Secondary Navigation Row */}
      <nav
        className="flex md:hidden items-center gap-5 overflow-x-auto border-t border-[#E2DDD3] px-6 py-2.5"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                isActive ? 'text-[#14213D] underline underline-offset-4' : 'text-[#5A6475]'
              }`}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 ? ` (${item.count})` : ''}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
