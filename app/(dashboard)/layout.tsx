'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Video,
  Languages,
  Database,
  Settings,
  BarChart2,
  Cpu,
} from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/videos',  label: 'Videos',   icon: Video },
  { href: '/editor',  label: 'Editor',   icon: Languages },
  { href: '/models',  label: 'Models',   icon: Cpu },
  { href: '/dataset', label: 'Dataset',  icon: Database },
  { href: '/reports', label: 'Reports',  icon: BarChart2 },
  { href: '/settings',label: 'Settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 bg-brand-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-brand-700">
          <span className="font-bold text-lg tracking-tight">OMI-TED</span>
          <p className="text-xs text-brand-100 mt-0.5">Translation Engine</p>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-brand-100 hover:bg-brand-700 hover:text-white',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-xs text-brand-300 border-t border-brand-700">
          v0.1.0
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
