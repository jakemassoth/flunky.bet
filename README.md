# flunky.bet

A Vue 3 + Supabase web app, scaffolded with Vite and managed with pnpm.

## Stack

- [Vue 3](https://vuejs.org/) (`<script setup>` SFCs) + [Vite](https://vite.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vue Router](https://router.vuejs.org/) for routing
- [Pinia](https://pinia.vuejs.org/) for state management
- [Supabase](https://supabase.com/) via [`@supabase/supabase-js`](https://github.com/supabase/supabase-js)

## Prerequisites

- [Node.js](https://nodejs.org/) `^22.18.0 || >=24.12.0`
- [pnpm](https://pnpm.io/) (pinned via the `packageManager` field in `package.json`)

If you use [Nix](https://nixos.org/), everything above (Node, pnpm, and the
Supabase CLI) is provided by the dev shell — no manual installs needed:

```sh
nix develop        # drops you into a shell with node, pnpm, supabase
# or, with direnv installed:
direnv allow       # auto-loads the dev shell on cd (uses .envrc → `use flake`)
```

## Setup

```sh
pnpm install
```

### Environment variables

The Supabase client reads its config from Vite env vars. Copy the example file
and fill in your project's values:

```sh
cp .env.example .env
```

| Variable                 | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project API URL                                          |
| `VITE_SUPABASE_ANON_KEY` | Supabase public **anon** key (never put the `service_role` key here) |

Find these in the Supabase dashboard under **Project Settings → API**, or use
the values printed by `supabase start` for local development. These vars are
inlined into the client bundle, so only ever use the public anon key.

## Scripts

```sh
pnpm dev        # start the Vite dev server with hot reload
pnpm build      # type-check (vue-tsc) and build for production into dist/
pnpm preview    # preview the production build locally
pnpm type-check # run the TypeScript type checker only
```

## Supabase

`supabase init` has been run, so a `supabase/` directory with `config.toml`
is committed for local development with the [Supabase CLI](https://supabase.com/docs/guides/cli).

```sh
supabase start   # spin up the local Supabase stack (Docker required)
supabase stop    # tear it down
```

`supabase start` prints a local API URL and anon key you can drop into `.env`.

The typed client lives in [`src/lib/supabase.ts`](src/lib/supabase.ts) and is
ready to import anywhere:

```ts
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase.from('your_table').select()
```

## Project structure

```
.
├── flake.nix              # Nix dev shell (node, pnpm, supabase CLI)
├── .envrc                 # direnv: `use flake`
├── index.html             # Vite entry HTML
├── vite.config.ts         # Vite config (@ alias → src/)
├── env.d.ts               # typed VITE_SUPABASE_* env vars
├── .env.example           # env var template (copy to .env)
├── supabase/
│   └── config.toml        # local Supabase project config
└── src/
    ├── main.ts            # app bootstrap (Pinia + Router)
    ├── App.vue
    ├── lib/
    │   └── supabase.ts    # typed Supabase client
    ├── router/            # Vue Router routes
    ├── stores/            # Pinia stores
    ├── views/             # routed views
    ├── components/        # shared components
    └── assets/            # styles and static assets
```
