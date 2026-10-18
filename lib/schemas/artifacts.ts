import { z } from 'zod';
import { baseNodeSchema } from './common';

// ── Agreement ─────────────────────────────────────────────────────────────────

export const agreementSubtype = z.enum([
  'contract',  // prospective — governs future events
  'deed',      // retrospective — memorializes completed events
  'treaty',
  'mou',       // memorandum of understanding / letter of intent
  'other',
]);

export const agreementSchema = baseNodeSchema.extend({
  type: z.literal('Agreement'),
  subtype: agreementSubtype,
  executedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  jurisdiction: z.string().optional(),
  governingLaw: z.string().optional(),
  description: z.string().optional(),
});

// ── Record ────────────────────────────────────────────────────────────────────

export const recordSubtype = z.enum([
  'filing',
  'report',
  'registry-entry',
  'other',
]);

export const recordSchema = baseNodeSchema.extend({
  type: z.literal('Record'),
  subtype: recordSubtype,
  filedAt: z.string().datetime().optional(),
  filedWith: z.string().optional(), // e.g. "SEC", "Land Registry"
  referenceNumber: z.string().optional(),
  description: z.string().optional(),
});

// ── Asset ─────────────────────────────────────────────────────────────────────

export const assetSubtype = z.enum([
  'account',
  'real-property',
  'personal-property',
  'location',
  'intellectual-property',
  'other',
]);

export const assetSchema = baseNodeSchema.extend({
  type: z.literal('Asset'),
  subtype: assetSubtype,
  estimatedValue: z.number().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  address: z.string().optional(),        // for real-property / location
  accountNumber: z.string().optional(),  // for accounts (store masked)
  institution: z.string().optional(),    // bank, registry, etc.
});

// ── Union ─────────────────────────────────────────────────────────────────────

export const artifactSchema = z.discriminatedUnion('type', [
  agreementSchema,
  recordSchema,
  assetSchema,
]);

export type Agreement = z.infer<typeof agreementSchema>;
export type Record = z.infer<typeof recordSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
