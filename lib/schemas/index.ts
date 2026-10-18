// Single import point for all schemas and types

export * from './common';
export * from './actors';
export * from './events';
export * from './artifacts';
export * from './relationships';

// Top-level node union — any node type the graph can hold
import { z } from 'zod';
import { actorSchema } from './actors';
import { eventSchema } from './events';
import { artifactSchema } from './artifacts';

export const nodeSchema = z.union([actorSchema, eventSchema, artifactSchema]);
export type Node = z.infer<typeof nodeSchema>;
