#!/usr/bin/env bash
# Recupera UM fluxograma do ProcessMap de um backup feito pelo backup.sh (01/11/2026: "ela estragou o
# meu fluxograma das funcionalidades da versão desktop" — a Lisa gravou uma aba pela metade por cima).
#
# Não sobrescreve nada. A versão do backup entra como uma VERSÃO ANTERIOR do fluxo
# (lisa_fluxogramas_versoes, db/fluxogramas_versoes.sql) e você escolhe no painel ProcessMap:
# ⋯ do fluxo → "Versões anteriores…" → a "recuperada do backup …" → "voltar para esta".
# (O restaurar.sh produção volta o banco INTEIRO, e perde tudo o que mudou depois do backup.)
#
#   recuperar-fluxo.sh ver     "<nome ou id do fluxo>" [pacote|filtro]   como o fluxo está no backup (abas e formas)
#   recuperar-fluxo.sh guardar "<nome ou id do fluxo>" [pacote|filtro]   põe essa versão nas versões anteriores
#
# `filtro`, como no restaurar.sh: a data (2026-11-01), o tipo (3horas, semanal) ou os dois
# (3horas_2026-11-01_09h00); vale o mais recente que bater. Sem filtro: o mais recente.
# Rode no iMac (onde estão o Docker do Supabase e o rclone). Veja os pacotes: restaurar.sh listar

set -Eeuo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"

BKP_PACOTES="${BKP_PACOTES:-$HOME/backup/pacotes}"
BKP_CRIPTO="${BKP_CRIPTO:-beyond-bkp-cripto}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"

log() { echo "[$(date '+%F %T')] $*"; }
morrer() { echo "ERRO: $*" >&2; exit 1; }
mais_novo() { awk -F'_' '{ print $(NF-1) "_" $NF "	" $0 }' | sort | tail -1 | cut -f2; }

modo="${1:-}"
fluxo="${2:-}"
alvo="${3:-}"
{ [ "$modo" = "ver" ] || [ "$modo" = "guardar" ]; } && [ -n "$fluxo" ] \
  || morrer "uso: recuperar-fluxo.sh ver|guardar \"<nome ou id do fluxo>\" [pacote|filtro]"

# ------------------------------------------------------------------ achar o pacote (como no restaurar.sh)
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
log "pacote: $(basename "$pacote")"

dir=$(mktemp -d)
nome_c="bkp-fluxo-$$"
trap 'docker rm -f "$nome_c" > /dev/null 2>&1 || true; rm -rf "$dir"' EXIT
tar -xf "$pacote" -C "$dir"
(cd "$dir" && grep -E '^[0-9a-f]{64}  ' MANIFESTO.txt | sha256sum -c --quiet) || morrer "o pacote não confere com o MANIFESTO (arquivo corrompido)"
[ -f "$dir/banco-postgres.dump" ] || morrer "o pacote não tem a base postgres"

# ------------------------------------------------------------------ só a tabela dos fluxos, num Postgres descartável
imagem=$(grep '^Imagem do banco:' "$dir/MANIFESTO.txt" | cut -d' ' -f4)
senha=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')
log "subindo um Postgres descartável ($imagem) — o banco em uso não é tocado"
docker run -d --rm --name "$nome_c" -e POSTGRES_PASSWORD="$senha" "$imagem" > /dev/null
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
docker exec -i "$nome_c" pg_restore -U "$SU" -d postgres --no-owner --no-privileges -n public -t lisa_fluxogramas \
  < "$dir/banco-postgres.dump" > "$dir/restore.log" 2>&1 || true
docker exec "$nome_c" psql -U "$SU" -d postgres -Atc "select 1 from public.lisa_fluxogramas limit 1" > /dev/null 2>&1 \
  || morrer "a tabela lisa_fluxogramas não está neste backup (ele é de antes de 01/11/2026?)"

# o fluxo pelo id (uuid) ou por um pedaço do nome
consulta() { docker exec -i "$nome_c" psql -U "$SU" -d postgres -v ON_ERROR_STOP=1 -v alvo="$fluxo" -qAt "$@"; }
FILTRO="not arquivado and (id::text = :'alvo' or nome ilike '%' || :'alvo' || '%')"

