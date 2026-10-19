# TASK: Unify Create Node and Edit Node into one component

## GOAL
Replace the separate create and edit node UIs with a single shared component that works in both "create" and "edit" modes.

## SCOPE
- `components/NodeEditor.tsx` — new shared client component
- `app/nodes/[id]/edit/EditNodeClient.tsx` — replace with thin wrapper using NodeEditor
- `app/nodes/[id]/edit/page.tsx` — unchanged
- `app/create/page.tsx` — replace Node tab form with NodeEditor in create mode; keep Relationship tab unchanged
- DELETE any code that is made redundant

## WHAT NodeEditor DOES

### Props
```ts
interface NodeEditorProps {
  mode: 'create' | 'edit';
  id?: string;           // only in edit mode — the node id
}
```

### Create mode (`mode="create"`)
- Title: "Add Node"
- **Type is a dropdown** (editable) — Person, Organization, Agent, Transaction, Interaction, Agreement, Record, Asset
- Subtype dropdown (driven by selected type, same SUBTYPES map as before)
- Label input (required)
- Notes textarea
- No relationships section
- No delete button
- Submit → POST /api/nodes → on success navigate to `/nodes/<newId>`
- On error: show inline error

### Edit mode (`mode="edit"`, `id` required)
- Fetch node + relationships from GET /api/nodes/[id] on mount
- Title: "Edit node"
- **Type shown as read-only badge** (not changeable)
- Subtype dropdown (driven by node.type)
- Label input (required)
- Notes textarea
- Save → PATCH /api/nodes/[id] → show "Saved ✓" without navigating
- Relationships section (full list + ✕ delete + inline add form) — copy exactly from EditNodeClient.tsx
- Delete node button at bottom — copy exactly from EditNodeClient.tsx
- "← Back" link goes to `/nodes/[id]`

### Shared behaviour
- Same INPUT_CLASS, same SUBTYPES map, same RELATIONSHIP_TYPES from relationshipType.options
- Same dark slate-950 styling throughout
- Loading/error states in edit mode

## WHAT TO CHANGE

1. **Create `components/NodeEditor.tsx`**
   - Single component handling both modes as described above
   - In create mode, no fetch needed on mount
   - In edit mode, fetch on mount (copy load logic from EditNodeClient.tsx)

2. **Replace `app/nodes/[id]/edit/EditNodeClient.tsx`**
   - Just render `<NodeEditor mode="edit" id={id} />`
   - No other logic needed

3. **Replace `app/create/page.tsx`**
   - Keep the Node / Relationship tab toggle
   - Node tab: render `<NodeEditor mode="create" />`
   - Relationship tab: keep existing RelationshipForm code unchanged (copy it as-is from the current file)

## ACCEPTANCE
- [ ] `npm run build` passes with no type errors
- [ ] Create node flow works (type selectable, POST, navigate to new node)
- [ ] Edit node flow works (type read-only, PATCH, Saved ✓)
- [ ] Relationship add/delete still works in edit mode
- [ ] Delete node still works in edit mode
- [ ] Relationship tab on /create still works
- [ ] No duplicate SUBTYPES/RELATIONSHIP_TYPES definitions — defined once in NodeEditor
