'use client';

import NodeEditor from '@/components/NodeEditor';

export default function EditNodeClient({ id }: { id: string }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <NodeEditor mode="edit" id={id} />
    </div>
  );
}
