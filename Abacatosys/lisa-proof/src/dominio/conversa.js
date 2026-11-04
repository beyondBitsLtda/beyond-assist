// A CONVERSA COM A LISA (pedido de 31/10/2026, da proposta dos cursos de idiomas): uma situação do
// dia a dia (o check-in no aeroporto, pedir comida), na língua do curso e no nível dele. A Lisa faz
// um papel, a pessoa escreve as falas dela; a cada fala, a Lisa responde no papel e, se precisar,
// corrige em português o que a pessoa escreveu. No fim (ou quando a pessoa encerra), a Lisa avalia a
// conversa inteira pela rubrica. Puro: as regras do roteiro, dos turnos e do que a IA devolve.

export const LIMITES_DA_CONVERSA = { falas: 6, minimoDeFalas: 2, mensagem: 400, fala: 600, correcao: 400 };
export const NIVEIS_DO_QECR = ["A1", "A2", "B1", "B2", "C1", "C2"];

const texto = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const lista = (v, max, cada) => (Array.isArray(v) ? v : []).map((x) => texto(x, cada)).filter(Boolean).slice(0, max);
const IDIOMA = /^[a-z]{2,3}(-[A-Z]{2})?$/;

/** O roteiro que a IA devolveu, conferido. */
export function validarConversa(bruto) {
  const abertura = texto(bruto?.abertura, LIMITES_DA_CONVERSA.fala);
  const objetivo = texto(bruto?.objetivo, 400);
  if (!abertura || !objetivo) throw new Error("a IA não montou a conversa — tente de novo");
  const criterios = lista(bruto?.criterios, 5, 240);
  if (criterios.length < 2) throw new Error("a IA não devolveu os critérios da conversa — tente de novo");
  return {
    motor: "conversa",
    titulo: texto(bruto?.titulo, 120) || "Conversa com a Lisa",
    idioma: IDIOMA.test(String(bruto?.idioma || "")) ? bruto.idioma : "en-US",
    nivel: NIVEIS_DO_QECR.includes(bruto?.nivel) ? bruto.nivel : "A2",
    cenario: texto(bruto?.cenario, 600),
    papel: texto(bruto?.papel, 200),
    objetivo,
    abertura,
    dicas: lista(bruto?.dicas, 4, 200),
    criterios,
    falas: LIMITES_DA_CONVERSA.falas,
  };
}

/** A resposta da Lisa a uma fala, conferida: a fala dela no papel, a correção (em português) e se acabou. */
export function validarRespostaDaLisa(bruto) {
  const fala = texto(bruto?.fala, LIMITES_DA_CONVERSA.fala);
  if (!fala) throw new Error("a Lisa não respondeu — tente de novo");
  return { fala, correcao: texto(bruto?.correcao, LIMITES_DA_CONVERSA.correcao), terminou: Boolean(bruto?.terminou) };
}

/** Os turnos guardados na resposta do desafio: começa com a abertura da Lisa. */
export const turnosDe = (desafio) => (Array.isArray(desafio?.resposta?.turnos) && desafio.resposta.turnos.length
  ? desafio.resposta.turnos
  : [{ quem: "lisa", texto: desafio?.conteudo?.abertura || "" }]);

export const falasDaPessoa = (turnos) => (turnos || []).filter((t) => t.quem === "pessoa").length;

/** Dá para mandar mais uma fala? Até o limite, e só enquanto a conversa não foi avaliada. */
export function podeFalar({ status, tentativas, resposta, conteudo }) {
  if (status === "concluido" || tentativas > 0) return { ok: false, motivo: "esta conversa já foi avaliada — faça outra rodada na Prática" };
  const turnos = turnosDe({ resposta, conteudo });
  if (falasDaPessoa(turnos) >= (conteudo?.falas || LIMITES_DA_CONVERSA.falas)) return { ok: false, motivo: "as falas desta conversa acabaram — encerre para a Lisa avaliar" };
  return { ok: true };
}

/** Dá para encerrar e pedir a avaliação? Só com pelo menos duas falas da pessoa. */
export function podeEncerrar(turnos) {
  return falasDaPessoa(turnos) >= LIMITES_DA_CONVERSA.minimoDeFalas
    ? { ok: true }
    : { ok: false, motivo: `converse um pouco mais: são pelo menos ${LIMITES_DA_CONVERSA.minimoDeFalas} falas suas antes da avaliação` };
}

/** A mensagem da pessoa, conferida. */
export function validarMensagem(m) {
  const t = texto(m, LIMITES_DA_CONVERSA.mensagem);
  if (!t) throw new Error("escreva a sua fala");
  return t;
}
