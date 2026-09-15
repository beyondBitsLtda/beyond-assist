#!/bin/bash
# Atualiza a Lisa de casa a partir do repositório e reinicia.
#
# Cuidados que este script toma, e o motivo de cada um:
#
#  - Só reconstrói se o código MUDOU. Reconstruir à toa gasta minutos de CPU numa máquina que
#    também está servindo o banco.
#  - Preserva o .env. Ele não está no repositório e tem os segredos locais; um `git reset`
#    descuidado o apagaria.
#  - Só reinicia se o build der certo. Reiniciar com build quebrado troca "versão antiga
#    funcionando" por "nada funcionando".

set -uo pipefail
export PATH="$HOME/.local/node/bin:$PATH"

PASTA="$HOME/lisa"
BRANCH="cloudflare-pages"
cd "$PASTA" || { echo "ERRO: $PASTA não existe"; exit 1; }

antes=$(git rev-parse HEAD)
git fetch --quiet origin "$BRANCH" || { echo "ERRO: não consegui buscar do GitHub"; exit 1; }
depois=$(git rev-parse "origin/$BRANCH")

if [ "$antes" = "$depois" ]; then
  echo "[$(date +%H:%M:%S)] ja esta na versao mais nova: $(git log --oneline -1)"
  exit 0
fi

echo "[$(date +%H:%M:%S)] atualizando"
echo "   de:   $(git log --oneline -1 $antes)"
echo "   para: $(git log --oneline -1 $depois)"

# O .env não é versionado; o reset não o toca, mas a cópia de segurança custa nada e evita
# um dia ruim.
cp -f .env /tmp/env-lisa-backup 2>/dev/null || true
git reset --hard --quiet "$depois"
[ -s .env ] || cp -f /tmp/env-lisa-backup .env 2>/dev/null || true

# package-lock mudou? então as dependências podem ter mudado.
if ! git diff --quiet "$antes" "$depois" -- package-lock.json; then
  echo "   dependencias mudaram — reinstalando"
  npm install --no-audit --no-fund 2>&1 | tail -2
fi

echo "   compilando"
if NODE_OPTIONS="--max-old-space-size=2048" npm run build > /tmp/build-lisa.log 2>&1; then
  echo "   build ok"
else
  echo "   BUILD FALHOU — mantendo a versao antiga no ar. ultimas linhas:"
  tail -12 /tmp/build-lisa.log | sed 's/^/     /'
  git reset --hard --quiet "$antes"
  exit 1
fi

echo "   reiniciando"
"$HOME/subir-lisa-local.sh" subir 2>&1 | grep -E "HTTP|health" | sed 's/^/   /'
echo "[$(date +%H:%M:%S)] pronto: $(git log --oneline -1)"
