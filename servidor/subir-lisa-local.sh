#!/bin/bash
# Sobe a Lisa de casa e garante que ela volte sozinha depois de um reinício.
#
# Sem sudo de propósito: usa o crontab do próprio usuário (@reboot), que não precisa de root.
# Um serviço do systemd seria mais elegante, mas exigiria privilégio que não é necessário aqui —
# e este processo não precisa de nada que só o root tenha.

set -uo pipefail
export PATH="$HOME/.local/node/bin:$PATH"

PASTA="$HOME/lisa"
PORTA=3000
LOG="$HOME/lisa-local.log"

parar() {
  local donos
  donos=$(pgrep -f "next-server|next start" 2>/dev/null || true)
  if [ -n "$donos" ]; then
    echo "$donos" | xargs -r kill 2>/dev/null || true
    sleep 2
  fi
}

case "${1:-subir}" in
  parar)
    parar
    echo "parada"
    exit 0
    ;;
  subir|"")
    parar
    cd "$PASTA"
    # `setsid` solta o processo da sessão SSH: sem isso ele morre quando a conexão cai.
    setsid env PORT=$PORTA nohup npm run start > "$LOG" 2>&1 < /dev/null &
    echo "=== subindo na porta $PORTA"
    for i in $(seq 1 30); do
      sleep 2
      if curl -s -o /dev/null -m 3 "http://localhost:$PORTA/login"; then
        echo "   respondeu depois de $((i*2))s"
        break
      fi
    done
    ;;
esac

echo ""
echo "=== esta de pe?"
curl -s -o /dev/null -w "   http://localhost:$PORTA/login  ->  HTTP %{http_code}\n" -m 10 "http://localhost:$PORTA/login"
curl -s -m 10 "http://localhost:$PORTA/api/health" | sed 's/^/   health: /'
echo ""

echo "=== volta sozinha depois de reiniciar?"
LINHA="@reboot sleep 45 && $HOME/subir-lisa-local.sh subir >> $HOME/lisa-local-boot.log 2>&1"
if crontab -l 2>/dev/null | grep -q "subir-lisa-local.sh"; then
  echo "   ja estava agendado"
else
  # os 45s de espera existem porque o Supabase precisa estar de pé antes: subir a Lisa
  # primeiro só produz uma tela que não conecta em nada.
  (crontab -l 2>/dev/null; echo "$LINHA") | crontab -
  echo "   agendado no crontab (@reboot, com 45s de espera pelo Supabase)"
fi

echo ""
echo "log: $LOG"
