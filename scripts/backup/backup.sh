#!/usr/bin/env bash
# Backup do banco da Lisa e de tudo que mora nele (Abacato, Beyond Brain, Beyond Space) —
# BEYOND-0003. A Sentinela fica fora: ela está num projeto do Supabase na nuvem, não no iMac.
#
#   backup.sh 3horas    a cada 3 horas; ficam os 3 MAIS RECENTES — o 4º substitui o mais antigo
#   backup.sh semanal   toda segunda; FICA GUARDADO na nuvem até alguém apagar à mão
#
# Roda NO iMac, pelo cron:
#   0 */3 * * *  /home/bryan/backup/backup.sh 3horas  >> /home/bryan/backup/backup.log 2>&1
#   15 3 * * 1   /home/bryan/backup/backup.sh semanal >> /home/bryan/backup/backup.log 2>&1
#
# Nome do pacote: tipo, dia e hora — beyond-bkp-semanal_2026-10-19_03h15.tar. O nome aparece
# assim mesmo no Drive (o CONTEÚDO é que vai cifrado), para dar para achar o backup de olho.
#
# O pacote leva TUDO o que é preciso para reconstruir o servidor do zero:
#   - cada base do Postgres em formato custom (pg_dump -Fc): comprimido e restaurável por
#     tabela, com pg_restore — inclusive só uma tabela, se for só ela que se perdeu;
#   - os papéis (roles) do cluster, que o pg_dump não leva;
#   - os arquivos do Storage (documentos, imagens de comentário, papéis de parede);
#   - a configuração do Supabase (docker/.env e os compose), sem a qual o banco restaurado
#     não aceita as chaves que as aplicações usam.
#
# O pacote sai daqui CRIPTOGRAFADO (remote "crypt" do rclone): ele tem dado pessoal e as
# chaves do servidor, e a nuvem gratuita não é lugar para isso em texto aberto.
#
# Configuração por variáveis (os padrões servem para o iMac de hoje):
#   SUPABASE_DIR    pasta docker do Supabase                    (~/supabase/docker)
#   BKP_PACOTES     onde os pacotes ficam aqui (uma pasta/tipo) (~/backup/pacotes)
#   BKP_CRIPTO      remote criptografado do rclone              (beyond-bkp-cripto)
#   MANTER_SEMANAIS quantos semanais guardar AQUI no iMac       (4; na nuvem, todos)
#   MANTER_3HORAS   quantos de 3 horas guardar, aqui e na nuvem (3)
#   DB_CONTAINER    container do Postgres                       (supabase-db)
#   ST_CONTAINER    container do Storage                        (supabase-storage)

set -Eeuo pipefail

TIPO="${1:-}"
case "$TIPO" in
  3horas|semanal) ;;
  *) echo "uso: backup.sh 3horas|semanal" >&2; exit 2 ;;
esac

SUPABASE_DIR="${SUPABASE_DIR:-$HOME/supabase/docker}"
BKP_PACOTES="${BKP_PACOTES:-$HOME/backup/pacotes}"
BKP_CRIPTO="${BKP_CRIPTO:-beyond-bkp-cripto}"
MANTER_SEMANAIS="${MANTER_SEMANAIS:-4}"
MANTER_3HORAS="${MANTER_3HORAS:-3}"
DB_CONTAINER="${DB_CONTAINER:-supabase-db}"
ST_CONTAINER="${ST_CONTAINER:-supabase-storage}"

export PATH="/usr/local/bin:/usr/bin:/bin:$HOME/.local/bin:$PATH"
# O pacote leva as chaves do Supabase e dado pessoal: só o dono da conta lê, nem o grupo.
umask 077

LOCAL="$BKP_PACOTES/$TIPO"
REMOTO="$BKP_CRIPTO:$TIPO"
STATUS="$HOME/backup/ultimo-$TIPO.json"
carimbo="$(date +%Y-%m-%d_%Hh%M)"
nome="beyond-bkp-${TIPO}_${carimbo}.tar"
trabalho="$LOCAL/.montando-$carimbo"
pacote="$LOCAL/$nome"
inicio=$(date +%s)

