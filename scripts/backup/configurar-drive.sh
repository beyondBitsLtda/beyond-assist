#!/usr/bin/env bash
# Liga o backup ao Google Drive (BEYOND-0003). Rodar UMA vez, num terminal ABERTO NA ÁREA DE
# TRABALHO do iMac (não por SSH): o rclone abre o navegador para você entrar na conta Google e
# clicar em "Permitir".
#
# Permissão pedida: `drive.file` — o rclone só enxerga os arquivos que ELE criou. O resto do
# seu Drive fica invisível para ele. E o Google só recebe arquivos já cifrados, com nome
# embaralhado (a criptografia, remote beyond-bkp-cripto, já está configurada).
#
# Os backups ficam na pasta `beyond-backup` da raiz do Drive.

set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

rclone listremotes | grep -q '^beyond-bkp-cripto:$' || { echo "falta o remote beyond-bkp-cripto (ver LEIA-ME.md)"; exit 1; }

echo "Vai abrir o navegador: entre na conta Google que vai guardar os backups e clique em Permitir."
echo "(Se o navegador não abrir sozinho, copie o endereço http://127.0.0.1:53682/... que aparecer abaixo.)"
echo

umask 077
rclone config delete beyond-bkp > /dev/null 2>&1 || true
rclone config create beyond-bkp drive scope=drive.file

echo
echo "Conferindo o acesso..."
rclone mkdir beyond-bkp:beyond-backup
rclone mkdir beyond-bkp-cripto:semanal
rclone about beyond-bkp: 2>/dev/null | sed 's/^/  /' || true

echo
echo "Google Drive ligado. Rodando o primeiro backup agora (leva uns 3 minutos)..."
~/backup/backup.sh semanal | tee -a ~/backup/backup.log
echo
cat ~/backup/ultimo-semanal.json
