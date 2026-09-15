#!/bin/bash
# Instala o Node na pasta pessoal, sem sudo.
#
# O caminho normal (repositório NodeSource + apt) exige root. Aqui o binário oficial é
# descompactado em ~/.local/node e entra no PATH pelo .bashrc — funciona igual, não toca em
# nada do sistema, e desinstalar é apagar uma pasta.

set -euo pipefail

VERSAO="v22.11.0"
DESTINO="$HOME/.local/node"

if [ -x "$DESTINO/bin/node" ]; then
  echo "ja instalado: $("$DESTINO/bin/node" --version)"
else
  echo "=== baixando Node $VERSAO (uns 25 MB)"
  mkdir -p "$DESTINO"
  curl -fsSL "https://nodejs.org/dist/$VERSAO/node-$VERSAO-linux-x64.tar.xz" -o /tmp/node.tar.xz
  tar -xJf /tmp/node.tar.xz -C "$DESTINO" --strip-components=1
  rm -f /tmp/node.tar.xz
  echo "   instalado em $DESTINO"
fi

# PATH para as próximas sessões, sem duplicar a linha se já estiver lá
if ! grep -q '.local/node/bin' "$HOME/.bashrc" 2>/dev/null; then
  printf '\n# Node instalado na pasta pessoal (sem sudo) — ver instalar-node.sh\nexport PATH="$HOME/.local/node/bin:$PATH"\n' >> "$HOME/.bashrc"
  echo "   PATH adicionado ao .bashrc"
fi

export PATH="$DESTINO/bin:$PATH"
echo ""
echo "=== conferindo"
echo "   node: $(node --version)"
echo "   npm:  $(npm --version)"
echo "   arquitetura: $(node -p 'process.arch')"
echo "   nucleos que o Node enxerga: $(node -p 'require("os").cpus().length')"
