# SGNC — Sistema de Gestão de Não Conformidade

Aplicação para a Cervejaria Cidade Imperial.

## Estrutura

```
.
├── src/                    # Cliente React (Vite + TS + Tailwind + shadcn/ui)
└── server/                 # API Node (Express + Prisma + Zod + PostgreSQL)
```

Workspaces npm: a raiz inclui `server` em `"workspaces"`, então um único
`npm install` na raiz instala as dependências do cliente e da API.

## Pré-requisitos

- **Node 20+** e **npm 10+**
- **PostgreSQL** rodando localmente (ou acessível por rede). Instale do jeito
  que preferir: pacote nativo do SO, Postgres.app no macOS, instalador no
  Windows, etc.

## Setup

```bash
npm install
cp server/.env.example server/.env
# edite server/.env e aponte DATABASE_URL para o seu Postgres
```

Crie o banco no Postgres (uma vez):

```bash
createdb sgnc          # ou via psql: CREATE DATABASE sgnc;
```

## Subir o app

```bash
npm run dev
```

O comando faz, em ordem:

1. `prisma migrate deploy` — aplica as migrations no banco
2. `prisma generate` — gera o client tipado
3. `prisma/seed.ts` — popula a filial Matriz (idempotente via `upsert`)
4. Sobe a **API** (`http://localhost:3333`) e o **cliente** (`http://localhost:5173`)
   em paralelo, com hot reload em ambos

Re-executar `npm run dev` é seguro: o migrate só aplica o que falta e o seed
usa `upsert`.

## Scripts úteis

| Script                | O que faz                                                          |
| --------------------- | ------------------------------------------------------------------ |
| `npm run dev`         | migrate + seed + API + client (modo desenvolvimento)               |
| `npm run bootstrap`   | Apenas migrate + generate + seed                                   |
| `npm run dev:client`  | Apenas o cliente Vite                                              |
| `npm run dev:api`     | Apenas a API (sem bootstrap)                                       |
| `npm run build:all`   | Build de cliente e API                                             |

## API

Detalhes dos endpoints e do modelo `Filial` estão em [`server/README.md`](server/README.md).

## Cadastros já implementados

- **Filial** — CRUD completo via `/api/filiais`, tela `Cadastros → Filial`.

Os demais cadastros (Fornecedor, Disposição de Material, Origem da Não
Conformidade, Severidade) ainda estão como "Em construção" no menu.
