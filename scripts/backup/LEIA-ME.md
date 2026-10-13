# Backup do banco da Lisa (BEYOND-0003)

O iMac gera pacotes com **tudo** o que mora no Supabase de casa, em dois ritmos:

| Tipo | Quando | Quanto tempo fica |
|---|---|---|
| **A cada 3 horas** | 00h, 03h, 06h... 21h | Os **3 mais recentes**. O 4º substitui o mais antigo, na nuvem e no iMac, e o antigo só sai depois que o novo subiu e foi conferido. |
| **Semanal** | Toda segunda às 03:15 | **Para sempre na nuvem**, até alguém apagar à mão. No iMac ficam os 4 últimos. |

Nome do pacote: tipo, dia e hora, por exemplo `beyond-bkp-semanal_2026-10-19_03h15.tar`. Na nuvem eles ficam nas pastas `3horas/` e `semanal/` de `beyond-backup`, **com o nome legível**. Só o conteúdo vai cifrado.

Cada pacote leva:

- o banco da Lisa, do Abacato, do Beyond Brain e do Beyond Space;
- os arquivos do Storage: documentos, imagens de comentário e papéis de parede;
- a configuração do Supabase.

A Sentinela fica fora: ela mora num projeto do Supabase na nuvem (`wilxxkkqgoigmrdgufej`), não no iMac.

O pacote é **criptografado** antes de sair do iMac.

> **Espaço:** cada pacote tem ~265 MB. Como os semanais não são apagados, os 15 GB do Drive dão para cerca de um ano. Apague os semanais velhos de vez em quando, pela pasta do Drive ou com `rclone delete`.

| Arquivo | Para quê |
|---|---|
| `backup.sh 3horas` / `backup.sh semanal` | Gera, confere, criptografa e envia. O de 3 horas faz o rodízio dos 3 últimos. É o que o cron roda. |
| `restaurar.sh` | Recupera o backup: `listar`, `ensaio` (num banco descartável) ou `producao`. |
| `configurar-drive.sh` | Liga o Google Drive uma vez: login pelo navegador, na área de trabalho do iMac, e o primeiro envio. **É o destino em uso.** |
| `configurar-r2.sh` | Alternativa: liga o Cloudflare R2, se um dia for ativado. |

Se a nuvem falhar, o pacote da semana **continua guardado no iMac**, e `~/backup/ultimo-3horas.json` ou `~/backup/ultimo-semanal.json` sai com `"nuvem": false`.

## Situação em 12/10/2026

| Passo | Situação |
|---|---|
| Scripts em `~/backup` e cron (segunda 03:15) | **Feito** |
| rclone 1.75 em `~/.local/bin`, sem sudo | **Feito** |
| Criptografia (`beyond-bkp-cripto`), com as senhas em `~/backup/SENHAS-DO-BACKUP.txt` | **Feito**. Falta guardar as senhas fora do iMac. |
| Backup completo e ensaio de restauração | **Feitos**. Pacote de 265 MB; 128 tabelas e 229 arquivos voltaram sem erro. |
| Acesso à nuvem (`beyond-bkp`, Google Drive) | **Feito**. Primeiro envio em 12/10, 265 MB, conferido. O R2 ficou de fora porque exige cartão. |
| Client ID próprio do Google | **Falta.** O client_id compartilhado do rclone cai em 2026. Ver a seção abaixo. |

## O que vai em cada pacote

`beyond-bkp-AAAA-MM-DD_HHMM.tar`, um arquivo por semana:

| Dentro | O que é | Como volta |
|---|---|---|
| `banco-postgres.dump`, `banco-_supabase.dump` | Cada base em formato custom do `pg_dump`. | `pg_restore`, inteiro ou só uma tabela. |
| `00-papeis.sql` | Os usuários do Postgres (roles). | `psql` |
| `storage.tar.gz` | Os arquivos do Storage. | `tar` dentro do container do Storage |
| `config/` | `.env` e compose do Supabase, e o crontab do iMac. | Copiar de volta |
| `MANIFESTO.txt` | Versões, data e o SHA-256 de cada arquivo. | `restaurar.sh` confere sozinho |

## Onde guardar: Cloudflare R2 (recomendado)

- **Grátis até 10 GB**, sem cobrança de download. Um pacote deve ter algumas dezenas a poucas centenas de MB, então 13 semanas cabem com folga.
- **É a mesma conta Cloudflare** (`beyondbitsLisa`) que já hospeda a Lisa, o Abacato e o Space.
- **Alternativas** que o mesmo script atende, trocando só o passo 2:
  - Google Drive: 15 GB grátis, com login pelo navegador;
  - Backblaze B2: 10 GB grátis.

A Cloudflare pode pedir um cartão cadastrado para ativar o R2, mesmo dentro da faixa grátis.

> No iMac de hoje, os passos 1 e 3 (só a criptografia) e os passos 4 e 5 já foram feitos. Falta o passo 2.
> Depois dele, em vez de criar o `beyond-bkp` na mão, rode `~/backup/configurar-r2.sh`.

## Instalar (uma vez, no iMac)

### 1. rclone

Ele envia para a nuvem e criptografa.

```bash
sudo -v ; curl https://rclone.org/install.sh | sudo bash
rclone version
```

### 2. Bucket e chave no R2

No painel da Cloudflare:

