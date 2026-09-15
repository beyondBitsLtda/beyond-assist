#!/bin/bash
# Acesso à tela do iMac pelo navegador, dentro da Lisa de casa.
#
# Três peças, cada uma fazendo o que já sabe fazer:
#
#   x11vnc      lê a tela do Xorg e injeta teclado/mouse
#   websockify  traduz VNC para WebSocket, que é o que navegador fala
#   noVNC       o cliente VNC em página web, sem instalar nada no dispositivo
#
# Não escrevi nenhum desses do zero de propósito: capturar tela e injetar entrada com
# desempenho decente é problema resolvido há vinte anos, e uma versão caseira seria pior em
# tudo. O que a gente acrescenta é a integração — mesmo endereço, mesmo login, mesmo cadeado.
#
# DUAS DECISÕES DE SEGURANÇA, e o motivo de cada uma:
#
#   `-localhost` no x11vnc e no websockify: os dois escutam SÓ em 127.0.0.1. Quem entra é o
#   Caddy, que já está atrás do HTTPS e do login da Lisa. Sem isso, qualquer aparelho da casa
#   veria (e controlaria) sua tela — e o firewall não ajudaria, porque a porta estaria aberta
#   de propósito.
#
#   Senha própria do VNC, além do login da Lisa. Duas travas independentes para uma coisa que
#   dá controle total do teclado e do mouse da máquina.

set -uo pipefail

TELA="$HOME/tela"
SENHA_VNC="$HOME/.vnc/passwd"
PORTA_VNC=5900        # x11vnc, só em localhost
PORTA_WEB=6080        # websockify, só em localhost
LOG="$HOME/tela.log"

command -v x11vnc >/dev/null 2>&1 || {
  echo "ERRO: x11vnc não instalado. Rode:  sudo apt install -y x11vnc"
  exit 1
}

# A sessão gráfica é do usuário; o x11vnc precisa da credencial dela para se conectar ao Xorg.
export DISPLAY=:0
export XAUTHORITY=/run/user/$(id -u)/gdm/Xauthority
[ -r "$XAUTHORITY" ] || {
  echo "ERRO: não consigo ler $XAUTHORITY — a sessão gráfica está aberta?"
  exit 1
}

if [ ! -f "$SENHA_VNC" ]; then
  echo "=== criando a senha do VNC"
  mkdir -p "$(dirname "$SENHA_VNC")"
  senha=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 12)
  x11vnc -storepasswd "$senha" "$SENHA_VNC" >/dev/null 2>&1
  printf 'Senha do acesso a tela (VNC)\n%s\n' "$senha" > "$HOME/.senha-tela"
  chmod 600 "$HOME/.senha-tela" "$SENHA_VNC"
  echo "   gravada em ~/.senha-tela (nao aparece na tela nem em log)"
else
  echo "=== senha do VNC ja existia"
fi

pkill -f "x11vnc -display" 2>/dev/null
pkill -f "websockify" 2>/dev/null
sleep 2

echo "=== subindo o x11vnc (so em localhost)"
setsid nohup x11vnc \
  -display :0 -auth "$XAUTHORITY" \
  -rfbauth "$SENHA_VNC" \
  -localhost -rfbport $PORTA_VNC \
  -forever -shared -noxdamage -ncache 0 \
  > "$LOG" 2>&1 < /dev/null &

echo "=== subindo o websockify + noVNC (so em localhost)"
# python3 -m websockify, e nao o ./run da pasta: o "run" e um script de SHELL que so
# descobre o diretorio e chama o python. Passa-lo para o python3 da SyntaxError na
# primeira linha - foi o que aconteceu na primeira montagem, e o unico sintoma visivel
# era o noVNC simplesmente nao responder. O cd e necessario: o modulo mora na pasta
# clonada, nao esta instalado no sistema.
( cd "$TELA/websockify" && setsid nohup python3 -m websockify \
  --web "$TELA/novnc" \
  127.0.0.1:$PORTA_WEB 127.0.0.1:$PORTA_VNC \
  >> "$LOG" 2>&1 < /dev/null & )

sleep 4
echo ""
echo "=== quem esta escutando:"
ss -tln 2>/dev/null | grep -E ":($PORTA_VNC|$PORTA_WEB) " | sed 's/^/   /'
echo "   (127.0.0.1 = so a propria maquina alcanca; o Caddy e a unica porta de entrada)"
echo ""
echo "=== o noVNC responde?"
# Este teste precisa REPROVAR, nao so imprimir: na primeira montagem ele mostrou
# "HTTP 000" no meio de uma saida cheia de sinais verdes, e passou batido.
codigo=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "http://127.0.0.1:$PORTA_WEB/vnc.html")
echo "   http://127.0.0.1:$PORTA_WEB/vnc.html  ->  HTTP $codigo"
if [ "$codigo" != "200" ]; then
  echo "   >>> O noVNC NAO SUBIU. ultimas linhas do log:"
  tail -6 "$LOG" | sed 's/^/     /'
fi

echo ""
echo "=== sobe sozinho depois de reiniciar?"
LINHA="@reboot sleep 75 && $HOME/montar-tela.sh >> $HOME/tela-boot.log 2>&1"
if crontab -l 2>/dev/null | grep -q "montar-tela.sh"; then
  echo "   ja estava agendado"
else
  # 75s: depois da Lisa (45s) e do Caddy (60s), e com folga para a sessao grafica abrir —
  # sem sessao aberta, o x11vnc nao tem o que capturar.
  (crontab -l 2>/dev/null; echo "$LINHA") | crontab -
  echo "   agendado (@reboot, 75s — depois da sessao grafica abrir)"
fi

echo ""
echo "para ver a senha:  cat ~/.senha-tela"