log() { echo "[$(date '+%F %T')] [$TIPO] $*"; }

# Falhou em qualquer ponto: registra e não deixa pacote pela metade parecendo bom.
falhou() {
  local linha=$1
  log "FALHOU na linha $linha"
  rm -rf "$trabalho" "$pacote.parcial"
  printf '{"ok":false,"tipo":"%s","quando":"%s","erro":"falhou na linha %s; ver backup.log"}\n' "$TIPO" "$(date -Iseconds)" "$linha" > "$STATUS"
  exit 1
}
trap 'falhou $LINENO' ERR

# Uma execução por vez, para os dois tipos: na segunda o de 3 horas e o semanal não podem ler o
# banco ao mesmo tempo. Quem chega depois ESPERA (até 1 h) em vez de desistir.
mkdir -p "$LOCAL"
exec 9> "$BKP_PACOTES/.trava"
flock -w 3600 9 || { log "outro backup está rodando há mais de 1 h; desisti"; false; }

# O superusuário do cluster. Nas imagens novas do Supabase é o supabase_admin; o postgres
# deixou de ser superusuário e não enxerga os esquemas internos (auth, storage).
SU=supabase_admin
docker exec "$DB_CONTAINER" psql -U "$SU" -d postgres -Atc 'select 1' > /dev/null 2>&1 || SU=postgres
log "início — superusuário $SU"

mkdir -p "$trabalho"

# ------------------------------------------------------------------ banco
docker exec "$DB_CONTAINER" pg_dumpall -U "$SU" --roles-only > "$trabalho/00-papeis.sql"

bases=$(docker exec "$DB_CONTAINER" psql -U "$SU" -d postgres -Atc \
  "select datname from pg_database where not datistemplate and datallowconn order by 1")
for base in $bases; do
  log "dump da base $base"
  docker exec "$DB_CONTAINER" pg_dump -U "$SU" -d "$base" -Fc -Z 6 > "$trabalho/banco-$base.dump"
  # Um dump que o pg_restore não consegue nem listar não é backup: é um arquivo com o nome certo.
  docker exec -i "$DB_CONTAINER" pg_restore --list < "$trabalho/banco-$base.dump" > "$trabalho/banco-$base.indice.txt"
  docker exec "$DB_CONTAINER" psql -U "$SU" -d "$base" -Atc \
    "select schemaname||'.'||relname||'='||n_live_tup from pg_stat_user_tables order by 1" > "$trabalho/banco-$base.contagens.txt"
done

# ------------------------------------------------------------------ arquivos do Storage
# Pelo próprio container: os arquivos são do usuário dele, e o tar daqui de fora toparia com
# permissão negada.
log "arquivos do Storage"
docker exec "$ST_CONTAINER" tar -czf - -C /var/lib storage > "$trabalho/storage.tar.gz"
gzip -t "$trabalho/storage.tar.gz"

# ------------------------------------------------------------------ configuração
mkdir -p "$trabalho/config"
cp "$SUPABASE_DIR/.env" "$trabalho/config/supabase.env"
cp "$SUPABASE_DIR"/docker-compose*.yml "$trabalho/config/" 2>/dev/null || true
cp -r "$SUPABASE_DIR/volumes/api" "$trabalho/config/" 2>/dev/null || true
crontab -l > "$trabalho/config/crontab.txt" 2>/dev/null || true

# ------------------------------------------------------------------ manifesto
{
  echo "Backup Beyond — $TIPO — $carimbo"
  echo "Máquina: $(hostname)  |  Postgres: $(docker exec "$DB_CONTAINER" postgres --version)"
  echo "Imagem do banco: $(docker inspect -f '{{.Config.Image}}' "$DB_CONTAINER")"
  echo "Bases: $bases"
  echo
  echo "Restaurar: scripts/backup/restaurar.sh (ver LEIA-ME.md no repositório beyond-assist)."
  echo
  (cd "$trabalho" && find . -type f ! -name MANIFESTO.txt -exec sha256sum {} + | sort -k2)
} > "$trabalho/MANIFESTO.txt"

