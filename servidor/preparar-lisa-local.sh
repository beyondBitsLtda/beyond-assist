#!/bin/bash
# Prepara a cópia da Lisa que roda DENTRO do iMac — o "modo casa".
#
# A razão de existir é uma só, e está no SUPABASE_URL: apontando para localhost, cada consulta
# custa 5 milissegundos em vez dos 150 que custa dando a volta pela internet e voltando pelo
# túnel. Medido: 25 a 30 vezes mais rápido.
#
# O resto do .env é igual ao da nuvem. Onde faltar valor, o script diz qual — em vez de subir
# quebrado e você descobrir clicando.

set -euo pipefail
export PATH="$HOME/.local/node/bin:$PATH"

REPO="beyondBitsLtda/beyond-assist"
PASTA="$HOME/lisa"
BRANCH="cloudflare-pages"

TOKEN="${GITHUB_TOKEN:-}"
[ -z "$TOKEN" ] && { echo "ERRO: passe o GITHUB_TOKEN no ambiente"; exit 1; }

echo "=== 1) codigo"
if [ -d "$PASTA/.git" ]; then
  cd "$PASTA" && git fetch --quiet origin "$BRANCH" && git checkout --quiet "$BRANCH" && git reset --hard --quiet "origin/$BRANCH"
  echo "   atualizado: $(git log --oneline -1)"
else
  git clone --quiet --branch "$BRANCH" "https://$TOKEN@github.com/$REPO.git" "$PASTA"
  cd "$PASTA"
  # Tira o token da URL do remoto e guarda num arquivo de credencial só do dono — senão ele
  # fica em texto no .git/config, que é legível por qualquer processo do usuário.
  git remote set-url origin "https://github.com/$REPO.git"
  printf 'https://%s@github.com\n' "$TOKEN" > "$HOME/.git-credentials"
  chmod 600 "$HOME/.git-credentials"
  git config credential.helper store
  echo "   clonado: $(git log --oneline -1)"
fi

echo ""
echo "=== 2) configuracao"
SUP="$HOME/supabase/docker/.env"
pega() { grep "^$1=" "$SUP" | head -1 | cut -d= -f2-; }

ENV_LOCAL="$PASTA/.env"
{
  echo "# A Lisa de casa. Gerado automaticamente — ver preparar-lisa-local.sh"
  echo "#"
  echo "# A UNICA diferenca que importa em relacao a nuvem esta na linha abaixo: o banco e"
  echo "# alcancado por localhost, sem dar a volta pela internet. Todo o resto e igual."
  echo "SUPABASE_URL=http://localhost:8000"
  echo "SUPABASE_SERVICE_ROLE_KEY=$(pega SERVICE_ROLE_KEY)"
  echo "SUPABASE_ANON_KEY=$(pega ANON_KEY)"
  echo "SUPABASE_JWT_SECRET=$(pega JWT_SECRET)"
} > "$ENV_LOCAL"

# Valores que vieram de fora (passados no ambiente por quem chamou o script).
for chave in GEMINI_API_KEYS GITHUB_TOKEN INGEST_SECRET CRON_SECRET VAPID_PRIVATE_KEY VAPID_SUBJECT NEXT_PUBLIC_VAPID_PUBLIC_KEY SERVICE_KEY_TESTE SUBABASE_TESTE_URL TRELLO_KEY TRELLO_TOKEN TRELLO_BOARD_IDS TRELLO_DEPLOY_BOARD_ID GEMINI_EMBED_MODEL GEMINI_TTS_MODEL GEMINI_TTS_VOICE RAG_TOP_K RAG_MIN_SIMILARITY; do
  valor="${!chave:-}"
  [ -n "$valor" ] && echo "$chave=$valor" >> "$ENV_LOCAL"
done
chmod 600 "$ENV_LOCAL"

echo "   $(grep -c '=' "$ENV_LOCAL") variaveis gravadas em $ENV_LOCAL"
echo "   faltando (os paineis que dependem delas nao vao funcionar em casa):"
faltou=0
for chave in GEMINI_API_KEYS GITHUB_TOKEN TRELLO_KEY TRELLO_TOKEN TRELLO_BOARD_IDS SERVICE_KEY_TESTE SUBABASE_TESTE_URL; do
  grep -q "^$chave=" "$ENV_LOCAL" || { echo "     - $chave"; faltou=1; }
done
[ "$faltou" = "0" ] && echo "     (nenhuma)"

echo ""
echo "=== 3) dependencias (demora nesta maquina)"
cd "$PASTA"
npm install --no-audit --no-fund 2>&1 | tail -3

echo ""
echo "=== 4) build"
# Next usa bastante memoria pra compilar; com 3,4 GB livres vale limitar pra nao ser morto
# pelo sistema no meio.
NODE_OPTIONS="--max-old-space-size=2048" npm run build 2>&1 | grep -E "Compiled successfully|Failed|Error|Middleware|○|ƒ" | head -12

echo ""
echo "pronto. o proximo passo e subir como servico."
