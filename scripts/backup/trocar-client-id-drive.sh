#!/usr/bin/env bash
# Troca o client_id do Google Drive do backup (BEYOND-0003). Rodar UMA vez, num terminal na
# ÁREA DE TRABALHO do iMac, depois de criar o próprio "ID do cliente OAuth" no Google Cloud
# (ver LEIA-ME.md, "Client ID próprio do Google").
#
# Por quê: o client_id que vem embutido no rclone é compartilhado por todo mundo que usa o
# rclone e está sendo desligado pelo Google em 2026. Quando cair, o envio para o Drive falha
# toda segunda — o pacote continua sendo feito no iMac, mas não sai de casa.
#
# O ID e o segredo são digitados aqui (o segredo sem aparecer) e ficam só no rclone.conf.

set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

rclone listremotes | grep -q '^beyond-bkp:$' || { echo "o remote beyond-bkp não existe — rode antes ~/backup/configurar-drive.sh"; exit 1; }

read -r -p "ID do cliente (termina em .apps.googleusercontent.com): " id
read -r -s -p "Chave secreta do cliente (não aparece): " segredo; echo
case "$id" in *.apps.googleusercontent.com) ;; *) echo "isso não parece um ID de cliente do Google"; exit 1 ;; esac
[ -n "$segredo" ] || { echo "falta a chave secreta"; exit 1; }

umask 077
rclone config update beyond-bkp client_id="$id" client_secret="$segredo" > /dev/null
unset id segredo

echo "Vai abrir o navegador de novo: entre na mesma conta Google e clique em Permitir."
rclone config reconnect beyond-bkp:

echo
echo "Conferindo..."
rclone lsl beyond-bkp-cripto:semanal
echo
echo "Pronto: o backup agora usa o seu próprio acesso ao Google."
