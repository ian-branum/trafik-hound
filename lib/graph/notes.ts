import { createId } from '@paralleldrive/cuid2';
import getDriver from '@/lib/neo4j';

export type Note = {
  id: string;
  nodeId: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DiscussionEntry = {
  id: string;
  nodeId: string;
  content: string;
  authorName: string;
  authorImage: string | null;
  publishedAt: string;
  sourceNoteId: string;
  republishOfId: string | null;
};

/** Thrown when a note doesn't exist or isn't authored by the requesting user. */
export class NoteAccessError extends Error {
  constructor(message = 'Note not found') {
    super(message);
    this.name = 'NoteAccessError';
  }
}

function toNote(raw: Record<string, unknown>): Note {
  return {
    id: String(raw.id ?? ''),
    nodeId: String(raw.nodeId ?? ''),
    content: String(raw.content ?? ''),
    pinned: raw.pinned === true,
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? ''),
  };
}

function toEntry(raw: Record<string, unknown>): DiscussionEntry {
  return {
    id: String(raw.id ?? ''),
    nodeId: String(raw.nodeId ?? ''),
    content: String(raw.content ?? ''),
    authorName: String(raw.authorName ?? 'Unknown'),
    authorImage: typeof raw.authorImage === 'string' ? raw.authorImage : null,
    publishedAt: String(raw.publishedAt ?? ''),
    sourceNoteId: String(raw.sourceNoteId ?? ''),
    republishOfId: typeof raw.republishOfId === 'string' ? raw.republishOfId : null,
  };
}

// ── Notes (private) ────────────────────────────────────────────────────────

/** All of a user's notes for a node: pinned first, then oldest first. */
export async function getNotes(nodeId: string, userId: string): Promise<Note[]> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (note:Note:_System {nodeId: $nodeId})-[:AUTHORED_BY]->(u:User {id: $userId})
       RETURN properties(note) AS note
       ORDER BY note.pinned DESC, note.createdAt ASC`,
      { nodeId, userId }
    );
    return result.records.map((record) =>
      toNote(record.get('note') as Record<string, unknown>)
    );
  } finally {
    await session.close();
  }
}

export async function createNote(
  nodeId: string,
  userId: string,
  content: string
): Promise<Note> {
  const now = new Date().toISOString();
  const note: Note = {
    id: createId(),
    nodeId,
    content,
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };

  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (n {id: $nodeId})
       WHERE NOT n:_System
       MATCH (u:User {id: $userId})
       CREATE (note:Note:_System $note)
       CREATE (note)-[:AUTHORED_BY]->(u)
       RETURN properties(note) AS note`,
      { nodeId, userId, note }
    );

    if (result.records.length === 0) {
      throw new NoteAccessError('Node or user not found');
    }

    return toNote(result.records[0].get('note') as Record<string, unknown>);
  } finally {
    await session.close();
  }
}

/**
 * Update content and/or pinned state. Only the author can edit.
 * Returns `null` when the note doesn't exist or belongs to someone else.
 */
export async function updateNote(
  noteId: string,
  userId: string,
  patch: { content?: string; pinned?: boolean }
): Promise<Note | null> {
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (patch.content !== undefined) updates.content = patch.content;
  if (patch.pinned !== undefined) updates.pinned = patch.pinned;

  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (note:Note:_System {id: $noteId})-[:AUTHORED_BY]->(u:User {id: $userId})
       SET note += $updates
       RETURN properties(note) AS note`,
      { noteId, userId, updates }
    );

    if (result.records.length === 0) return null;
    return toNote(result.records[0].get('note') as Record<string, unknown>);
  } finally {
    await session.close();
  }
}

/** Delete a note. Returns `false` when it doesn't exist or isn't the caller's. */
export async function deleteNote(noteId: string, userId: string): Promise<boolean> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (note:Note:_System {id: $noteId})-[:AUTHORED_BY]->(u:User {id: $userId})
       DETACH DELETE note
       RETURN 1 AS deleted`,
      { noteId, userId }
    );

    if (result.records.length === 0) return false;
    return true;
  } finally {
    await session.close();
  }
}

/**
 * Publish a private note to the shared discussion.
 * Re-publishing the same note links back to the most recent entry it produced.
 * Throws `NoteAccessError` when the note isn't the caller's.
 */
export async function publishNote(
  noteId: string,
  userId: string
): Promise<DiscussionEntry> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const found = await session.run(
      `MATCH (note:Note:_System {id: $noteId})-[:AUTHORED_BY]->(u:User {id: $userId})
       RETURN properties(note) AS note, properties(u) AS author`,
      { noteId, userId }
    );

    if (found.records.length === 0) {
      throw new NoteAccessError('Note not found');
    }

    const note = found.records[0].get('note') as Record<string, unknown>;
    const author = found.records[0].get('author') as Record<string, unknown>;
    const nodeId = String(note.nodeId ?? '');

    // Most recent entry produced from this note, if any.
    const previous = await session.run(
      `MATCH (prev:DiscussionEntry:_System {sourceNoteId: $noteId})
       RETURN prev.id AS id
       ORDER BY prev.publishedAt DESC
       LIMIT 1`,
      { noteId }
    );
    const republishOfId =
      previous.records.length > 0 ? String(previous.records[0].get('id')) : null;

    const authorName =
      (typeof author.name === 'string' && author.name.trim()) ||
      (typeof author.email === 'string' ? author.email.split('@')[0] : 'Unknown');
    const authorImage = typeof author.image === 'string' ? author.image : null;

    const entry: DiscussionEntry = {
      id: createId(),
      nodeId,
      content: String(note.content ?? ''),
      authorName,
      authorImage,
      publishedAt: new Date().toISOString(),
      sourceNoteId: noteId,
      republishOfId,
    };

    // Neo4j ignores null map values, but keep the map clean anyway.
    const entryProps: Record<string, unknown> = { ...entry };
    if (!republishOfId) delete entryProps.republishOfId;

    await session.run(
      `MATCH (n {id: $nodeId})
       WHERE NOT n:_System
       MATCH (u:User {id: $userId})
       CREATE (entry:DiscussionEntry:_System $entry)
       CREATE (entry)-[:ON_NODE]->(n)
       CREATE (entry)-[:PUBLISHED_BY]->(u)`,
      { nodeId, userId, entry: entryProps }
    );

    if (republishOfId) {
      await session.run(
        `MATCH (entry:DiscussionEntry:_System {id: $entryId})
         MATCH (prev:DiscussionEntry:_System {id: $prevId})
         CREATE (entry)-[:REPUBLISH_OF]->(prev)`,
        { entryId: entry.id, prevId: republishOfId }
      );
    }

    return entry;
  } finally {
    await session.close();
  }
}

// ── Discussion (shared) ────────────────────────────────────────────────────

/** Every published entry for a node, oldest first. */
export async function getDiscussion(nodeId: string): Promise<DiscussionEntry[]> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (entry:DiscussionEntry:_System {nodeId: $nodeId})
       RETURN properties(entry) AS entry
       ORDER BY entry.publishedAt ASC`,
      { nodeId }
    );
    return result.records.map((record) =>
      toEntry(record.get('entry') as Record<string, unknown>)
    );
  } finally {
    await session.close();
  }
}
