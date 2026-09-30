# multi-tenant-ai-catalog

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Express, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Express** - Fast, unopinionated web framework
- **Node.js** - Runtime environment
- **Mongoose** - TypeScript-first ORM
- **MongoDB** - Database engine
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

## Database Setup

This project uses MongoDB with Mongoose.

1. Make sure you have MongoDB set up.
2. Update your `apps/server/.env` file with your MongoDB connection URI.

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## Autenticação

O JWT (HS256, payload `{ sub, companyId, role }`) é entregue em um cookie httpOnly `access_token` e nunca aparece no corpo das respostas. O tenant de cada requisição vem só desse token. Detalhes e trade-offs em `docs/decisions.md` (D-08 a D-10).

Configure em `apps/server/.env` (schema em `apps/server/.env.schema`): `DATABASE_URL`, `CORS_ORIGIN`, `JWT_SECRET` (mínimo 32 caracteres, ex.: `openssl rand -base64 48`) e, opcionalmente, `JWT_EXPIRES_IN` (padrão `8h`) e `PORT` (padrão `3000`).

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/register` | público | Cria empresa + admin, define o cookie, 201 `{ user }` |
| POST | `/auth/login` | público | Define o cookie, 200 `{ user }` |
| POST | `/auth/logout` | público | Remove o cookie, 204 |
| GET | `/auth/me` | autenticado | 200 `{ user }` |
| GET | `/users` | admin | Usuários da própria empresa |
| POST | `/users` | admin | Cria usuário na própria empresa |

Roles: `admin` gerencia produtos e usuários; `user` consulta produtos e usa o chat. Register e login têm rate limit de 10 requisições/minuto por IP. POST/PUT/PATCH exigem `Content-Type: application/json` (proteção contra CSRF).

Seed com duas empresas (`pnpm db:seed`): `admin@petfeliz.test`, `user@petfeliz.test`, `admin@volt.test`, `user@volt.test`, todos com senha `password123`.

```bash
# login: salva o cookie no cookie jar
curl -i -c cookies.txt -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@petfeliz.test","password":"password123"}'

# rotas autenticadas: envia o cookie
curl -b cookies.txt http://localhost:3000/auth/me
curl -b cookies.txt http://localhost:3000/users

# logout (também exige Content-Type JSON)
curl -b cookies.txt -c cookies.txt -X POST http://localhost:3000/auth/logout \
  -H 'Content-Type: application/json'
```

## Produtos

Todas as rotas exigem o cookie de sessão e só enxergam produtos da empresa do token. Produto inexistente ou de outra empresa retorna 404 `PRODUCT_NOT_FOUND`; id malformado retorna 400. Erros seguem `{ error: { code, message, details? } }`.

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/products` | autenticado | Lista paginada, 200 `{ data, meta }` |
| GET | `/products/categories` | autenticado | Categorias distintas da empresa, 200 `{ categories }` |
| GET | `/products/:id` | autenticado | 200 `{ product }` |
| POST | `/products` | admin | Cria, 201 `{ product }` |
| PATCH | `/products/:id` | admin | Atualização parcial (ao menos um campo), 200 `{ product }` |
| DELETE | `/products/:id` | admin | Exclusão física, 204 |

Produto: `{ id, name, description, priceCents, category, imageUrl, createdAt, updatedAt }`. Preço em centavos inteiros (`18990` = R$ 189,90); `imageUrl` é `null` quando não há imagem. No POST: `name` (2–120), `description` (até 2000), `priceCents` (inteiro ≥ 0), `category` (2–60) e `imageUrl` opcional (http/https). No PATCH, `imageUrl: null` remove a imagem. `company_id` e campos desconhecidos no corpo são ignorados.

Query params de `GET /products` (todos opcionais):

| Param | Descrição |
| --- | --- |
| `search` | Trecho do nome ou da descrição, sem diferenciar maiúsculas (até 100 caracteres) |
| `category` | Categoria exata |
| `minPriceCents`, `maxPriceCents` | Faixa de preço inclusiva, em centavos |
| `sort` | `newest` (padrão), `price_asc`, `price_desc`, `name_asc` |
| `page` | Página, a partir de 1 (padrão 1) |
| `limit` | Itens por página, 1 a 50 (padrão 12) |

`meta` traz `{ page, limit, total, totalPages }`; uma página além do fim devolve `data: []`.

```bash
# rações até R$ 100, da mais barata para a mais cara (cookie do login acima)
curl -b cookies.txt 'http://localhost:3000/products?search=ra%C3%A7%C3%A3o&maxPriceCents=10000&sort=price_asc&limit=5'
```

O seed cria 14 produtos para a Pet Feliz e 15 para a Volt Eletrônicos, com nomes parecidos nas duas ("Kit Presente", "Garrafa Térmica", "Kit Viagem") para demonstrar o isolamento no chat. Se o seu banco local foi criado antes desta versão, rode `pnpm db:seed` de novo: ele recria os índices (D-17).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@multi-tenant-ai-catalog/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `pnpm run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Import the generated `ENV` accessor in application code. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Project Structure

```
multi-tenant-ai-catalog/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Express)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run test`: Run the test suites (server: Vitest + Supertest + mongodb-memory-server)
- `pnpm db:seed`: Reset the database with two demo companies
