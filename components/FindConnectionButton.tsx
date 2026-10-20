'use client';

import { useState } from 'react';
import FindConnectionModal from '@/components/FindConnectionModal';

interface Props {
  sourceNode: { id: string; label: string };
}

export default function FindConnectionButton({ sourceNode }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:border-slate-500 transition-colors whitespace-nowrap"
      >
        🔗 Find Connection
      </button>

      {open && (
        <FindConnectionModal
          sourceNode={sourceNode}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
