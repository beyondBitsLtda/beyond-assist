#!/bin/bash
# Põe o relógio da Lisa no crontab do iMac.
#
# Sem sudo: crontab de usuário basta, e este trabalho não precisa de nada que só o root tenha.
#
# O `flock -n` na linha da sincronização é o detalhe que evita um problema real: agora que ela
# roda até o fim (e não mais 5 fatias e para), uma execução pode durar mais que o intervalo
# entre duas. Sem a trava, duas sincronizações rodariam ao mesmo tempo sobre a mesma linha de
# progresso, competindo por cota do Gemini e embaralhando o offset. O `-n` faz a segunda
# simplesmente desistir em silêncio, que é o comportamento certo aqui.

set -uo pipefail

NODE="$HOME/.local/node/bin/node"
RELOGIO="$HOME/relogio/relogio-local.mjs"
LOG="$HOME/relogio.log"
TRAVA="/tmp/lisa-sync.lock"

[ -x "$NODE" ] || { echo "ERRO: node não encontrado"; exit 1; }
[ -f "$RELOGIO" ] || { echo "ERRO: relógio não encontrado"; exit 1; }

# Tira as linhas antigas do relógio e da atualização, para poder rodar de novo sem duplicar.
atual=$(crontab -l 2>/dev/null | grep -v "relogio-local.mjs" | grep -v "atualizar-lisa.sh" || true)

novas=$(cat <<CRON
# --- relógio da Lisa, rodando no proprio iMac (ver ~/relogio/relogio-local.mjs) ---
# notificações e falas agendadas
*/5 * * * * $NODE $RELOGIO notificar >> $LOG 2>&1
# Map of Deploy
*/15 * * * * $NODE $RELOGIO deploys >> $LOG 2>&1
# reinicio do ciclo de sincronizacao, de hora em hora
0 * * * * $NODE $RELOGIO reiniciar >> $LOG 2>&1
# avanco do ciclo ate o fim; a trava impede duas rodando juntas
*/10 * * * * /usr/bin/flock -n $TRAVA $NODE $RELOGIO sincronizar >> $LOG 2>&1
# atualizacao do codigo, de madrugada
30 3 * * * $HOME/atualizar-lisa.sh >> $HOME/atualizacao.log 2>&1
CRON
)

printf '%s\n%s\n' "$atual" "$novas" | crontab -

echo "=== crontab agora:"
crontab -l | grep -vE "^#|^$" | sed 's/^/   /'

echo ""
echo "=== o flock existe nesta maquina?"
[ -x /usr/bin/flock ] && echo "   sim" || echo "   AUSENTE — a trava nao vai funcionar"
