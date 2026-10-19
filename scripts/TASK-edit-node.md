# TASK: Node and Relationship Editing

## SCOPE
- `lib/graph/nodes.ts` — add `updateNode()` and `deleteNode()` functions
- `lib/graph/relationships.ts` — add `deleteRelationship()` function
- `app/api/nodes/[id]/route.ts` — add PATCH and DELETE handlers
- `app/api/relationships/route.ts` — add DELETE handler
- `app/nodes/[id]/edit/page.tsx` — new edit page (node fields + relationship management)

## CONTEXT

### Existing pieces (read before touching)
- `lib/graph/nodes.ts` — `getNodeById`, `searchNodes`, `createNode`
- `lib/graph/relationships.ts` — `createRelationship`, `getRelationshipsForNode`
- `app/nodes/[id]/page.tsx` — node detail page (server component, `instant = false`)
- `lib/schemas/` — all Zod schemas; the node `type` field is immutable (don't allow changing it)
- `components/NodeSearch.tsx` — reusable type-ahead node search, use this in the edit page for relationship editing
- All queries must include `WHERE NOT n:_System` (or equivalent) — see existing patterns in nodes.ts and queries.ts

### Neo4j notes
- Relationships in Neo4j cannot be updated in place — to change a relationship's properties, delete and recreate it
- To delete a node, first check it has no relationships; if it does, either block deletion or detach-delete (use DETACH DELETE to remove the node and all its relationships at once)
- Relationship identity: Neo4j has no stable relationship ID in our schema. Identify relationships by the combination of `fromId`, `toId`, and `type` (and optionally `role` to disambiguate parallel edges)

## WHAT TO BUILD

### 1. `lib/graph/nodes.ts` additions

**`updateNode(id, patch)`**
- Patch fields: `label`, `subtype`, `notes`, and any other non-system fields
- Do NOT allow changing `type`, `id`, `createdAt`
- Use `SET n += $patch` pattern (merge, not replace)
- Strip system fields from patch before writing
- Return updated node or null if not found

**`deleteNode(id)`**
- Use `MATCH (n {id: $id}) WHERE NOT n:_System DETACH DELETE n`
- Returns `true` if deleted, `false` if not found

### 2. `lib/graph/relationships.ts` addition

**`deleteRelationship(fromId, toId, type, role?)`**
- `MATCH (a {id: $fromId})-[r:TYPE]->(b {id: $toId})` with optional `WHERE r.role = $role`
- DELETE r
- Because type is dynamic, build the query string with the type inline (it's validated by Zod before reaching here)
- Returns `true` if deleted, `false` if not found

### 3. API routes

**`PATCH /api/nodes/[id]`** — update node fields
- Body: `{ label?, subtype?, notes?, ...otherFields }`
- Strip `type`, `id`, `createdAt` from body before passing to `updateNode`
- Return updated node or 404

**`DELETE /api/nodes/[id]`** — delete node
- Calls `deleteNode(id)`
- Return 204 on success, 404 if not found

**`DELETE /api/relationships`** — delete a relationship
- Body: `{ fromId, toId, type, role? }`
- Validate `type` against `relationshipType` enum
- Return 204 on success, 404 if not found

### 4. Edit page — `app/nodes/[id]/edit/page.tsx`

This is a client component (`'use client'`) that:
- Fetches node + relationships via `GET /api/nodes/[id]` on mount
- Shows a loading state while fetching

**Node fields section:**
- `label` — text input (required)
- `subtype` — dropdown (same options as create page, based on type)
- `notes` — textarea
- Type is shown as a read-only badge (not editable)
- Save button → `PATCH /api/nodes/[id]`
- On success: show a brief "Saved ✓" confirmation, do NOT navigate away

**Relationships section (below node fields):**
- List all current relationships with a ✕ delete button on each
- Clicking ✕ → confirm with `window.confirm()` → `DELETE /api/relationships` → remove from list
- "Add relationship" button at the bottom opens an inline form (not a new page):
  - NodeSearch for the other node
  - Direction toggle: "This node → Other" / "Other → This node"
  - Type dropdown (all relationshipType enum values)
  - Role (optional text)
  - Notes (optional)
  - Valid from / Valid to (optional dates)
  - Submit → `POST /api/relationships` → append to list → close inline form

**Delete node:**
- Red "Delete node" button at the very bottom of the page
- Requires `window.confirm("Delete this node and all its relationships? This cannot be undone.")`
- `DELETE /api/nodes/[id]` → on success navigate to `/explore`

**Navigation:**
- "← Back" link at top goes to `/nodes/[id]`
- Add an "Edit" link/button on `/nodes/[id]/page.tsx` that goes to `/nodes/[id]/edit`

**Style:** Match existing dark slate-950 theme exactly. Use same input/select/button classes as create page.

## ACCEPTANCE
- [ ] `npm run build` passes with no type errors
- [ ] PATCH /api/nodes/[id] updates and returns the node
- [ ] DELETE /api/nodes/[id] removes node and relationships
- [ ] DELETE /api/relationships removes a single relationship
- [ ] Edit page loads current values correctly
- [ ] Saving node fields works without navigating away
- [ ] Relationship delete works with confirmation
- [ ] Inline add-relationship form works
- [ ] Delete node with confirmation navigates to /explore
- [ ] Edit button visible on node detail page
- [ ] System fields (_System nodes) cannot be edited or deleted via these endpoints
