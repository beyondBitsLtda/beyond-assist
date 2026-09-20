import { jsonResponse } from "@/lib/http.js";
import { conferirTokenDaExtensao } from "@/lib/lisaCodeAuth.js";
import { loadAllCards } from "@/lib/liveQuadros.js";
import { listDelpTasks } from "@/lib/delpTasks.js";
import { listTickets } from "@/lib/sentinel.js";
import { listThoughts } from "@/lib/notes.js";
import { termosDoArquivo, itensRelevantes, blocoDeContexto } from "@/lib/relevanciaDoArquivo.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/lisa-code/contexto   headers: { "x-lisa-token": "..." }   body: { file, trecho }
 *
 * O que existe no Beyond Bits sobre o arquivo que você está editando — cards do Trello,
 * tarefas da Delp, chamados do Sentinela e pensamentos. A extensão chama isto quando você MUDA
 * DE ARQUIVO, não a cada mensagem, e guarda o resultado (ver lisaClient.ts).
 *
 * Devolve `bloco: ""` quando nada casa, e isso é o caso comum e desejado: a maioria dos
 * arquivos de um projeto não tem card nenhum falando deles. Inventar um "(nada encontrado)"
 * em toda conversa treinaria a Lisa a mencionar o vazio.
 *
 * Nenhuma chamada de IA acontece aqui. O casamento é por texto (ver relevanciaDoArquivo.js), e
 * a razão é a cota: um embedding por troca de arquivo foi o tipo de consumo que secou as 35
 * chaves num dia e fez a Lisa levar 98 segundos para responder.
 */
export async function POST(req) {
  try {
    const acesso = conferirTokenDaExtensao(req);
    if (!acesso.ok) return jsonResponse({ ok: false, error: acesso.motivo }, 401);

    // POST, e não GET, porque agora vai junto um trecho do arquivo. O CAMINHO sozinho não
    // bastava: `cronograma/index.html` dá o termo "cronograma", enquanto o assunto real —
    // "Painel SEO · Montador de Móveis" — está no título, dentro do arquivo.
    const { file, trecho } = await req.json().catch(() => ({}));
    const arquivo = String(file || "");
    const termos = termosDoArquivo(arquivo, String(trecho || ""));
    // Sem termo útil (um `index.js` dentro de `utils/`, por exemplo) não há o que procurar, e
    // sair buscando quatro fontes para descartar tudo depois é trabalho jogado fora.
    if (!termos.length) return jsonResponse({ ok: true, bloco: "", termos: [] });

    // As quatro fontes em paralelo, e nenhuma delas pode derrubar as outras: se o Trello estiver
    // fora, os chamados e os pensamentos continuam valendo.
    const [cards, delp, chamados, pensamentos] = await Promise.all([
      loadAllCards().catch(() => []),
      listDelpTasks().catch(() => []),
      // listTickets não filtra por status — eu tinha passado `{ status: "open" }`, que seria
      // ignorado em silêncio e daria a impressão de um filtro que não existe.
      listTickets().catch(() => []),
      listThoughts({ limit: 200 }).catch(() => []),
    ]);

    const grupos = [
      { rotulo: "Cards do Trello", itens: itensRelevantes(termos, cards) },
      { rotulo: "Tarefas da Delp", itens: itensRelevantes(termos, delp) },
      { rotulo: "Chamados do Sentinela", itens: itensRelevantes(termos, chamados) },
      { rotulo: "Pensamentos", itens: itensRelevantes(termos, pensamentos) },
    ];

    return jsonResponse({
      ok: true,
      bloco: blocoDeContexto(grupos),
      termos,
      // Contagem por fonte, para diagnosticar "por que não achou nada" sem precisar de log.
      achados: Object.fromEntries(grupos.map((g) => [g.rotulo, g.itens.length])),
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
