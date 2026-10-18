import { z } from 'zod';
import { dateRangeSchema, idSchema } from './common';

// All relationship types in the graph, with their allowed properties

export const relationshipType = z.enum([
  'PARTICIPATED_IN',      // Actor → Event (with role)
  'GOVERNS',              // Agreement → Event (prospective)
  'MEMORIALIZES',         // Deed → Event (retrospective)
  'SETTLES',              // Financial Transaction → Sale Transaction
  'TRANSFERS',            // Event → Asset
  'IS_MEMBER_OF',         // Actor → Organization (temporal)
  'IS_SUBSIDIARY_OF',     // Organization → Organization
  'IS_AFFILIATE_OF',      // Organization → Organization
  'IS_RELATED_TO',        // Person → Person (with relationshipKind)
  'KNOWS',                // Person → Person
  'REPRESENTS',           // Actor → Actor (as agent/proxy)
  'CONTROLLED_BY',        // Agent → Actor
  'INSTANCE_OF',          // Agent → Agent (template)
  'SECURED_BY',           // Agreement → Asset (collateral)
  'DESCRIBES',            // Deed → Asset
  'HAS_ALIAS',            // Actor → Actor (same entity, different identity)
]);

export const relationshipSchema = z.object({
  fromId: idSchema,
  toId: idSchema,
  type: relationshipType,
  role: z.string().optional(),             // e.g. 'payer', 'guarantor', 'witness'
  relationshipKind: z.string().optional(), // e.g. 'spouse', 'parent', 'sibling'
  notes: z.string().optional(),
}).merge(dateRangeSchema);

export type RelationshipType = z.infer<typeof relationshipType>;
export type Relationship = z.infer<typeof relationshipSchema>;
