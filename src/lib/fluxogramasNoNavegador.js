// ProcessMap na Lisa (01/11/2026), o lado do navegador: as chamadas a /api/fluxogramas e o
// salvamento automático, usados pelo painel ProcessMap (/fluxogramas) e pelo "salvar" do quadro da
// Lisa (QuadroDaLisa.js). Sem nada de React, para o comportamento do salvador ser testado em Node
// (scripts/fluxogramas-check.mjs).

// o painel do ProcessMap abrindo um fluxo (o quadro da Lisa leva para cá)
export const enderecoDoFluxo = (id) => `/fluxogramas?fluxo=${encodeURIComponent(id)}`;

const ESPERA_DEPOIS_DO_ERRO_MS = 8000;
// o navegador recusa pedido com keepalive maior que 64 KB: acima disso, o "sair" vai sem ele
export const LIMITE_DO_KEEPALIVE = 60_000;

/** As chamadas da API. `buscar` é injetável (o fetch do navegador, ou um falso nos testes). */
export function apiDosFluxos(buscar = (...a) => fetch(...a)) {
  async function chamar(url, metodo = "GET", corpo, extra = {}) {
    const r = await buscar(url, {
      method: metodo,
      headers: corpo === undefined ? undefined : { "content-type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      ...extra,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) {
      const erro = new Error(j.error || `HTTP ${r.status}`);
      erro.status = r.status;
      if (j.fluxo) erro.fluxo = j.fluxo;
      throw erro;
    }
    return j;
  }
  return {
    listar: async () => (await chamar("/api/fluxogramas")).projetos,
    ler: async (id) => (await chamar(`/api/fluxogramas/${encodeURIComponent(id)}`)).fluxo,
    /** { documento, nome, projetoId | projetoNovo, origem } → { fluxo, projeto } */
    criar: (dados) => chamar("/api/fluxogramas", "POST", dados),
    /**
     * { documento?, nome?, projetoId?, versao?, forcar?, origem?, motivo? } → o fluxo (sem documento).
     * `origem: "lisa"` guarda a versão de antes (dá para voltar). `extra`: keepalive ao sair.
     */
    salvar: async (id, dados, extra) => (await chamar(`/api/fluxogramas/${encodeURIComponent(id)}`, "PUT", dados, extra)).fluxo,
    excluir: (id) => chamar(`/api/fluxogramas/${encodeURIComponent(id)}`, "DELETE"),
    /** as versões anteriores do fluxo (sem documento), da mais nova para a mais antiga */
    versoes: async (id) => (await chamar(`/api/fluxogramas/${encodeURIComponent(id)}/versoes`)).versoes,
    /** volta o fluxo para uma versão anterior → o fluxo (a versão de agora fica guardada) */
    voltarVersao: async (id, versaoId) => (await chamar(`/api/fluxogramas/${encodeURIComponent(id)}/versoes`, "POST", { versaoId })).fluxo,
    /** um projeto com os fluxos e os documentos (a Lisa trabalhando no projeto citado na conversa) */
    lerProjeto: (id) => chamar(`/api/fluxogramas/projetos?id=${encodeURIComponent(id)}`),
    criarProjeto: async (nome) => (await chamar("/api/fluxogramas/projetos", "POST", { nome })).projeto,
    mudarProjeto: (id, dados) => chamar("/api/fluxogramas/projetos", "PATCH", { id, ...dados }),
    excluirProjeto: (id) => chamar(`/api/fluxogramas/projetos?id=${encodeURIComponent(id)}`, "DELETE"),
  };
}

/**
 * O que conta como "o desenho mudou": o documento sem a hora da exportação e sem as câmeras
 * (rolar e dar zoom não é mudança — ninguém quer "salvando…" a cada roda do mouse).
 */
export function assinaturaDoDesenho(doc) {
  if (!doc || typeof doc !== "object") return "";
  const { exportedAt, viewport, ...resto } = doc;
  if (Array.isArray(resto.pages)) resto.pages = resto.pages.map(({ viewport: _v, ...aba }) => aba);
  try { return JSON.stringify(resto); } catch { return ""; }
}

/**
 * O salvamento automático de UM fluxo já guardado.
 *
 *   const s = criarSalvador({ gravar: (doc, { versao, forcar, saindo }) => api.salvar(...), versao, assinatura, aoEstado })
 *   s.mudou(doc)       a cada mudança do quadro: espera `esperaMs` de calma e grava
 *   s.agora()          grava já o que estiver pendente (o botão "salvar", trocar de fluxo)
 *   s.sair()           a página vai fechar: grava com keepalive, sem esperar resposta
 *   s.ficarComAMinha() no conflito: grava por cima da outra versão
 *   s.ajustarVersao(v) renomear/mover gravou por fora: a versão do banco agora é v
 *   s.parar()          esquece o que estiver pendente (o fluxo foi fechado ou recarregado)
 *
 * Uma gravação por vez: o que mudar durante uma gravação sai na seguinte, já com a versão nova.
 * `aoEstado({ estado, quando, erro, fluxo })`: "salvo" | "pendente" | "salvando" | "erro" | "conflito".
 * No conflito (outra aba gravou no meio), o salvador para até a pessoa escolher: ficar com a dela
 * (`ficarComAMinha`) ou abrir a de lá (quem chamou recarrega e cria outro salvador).
 */
export function criarSalvador({ gravar, versao = null, assinatura = "", aoEstado = () => {}, esperaMs = 1200, relogio = globalThis }) {
  let base = versao;
  let ultima = assinatura; // a assinatura do que está no banco
  let pendente = null; // { doc, assinatura } — o mais novo ainda não gravado
  let timer = null;
  let gravando = null; // a promessa da gravação em curso
  let travado = false; // conflito: espera a pessoa decidir
  let parado = false;

  const avisar = (estado, extra = {}) => { if (!parado) aoEstado({ estado, ...extra }); };

  async function gravarPendente({ forcar = false } = {}) {
    if (gravando) return gravando;
    if (!pendente || parado || (travado && !forcar)) return null;
    const alvo = pendente;
    pendente = null;
    avisar("salvando");
    let deuCerto = false;
    gravando = (async () => {
      try {
        const fluxo = await gravar(alvo.doc, { versao: base, forcar });
        base = fluxo?.versao ?? base;
        ultima = alvo.assinatura;
        travado = false;
        if (pendente && pendente.assinatura === ultima) pendente = null;
        if (!pendente) avisar("salvo", { quando: new Date(), fluxo });
        else avisar("pendente");
        deuCerto = true;
        return fluxo;
      } catch (erro) {
        // não perde o que mudou: volta a ser o pendente (a não ser que já haja um mais novo)
        if (!pendente) pendente = alvo;
        if (erro?.status === 409) {
          travado = true;
          avisar("conflito", { erro, fluxo: erro.fluxo });
        } else {
          avisar("erro", { erro });
          // rede caiu ou o servidor tropeçou: tenta de novo sozinho; erro do pedido (400, 404) não
          // se resolve repetindo
          if (!erro?.status || erro.status >= 500) agendar(ESPERA_DEPOIS_DO_ERRO_MS);
        }
        return null;
      } finally {
        gravando = null;
      }
    })();
    const r = await gravando;
    // mudou durante a gravação: grava de novo (já com a versão nova)
    if (deuCerto && pendente && !travado && !parado) agendar(0);
    return r;
  }

  function agendar(ms) {
    relogio.clearTimeout(timer);
    timer = relogio.setTimeout(() => { timer = null; gravarPendente(); }, ms);
  }

  return {
    mudou(doc) {
      if (parado) return;
      const a = assinaturaDoDesenho(doc);
      if (!a) return;
      if (a === ultima) {
        // voltou a ser o que está no banco (desfez tudo): nada a gravar
        pendente = null;
        relogio.clearTimeout(timer);
        if (!gravando && !travado) avisar("salvo");
        return;
      }
      pendente = { doc, assinatura: a };
      if (travado) return;
      avisar("pendente");
      agendar(esperaMs);
    },
    async agora() {
      relogio.clearTimeout(timer);
      if (gravando) await gravando;
      return gravarPendente();
    },
    sair() {
      if (!pendente || parado || travado) return;
      relogio.clearTimeout(timer);
      const alvo = pendente;
      pendente = null;
      // keepalive: a página pode morrer antes da resposta; o pedido segue mesmo assim
      try { gravar(alvo.doc, { versao: base, forcar: false, saindo: true })?.catch?.(() => {}); } catch { /* fica para a próxima */ }
    },
    ficarComAMinha() {
      if (!pendente) { travado = false; return Promise.resolve(null); }
      relogio.clearTimeout(timer);
      return gravarPendente({ forcar: true });
    },
    temPendente: () => Boolean(pendente) || Boolean(gravando),
    versao: () => base,
    // outra gravação do mesmo fluxo passou por fora do salvador (renomear, mover): a versão é essa
    ajustarVersao(v) { if (Number.isInteger(v)) base = v; },
    parar() {
      parado = true;
      pendente = null;
      relogio.clearTimeout(timer);
    },
  };
}
