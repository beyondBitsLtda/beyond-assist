#!/bin/bash
# Sobe o Caddy, que termina o HTTPS da Lisa de casa e repassa para a porta 3000.
#
# O certificado é pedido na primeira execução, pelo desafio DNS-01: o Caddy cria um registro
# TXT na Cloudflare, o Let's Encrypt lê, e o registro é apagado. Nenhuma porta precisa estar
# aberta para a internet — o que é essencial aqui, já que o nome aponta para um endereço
# privado que ninguém de fora alcança.

set -uo pipefail

CADDY="$HOME/.local/bin/caddy"
CONF="$HOME/.config/caddy/Caddyfile"
LOG="$HOME/caddy-saida.log"

export CLOUDFLARE_API_TOKEN=$(tr -d " \n\r" < ~/.token-cloudflare)
[ -n "$CLOUDFLARE_API_TOKEN" ] || { echo "ERRO: token vazio"; exit 1; }

pkill -f "caddy run" 2>/dev/null && sleep 2

echo "=== subindo"
setsid nohup "$CADDY" run --config "$CONF" --adapter caddyfile > "$LOG" 2>&1 < /dev/null &

echo "=== esperando o certificado (a primeira vez leva ~30s)"
for i in $(seq 1 45); do
  sleep 2
  if grep -q "certificate obtained successfully\|certificate cached" "$LOG" 2>/dev/null; then
    echo "   certificado emitido depois de $((i*2))s"
    break
  fi
  if grep -qi "error obtaining certificate\|could not get certificate" "$LOG" 2>/dev/null; then
    echo "   FALHOU. ultimas linhas do log:"
    grep -iE "error|fail" "$LOG" | tail -5 | cut -c1-200
    exit 1
  fi
done

echo ""
echo "=== quem escuta na 443:"
ss -tln 2>/dev/null | grep ":443 " | sed 's/^/   /' || echo "   ninguem"

echo ""
echo "=== do proprio iMac, pelo nome:"
curl -s -o /dev/null -w "   https://casa.beyond.dev.br/login  ->  HTTP %{http_code}\n" -m 20 https://casa.beyond.dev.br/login

echo ""
echo "=== de quem e o certificado:"
echo | openssl s_client -connect casa.beyond.dev.br:443 -servername casa.beyond.dev.br 2>/dev/null \
  | openssl x509 -noout -issuer -subject -dates 2>/dev/null | sed 's/^/   /'

echo ""
echo "=== volta sozinho depois de reiniciar?"
LINHA="@reboot sleep 60 && $HOME/subir-caddy.sh >> $HOME/caddy-boot.log 2>&1"
if crontab -l 2>/dev/null | grep -q "subir-caddy.sh"; then
  echo "   ja estava agendado"
else
  (crontab -l 2>/dev/null; echo "$LINHA") | crontab -
  echo "   agendado (@reboot, 60s de espera — depois da Lisa, que espera 45s)"
fi
