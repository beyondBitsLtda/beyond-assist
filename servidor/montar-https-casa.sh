#!/bin/bash
# HTTPS de verdade para a Lisa de casa.
#
# O problema que isto resolve: o navegador bloqueia microfone, câmera e notificações em
# `http://` fora de localhost. Sem certificado, a Lisa local perde o Assistente por voz, o
# scanner e o push — que são boa parte da graça.
#
# Por que não um certificado auto-assinado: o navegador continuaria recusando aquelas APIs
# até o certificado ser confiado, e confiar exigiria instalar uma autoridade em cada
# aparelho — incluindo celular, onde isso é chato de verdade.
#
# A saída é um certificado REAL para um nome que aponta para o IP da rede local. O Let's
# Encrypt emite sem precisar alcançar a máquina: a prova é feita criando um registro TXT no
# DNS (desafio DNS-01), e quem cria é o próprio Caddy, pela API da Cloudflare. Nenhuma porta
# precisa ser aberta para a internet, e o nome só resolve para um endereço privado — de fora
# da casa, ele não leva a lugar nenhum.

set -euo pipefail

NOME="casa.beyond.dev.br"
DESTINO="localhost:3000"
CADDY="$HOME/.local/bin/caddy"
CONF="$HOME/.config/caddy"
EMAIL="${ACME_EMAIL:-bryan@beyond.dev.br}"

[ -x "$CADDY" ] || { echo "ERRO: Caddy não encontrado em $CADDY"; exit 1; }
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "ERRO: falta CLOUDFLARE_API_TOKEN no ambiente"; exit 1; }

mkdir -p "$CONF"

cat > "$CONF/Caddyfile" <<CADDYFILE
{
	email $EMAIL
	# Sem isto o Caddy tenta o desafio HTTP, que exige a porta 80 alcançável da internet —
	# impossível aqui, e desnecessário: o DNS-01 prova a posse do domínio sem tráfego de
	# entrada nenhum.
	acme_dns cloudflare {env.CLOUDFLARE_API_TOKEN}

	# Sem isto o Caddy abre a porta 80 so para redirecionar http -> https, e nao sobe porque
	# a 80 ja esta ocupada nesta maquina. O redirecionamento nao faz falta: o unico jeito de
	# chegar aqui e pelo nome, e o nome so e usado em https.
	auto_https disable_redirects
}

$NOME {
	# --- a tela do próprio iMac, em /tela/ -------------------------------------------------
	# O noVNC não é servido pela Lisa: quem serve é o websockify, em 6080. Por isso este
	# bloco vem ANTES do resto: handle e excludente, o primeiro que casa e o unico que roda.
	#
	# handle_path (e nao handle) tira o /tela da frente antes de repassar: o websockify
	# conhece /vnc.html e /websockify, não /tela/vnc.html.
	#
	# O forward_auth é a trava que faltaria: /tela/* nunca chega ao Next, então o middleware
	# não o protege. Aqui o Caddy pergunta à própria Lisa "essa sessão vale?" antes de deixar
	# passar — e a Lisa responde com o mesmo cookie de login de sempre. Sem sessão, ela devolve
	# um redirecionamento para /login, que o Caddy copia para o navegador.
	#
	# Continuam sendo DUAS travas: esta, e a senha do VNC que o x11vnc pede depois.
	handle_path /tela/* {
		forward_auth $DESTINO {
			uri /auth-check

			# O Next NAO responde nada a um pedido que traz cabecalhos de upgrade: ele
			# derruba a conexao. E o forward_auth repassa os cabecalhos originais, entao
			# durante o handshake do WebSocket a pergunta "essa sessao vale?" voltava
			# vazia e o Caddy traduzia isso em 502 — com a pagina do noVNC carregando
			# inteira, o que fazia parecer problema do VNC.
			#
			# Tirar os dois cabecalhos transforma a pergunta num GET comum. O upgrade de
			# verdade continua intacto: ele acontece no reverse_proxy abaixo, que recebe a
			# requisicao original.
			header_up -Connection
			header_up -Upgrade
		}
		reverse_proxy localhost:6080
	}

	handle {
		reverse_proxy $DESTINO {
			# A Lisa precisa saber o endereço original para montar links e cookies corretos.
			header_up Host {host}
			header_up X-Forwarded-Proto {scheme}
		}
	}

	# A porta 3000 continua bloqueada no firewall; quem atende a rede é este Caddy, em 443.
	log {
		output file $HOME/caddy-casa.log
		level WARN
	}
}
CADDYFILE

chmod 600 "$CONF/Caddyfile"
echo "=== configuração escrita em $CONF/Caddyfile"

echo "=== conferindo a sintaxe"
"$CADDY" validate --config "$CONF/Caddyfile" --adapter caddyfile 2>&1 | tail -3

echo ""
echo "=== o token da Cloudflare funciona?"
resp=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens/verify")
if [ "$resp" = "200" ]; then echo "   token válido"; else echo "   TOKEN RECUSADO (HTTP $resp)"; exit 1; fi

echo ""
echo "=== o nome $NOME aponta para onde?"
alvo=$(getent hosts "$NOME" 2>/dev/null | awk '{print $1}' | head -1)
if [ -z "$alvo" ]; then
  echo "   ainda não resolve — falta criar o registro A na Cloudflare"
  exit 1
fi
echo "   $alvo"
meu_ip=$(ip -4 -o addr show | grep -v " lo " | grep -oE '192\.168\.[0-9]+\.[0-9]+' | head -1)
[ "$alvo" = "$meu_ip" ] && echo "   bate com o IP desta máquina" || echo "   ATENÇÃO: esta máquina é $meu_ip — o registro aponta para outro lugar"

echo ""
echo "pronto para subir. o certificado é emitido na primeira execução (leva ~30s)."
