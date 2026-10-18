# Trafik-Hound: Purpose and Architecture

## Purpose

Trafik-Hound is a browser-based platform for recording, visualizing, and querying relationship graphs between real-world entities. A signed-in user creates nodes — people, organizations, agents, events, agreements, assets — and connects them with typed, time-stamped relationships. The application stores the graph in Neo4j and exposes a generic explorer interface for traversal, search, and pattern discovery.

The repository supports three top-level entity supertypes: Actors (Person, Organization, Agent), Events (Transaction subtypes and Interactions), and Artifacts (Agreement subtypes, Records, and Assets). Every relationship carries temporal properties so the graph can represent how connections form, change, and dissolve over time.

## Overall Architecture

The application is a single Next.js App Router project using React and TypeScript.

### Presentation and routing

- `app/` contains pages and route handlers.
- `app/page.tsx` is the landing and entry point.
- `app/explore/page.tsx` is the primary graph explorer — browsing, searching, and traversing nodes and relationships.
- `app/nodes/[id]/page.tsx` is the detail view for a single node and its immediate neighborhood.
- `app/create/page.tsx` provides guided forms for creating nodes and relationships.
- `components/` contains the navigation, graph visualization canvas, node/relationship forms, and type-specific display cards.

### Graph API layer

`POST /api/nodes` and `POST /api/relationships` accept typed payloads, validate them, and write to Neo4j via Cypher. `GET /api/nodes` and `GET /api/nodes/[id]` support search and neighborhood queries. All routes authenticate the request, validate input shape, and map errors to stable client-safe responses.

Each entity type has a schema module under `lib/schemas/` that defines its required and optional properties and validates payloads at the API boundary before any write reaches the database.

### Data model

The graph is organized around three supertypes:

**Actor** — things that act
- Person
- Organization (with `transient` flag for committees, conferences, ad-hoc groups)
- Agent (AI or automated — carries `controller`, `version`, and `instanceOf` properties)

**Event** — things that happen
- Transaction (subtypes: Financial, Sale, Barter, Gift/Donation, Service, Rights Transfer, Obligation Transfer)
- Interaction (subtypes: Meeting/Negotiation, Communication, Attack, Arrest/Detention, Inspection)

**Artifact** — things that persist and are created or modified by events
- Agreement (subtypes: Contract, Deed, Treaty, MOU/Letter of Intent)
- Record (Filing, Report, Registry Entry)
- Asset (Account, Location, Property)

Key relationship types include:
- `PARTICIPATED_IN {role}` — Actor to Event, N-party capable
- `GOVERNS` — Agreement to Event (prospective)
- `MEMORIALIZES` — Deed to Event (retrospective)
- `SETTLES` — Financial Transaction to Sale Transaction
- `TRANSFERS` — Event to Asset
- `IS_MEMBER_OF {validFrom, validTo}` — Actor to Organization
- `CONTROLLED_BY` — Agent to Actor
- `SECURED_BY` — Agreement to Asset (collateral)

All relationships carry `validFrom` and `validTo` timestamps where applicable.

### Persistence and graph queries

- `neo4j-driver` connects to Neo4j Aura via `neo4j+s://` bolt protocol.
- `lib/neo4j.ts` exports a shared driver singleton, initialized from environment variables.
- Cypher queries are composed in service modules under `lib/graph/` — one module per entity supertype.
- Node IDs are cuid2s assigned at creation time; Neo4j internal IDs are not exposed to the API layer.

### External services

- Neo4j Aura supplies persistent graph storage.
- Authentication provider TBD (NextAuth with Google OAuth is the expected choice, consistent with other projects).
- No payment or credit system planned.

## Architectural Risks and Known Gaps

### Known gaps (pre-implementation)

1. **Authentication and authorization not yet designed.** Node visibility, ownership, and multi-user isolation have not been specified. The first implementation should define a simple access model before adding sharing or collaboration features.

2. **No schema enforcement at the database layer.** Neo4j does not enforce property types or required fields at write time. All validation must happen in the API layer; a missing or malformed schema check will silently write invalid nodes.

3. **Relationship directionality needs a consistent convention.** Cypher relationships are directed, but some semantic relationships (e.g. KNOWS) are conceptually symmetric. The convention for how to store and query bidirectional relationships must be decided before the schema is locked.

4. **Temporal queries are non-trivial in Cypher.** Filtering relationships by `validFrom`/`validTo` requires date comparison on every traversal. Performance implications of this pattern at scale should be evaluated early.

5. **Graph visualization at scale is unsolved.** Rendering large neighborhoods in the browser degrades quickly. The explorer should define a depth and degree limit for initial renders and provide progressive expansion rather than rendering unbounded subgraphs.

6. **No automated test suite planned yet.** Schema validation, Cypher query correctness, and authorization logic should have test coverage before the codebase grows.

### Maintainability risks

- Cypher queries embedded in service modules can drift from the data model if schema decisions change without updating all query sites.
- Entity type discrimination (Person vs Organization vs Agent all share Actor) must be handled consistently; ad-hoc `type` string checks scattered across the codebase will cause bugs.
- Without a migration strategy, evolving the graph schema (adding properties, renaming relationship types) will require manual data fixup scripts.

## Obvious Next Steps

1. **Scaffold the Next.js project and wire the Neo4j driver.** Confirm the driver singleton, verify connectivity in a health-check route, and push the initial repo structure.

2. **Define and implement the schema layer.** Write schema modules for each entity type under `lib/schemas/`. These are the single source of truth for what properties each node type requires.

3. **Build the write API.** Implement `POST /api/nodes` and `POST /api/relationships` with validation, error handling, and Cypher writes.

4. **Build the read API.** Implement search, neighborhood queries, and single-node detail endpoints.

5. **Build the explorer UI.** Start with a simple list/search view before adding graph visualization. Get data flowing before investing in canvas rendering.

6. **Add authentication.** Decide the access model, implement NextAuth, and apply ownership checks to all write routes.

7. **Add graph visualization.** Evaluate libraries (e.g. `react-force-graph`, `cytoscape.js`, `neovis.js`) against the depth-limit and progressive-expansion requirements.

8. **Seed the Game of Thrones example.** Use the Stannis/Iron Bank/Golden Company scenario from the design phase to exercise the full data model end-to-end and catch gaps.
