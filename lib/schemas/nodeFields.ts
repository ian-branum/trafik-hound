/**
 * Field registry for type-specific node properties.
 *
 * This is the single source of truth for the *UI*: the node detail page uses it
 * to render values with human labels, and the node editor uses it to pick the
 * right input widget. It mirrors the Zod schemas in `actors.ts`, `events.ts`
 * and `artifacts.ts` — keep the two in sync when adding a field.
 *
 * Base fields (`id`, `label`, `notes`, `type`, `subtype`, `createdAt`) and
 * system fields (`marqueeUrl`, `images`, `documents`, `passwordHash`) are
 * deliberately excluded: they're rendered elsewhere.
 */

export type FieldKind = 'text' | 'number' | 'date' | 'datetime' | 'enum' | 'boolean';

export interface FieldDef {
  key: string; // property name on the Neo4j node
  label: string; // human-readable label
  kind: FieldKind;
  options?: string[]; // only for kind='enum'
  placeholder?: string;
}

export const NODE_FIELDS: Record<string, FieldDef[]> = {
  Person: [
    { key: 'firstName', label: 'First name', kind: 'text' },
    { key: 'lastName', label: 'Last name', kind: 'text' },
    { key: 'aliases', label: 'Aliases', kind: 'text', placeholder: 'comma-separated' },
    { key: 'nationality', label: 'Nationality', kind: 'text' },
    { key: 'dateOfBirth', label: 'Date of birth', kind: 'date' },
    { key: 'dateOfDeath', label: 'Date of death', kind: 'date' },
  ],

  Organization: [
    {
      key: 'orgType',
      label: 'Organisation type',
      kind: 'enum',
      options: ['company', 'government', 'ngo', 'family', 'club', 'team', 'committee', 'other'],
    },
    { key: 'transient', label: 'Transient', kind: 'boolean' },
    { key: 'foundedDate', label: 'Founded date', kind: 'date' },
    { key: 'dissolvedDate', label: 'Dissolved date', kind: 'date' },
    { key: 'jurisdiction', label: 'Jurisdiction', kind: 'text' },
  ],

  Agent: [
    {
      key: 'agentType',
      label: 'Agent type',
      kind: 'enum',
      options: ['ai', 'automated', 'software', 'other'],
    },
    { key: 'version', label: 'Version', kind: 'text' },
    { key: 'instanceOf', label: 'Instance of (node ID)', kind: 'text' },
    { key: 'controlledBy', label: 'Controlled by (node ID)', kind: 'text' },
    { key: 'deployedAt', label: 'Deployed at', kind: 'datetime' },
    { key: 'retiredAt', label: 'Retired at', kind: 'datetime' },
  ],

  Transaction: [
    { key: 'occurredAt', label: 'Occurred at', kind: 'datetime' },
    { key: 'amount', label: 'Amount', kind: 'number' },
    { key: 'currency', label: 'Currency', kind: 'text', placeholder: 'e.g. USD, EUR' },
    { key: 'description', label: 'Description', kind: 'text' },
  ],

  Interaction: [
    { key: 'occurredAt', label: 'Occurred at', kind: 'datetime' },
    { key: 'duration', label: 'Duration', kind: 'text', placeholder: 'e.g. PT2H (ISO 8601)' },
    { key: 'description', label: 'Description', kind: 'text' },
  ],

  Agreement: [
    { key: 'executedAt', label: 'Executed at', kind: 'datetime' },
    { key: 'expiresAt', label: 'Expires at', kind: 'datetime' },
    { key: 'jurisdiction', label: 'Jurisdiction', kind: 'text' },
    { key: 'governingLaw', label: 'Governing law', kind: 'text' },
    { key: 'description', label: 'Description', kind: 'text' },
  ],

  Record: [
    { key: 'filedAt', label: 'Filed at', kind: 'datetime' },
    { key: 'filedWith', label: 'Filed with', kind: 'text', placeholder: 'e.g. SEC, Land Registry' },
    { key: 'referenceNumber', label: 'Reference number', kind: 'text' },
    { key: 'description', label: 'Description', kind: 'text' },
  ],

  Asset: [
    { key: 'estimatedValue', label: 'Estimated value', kind: 'number' },
    { key: 'currency', label: 'Currency', kind: 'text', placeholder: 'e.g. USD, EUR' },
    { key: 'description', label: 'Description', kind: 'text' },
    { key: 'address', label: 'Address', kind: 'text' },
    {
      key: 'accountNumber',
      label: 'Account number',
      kind: 'text',
      placeholder: 'store masked (e.g. ****1234)',
    },
    { key: 'institution', label: 'Institution', kind: 'text' },
  ],
};

/** Field definitions for a node type (empty array when unknown). */
export function getNodeFields(type: unknown): FieldDef[] {
  return typeof type === 'string' ? (NODE_FIELDS[type] ?? []) : [];
}

/** Every type-specific key, useful for filtering them out of generic lists. */
export const ALL_NODE_FIELD_KEYS: string[] = Array.from(
  new Set(Object.values(NODE_FIELDS).flat().map((field) => field.key))
);
