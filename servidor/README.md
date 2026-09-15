# O servidor de casa

Scripts que montam e mantêm a Lisa rodando **dentro do iMac** — o "modo casa". Estavam só na
máquina; se o disco morresse, iam junto. Aqui eles são versionados e a montagem vira repetível.

Ordem de uso, do zero:

| | O quê | Precisa de `sudo`? |
| --- | --- | --- |
| 1 | `instalar-node.sh` — Node na pasta pessoal | não |
| 2 | `preparar-lisa-local.sh` — clona, configura o `.env`, compila | não |
| 3 | `criar-usuario.sh` — cria o login no Supabase Auth | não |
| 4 | `subir-lisa-local.sh` — sobe na porta 3000 e agenda no boot | não |
| 5 | `montar-https-casa.sh` — escreve a configuração do Caddy | não |
| 6 | `subir-caddy.sh` — emite o certificado e serve em 443 | só o `setcap`, antes |
| 7 | `agendar-relogio.sh` — põe o relógio no crontab | não |

Manutenção: `atualizar-lisa.sh` (roda sozinho às 3h30) e `relogio-local.mjs`.

## Por que o relógio saiu da Cloudflare

O Worker `lisa-cron` continua publicado, mas **sem horários** — quem agenda é o crontab do iMac.
Três limites do Worker deixaram de existir com a mudança, e a diferença é grande:

- **Chamadas de saída:** o plano gratuito para em 50 por invocação. Foi isso que obrigou o
  download do GitHub a ser fatiado em 35 arquivos por vez. Em Node não há esse teto —
  `GITHUB_ARQUIVOS_POR_VEZ=400` no `.env` de casa.
- **Tempo:** o Worker precisava responder rápido, então avançava 5 fatias e parava. Aqui o
  ciclo vai até o fim.
- **Rede:** o Worker ia até a Cloudflare e voltava pelo túnel — duas travessias de internet por
  chamada. O iMac fala com a Lisa em `localhost`.

Medido: **720 pedaços em 90 segundos** no iMac, contra cerca de **300 por hora** pelo Worker.

Para religar o Worker um dia — se o servidor de casa sair de cena — basta devolver os horários
em `workers/lisa-cron/wrangler.jsonc` e publicar. A lista vazia é necessária: apagar a seção
faria o wrangler manter os horários antigos.

## O que NÃO está aqui, e por quê

- **`.env` e credenciais.** Ficam só no iMac, com permissão 600. `preparar-lisa-local.sh` monta
  o arquivo a partir do `.env` do Supabase local mais o que vier no ambiente.
- **`web-push`.** Mora em `~/relogio/package.json`, fora do repositório da Lisa, porque foi
  justamente tirá-lo de lá que permitiu o app caber no Worker da Cloudflare.

## Duas travas que parecem detalhe e não são

O `flock -n` na linha da sincronização, em `agendar-relogio.sh`: agora que ela roda até o fim,
uma execução pode durar mais que o intervalo entre duas. Sem a trava, duas rodariam sobre a
mesma linha de progresso, competindo por cota e embaralhando o offset.

O `atualizar-lisa.sh` só reinicia **se o build der certo**. Reiniciar com build quebrado troca
"versão antiga funcionando" por "nada funcionando".
