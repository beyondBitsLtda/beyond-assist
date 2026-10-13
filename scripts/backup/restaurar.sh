#!/usr/bin/env bash
# Restaura um backup feito pelo backup.sh (BEYOND-0003).
#
#   restaurar.sh listar                       os pacotes que estão na nuvem (de 3 horas e semanais)
#   restaurar.sh ensaio   [pacote|filtro]     restaura num Postgres DESCARTÁVEL e confere — não
#                                             toca no banco de verdade (padrão: o mais recente)
#   restaurar.sh producao <pacote|filtro>     restaura POR CIMA do banco e do Storage em uso
#
# `pacote` é um .tar local. `filtro` é um pedaço do nome — a data (2026-10-19), o tipo
# (3horas, semanal) ou os dois (semanal_2026-10-19); vale o mais recente que bater, procurado
# aqui no iMac e, se não houver, na nuvem.
#
# O ENSAIO EXISTE PORQUE BACKUP QUE NUNCA FOI RESTAURADO É SÓ ESPERANÇA. Ele sobe a mesma
# imagem do Postgres num container à parte, restaura tudo lá dentro e compara o número de
# linhas de cada tabela com o que o backup anotou. Rode depois de instalar e, de vez em
# quando, para ter certeza de que o pacote volta.

set -Eeuo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"

BKP_PACOTES="${BKP_PACOTES:-$HOME/backup/pacotes}"
BKP_CRIPTO="${BKP_CRIPTO:-beyond-bkp-cripto}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
ST_CONTAINER="${ST_CONTAINER:-supabase-storage}"

log() { echo "[$(date '+%F %T')] $*"; }
morrer() { echo "ERRO: $*" >&2; exit 1; }

# Ordena caminhos de pacote pela data/hora do nome (beyond-bkp-TIPO_AAAA-MM-DD_HHhMM.tar), e
# não pelo tipo: o de 3 horas de hoje é mais novo que o semanal de segunda.
mais_novo() { awk -F'_' '{ print $(NF-1) "_" $NF "	" $0 }' | sort | tail -1 | cut -f2; }

modo="${1:-}"
alvo="${2:-}"

[ "$modo" = "listar" ] && { rclone lsl "$BKP_CRIPTO:" --include 'beyond-bkp-*.tar' | sort -k4; exit 0; }
[ "$modo" = "ensaio" ] || [ "$modo" = "producao" ] || morrer "uso: restaurar.sh listar | ensaio [pacote|filtro] | producao <pacote|filtro>"
[ "$modo" = "producao" ] && [ -z "$alvo" ] && morrer "na produção, diga qual pacote ou data — nunca 'o mais recente' por padrão"

# ------------------------------------------------------------------ achar o pacote
if [ -n "$alvo" ] && [ -f "$alvo" ]; then
  pacote="$alvo"
else
  filtro="beyond-bkp-*${alvo}*.tar"
  pacote=$(find "$BKP_PACOTES" -name "$filtro" -type f 2>/dev/null | mais_novo || true)
  if [ -z "$pacote" ]; then
    caminho=$(rclone lsf "$BKP_CRIPTO:" -R --files-only --include "$filtro" | mais_novo || true)
    [ -n "$caminho" ] || morrer "nenhum pacote ${alvo:+de '$alvo' }aqui nem na nuvem (veja: restaurar.sh listar)"
    destino="$BKP_PACOTES/$(dirname "$caminho")"
    mkdir -p "$destino"
    log "baixando $caminho"
    rclone copy "$BKP_CRIPTO:$caminho" "$destino/"
    pacote="$destino/$(basename "$caminho")"
  fi
fi
log "pacote: $pacote"

dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
tar -xf "$pacote" -C "$dir"

# Cada arquivo confere com o hash anotado no dia do backup.
(cd "$dir" && grep -E '^[0-9a-f]{64}  ' MANIFESTO.txt | sha256sum -c --quiet) || morrer "o pacote não confere com o MANIFESTO (arquivo corrompido)"
log "pacote íntegro"
bases=$(ls "$dir"/banco-*.dump | sed -E 's#.*/banco-(.*)\.dump#\1#')

