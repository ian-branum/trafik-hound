# TASK: Implement NextAuth v5 authentication with Google + email, role-based access, and admin user management

## SCOPE
- `/auth.ts` (root) — NextAuth config
- `/app/api/auth/[...nextauth]/route.ts` — NextAuth route handler
- `/app/api/admin/users/route.ts` — list + patch users (admin only)
- `/app/auth/signin/page.tsx` — sign-in page
- `/app/auth/pending/page.tsx` — "awaiting approval" holding page
- `/app/admin/users/page.tsx` — admin user management UI
- `/middleware.ts` — route protection
- `/lib/auth/users.ts` — Neo4j user CRUD helpers
- `/lib/auth/types.ts` — shared User type
- `/components/Nav.tsx` — update to show user avatar + sign out
- `package.json` — add next-auth@beta, @auth/neo4j-adapter (or custom), nodemailer, bcryptjs

## CONTEXT

### Stack
- Next.js 16 (App Router), TypeScript, Tailwind v4, Neo4j AuraDB Free
- Neo4j driver singleton already in `/lib/neo4j.ts` — use it, don't re-create
- The env var for Neo4j username is `NEO4J_USER` (NOT NEO4J_USERNAME)

### Auth requirements
1. **Providers:** Google OAuth + Email (magic link via Nodemailer, SMTP)
2. **Self-registration:** Anyone can register via either provider
3. **Default state on first login:** `enabled: false`, `role: 'user'`
4. **Access gate:** If `enabled === false`, redirect to `/auth/pending` after sign-in — they see NOTHING else
5. **Roles:** `'admin'` | `'user'` — admins can see `/admin/*` routes
6. **Admin user management page** at `/admin/users`:
   - Lists all users (name, email, provider, role, enabled, createdAt)
   - Toggle enabled/disabled per user
   - Change role (user ↔ admin)
   - Admin cannot disable themselves
7. **First user bootstrap:** The very first user to register is automatically set to `enabled: true, role: 'admin'`

### Data model — store users as Neo4j `:User` nodes
Properties:
```
id           String  (cuid2)
email        String  UNIQUE
name         String?
image        String? (avatar URL from OAuth)
role         String  ('admin' | 'user')
enabled      Boolean
provider     String  ('google' | 'email')
createdAt    DateTime
lastLoginAt  DateTime?
```

Add a uniqueness constraint for `:User(email)` in the DB setup — include this in a `scripts/setup-auth.mjs` file that can be run once (similar to `scripts/setup-db.mjs`).

### NextAuth v5 (next-auth@beta) specifics
- Use `auth()` export from `auth.ts` for server-side session access
- Use `handlers` export for the route handler
- Session strategy: `jwt` (Aura Free doesn't support adapter sessions well due to connection limits)
- Extend the JWT and Session types to include `role`, `enabled`, `userId`
- In the `jwt` callback: on first sign-in, check if User node exists in Neo4j — if not, create it (first user gets admin, rest get user+disabled). Store role+enabled in the token.
- In the `session` callback: copy role+enabled+userId from token to session.user
- **Do NOT use @auth/neo4j-adapter** — manage user nodes manually in the jwt callback

### Middleware
File: `/middleware.ts`
- Public routes: `/auth/*`, `/api/auth/*`
- If no session → redirect to `/auth/signin`
- If session but `enabled === false` → redirect to `/auth/pending`
- If route starts with `/admin` and role !== 'admin' → redirect to `/` with a toast param
- Export `config.matcher` to exclude `/_next/*`, `/favicon.ico`, `/public/*`

### Sign-in page (`/app/auth/signin/page.tsx`)
- Dark themed, matches existing slate-950 bg
- "Sign in with Google" button (prominent)
- Divider "or"
- Email input + "Send magic link" button
- On email submit: call `signIn('email', { email, callbackUrl: '/' })`
- Show success state "Check your inbox"
- No passwords

### Pending page (`/app/auth/pending/page.tsx`)
- Simple centered message: "Your account is pending approval by an administrator."
- Sign out link

### Admin users page (`/app/admin/users/page.tsx`)
- Server component for initial data fetch, client component for interactions
- Table: Name | Email | Provider | Role | Enabled | Joined | Actions
- Actions: toggle enable/disable button, role dropdown (select)
- PATCH to `/api/admin/users` with `{ id, enabled?, role? }`
- Show current user's own row but disable the enable/disable toggle for it
- Style: consistent with existing dark slate theme

### Nav updates (`/components/Nav.tsx`)
- If signed in: show user avatar (img or initials fallback) + sign out button on the right
- If admin: add "Admin" link to `/admin/users` in nav
- If not signed in: show "Sign in" link

### Environment variables needed (add to .env.local — do not create the file, just document what's needed in a comment at top of auth.ts)
```
NEXTAUTH_SECRET=         # openssl rand -base64 32
NEXTAUTH_URL=            # https://your-domain.com
AUTH_GOOGLE_ID=          # Google OAuth client ID
AUTH_GOOGLE_SECRET=      # Google OAuth client secret
EMAIL_SERVER=            # smtp://user:pass@smtp.host:587
EMAIL_FROM=              # noreply@your-domain.com
```

## ACCEPTANCE
- [ ] `npm run build` passes with no type errors
- [ ] Google sign-in flow works end-to-end
- [ ] Email magic link flow works end-to-end  
- [ ] New user lands on `/auth/pending` after first sign-in
- [ ] Admin can enable user at `/admin/users`
- [ ] Enabled user can access all routes
- [ ] Non-admin cannot access `/admin/*`
- [ ] First registered user auto-gets admin + enabled
- [ ] Nav shows correct state for each user type
- [ ] `scripts/setup-auth.mjs` creates `:User(email)` constraint when run
