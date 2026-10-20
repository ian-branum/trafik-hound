'use client';

import { useState } from 'react';

type TabKey = 'properties' | 'attachments' | 'relationships' | 'notes' | 'discussion';

interface NodeTabsProps {
  properties: React.ReactNode;
  attachments: React.ReactNode;
  relationships: React.ReactNode;
  notes: React.ReactNode;
  discussion: React.ReactNode;
  defaultTab?: TabKey;
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'properties', label: 'Properties' },
  { key: 'attachments', label: 'Attachments' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'notes', label: 'Notes' },
  { key: 'discussion', label: 'Discussion' },
];

export default function NodeTabs({
  properties,
  attachments,
  relationships,
  notes,
  discussion,
  defaultTab = 'properties',
}: NodeTabsProps) {
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
        {active === 'properties' && properties}
        {active === 'attachments' && attachments}
        {active === 'relationships' && relationships}
        {active === 'notes' && notes}
        {active === 'discussion' && discussion}
      </div>
    </div>
  );
}
