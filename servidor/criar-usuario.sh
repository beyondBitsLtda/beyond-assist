#!/bin/bash
# Cria o usuário de acesso à Lisa no Supabase Auth do iMac.
#
# A senha é gerada AQUI e gravada num arquivo que só o dono lê. Ela não é impressa na tela nem
# passa por chat nenhum — quem precisa dela é você, e o lugar dela é a sua máquina.
#
# `email_confirm: true` é obrigatório: sem isso o usuário nasce pendente de confirmação por
# e-mail, e o login recusa com uma mensagem que não explica nada. Este Supabase não tem SMTP
# configurado, então o e-mail de confirmação nunca chegaria.

set -uo pipefail
cd ~/supabase/docker

EMAIL="${1:-bryan@beyond.dev.br}"
ARQUIVO="$HOME/.senha-lisa"

CHAVE=$(grep '^SERVICE_ROLE_KEY=' .env | cut -d= -f2-)
[ -z "$CHAVE" ] && { echo "ERRO: não achei SERVICE_ROLE_KEY no .env"; exit 1; }

# Só letras e números: senha com símbolo é chata de digitar no celular, e o ganho de entropia
# se compensa com o comprimento.
SENHA=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 24)

echo "=== já existe alguém?"
docker compose exec -T db psql -U postgres -d postgres -t -A \
  -c "select coalesce(string_agg(email, ', '), '(nenhum)') from auth.users;" </dev/null | sed 's/^/   /'

echo "=== criando $EMAIL"
resposta=$(curl -s -w $'\n%{http_code}' -X POST "http://localhost:8000/auth/v1/admin/users" \
  -H "apikey: $CHAVE" \
  -H "Authorization: Bearer $CHAVE" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$SENHA\",\"email_confirm\":true}")

codigo=$(echo "$resposta" | tail -1)
corpo=$(echo "$resposta" | head -n -1)

if [ "$codigo" = "200" ] || [ "$codigo" = "201" ]; then
  echo "   criado (HTTP $codigo)"
  printf 'Login da Lisa\ne-mail: %s\nsenha:  %s\n' "$EMAIL" "$SENHA" > "$ARQUIVO"
  chmod 600 "$ARQUIVO"
  echo "   senha gravada em $ARQUIVO (permissão 600)"
else
  echo "   FALHOU (HTTP $codigo)"
  echo "$corpo" | head -c 300
  exit 1
fi

echo ""
echo "=== conferindo no banco"
docker compose exec -T db psql -U postgres -d postgres -t -A -F'  ' \
  -c "select email, case when email_confirmed_at is null then 'NAO confirmado' else 'confirmado' end from auth.users;" </dev/null | sed 's/^/   /'

echo ""
echo "=== o login funciona de verdade? (testando com a senha gerada)"
teste=$(curl -s -o /dev/null -w '%{http_code}' -X POST "http://localhost:8000/auth/v1/token?grant_type=password" \
  -H "apikey: $(grep '^ANON_KEY=' .env | cut -d= -f2-)" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$SENHA\"}")
if [ "$teste" = "200" ]; then
  echo "   HTTP 200 — entra"
else
  echo "   HTTP $teste — NÃO entra; algo está errado"
  exit 1
fi

echo ""
echo "Para ver a senha depois:  cat ~/.senha-lisa"