1. Abra **R2 → Create bucket** e crie o bucket `beyond-backup`.
2. Em **R2 → Manage API tokens → Create API token**, crie uma chave com permissão **Object Read & Write**, só para o bucket `beyond-backup`.
3. Anote o *Access Key ID*, o *Secret Access Key* e o endpoint `https://<account-id>.r2.cloudflarestorage.com`.

### 3. Os dois remotes do rclone

Rode `rclone config`. As chaves ficam só no iMac, em `~/.config/rclone/rclone.conf`, e não vão para o repositório.

1. **`beyond-bkp`**, o acesso ao R2:
   - **Tipo:** `s3`.
   - **Provider:** `Cloudflare`.
   - **Chaves:** as do passo 2.
   - **Endpoint:** o do passo 2.
   - **ACL:** `private`.
2. **`beyond-bkp-cripto`**, a camada de criptografia:
   - **Tipo:** `crypt`.
   - **Remote:** `beyond-bkp:beyond-backup`.
   - **Nomes:** `filename_encryption = standard`.
   - **Senhas:** deixe o rclone gerar as duas (password e salt).

> **Guarde as duas senhas do `crypt` fora do iMac**, por exemplo no gerenciador de senhas.
> Se o iMac morrer, só elas abrem os backups da nuvem. Sem elas, o backup é ruído.

Confira:

```bash
rclone lsd beyond-bkp:                 # deve listar beyond-backup
rclone mkdir beyond-bkp-cripto:semanal
```

### 4. Scripts e primeira rodada

```bash
mkdir -p ~/backup
cp backup.sh restaurar.sh ~/backup/ && chmod +x ~/backup/*.sh
~/backup/backup.sh semanal             # a primeira rodada, olhando
~/backup/restaurar.sh ensaio           # prova que o pacote volta
```

O `ensaio` sobe a mesma imagem do Postgres num container descartável e restaura tudo nela. Depois confere, tabela por tabela, que nada voltou vazio. O banco de verdade não é tocado. Ele deve terminar com `ENSAIO OK — este backup volta`.

### 5. Agendar

Rode `crontab -e` e acrescente a linha:

```
0 */3 * * *  /home/bryan/backup/backup.sh 3horas  >> /home/bryan/backup/backup.log 2>&1
15 3 * * 1   /home/bryan/backup/backup.sh semanal >> /home/bryan/backup/backup.log 2>&1
```

Cada rodada grava o resultado em `~/backup/ultimo-3horas.json` ou `~/backup/ultimo-semanal.json` (`"ok": true` ou o erro) e o detalhe em `~/backup/backup.log`.

## Client ID próprio do Google

O rclone vem com um client_id do Google que é usado por todo mundo e está sendo desligado em 2026. Quando ele cair, o envio para o Drive falha. O pacote continua sendo feito no iMac, mas não sai de casa. Para criar o seu, de graça e sem cartão:

1. **Criar o projeto.** Em https://console.cloud.google.com, logado na **mesma conta** do backup, clique em **Selecionar projeto → Novo projeto** e use o nome `beyond-backup`.
2. **Ativar a API do Drive.** Em **APIs e serviços → Biblioteca**, procure **Google Drive API** e clique em **Ativar**.
3. **Configurar a tela de consentimento.** Em **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform**):
   - **Tipo:** Externo.
   - **Nome do app:** `beyond-backup`.
   - **E-mails de suporte e de contato:** o seu.
   - Depois, em **Público**, clique em **Publicar app** (colocar em produção). Em modo "teste", o Google derruba o acesso a cada 7 dias.
4. **Criar o ID do cliente.** Em **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - **Tipo:** **App para computador**.
   - Anote o **ID do cliente** e a **chave secreta do cliente**.
5. **Trocar no iMac.** Na área de trabalho do iMac, rode `~/backup/trocar-client-id-drive.sh`. Ele pede o ID e a chave e reabre o login do Google: entre na mesma conta e clique em **Permitir**.

## Recuperar

```bash
~/backup/restaurar.sh listar                    # o que tem na nuvem
~/backup/restaurar.sh ensaio semanal_2026-10-19 # testa o semanal daquela segunda
~/backup/restaurar.sh ensaio 3horas           # testa o de 3 horas mais recente
~/backup/restaurar.sh producao semanal_2026-10-19   # restaura por cima do que está em uso
```

O modo `producao` pede para digitar `RESTAURAR` e nunca escolhe "o mais recente" sozinho.

**Só uma tabela** (por exemplo, cards apagados por engano):

```bash
tar -xf beyond-bkp-semanal_2026-10-19_03h15.tar ./banco-postgres.dump
docker exec -i supabase-db pg_restore -U supabase_admin -d postgres --data-only -t abacato_cards < banco-postgres.dump
```

### Máquina nova (o iMac morreu)

1. Instale o Docker e o rclone, e configure os dois remotes. Use **as mesmas senhas do crypt**, as que ficaram guardadas fora do iMac.
2. Baixe o pacote e tire a configuração de dentro dele:
   ```bash
   rclone copy beyond-bkp-cripto:semanal/<pacote> .   # ou 3horas/
   tar -xf <pacote> ./config
   ```
3. Clone o Supabase self-hosted e ponha o `config/supabase.env` como `docker/.env`. Assim as chaves das aplicações continuam valendo.
4. Suba o Supabase com `docker compose up -d` e rode `restaurar.sh producao <pacote>`.
5. Religue o túnel da Cloudflare (`banco.beyond.dev.br`) para a máquina nova.
