'use client';

import { useState } from 'react';

type TabKey = 'users' | 'access-log';

interface AdminTabsProps {
  users: React.ReactNode;
  accessLog: React.ReactNode;
  defaultTab?: TabKey;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'access-log', label: 'Access Log' },
];

export default function AdminTabs({
  users,
  accessLog,
  defaultTab = 'users',
}: AdminTabsProps) {
  const [active, setActive] = useState<TabKey>(defaultTab);

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <div
        role="tablist"
        className="flex border-b border-slate-800 bg-slate-900/50 overflow-x-auto"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active === tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active === tab.key
                ? 'text-white border-blue-500'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="p-5">
        {active === 'users' && users}
        {active === 'access-log' && accessLog}
      </div>
    </div>
  );
}
