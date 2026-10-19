import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listUsers } from "@/lib/auth/users";
import UsersTable from "./UsersTable";

export const metadata = {
  title: "Users · Trafik-hound",
};

// Auth-gated page: allow blocking (dynamic) rendering instead of prerendering.
export const instant = false;

export default async function AdminUsersPage() {
  const session = await auth();

  // Defence in depth — middleware already redirects non-admins.
  if (!session?.user || session.user.role !== "admin") {
    redirect("/");
  }

  const users = await listUsers();

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Users</h1>
        <p className="text-slate-400 text-sm">
          New accounts start disabled. Enable a user to let them access the app.
        </p>
      </div>

      <UsersTable initialUsers={users} currentUserId={session.user.userId} />
    </div>
  );
}
