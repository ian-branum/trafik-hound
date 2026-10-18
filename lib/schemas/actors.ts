import { z } from 'zod';
import { baseNodeSchema } from './common';

// ── Person ───────────────────────────────────────────────────────────────────

export const personSchema = baseNodeSchema.extend({
  type: z.literal('Person'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  nationality: z.string().optional(),
  dateOfBirth: z.string().date().optional(),
  dateOfDeath: z.string().date().optional(),
});

// ── Organization ─────────────────────────────────────────────────────────────

export const organizationSchema = baseNodeSchema.extend({
  type: z.literal('Organization'),
  orgType: z.enum([
    'company',
    'government',
    'ngo',
    'family',
    'club',
    'team',
    'committee',
    'other',
  ]).optional(),
  transient: z.boolean().default(false), // conferences, ad-hoc groups, etc.
  foundedDate: z.string().date().optional(),
  dissolvedDate: z.string().date().optional(),
  jurisdiction: z.string().optional(),
});

// ── Agent ─────────────────────────────────────────────────────────────────────

export const agentSchema = baseNodeSchema.extend({
  type: z.literal('Agent'),
  agentType: z.enum(['ai', 'automated', 'software', 'other']).optional(),
  version: z.string().optional(),
  instanceOf: z.string().optional(), // ID of the template/parent agent
  controlledBy: z.string().optional(), // Actor ID
  deployedAt: z.string().datetime().optional(),
  retiredAt: z.string().datetime().optional(),
});

// ── Union ─────────────────────────────────────────────────────────────────────

export const actorSchema = z.discriminatedUnion('type', [
  personSchema,
  organizationSchema,
  agentSchema,
]);

export type Person = z.infer<typeof personSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type Agent = z.infer<typeof agentSchema>;
export type Actor = z.infer<typeof actorSchema>;
