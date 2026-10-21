import { redirect } from 'next/navigation';

/** The admin surface now lives at /admin — keep the old URL working. */
export default function AdminUsersRedirect() {
  redirect('/admin');
}
