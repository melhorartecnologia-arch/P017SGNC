# Deploy do SGNC em uma VPS Lightsail (AWS) com SSL

Guia passo a passo para publicar o SGNC numa instância **Amazon Lightsail**
(Ubuntu) com HTTPS gratuito via **Let's Encrypt**.

## Arquitetura em produção

Tudo roda em **uma única instância** Lightsail:

```
Internet ──HTTPS(443)──> Nginx ──┬─ /            -> arquivos estáticos (dist/ do Vite)
                                 ├─ /api/*       -> proxy p/ Node/Express (127.0.0.1:3333)
                                 └─ /health      -> proxy p/ Node/Express
                                                      │
                                                      └─ PostgreSQL (localhost:5432)
```

- **Nginx**: termina o SSL, serve o front e faz o proxy reverso da API.
- **Node/Express (Prisma)**: roda como serviço `systemd`, escuta só em `127.0.0.1:3333`.
- **PostgreSQL**: instalado na mesma máquina.
- **Certbot**: emite e renova o certificado SSL automaticamente.

> O front chama a API por caminho relativo (`/api/...`), então front e API ficam
> na **mesma origem** — sem configuração de CORS complicada e sem variável de URL no build.

**Pré-requisitos:** um **domínio** (ex.: `sgnc.cervejariacidadeimperial.com.br`)
onde você consiga editar o DNS. SSL do Let's Encrypt exige um domínio — não funciona
com IP puro.

---

## 1. Criar a instância no Lightsail

