import EditNodeClient from './EditNodeClient';

// Client-side editor: load node data at request time, never prerender.
export const instant = false;

export default async function EditNodePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditNodeClient id={id} />;
}
