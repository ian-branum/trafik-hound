# TASK: Image and Document Attachments via Vercel Blob

## SCOPE
- `package.json` — add `@vercel/blob`
- `app/api/upload/route.ts` — POST (upload) and DELETE (remove) handlers
- `lib/graph/nodes.ts` — add `addAttachment()` and `removeAttachment()` helpers
- `components/NodeEditor.tsx` — add Attachments section below Relationships (edit mode only)

## CONTEXT

### How attachments are stored
Attachments are stored as JSON arrays on the Neo4j node:
- `node.images` — array of `{ url, name, size }` — images only (jpeg, png, gif, webp)
- `node.documents` — array of `{ url, name, size, mimeType }` — PDFs and other docs

Neo4j doesn't have a native array-of-objects type. Store each as a JSON string array:
- `images` property = JSON.stringify([{ url, name, size }, ...])
- `documents` property = JSON.stringify([{ url, name, size, mimeType }, ...])

Parse on read. The `updateNode` PATCH already uses `SET n += $patch` so arrays can be written the same way.

### Vercel Blob
- Package: `@vercel/blob`
- Upload: `put(filename, body, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN })`
- Delete: `del(url, { token: process.env.BLOB_READ_WRITE_TOKEN })`
- Returns `{ url }` on upload
- `BLOB_READ_WRITE_TOKEN` env var — already set in Vercel by Ian

### Auth
All upload/delete endpoints are protected by existing middleware (authenticated + enabled users only). No extra auth needed.

## WHAT TO BUILD

### 1. `app/api/upload/route.ts`

**POST** — upload a file
- Accept `multipart/form-data` with fields: `file` (the blob), `nodeId` (string), `kind` (string: 'image' | 'document')
- Validate: nodeId required, kind must be 'image' or 'document'
- Image allowed mimeTypes: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Document allowed mimeTypes: `application/pdf`, `text/plain`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Max file size: 10MB
- Upload to Vercel Blob with filename: `trafik-hound/<nodeId>/<kind>/<originalFilename>`
- Call `addAttachment(nodeId, kind, { url, name, size, mimeType })` to persist to Neo4j
- Return `{ url, name, size, mimeType }` with 201

**DELETE** — remove a file
- Body: `{ nodeId, url, kind }` 
- Call `del(url)` from `@vercel/blob` to remove from blob store
- Call `removeAttachment(nodeId, kind, url)` to remove from Neo4j node
- Return 204

### 2. `lib/graph/nodes.ts` additions

**`addAttachment(nodeId, kind, attachment)`**
```ts
type Attachment = { url: string; name: string; size: number; mimeType?: string };
```
- MATCH node by id (WHERE NOT n:_System)
- Read current `n.images` or `n.documents` (JSON string, default '[]')
- Parse, append new attachment, stringify
- SET the property back
- Return updated attachment list

**`removeAttachment(nodeId, kind, url)`**
- MATCH node, read array, filter out the entry with matching url, SET back
- Return updated list

### 3. `components/NodeEditor.tsx` — Attachments section

Add below the Relationships section, **edit mode only**.

On mount (alongside the existing node fetch), parse `node.images` and `node.documents` from the node props (they're JSON strings — parse with `JSON.parse`, default to `[]` on error/missing).

**Images subsection:**
- Grid of image thumbnails (use `<img>` tags, the blob URLs are public)
- Each thumbnail has an ✕ button overlay (top-right corner)
- Below the grid: file input button "Attach image" (accept="image/jpeg,image/png,image/gif,image/webp")
- On file select: POST to `/api/upload` (multipart), show upload progress via disabled state, append to list on success

**Documents subsection:**
- List of documents: file icon + name + size (formatted: KB/MB) + ✕ button
- Below: file input button "Attach document" (accept=".pdf,.txt,.doc,.docx")
- Same upload flow as images

**Deletion:**
- ✕ on image or document → `window.confirm()` → DELETE `/api/upload` → remove from local list

**Upload state:**
- While uploading: disable the file input, show a small spinner or "Uploading…" text
- On error: show inline error message

**Style:**
- Same dark slate-950 theme, same border/card treatment as the Relationships section
- Image thumbnails: `h-24 w-24 object-cover rounded-lg border border-slate-700`
- Document list items: same style as relationship list items

## ACCEPTANCE
- [ ] `npm run build` passes with no type errors
- [ ] Images upload and appear as thumbnails in edit mode
- [ ] Documents upload and appear in list with name + size
- [ ] ✕ removes from blob store and from Neo4j
- [ ] File type validation enforced server-side (400 on wrong type)
- [ ] 10MB limit enforced (400 on oversize)
- [ ] Attachments persist across page reloads (stored in Neo4j)
- [ ] Attachments section does NOT appear in create mode
