import { fonteDosQuadros, gravarConfig, FONTES_DE_QUADRO } from "@/lib/configLisa.js";
import { loadAllCards, esquecerCache } from "@/lib/liveQuadros.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(corpo, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

/**
 * GET /api/fonte-dos-quadros — qual fonte está valendo, e quanto tem em cada uma.
 *
 * Os dois lados vêm juntos de propósito. Trocar a fonte das tarefas às cegas é o tipo de
 * clique de que a pessoa se arrepende: ninguém quer descobrir que o Abacato tinha três cards
 * DEPOIS de o painel inteiro passar a mostrar três cards. Com os números na tela, a decisão é
 * informada — e o caso "esqueci de importar do Trello" aparece antes, não depois.
 *
 * Se um dos lados falhar (chave do Trello faltando, banco fora do ar), o outro continua sendo
 * mostrado, com o erro escrito ao lado. Uma tela que some inteira porque uma das fontes está
 * ruim esconde justamente a informação de que aquela fonte está ruim.
 */
export async function GET() {
  const atual = await fonteDosQuadros();

  const contar = async (fonte) => {
    try {
      const cards = await loadAllCards({ fonte, fresh: true });
      const quadros = new Set(cards.map((c) => c.board).filter(Boolean));
      const agora = Date.now();
      return {
        ok: true,
        cards: cards.length,
        quadros: quadros.size,
        abertos: cards.filter((c) => !c.due_complete).length,
        atrasados: cards.filter((c) => !c.due_complete && c.due && new Date(c.due).getTime() < agora).length,
        nomes: [...quadros].sort((a, b) => a.localeCompare(b)),
      };
    } catch (e) {
      return { ok: false, erro: String(e?.message || e).slice(0, 200) };
    }
  };

  const [trello, abacato] = await Promise.all([contar("trello"), contar("abacato")]);
  return json({ ok: true, atual, fontes: { trello, abacato } });
}

/** PUT /api/fonte-dos-quadros   body: { fonte } */
export async function PUT(req) {
  const { fonte } = await req.json().catch(() => ({}));
  if (!FONTES_DE_QUADRO.includes(fonte)) {
    return json({ ok: false, error: `fonte precisa ser uma de: ${FONTES_DE_QUADRO.join(", ")}` }, 400);
  }

  try {
    await gravarConfig("fonte_dos_quadros", fonte, "painel");
    // O cache de leitura vive quinze segundos. Sem esquecê-lo aqui, a próxima tela ainda viria
    // da fonte antiga e o interruptor pareceria não ter pegado.
    esquecerCache();
    return json({ ok: true, atual: await fonteDosQuadros() });
  } catch (e) {
    return json({ ok: false, error: String(e?.message || e) }, 500);
  }
}
