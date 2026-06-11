# SGNC — API

API REST do Sistema de Gestão de Não Conformidade. Stack: Node.js + Express +
Prisma + PostgreSQL + Zod.

## Setup

Esta API faz parte do workspace npm da raiz — basta rodar `npm install` na
raiz do repo. Para rodar isoladamente:

```bash
cd server
cp .env.example .env
# edite .env apontando DATABASE_URL para o seu Postgres

# aplica o schema no banco
npm run prisma:migrate

# (opcional) popula com uma filial de exemplo
npm run db:seed

# inicia em modo dev (hot reload, com bootstrap)
npm run dev
```

A API sobe em `http://localhost:3333` por padrão. Em desenvolvimento o Vite faz
proxy de `/api/*` para esta porta — ver `vite.config.ts`.

## Endpoints — Filial

| Método | Rota                | Descrição                          |
| ------ | ------------------- | ---------------------------------- |
| GET    | `/api/filiais`      | Lista (`?q=`, `?ativo=`, `?page=`) |
| GET    | `/api/filiais/:id`  | Detalhe                            |
| POST   | `/api/filiais`      | Cria                               |
| PATCH  | `/api/filiais/:id`  | Atualiza (parcial)                 |
| DELETE | `/api/filiais/:id`  | Remove                             |

### Payload de criação

```json
{
  "codigo": "FIL01",
  "nome": "Filial Petrópolis",
  "razaoSocial": "Cervejaria Cidade Imperial Ltda.",
  "cnpj": "00.000.000/0001-00",
  "endereco": "Rua da Cervejaria",
  "numero": "1000",
  "bairro": "Centro",
  "cidade": "Petrópolis",
  "uf": "RJ",
  "cep": "25600-000",
  "telefone": "(24) 0000-0000",
  "email": "matriz@cidadeimperial.com.br",
  "responsavel": "Gerente Industrial",
  "ativo": true
}
```

## Estrutura

```
server/
├── prisma/
│   ├── schema.prisma          # modelo Filial
│   ├── migrations/            # migrations versionadas
│   └── seed.ts
└── src/
    ├── index.ts               # bootstrap Express
    ├── env.ts                 # validação de env com Zod
    ├── db.ts                  # cliente Prisma singleton
    ├── middleware/error.ts    # tratamento de erros (Zod / Prisma / HttpError)
    ├── schemas/               # schemas Zod por entidade
    └── routes/                # routers Express por entidade
```
