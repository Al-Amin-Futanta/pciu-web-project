import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { AuditLogEntry } from '../shared/types';
import { formatAcademicDate } from '../lib/time';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
}

export function AuditLogView({ logs }: AuditLogViewProps) {
  const [query, setQuery] = useState('');

  const filtered = logs.filter((entry) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      entry.action.toLowerCase().includes(q) ||
      entry.actorName.toLowerCase().includes(q) ||
      entry.details.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#14213D] dark:text-white">
            Security &amp; Integrity Audit Ledger
          </h2>
          <p className="mt-1 text-sm text-[#5A6475] dark:text-white/80">
            Append-only log of portal sign-ins, file uploads, AI integrity checks, and receipt confirmations.
          </p>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by action, actor, or detail..."
          className="w-72 rounded-md border border-[#E2DDD3] bg-white px-3.5 py-2 text-xs text-[#1E2430] focus:border-[#14213D] focus:outline-none dark:border-[#293752] dark:bg-[#131C2E] dark:text-white dark:placeholder:text-white/50 dark:focus:border-white"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#E2DDD3] bg-white dark:border-[#293752] dark:bg-[#131C2E]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E2DDD3] bg-[#FAF8F4] text-[#5A6475] dark:border-[#293752] dark:bg-[#0B1120] dark:text-white/80">
            <tr>
              <th className="px-4 py-3 font-semibold">Timestamp</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Event</th>
              <th className="px-4 py-3 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2DDD3]/70 dark:divide-[#293752]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[#5A6475] dark:text-white/80">
                  <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-[#5A6475]/60 dark:text-white/75" />
                  No audit records match your filter.
                </td>
              </tr>
            ) : (
              filtered.map((entry) => (
                <tr key={entry.id} className="hover:bg-[#FAF8F4]/70 dark:hover:bg-[#1A263D]">
                  <td className="px-4 py-3 font-mono text-[#5A6475] dark:text-white/75 whitespace-nowrap tabular-nums">
                    {formatAcademicDate(entry.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-[#1E2430] dark:text-white">
                      {entry.actorName}
                    </span>{' '}
                    <span className="text-[#5A6475] dark:text-white/75">
                      ({entry.actorRole})
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-[#14213D] dark:text-white whitespace-nowrap">
                    {entry.action}
                  </td>
                  <td className="px-4 py-3 text-[#1E2430] dark:text-white/90">
                    {entry.details}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