1. Acesse o [console do Lightsail](https://lightsail.aws.amazon.com/) → **Create instance**.
2. **Region**: escolha a mais próxima (ex.: `São Paulo` / `sa-east-1`).
3. **Platform**: Linux/Unix → **Blueprint**: **OS Only → Ubuntu 22.04 LTS**.
4. **Plano**: recomendo no mínimo o de **2 GB RAM / 2 vCPU** (US$ 12/mês). O de
   1 GB (US$ 7) funciona, mas o `vite build`/`tsc` pode estourar memória — nesse
   caso adicione swap (passo 9).
5. Dê um nome (ex.: `sgnc-prod`) e **Create instance**.

## 2. IP estático + DNS

1. No Lightsail, aba **Networking → Create static IP**, anexe à instância `sgnc-prod`.
2. No seu provedor de DNS, crie um registro **A** apontando o domínio para esse IP estático:
   - `sgnc.cervejariacidadeimperial.com.br  A  <IP_ESTATICO>`
3. Confirme a propagação: `ping sgnc.cervejariacidadeimperial.com.br` deve responder o IP novo.

## 3. Firewall (Lightsail)

Na instância → aba **Networking → IPv4 Firewall**, deixe **apenas**:

| Aplicação | Protocolo | Porta |
| --------- | --------- | ----- |
| SSH       | TCP       | 22    |
| HTTP      | TCP       | 80    |
| HTTPS     | TCP       | 443   |

**Não** abra a 3333 nem a 5432 — elas só são acessadas localmente.

## 4. Conectar via SSH

Use o botão **Connect using SSH** no console, ou pelo terminal com a chave baixada
em *Account → SSH keys*:

```bash
ssh -i LightsailDefaultKey.pem ubuntu@<IP_ESTATICO>
```

---

## 5. Instalar dependências no servidor

```bash
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS (NodeSource — instala node em /usr/bin/node)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL, Nginx, Git e Certbot
sudo apt install -y postgresql postgresql-contrib nginx git
sudo apt install -y certbot python3-certbot-nginx

# Confira as versões
node -v   # v20.x
npm -v    # 10.x
```

## 6. Configurar o PostgreSQL

Crie o banco e um usuário dedicado (troque a senha):

```bash
sudo -u postgres psql <<'SQL'
CREATE USER sgnc WITH PASSWORD 'SENHA_FORTE_DO_BANCO';
CREATE DATABASE sgnc OWNER sgnc;
GRANT ALL PRIVILEGES ON DATABASE sgnc TO sgnc;
SQL
```

O Postgres já escuta só em `localhost` por padrão — não precisa expor nada.

## 7. Clonar e configurar o projeto

```bash
# Pasta do app
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www

# Clone o repositório (use HTTPS com token ou deploy key configurada)
git clone https://github.com/melhorartecnologia-arch/p017sgnc.git sgnc
cd sgnc

# Instale as dependências (raiz instala cliente + workspace server)
npm install
```

Crie o `server/.env` de produção a partir do modelo e edite:

```bash
cp server/.env.production.example server/.env
nano server/.env
```

Preencha:
- `DATABASE_URL` com a senha definida no passo 6.
- `CORS_ORIGIN=https://seu-dominio.com.br`
- `JWT_SECRET` com `openssl rand -hex 32`.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` (a senha do admin do primeiro login — **troque!**).

## 8. Build + bootstrap do banco

```bash
cd /var/www/sgnc

# Build do front (gera ./dist) e da API (gera ./server/dist)
npm run build
npm run build:api

# Aplica migrations, gera o Prisma Client e roda o seed (cria admin + Matriz)
npm run bootstrap --workspace @sgnc/server
```

> Se o build travar por falta de memória num plano de 1 GB, faça o passo 9 (swap) antes.

## 9. (Opcional, planos pequenos) Adicionar swap

Recomendado no plano de 1 GB para o build não morrer:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 10. Rodar a API como serviço (systemd)

```bash
# Garante que o www-data consiga ler o app e gravar os uploads
sudo chown -R www-data:www-data /var/www/sgnc

sudo cp deploy/sgnc-api.service /etc/systemd/system/sgnc-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now sgnc-api

# Verifique
sudo systemctl status sgnc-api
curl http://127.0.0.1:3333/health   # deve responder {"status":"ok","db":"up",...}
```

Logs em tempo real: `sudo journalctl -u sgnc-api -f`

## 11. Configurar o Nginx

Edite `deploy/nginx-sgnc.conf` e troque `seu-dominio.com.br` pelo seu domínio real
(o `root` já aponta para `/var/www/sgnc/dist`). Depois:

```bash
sudo cp deploy/nginx-sgnc.conf /etc/nginx/sites-available/sgnc
sudo ln -sf /etc/nginx/sites-available/sgnc /etc/nginx/sites-enabled/sgnc
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t && sudo systemctl reload nginx
```

Teste em `http://seu-dominio.com.br` — o app já deve abrir (ainda sem cadeado).

## 12. Ativar o SSL (HTTPS) com Certbot

```bash
sudo certbot --nginx -d seu-dominio.com.br -d www.seu-dominio.com.br
```

O Certbot pede um e-mail, emite o certificado, **edita o Nginx** adicionando o
bloco `443 ssl` e configura o redirect de HTTP → HTTPS. Escolha a opção de
**redirecionar** quando perguntado.

A renovação automática já vem ativada; confirme com:

```bash
sudo certbot renew --dry-run
```

## 13. Validação final

- `https://seu-dominio.com.br` abre com cadeado válido.
- Login com `ADMIN_EMAIL` / `ADMIN_PASSWORD` funciona.
- Criar um registro e anexar foto (testa upload + `client_max_body_size`).
- `https://seu-dominio.com.br/health` → `{"status":"ok","db":"up"}`.

---

## Atualizar para uma nova versão (deploy)

```bash
cd /var/www/sgnc
git pull
npm install
npm run build
npm run build:api
npm run bootstrap --workspace @sgnc/server   # aplica migrations novas (idempotente)
sudo chown -R www-data:www-data /var/www/sgnc
sudo systemctl restart sgnc-api
```

O Nginx não precisa reiniciar (serve o `dist/` atualizado direto).

## Boas práticas

- **Backups do banco:** agende `pg_dump`:
  ```bash
  pg_dump -U sgnc sgnc | gzip > ~/backup-sgnc-$(date +%F).sql.gz
  ```
  (e copie para fora da VPS, ex.: snapshot do Lightsail ou S3).
- **Snapshots do Lightsail:** ative snapshots automáticos da instância.
- **Segurança:** troque a senha do admin no primeiro login; mantenha o
  `JWT_SECRET` fora do Git (já está no `.gitignore` via `server/.env`).
- **Uploads:** ficam em `/var/www/sgnc/server/uploads`. Inclua essa pasta no backup.
- **Atualizações do SO:** `sudo apt update && sudo apt upgrade -y` periodicamente.

## Solução de problemas

| Sintoma | Verifique |
| ------- | --------- |
| 502 Bad Gateway | `sudo systemctl status sgnc-api` e `journalctl -u sgnc-api -f` |
| API não conecta no banco | `DATABASE_URL` no `server/.env` e `sudo systemctl status postgresql` |
| Build morre/trava | Falta de RAM → adicione swap (passo 9) ou suba o plano |
| Certbot falha | DNS ainda não propagou, ou portas 80/443 fechadas no firewall do Lightsail |
| Upload de foto dá erro 413 | Aumente `client_max_body_size` no Nginx |