# ------------------------------------------------------------------ ensaio
if [ "$modo" = "ensaio" ]; then
  imagem=$(grep '^Imagem do banco:' "$dir/MANIFESTO.txt" | cut -d' ' -f4)
  nome_c="bkp-ensaio-$$"
  senha=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
  log "subindo Postgres descartável ($imagem)"
  docker run -d --rm --name "$nome_c" -e POSTGRES_PASSWORD="$senha" "$imagem" > /dev/null
  trap 'docker rm -f "$nome_c" > /dev/null 2>&1; rm -rf "$dir"' EXIT
  # A imagem sobe um Postgres TEMPORÁRIO para rodar os scripts de início, derruba e sobe o
  # definitivo. O pg_isready responde "pronto" já no temporário — e restaurar nele termina em
  # "the database system is shutting down". O sinal certo é a linha do fim do início no log.
  pronto=0
  for _ in $(seq 1 120); do
    if docker logs "$nome_c" 2>&1 | grep -q "init process complete" \
       && docker exec "$nome_c" pg_isready -U postgres -q 2>/dev/null; then pronto=1; break; fi
    sleep 2
  done
  [ "$pronto" -eq 1 ] || morrer "o Postgres descartável não ficou pronto em 4 minutos"
  sleep 3
  SU=supabase_admin
  docker exec "$nome_c" psql -U "$SU" -d postgres -Atc 'select 1' > /dev/null 2>&1 || SU=postgres

  # Papéis que já existem na imagem dão erro de "já existe" — esperado e inofensivo.
  docker exec -i "$nome_c" psql -U "$SU" -d postgres -q < "$dir/00-papeis.sql" > /dev/null 2>&1 || true

  problemas=0
  for base in $bases; do
    docker exec "$nome_c" psql -U "$SU" -d postgres -Atc "select 1 from pg_database where datname='$base'" | grep -q 1 \
      || docker exec "$nome_c" createdb -U "$SU" "$base"
    log "restaurando $base"
    docker exec -i "$nome_c" pg_restore -U "$SU" -d "$base" --clean --if-exists --no-owner \
      < "$dir/banco-$base.dump" > "$dir/restore-$base.log" 2>&1 || true
    erros=$(grep -c '^pg_restore: error' "$dir/restore-$base.log" || true)
    [ "$erros" -eq 0 ] || log "  $erros aviso(s) do pg_restore (objetos internos do Supabase que a imagem já cria) — ver abaixo"
    grep '^pg_restore: error' "$dir/restore-$base.log" | head -5 | sed 's/^/    /' || true

    # Linhas: contagem EXATA aqui contra a estimativa anotada no dia. A estimativa do Postgres
    # (n_live_tup) pode variar um pouco; o que interessa é tabela vazia que devia ter dados.
    docker exec "$nome_c" psql -U "$SU" -d "$base" -Atc "analyze" > /dev/null
    while IFS='=' read -r tabela esperado; do
      [ -n "$tabela" ] || continue
      real=$(docker exec "$nome_c" psql -U "$SU" -d "$base" -Atc "select count(*) from $tabela" 2>/dev/null || echo "FALTA")
      if [ "$real" = "FALTA" ] || { [ "$esperado" -gt 0 ] && [ "$real" -eq 0 ]; }; then
        log "  PROBLEMA  $tabela: esperado ~$esperado, restaurado $real"
        problemas=$((problemas + 1))
      fi
    done < "$dir/banco-$base.contagens.txt"
    log "  $(wc -l < "$dir/banco-$base.contagens.txt") tabelas conferidas em $base"
  done

  arquivos=$(tar -tzf "$dir/storage.tar.gz" | grep -vc '/$' || true)
  log "Storage: $arquivos arquivo(s) no pacote, tar íntegro"
  [ -f "$dir/config/supabase.env" ] && log "configuração do Supabase presente" || { log "PROBLEMA: falta config/supabase.env"; problemas=$((problemas + 1)); }

  if [ "$problemas" -eq 0 ]; then log "ENSAIO OK — este backup volta"; else log "ENSAIO COM $problemas PROBLEMA(S)"; exit 1; fi
  exit 0
fi

# ------------------------------------------------------------------ produção
echo
echo "Isto vai SOBRESCREVER o banco ($bases) e os arquivos do Storage em uso pelo"
echo "pacote $(basename "$pacote"). Tudo o que mudou depois dele será perdido."
read -r -p "Para continuar, digite RESTAURAR: " confirma
[ "$confirma" = "RESTAURAR" ] || morrer "cancelado"

SU=supabase_admin
docker exec "$DB_CONTAINER" psql -U "$SU" -d postgres -Atc 'select 1' > /dev/null 2>&1 || SU=postgres
docker exec -i "$DB_CONTAINER" psql -U "$SU" -d postgres -q < "$dir/00-papeis.sql" > /dev/null 2>&1 || true
for base in $bases; do
  log "restaurando $base"
  docker exec -i "$DB_CONTAINER" pg_restore -U "$SU" -d "$base" --clean --if-exists \
    < "$dir/banco-$base.dump" 2>&1 | grep '^pg_restore: error' | head -20 || true
done
log "restaurando arquivos do Storage"
docker exec -i "$ST_CONTAINER" tar -xzf - -C /var/lib < "$dir/storage.tar.gz"
log "pronto. Confira as aplicações; a configuração antiga está em config/ dentro do pacote, se precisar."
