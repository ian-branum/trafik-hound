# TASK: Type-specific node fields — display and editing

## SCOPE
- `lib/schemas/nodeFields.ts` — new field registry (source of truth for UI)
- `app/nodes/[id]/page.tsx` — render only populated type-specific fields with labels
- `components/NodeEditor.tsx` — render all type-specific fields in edit mode with correct input widgets
- `components/NodeFieldInput.tsx` — new reusable input component (text/number/date/enum/boolean)

## CONTEXT

### Existing schemas (read these — do not change them)
All type-specific fields are defined in:
- `lib/schemas/actors.ts` — Person, Organization, Agent
- `lib/schemas/events.ts` — Transaction, Interaction
- `lib/schemas/artifacts.ts` — Agreement, Record, Asset
- `lib/schemas/common.ts` — baseNodeSchema (id, label, notes, createdAt)

### Base fields (already handled in NodeEditor)
`label`, `notes`, `subtype` are already rendered by NodeEditor. Do NOT include them in the field registry — they'd render twice. Also exclude: `id`, `type`, `createdAt`, `marqueeUrl`, `images`, `documents`, `passwordHash`.

### How type-specific fields are stored in Neo4j
All properties are flat on the node. Dates stored as ISO strings (`z.string().date()` = YYYY-MM-DD, `z.string().datetime()` = full ISO). Numbers as numbers. Booleans as booleans.

## FIELD REGISTRY — `lib/schemas/nodeFields.ts`

Define and export:

```ts
export type FieldKind = 'text' | 'number' | 'date' | 'datetime' | 'enum' | 'boolean';

export interface FieldDef {
  key: string;          // property name on Neo4j node
  label: string;        // human-readable label
  kind: FieldKind;
  options?: string[];   // only for kind='enum'
  placeholder?: string;
}

export const NODE_FIELDS: Record<string, FieldDef[]> = { ... }
```

Build the registry from the schemas. Here is the complete mapping:

**Person**
- firstName: text, "First name"
- lastName: text, "Last name"  
- aliases: text, "Aliases", placeholder "comma-separated"
- nationality: text, "Nationality"
- dateOfBirth: date, "Date of birth"
- dateOfDeath: date, "Date of death"

**Organization**
- orgType: enum, "Organisation type", options: ['company','government','ngo','family','club','team','committee','other']
- transient: boolean, "Transient" (conferences, ad-hoc groups)
- foundedDate: date, "Founded date"
- dissolvedDate: date, "Dissolved date"
- jurisdiction: text, "Jurisdiction"

**Agent**
- agentType: enum, "Agent type", options: ['ai','automated','software','other']
- version: text, "Version"
- instanceOf: text, "Instance of (node ID)"
- controlledBy: text, "Controlled by (node ID)"
- deployedAt: datetime, "Deployed at"
- retiredAt: datetime, "Retired at"

**Transaction**
- occurredAt: datetime, "Occurred at"
- amount: number, "Amount"
- currency: text, "Currency", placeholder "e.g. USD, EUR"
- description: text, "Description"

**Interaction**
- occurredAt: datetime, "Occurred at"
- duration: text, "Duration", placeholder "e.g. PT2H (ISO 8601)"
- description: text, "Description"

**Agreement**
- executedAt: datetime, "Executed at"
- expiresAt: datetime, "Expires at"
- jurisdiction: text, "Jurisdiction"
- governingLaw: text, "Governing law"
- description: text, "Description"

**Record**
- filedAt: datetime, "Filed at"
- filedWith: text, "Filed with", placeholder "e.g. SEC, Land Registry"
- referenceNumber: text, "Reference number"
- description: text, "Description"

**Asset**
- estimatedValue: number, "Estimated value"
- currency: text, "Currency", placeholder "e.g. USD, EUR"
- description: text, "Description"
- address: text, "Address"
- accountNumber: text, "Account number", placeholder "store masked (e.g. ****1234)"
- institution: text, "Institution"

## COMPONENT — `components/NodeFieldInput.tsx`

A small `'use client'` component:
```tsx
interface Props {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, value: string | number | boolean | null) => void;
  readOnly?: boolean;
}
```

Render:
- `text` → `<input type="text" />`
- `number` → `<input type="number" />`
- `date` → `<input type="date" />` (value formatted as YYYY-MM-DD)
- `datetime` → `<input type="datetime-local" />` (value formatted as YYYY-MM-DDTHH:mm, stored back as full ISO)
- `enum` → `<select>` with `<option value="">— select —</option>` + options
- `boolean` → `<input type="checkbox" />` with the label inline

Use the same `INPUT_CLASS` styling exported from NodeEditor. Import it.

For `readOnly` mode: render a `<span>` or `<dd>` styled as `text-slate-200` instead of an input.

## NODE DETAIL PAGE — `app/nodes/[id]/page.tsx`

Replace the current generic "Properties" section with type-specific field rendering:

1. Look up `NODE_FIELDS[node.type]` (or `[]` if not found)
2. Filter to fields where `n[field.key]` is not null/undefined/empty string
3. For datetime/date values, format them nicely for display:
   - date: `new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })`
   - datetime: same but include time
4. For boolean: show "Yes" / "No"
5. For enum: show the value as-is (already human-readable)
6. Render as a `<dl>` with `<dt>` (field.label) and `<dd>` (formatted value) — same styling as before
7. If no type-specific fields have values, render nothing (don't show an empty section)

Keep the existing `notes` rendering (it's already in the base section). Keep `SKIP_KEYS` updated to include all type-specific keys so they don't also appear in the generic extras list.

## NODE EDITOR — `components/NodeEditor.tsx`

In edit mode, below the existing `notes` field and above the Save button:

1. Look up `NODE_FIELDS[node.type]` (or `[]`)
2. Maintain a `typeFields` state object: `Record<string, string | number | boolean | null>` — initialised from the loaded node on mount
3. Render each field using `<NodeFieldInput>`, passing the current value and an `onChange` that updates `typeFields`
4. On save (PATCH), merge `typeFields` into the patch body alongside label/subtype/notes
5. Null/empty values should be included as `null` in the patch so they can clear existing values

## ACCEPTANCE
- [ ] `npm run build` passes with no type errors
- [ ] Node detail page shows type-specific fields with human labels, only when populated
- [ ] Node editor shows all type-specific fields for the node's type with correct input widgets
- [ ] Values round-trip correctly (save → reload shows same value)
- [ ] Date/datetime inputs display correctly in both view and edit
- [ ] Boolean renders as checkbox in edit, Yes/No in view
- [ ] Enum renders as dropdown in edit, value as-is in view
- [ ] Generic extras list no longer shows type-specific keys
