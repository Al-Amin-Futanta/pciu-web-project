import { LogOut, Moon, Sun } from 'lucide-react';
import type { UserProfile } from '../shared/types';

export type NavTab = 'dashboard' | 'submissions' | 'extensions' | 'messages' | 'audit';
export type PublicView = 'home' | 'login';

interface TopNavProps {
  currentUser: UserProfile | null;
  publicView: PublicView;
  activeTab: NavTab;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectPublicView: (view: PublicView, sectionId?: 'about' | 'contact') => void;
  onSelectTab: (tab: NavTab) => void;
  onSignOut: () => void;
  unreadMessages: number;
  pendingExtensions: number;
}

export function TopNav({
  currentUser,
  publicView,
  activeTab,
  darkMode,
  onToggleDarkMode,
  onSelectPublicView,
  onSelectTab,
  onSignOut,
  unreadMessages,
  pendingExtensions,
}: TopNavProps) {
  const roleNavItems: Array<{ id: NavTab; label: string; count?: number }> =
    currentUser?.role === 'lecturer'
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
    <header className="sticky top-0 z-30 border-b border-[#E2DDD3] bg-[#FAF8F4]/95 backdrop-blur-sm dark:border-[#293752] dark:bg-[#0B1120]/95">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-6 py-4">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => {
            if (currentUser) {
              onSelectTab('dashboard');
            } else {
              onSelectPublicView('home');
            }
          }}
          className="font-display text-xl font-semibold tracking-tight text-[#14213D] dark:text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#14213D] dark:focus-visible:outline-white"
        >
          Verity Academic
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        {!currentUser ? (
          <nav className="hidden md:flex items-center gap-7" aria-label="Public Navigation">
            <button
              type="button"
              onClick={() => onSelectPublicView('home')}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                publicView === 'home'
                  ? 'text-[#14213D] dark:text-white'
                  : 'text-[#5A6475] hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white'
              }`}
            >
              Homepage
              {publicView === 'home' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[#14213D] dark:bg-white"
                />
              )}
            </button>
            <button
              type="button"
              onClick={() => onSelectPublicView('home', 'about')}
              className="py-1 text-sm font-medium text-[#5A6475] transition-colors hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => onSelectPublicView('home', 'contact')}
              className="py-1 text-sm font-medium text-[#5A6475] transition-colors hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              Contact Us
            </button>
            <button
              type="button"
              onClick={() => onSelectPublicView('login')}
              className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                publicView === 'login'
                  ? 'text-[#14213D] dark:text-white'
                  : 'text-[#5A6475] hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white'
              }`}
            >
              Portal Login
              {publicView === 'login' && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[#14213D] dark:bg-white"
                />
              )}
            </button>
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-7" aria-label="Portal Navigation">
            {roleNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#14213D] dark:text-white'
                      : 'text-[#5A6475] hover:text-[#1E2430] dark:text-white/75 dark:hover:text-white'
                  }`}
                >
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="ml-1.5 font-mono text-xs text-[#8C2D38] dark:text-rose-300 tabular-nums">
                      ({item.count})
                    </span>
                  )}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-[17px] h-[2px] bg-[#14213D] dark:bg-white"
                    />
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Top-right Dark/Bright Mode Icon + Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? 'Switch to Bright Mode' : 'Switch to Dark Mode'}
            title={darkMode ? 'Switch to Bright Mode' : 'Switch to Dark Mode'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2DDD3] bg-white text-[#14213D] transition-colors hover:bg-[#F2EFE9] dark:border-[#293752] dark:bg-[#131C2E] dark:text-white dark:hover:bg-[#1A263D] shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14213D] dark:focus-visible:outline-white"
          >
            {darkMode ? <Sun className="h-4 w-4 text-white" /> : <Moon className="h-4 w-4" />}
          </button>

          {currentUser ? (
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center gap-2 rounded-lg border border-[#E2DDD3] bg-white px-3.5 py-2 text-xs font-semibold text-[#14213D] transition-colors hover:bg-[#F2EFE9] dark:border-[#293752] dark:bg-[#131C2E] dark:text-white dark:hover:bg-[#1A263D] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5 text-[#14213D] dark:text-white" />
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelectPublicView('login')}
              className="rounded-lg bg-[#14213D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D2E54] dark:bg-white dark:text-[#14213D] dark:hover:bg-slate-100 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Portal Login
            </button>
          )}
        </div>
      </div>

      {/* Mobile Secondary Navigation Row */}
      <nav
        className="flex md:hidden items-center gap-5 overflow-x-auto border-t border-[#E2DDD3] px-6 py-2.5 dark:border-[#293752]"
        aria-label="Mobile Navigation"
      >
        {!currentUser ? (
          <>
            <button
              type="button"
              onClick={() => onSelectPublicView('home')}
              className={`text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                publicView === 'home'
                  ? 'text-[#14213D] underline underline-offset-4 dark:text-white'
                  : 'text-[#5A6475] dark:text-white/75'
              }`}
            >
              Homepage
            </button>
            <button
              type="button"
              onClick={() => onSelectPublicView('home', 'about')}
              className="text-xs font-medium text-[#5A6475] dark:text-white/75 whitespace-nowrap shrink-0 cursor-pointer"
            >
              About
            </button>
            <button
              type="button"
              onClick={() => onSelectPublicView('home', 'contact')}
              className="text-xs font-medium text-[#5A6475] dark:text-white/75 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Contact Us
            </button>
            <button
              type="button"
              onClick={() => onSelectPublicView('login')}
              className={`text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                publicView === 'login'
                  ? 'text-[#14213D] underline underline-offset-4 dark:text-white'
                  : 'text-[#5A6475] dark:text-white/75'
              }`}
            >
              Portal Login
            </button>
          </>
        ) : (
          roleNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'text-[#14213D] underline underline-offset-4 dark:text-white'
                    : 'text-[#5A6475] dark:text-white/75'
                }`}
              >
                {item.label}
                {item.count !== undefined && item.count > 0 ? ` (${item.count})` : ''}
              </button>
            );
          })
        )}
      </nav>
    </header>
  );
}
