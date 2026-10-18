import { z } from 'zod';
import { baseNodeSchema } from './common';

// ── Transaction ───────────────────────────────────────────────────────────────

export const transactionSubtype = z.enum([
  'financial',
  'sale',
  'barter',
  'gift',
  'service',
  'rights-transfer',
  'obligation-transfer',
]);

export const transactionSchema = baseNodeSchema.extend({
  type: z.literal('Transaction'),
  subtype: transactionSubtype,
  occurredAt: z.string().datetime().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
});

// ── Interaction ───────────────────────────────────────────────────────────────

export const interactionSubtype = z.enum([
  'meeting',
  'negotiation',
  'communication',
  'attack',
  'arrest',
  'detention',
  'inspection',
  'other',
]);

export const interactionSchema = baseNodeSchema.extend({
  type: z.literal('Interaction'),
  subtype: interactionSubtype,
  occurredAt: z.string().datetime().optional(),
  duration: z.string().optional(), // ISO 8601 duration e.g. PT2H
  description: z.string().optional(),
});

// ── Union ─────────────────────────────────────────────────────────────────────

export const eventSchema = z.discriminatedUnion('type', [
  transactionSchema,
  interactionSchema,
]);

export type Transaction = z.infer<typeof transactionSchema>;
export type Interaction = z.infer<typeof interactionSchema>;
export type Event = z.infer<typeof eventSchema>;
