# TASK: Add "Create Relationship" UI

## SCOPE
- `app/create/page.tsx` — add a tab/toggle to switch between "Node" and "Relationship" creation
- `components/NodeSearch.tsx` — new reusable async search component (type-ahead, calls GET /api/nodes?q=)

## CONTEXT

### Existing pieces (do not change)
- `POST /api/relationships` already exists and calls `createRelationship()` from `lib/graph/relationships.ts`
- Relationship schema is in `lib/schemas/relationships.ts` — use the `relationshipType` enum for the type dropdown
- Relationship props: `fromId`, `toId`, `type`, `role?`, `relationshipKind?`, `notes?`, `validFrom?`, `validTo?`

### What to build

**1. Tab toggle on `/create`**
Add two tabs at the top of the create page: "Node" and "Relationship". Default to Node (existing behaviour unchanged). The Relationship tab shows the new form below.

**2. NodeSearch component (`components/NodeSearch.tsx`)**
- Text input that searches as the user types (debounced ~300ms), calling `GET /api/nodes?q=<query>&limit=10`
- Shows a dropdown of matching nodes: display `node.label` (type badge on the right)
- On select: stores the node id internally, shows the selected label in the input
- Props: `value: string | null`, `onChange: (id: string, label: string) => void`, `placeholder?: string`
- Must be `'use client'`

**3. Relationship form**
Fields:
- **From** — NodeSearch component, labelled "From node"
- **To** — NodeSearch component, labelled "To node"  
- **Type** — dropdown of all values from `relationshipType` enum (import from `@/lib/schemas/relationships`)
- **Role** — text input, optional (placeholder: "e.g. payer, witness, guarantor")
- **Relationship kind** — text input, optional, only shown when type = IS_RELATED_TO or KNOWS (placeholder: "e.g. spouse, parent, colleague")
- **Notes** — textarea, optional
- **Valid from / Valid to** — date inputs, optional

On submit: POST to `/api/relationships` with `{ fromId, toId, type, role?, relationshipKind?, notes?, validFrom?, validTo? }`.
On success: navigate to `/nodes/<fromId>` so the user can see the new edge.
On error: show inline error message.

### Style
- Match existing dark slate-950 theme exactly — same input/select/button classes as the Node form
- Tabs: simple pill/underline style, consistent with the page
- NodeSearch dropdown: `bg-slate-900 border border-slate-700 rounded-lg` with hover highlight

## ACCEPTANCE
- [ ] `npm run build` passes with no type errors
- [ ] Node tab still works identically
- [ ] Relationship form submits and navigates to the from-node on success
- [ ] NodeSearch debounces, shows results, clears on new search
- [ ] All relationship types available in dropdown
- [ ] Conditional fields (relationshipKind) shown/hidden correctly