echo
echo "No backup $(basename "$pacote"):"
echo "select format(E'%s  v%s  %s formas  salvo em %s  \"%s\"\\n%s', id, versao, formas, to_char(atualizado_em at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), nome,
  (select string_agg(format('      aba \"%s\": %s formas', p->>'name', jsonb_array_length(coalesce(p->'shapes', '[]'::jsonb))), E'\\n')
     from jsonb_array_elements(coalesce(documento->'pages', '[]'::jsonb)) p))
  from public.lisa_fluxogramas where $FILTRO order by atualizado_em desc;" | consulta
quantos=$(echo "select count(*) from public.lisa_fluxogramas where $FILTRO;" | consulta)
[ "$quantos" -gt 0 ] || morrer "nenhum fluxo com \"$fluxo\" no nome neste backup"

if [ "$modo" = "ver" ]; then
  echo
  echo "Para pôr essa versão nas versões anteriores do fluxo: recuperar-fluxo.sh guardar \"$fluxo\" ${alvo:-<filtro>}"
  [ "$quantos" -gt 1 ] && echo "(há $quantos fluxos com esse nome — use o id, a primeira coluna)"
  exit 0
fi

[ "$quantos" -eq 1 ] || morrer "há $quantos fluxos com \"$fluxo\" no nome — rode de novo com o id (a primeira coluna acima)"

# ------------------------------------------------------------------ guardar como versão anterior no banco em uso
# A linha vai como JSON numa linha só; o CSV com aspas e separador que nunca aparecem num JSON
# (\x01, \x02) passa o texto sem mexer em nenhuma barra invertida.
echo "copy (select row_to_json(t)::text from (select id, dono_id, versao, nome, documento, modo, formas from public.lisa_fluxogramas where $FILTRO) t)
  to stdout with (format csv, quote e'\\x01', delimiter e'\\x02');" | consulta | grep -m1 '^{' > "$dir/fluxo.json" || true
[ -s "$dir/fluxo.json" ] || morrer "não consegui ler o fluxo do backup"

SUV=supabase_admin
docker exec "$DB_CONTAINER" psql -U "$SUV" -d postgres -Atc 'select 1' > /dev/null 2>&1 || SUV=postgres
docker exec "$DB_CONTAINER" psql -U "$SUV" -d postgres -Atc "select 1 from public.lisa_fluxogramas_versoes limit 1" > /dev/null 2>&1 \
  || morrer "o banco em uso ainda não tem a tabela das versões: aplique db/fluxogramas_versoes.sql antes"

motivo="recuperada do backup $(basename "$pacote" .tar | sed 's/^beyond-bkp-//')"
log "guardando como versão anterior ($motivo)"
{
  echo "create temp table r (j jsonb);"
  echo "copy r from stdin with (format csv, quote e'\\x01', delimiter e'\\x02');"
  cat "$dir/fluxo.json"
  echo '\.'
  echo "insert into public.lisa_fluxogramas_versoes (fluxo_id, dono_id, versao, nome, documento, modo, formas, motivo)
    select (j->>'id')::uuid, (j->>'dono_id')::uuid, (j->>'versao')::int, j->>'nome', j->'documento', j->>'modo', (j->>'formas')::int, left(:'motivo', 200)
    from r where exists (select 1 from public.lisa_fluxogramas f where f.id = (r.j->>'id')::uuid)
    returning format('guardada: v%s, %s formas', versao, formas);"
} | docker exec -i "$DB_CONTAINER" psql -U "$SUV" -d postgres -v ON_ERROR_STOP=1 -v motivo="$motivo" -qAt \
  | grep -E '^guardada' || morrer "nada foi guardado: o fluxo não existe mais no banco em uso (foi excluído?), ou o psql falhou (veja a mensagem acima)"

echo
echo "Pronto. No painel ProcessMap: ⋯ do fluxo → \"Versões anteriores…\" → \"$motivo\" → \"voltar para esta\"."
