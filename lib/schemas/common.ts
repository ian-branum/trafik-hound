import { z } from 'zod';

// Shared building blocks used across all entity schemas

export const dateRangeSchema = z.object({
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
});

export const idSchema = z.string().min(1);

// All nodes share these base properties
export const baseNodeSchema = z.object({
  id: idSchema.optional(), // assigned at creation if omitted
  label: z.string().min(1, 'Label is required'),
  notes: z.string().optional(),
  createdAt: z.string().datetime().optional(),
});

export type DateRange = z.infer<typeof dateRangeSchema>;
export type BaseNode = z.infer<typeof baseNodeSchema>;
