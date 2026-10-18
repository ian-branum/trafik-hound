'use client';

import dynamic from 'next/dynamic';

const GraphCanvas = dynamic(() => import('@/components/GraphCanvas'), { ssr: false });

type Props = {
  nodes: { id: string; label: string; type: string; [key: string]: unknown }[];
  relationships: { from: string; to: string; type: string }[];
  focusId: string;
};

export default function NeighborhoodGraph({ nodes, relationships, focusId }: Props) {
  return (
    <div style={{ height: '456px' }}>
      <GraphCanvas nodes={nodes} relationships={relationships} focusId={focusId} />
    </div>
  );
}
