import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { listUsers } from '@/lib/auth/users';
import UsersTable from './users/UsersTable';
import AdminTabs from '@/components/AdminTabs';
import AccessLogTable from './access-log/AccessLogTable';

export const metadata = {
  title: 'Admin · Trafik-hound',
};

// Auth-gated page: allow blocking (dynamic) rendering instead of prerendering.
export const instant = false;

export default async function AdminPage() {
  const session = await auth();

  // Defence in depth — middleware already redirects non-admins.
  if (!session?.user || session.user.role !== 'admin') {
    redirect('/');
  }

  const users = await listUsers();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Admin</h1>
        <p className="text-slate-400 text-sm">
          Manage users and review system activity.
        </p>
      </div>

      <AdminTabs
        users={
          <UsersTable
            initialUsers={users}
            currentUserId={session.user.userId}
          />
        }
        accessLog={<AccessLogTable />}
      />
    </div>
  );
}
