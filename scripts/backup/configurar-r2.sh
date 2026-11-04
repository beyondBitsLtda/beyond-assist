#!/usr/bin/env bash
# Liga o backup ao Cloudflare R2 (BEYOND-0003). Rodar UMA vez no iMac, depois de:
#   1. ativar o R2 na conta beyondbitsLisa (painel da Cloudflare → R2);
#   2. criar o bucket `beyond-backup`;
#   3. criar um token de API do R2 com "Object Read & Write" só para esse bucket.
#
# As chaves são digitadas aqui, sem aparecer na tela, e ficam só em ~/.config/rclone/rclone.conf
# (permissão 600). A criptografia (remote beyond-bkp-cripto) já está configurada; este script
# cria só o acesso ao R2 por baixo dela e faz o primeiro envio.

set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

CONTA="${CLOUDFLARE_ACCOUNT_ID:-7e4b10d80b08fef1f2fcca583577bf2d}" # beyondbitsLisa — id não é segredo
BUCKET="${BKP_BUCKET:-beyond-backup}"

rclone listremotes | grep -q '^beyond-bkp-cripto:$' || { echo "falta o remote beyond-bkp-cripto (ver LEIA-ME.md)"; exit 1; }

read -r -p  "Access Key ID do token R2: " chave
read -r -s -p "Secret Access Key do token R2 (não aparece): " segredo; echo
[ -n "$chave" ] && [ -n "$segredo" ] || { echo "as duas chaves são obrigatórias"; exit 1; }

umask 077
rclone config delete beyond-bkp > /dev/null 2>&1 || true
rclone config create beyond-bkp s3 provider=Cloudflare access_key_id="$chave" secret_access_key="$segredo" \
  endpoint="https://${CONTA}.r2.cloudflarestorage.com" acl=private no_check_bucket=true > /dev/null
unset chave segredo

echo "Conferindo o acesso ao bucket $BUCKET..."
rclone lsf "beyond-bkp:$BUCKET" --max-depth 1 > /dev/null || { echo "não consegui abrir o bucket — confira o nome e as permissões do token"; exit 1; }
rclone mkdir beyond-bkp-cripto:semanal
echo "R2 ligado. Rodando o primeiro backup agora (leva uns 3 minutos)..."
~/backup/backup.sh semanal | tee -a ~/backup/backup.log
echo
cat ~/backup/ultimo-semanal.json
