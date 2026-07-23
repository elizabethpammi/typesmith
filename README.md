# Typesmith

**Paste an API contract. Forge React-ready code.**

Live: **https://typesmith-app.vercel.app**

Typesmith takes a raw JSON payload or an OpenAPI 3 spec and instantly generates everything a React app needs to talk to that API:

- **`types.ts`** — TypeScript interfaces, with structural deduplication so repeated shapes emit once
- **`schemas.ts`** — Zod schemas (enums, `.nullable()`, `.optional()`, `.uuid()` / `.email()` / `.datetime()` format refinements) plus inferred types
- **`hooks.ts`** — TanStack Query v5 hooks: typed `useQuery` hooks with stable query keys and `URLSearchParams` handling, `useMutation` hooks with cache invalidation
- **`mocks.ts`** — Deterministic, field-name-aware mock fixtures typed against the generated interfaces, wired into MSW request handlers
- **Preview** — a live rendered data table from the inferred shape, and a working form validated in real time by a zod schema built at runtime (no `eval`)

Everything runs in the browser. Nothing is uploaded anywhere.

## Try it

Open the live site and click an example chip:

- **Users API** (JSON) — shows optional-field detection (`referredBy` appears on one of three users), nullable unions (`lastLogin: string | null`), nested objects, and format inference (email, date-time)
- **Payments list** (JSON) — a Stripe-style list envelope; shows list unwrapping, snake_case handling, and nullable failure messages
- **Todos spec** (OpenAPI 3, YAML) — shows `$ref` resolution into shared named types, enums to literal unions, path/query params, request bodies, and a 204 delete

Or paste your own payload / spec into the left pane.

## How it works

The pipeline is a small IR (intermediate representation) with four emitters on top:

```
JSON payload ──► infer()  ──┐
                            ├──► Contract { namedShapes, endpoints } ──► TypeScript / Zod / Hooks / Mocks emitters
OpenAPI spec ──► parseOpenApi ──┘                                   └──► runtime zod builder + seeded mock generator (Preview)
```

- `src/lib/infer.ts` — the Shape IR: objects, arrays, primitives (with detected formats), literals, nullable unions. `merge()` reconciles shapes across array items, so a field missing from some items becomes optional and conflicting types become unions.
- `src/lib/openapi.ts` — OpenAPI 3 to the same IR: local `$ref` resolution (circular-safe), `allOf` merging, `oneOf`/`anyOf` unions, enums, nullable, path/query parameters. Unsupported corners degrade to `unknown` with a visible note instead of failing.
- `src/lib/emit/registry.ts` — names are claimed against a structural key of the shape, so the same shape referenced from five endpoints gets one interface, and OpenAPI component names always win.
- `src/lib/mock.ts` — a seeded PRNG (mulberry32) plus field-name heuristics (id, email, name, city, amount, dates...) generates realistic fixtures that are fully deterministic: the same contract always produces the same mocks.
- `src/lib/zod-runtime.ts` — builds a real zod schema object from the IR (mirroring what the emitted `schemas.ts` would do) to power the live form validation in the Preview tab.

The round-trip property is tested: for every endpoint in every example, the generated mock response must validate against the runtime zod schema built from the same shape.

## Run locally

```bash
npm install
npm run dev      # vite dev server
npm test         # vitest: infer, naming, openapi, emitters, round-trip
npm run build    # tsc --noEmit && vite build
```

No environment variables, no backend, no accounts. It is a static SPA.

## Stack

Vite · React 18 · TypeScript (strict) · Zod · js-yaml. The syntax highlighter is 40 lines of regex, not a dependency, and every character of highlighted output is HTML-escaped before rendering.

## Author

Elizabeth Pammi — [github.com/elizabethpammi](https://github.com/elizabethpammi) · [portfolio](https://elizabeth-pammi-site.vercel.app/)

MIT licensed.