# Um arquivo só por backup: mais fácil de achar, baixar e conferir. Sem compressão aqui —
# o que está dentro já veio comprimido.
tar -cf "$pacote.parcial" -C "$trabalho" .
mv "$pacote.parcial" "$pacote"
rm -rf "$trabalho"
tamanho=$(du -h "$pacote" | cut -f1)
log "pacote pronto: $nome ($tamanho)"

# ------------------------------------------------------------------ nuvem
# A nuvem falhar NÃO desfaz o backup: o pacote já está pronto aqui no iMac e fica guardado.
# O status sai com ok=false para alguém olhar, mas a cópia local existe.
enviar() {
  command -v rclone > /dev/null || { log "rclone não instalado (ver LEIA-ME.md)"; return 1; }
  rclone listremotes | grep -q "^${BKP_CRIPTO}:$" || { log "remote $BKP_CRIPTO não configurado no rclone"; return 1; }
  rclone copy "$pacote" "$REMOTO/" --retries 5 --low-level-retries 10 || return 1
  # Conferência de verdade: o cryptcheck cifra o arquivo daqui com o mesmo nonce do que está
  # na nuvem e compara os hashes — prova que o que subiu é este pacote, sem baixar nada.
  rclone cryptcheck "$LOCAL" "$REMOTO/" --one-way --include "$nome" || return 1
}

nuvem=false
if enviar; then
  nuvem=true
  log "enviado e conferido em $REMOTO"
  # Rodízio do de 3 horas: ficam os $MANTER_3HORAS mais recentes (pela data e hora do nome) e o
  # mais antigo sai — mas só depois que o novo subiu e conferiu, para nunca ficar com menos.
  # O semanal nunca é apagado daqui: fica na nuvem até alguém apagar à mão.
  if [ "$TIPO" = 3horas ]; then
    rclone lsf "$REMOTO/" --files-only --include 'beyond-bkp-3horas_*.tar' | sort | head -n -"$MANTER_3HORAS" |
      while read -r velho; do
        [ "$velho" = "$nome" ] && continue
        rclone deletefile "$REMOTO/$velho" && log "substituído na nuvem: $velho" || log "aviso: não consegui apagar $velho"
      done
    rclone lsf "$REMOTO/" --files-only --include "$nome" | grep -qx "$nome"       || { log "o pacote novo sumiu da nuvem depois do rodízio"; nuvem=false; }
  fi
else
  log "NUVEM FALHOU — o pacote ficou só aqui: $pacote"
fi

# ------------------------------------------------------------------ retenção local
# De 3 horas: os $MANTER_3HORAS mais recentes, como na nuvem.
# Semanal: os últimos $MANTER_SEMANAIS aqui — os da nuvem ficam todos.
if [ "$TIPO" = 3horas ]; then
  ls -1 "$LOCAL"/beyond-bkp-3horas_*.tar 2>/dev/null | sort | head -n -"$MANTER_3HORAS" | xargs -r rm -f
else
  ls -1t "$LOCAL"/beyond-bkp-semanal_*.tar 2>/dev/null | tail -n +"$((MANTER_SEMANAIS + 1))" | xargs -r rm -f
fi

duracao=$(( $(date +%s) - inicio ))
printf '{"ok":%s,"tipo":"%s","quando":"%s","pacote":"%s","tamanho":"%s","segundos":%d,"nuvem":%s,"destino":"%s"}\n' \
  "$nuvem" "$TIPO" "$(date -Iseconds)" "$nome" "$tamanho" "$duracao" "$nuvem" "$REMOTO" > "$STATUS"
log "fim em ${duracao}s"
[ "$nuvem" = true ] || exit 1
