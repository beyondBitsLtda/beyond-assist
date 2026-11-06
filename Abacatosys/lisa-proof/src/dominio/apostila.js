// A apostila (pedido de 06/11/2026): "quando a Lisa indica um checklist de teoria para estudar, ela
// sugere abra a documentação tal etc. Deixe um modo onde o usuário pode pedir para ela mostrar uma aula
// completa contendo todos os pontos desse checklist, criando apostilas com todo o conteúdo… devidamente
// formatado em Markdown já renderizado… uma categoria chamada apostila, com uma capa diferente e uma
// categoria separada lá na aba de cadernos".
//
// A apostila é um caderno da categoria "apostila": a IA escreve a aula (src/lib/iaApostila.js), aqui ela
// é conferida (todos os pontos do checklist cobertos, Markdown que a prévia do caderno sabe desenhar) e
// vira as páginas do caderno: "Comece aqui", uma página por seção, a revisão e as fontes.
//
// Puro: sem banco, sem rede.

import { enderecoSeguro } from "./markdown.js";

export const CATEGORIAS_DO_CADERNO = ["caderno", "apostila"];

/** A categoria gravada no caderno: tudo o que não é apostila é caderno de anotações. */
export const categoriaDoCaderno = (valor) => (valor === "apostila" ? "apostila" : "caderno");

export const LIMITES_DA_APOSTILA = {
  titulo: 120,
  introducao: 8000,
  secoes: 12,
  tituloDaSecao: 120,
  conteudoDaSecao: 24000,
  resumo: 8000,
  exercicios: 8,
  fontes: 8,
  minimoDeTexto: 1500, // a aula inteira: menos que isso é o "filete" de que a pessoa reclamou
};

const texto = (v, limite) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, limite);

/** O título da apostila de um assunto (o nome do caderno). */
export function tituloDaApostila(assunto) {
  return texto(`Apostila — ${texto(assunto, 100) || "assunto"}`, LIMITES_DA_APOSTILA.titulo);
}

/**
 * O Markdown que a IA escreveu, pronto para a prévia do caderno (src/dominio/markdown.js): fora dos
 * blocos de código, `<br>` vira quebra de linha e o título de nível 1 desce para o 2 (o nível 1 é o
 * título da página, posto aqui). Dentro dos blocos de código nada muda — um curso de HTML tem tags.
 */
export function limparMarkdown(bruto, limite) {
  const linhas = String(bruto ?? "").replace(/\r\n?/g, "\n").split("\n");
  let dentro = false;
  const saida = [];
  for (const linha of linhas) {
    if (/^\s*(```|~~~)/.test(linha)) {
      dentro = !dentro;
      saida.push(linha);
      continue;
    }
    if (dentro) {
      saida.push(linha);
      continue;
    }
    saida.push(linha.replace(/<br\s*\/?>/gi, "\n").replace(/^#\s+/, "## "));
  }
  if (dentro) saida.push("```"); // a cerca que a IA esqueceu de fechar
  const t = saida.join("\n").replace(/\n{4,}/g, "\n\n\n").trim();
  return limite && t.length > limite ? t.slice(0, limite) : t;
}

/**
 * A aula que a IA devolveu, conferida. `pontos`: os itens do checklist de teoria (os textos), na ordem;
 * cada seção diz em `ponto` qual deles (1..n) ela ensina (0 = uma seção a mais, fora do checklist).
 * Nunca lança: `{ apostila, faltando }` — `faltando` são os pontos (1..n) que nenhuma seção cobriu.
 */
export function validarApostila(bruto, { pontos = [] } = {}) {
  const n = pontos.length;
  const secoes = (Array.isArray(bruto?.secoes) ? bruto.secoes : [])
    .map((s) => {
      const conteudo = limparMarkdown(s?.conteudo, LIMITES_DA_APOSTILA.conteudoDaSecao);
      const titulo = texto(s?.titulo, LIMITES_DA_APOSTILA.tituloDaSecao);
      if (!conteudo || !titulo) return null;
      const p = Number.parseInt(s?.ponto, 10);
      return { titulo, ponto: Number.isFinite(p) && p >= 1 && p <= n ? p : 0, conteudo };
    })
    .filter(Boolean)
    .slice(0, LIMITES_DA_APOSTILA.secoes);
  const cobertos = new Set(secoes.map((s) => s.ponto).filter(Boolean));
  const faltando = pontos.map((_, i) => i + 1).filter((p) => !cobertos.has(p));
  const exercicios = (Array.isArray(bruto?.exercicios) ? bruto.exercicios : [])
    .map((e) => ({ pergunta: limparMarkdown(e?.pergunta, 1200), resposta: limparMarkdown(e?.resposta, 2400) }))
    .filter((e) => e.pergunta && e.resposta)
    .slice(0, LIMITES_DA_APOSTILA.exercicios);
  const fontes = (Array.isArray(bruto?.fontes) ? bruto.fontes : [])
    .map((f) => ({ titulo: texto(f?.titulo, 140), url: enderecoSeguro(String(f?.url || "").trim()) || "", descricao: texto(f?.descricao, 240) }))
    .filter((f) => f.titulo && /^https?:\/\//i.test(f.url))
    .slice(0, LIMITES_DA_APOSTILA.fontes);
  return {
    apostila: {
      titulo: texto(bruto?.titulo, LIMITES_DA_APOSTILA.titulo),
      introducao: limparMarkdown(bruto?.introducao, LIMITES_DA_APOSTILA.introducao),
      secoes,
      resumo: limparMarkdown(bruto?.resumo, LIMITES_DA_APOSTILA.resumo),
      exercicios,
      fontes,
    },
    faltando,
  };
}

/** Junta as seções que vieram depois (as dos pontos que faltaram) na ordem do checklist. */
export function juntarSecoes(apostila, novas) {
  const todas = [...apostila.secoes, ...(novas || [])];
  const ordem = (s) => (s.ponto ? s.ponto : 1000);
  return { ...apostila, secoes: todas.map((s, i) => ({ s, i })).sort((a, b) => ordem(a.s) - ordem(b.s) || a.i - b.i).map(({ s }) => s).slice(0, LIMITES_DA_APOSTILA.secoes + 6) };
}

/** Quanto texto a aula tem (para recusar a aula curta demais). */
export function tamanhoDaApostila(a) {
  return [a.introducao, a.resumo, ...a.secoes.map((s) => s.conteudo), ...a.exercicios.map((e) => e.pergunta + e.resposta)].join("").length;
}

/** A aula conferida está boa para virar apostila? `{ ok, motivo }`. */
export function apostilaCompleta({ apostila, faltando }) {
  if (!apostila.secoes.length) return { ok: false, motivo: "a Lisa não escreveu as seções da aula" };
  if (faltando.length) return { ok: false, motivo: `faltou cobrir ${faltando.length === 1 ? "o ponto" : "os pontos"} ${faltando.join(", ")} do checklist` };
  if (tamanhoDaApostila(apostila) < LIMITES_DA_APOSTILA.minimoDeTexto) return { ok: false, motivo: "a aula veio curta demais" };
  return { ok: true, motivo: "" };
}

const linkDoAssunto = ({ trilhaId, cardId }) => (trilhaId && cardId ? `/trilhas/${trilhaId}?assunto=${cardId}` : "");

/**
 * As páginas do caderno da apostila, na ordem de leitura: "Comece aqui" (o objetivo, o mapa da aula
 * — cada ponto do checklist e a seção que o ensina — e o link de volta ao assunto), uma página por
 * seção, a revisão (resumo, exercícios e as respostas) e as fontes, quando houver.
 *
 * @param contexto  { tema, assunto: { titulo, objetivo }, pontos: [texto], trilhaId, cardId }
 */
export function paginasDaApostila(apostila, { tema = "", assunto = {}, pontos = [], trilhaId, cardId } = {}) {
  const titulo = apostila.titulo || tituloDaApostila(assunto.titulo);
  const voltar = linkDoAssunto({ trilhaId, cardId });
  const secoes = apostila.secoes.map((s, i) => ({ ...s, numero: i + 1 }));
  const inicio = [`# ${titulo}`, ""];
  inicio.push(`> 📘 Apostila de **${texto(tema, 120) || "estudo"}** · assunto **${texto(assunto.titulo, 160) || "da trilha"}**`, "");
  if (assunto.objetivo) inicio.push(`**Objetivo:** ${texto(assunto.objetivo, 400)}`, "");
  if (apostila.introducao) inicio.push(apostila.introducao, "");
  if (pontos.length) {
    inicio.push("## O que esta aula cobre", "", "Cada ponto do checklist de teoria do assunto e a seção da apostila que o ensina:", "");
    pontos.forEach((p, i) => {
      const onde = secoes.filter((s) => s.ponto === i + 1).map((s) => `seção ${s.numero}`);
      inicio.push(`${i + 1}. ${texto(p, 200)}${onde.length ? ` — ${onde.join(", ")}` : ""}`);
    });
    inicio.push("");
  }
  inicio.push("## Como estudar com ela", "", "- Leia uma seção por vez e refaça os exemplos.", "- No fim, responda os exercícios da revisão antes de olhar as respostas.", "- Marque no checklist do assunto o que você já domina.");
  if (voltar) inicio.push("", `🔗 [Voltar ao assunto na trilha](${voltar})`);

  const paginas = [{ titulo: "Comece aqui", conteudo: inicio.join("\n") }];
  for (const s of secoes) {
    const linhas = [`# ${s.numero}. ${s.titulo}`, ""];
    if (s.ponto && pontos[s.ponto - 1]) linhas.push(`> 📌 Do checklist: ${texto(pontos[s.ponto - 1], 200)}`, "");
    linhas.push(s.conteudo);
    paginas.push({ titulo: texto(`${s.numero}. ${s.titulo}`, 160), conteudo: linhas.join("\n") });
  }
  if (apostila.resumo || apostila.exercicios.length) {
    const linhas = ["# Revisão", ""];
    if (apostila.resumo) linhas.push("## Resumo", "", apostila.resumo, "");
    if (apostila.exercicios.length) {
      // um título por exercício (e não uma lista): a pergunta e a resposta podem ter bloco de código
      linhas.push("## Exercícios de fixação", "");
      apostila.exercicios.forEach((e, i) => linhas.push(`### Exercício ${i + 1}`, "", e.pergunta, ""));
      linhas.push("---", "", "## Respostas", "", "Tente responder antes de ler.", "");
      apostila.exercicios.forEach((e, i) => linhas.push(`### Resposta ${i + 1}`, "", e.resposta, ""));
    }
    paginas.push({ titulo: "Revisão e exercícios", conteudo: linhas.join("\n").trim() });
  }
  if (apostila.fontes.length) {
    const linhas = ["# Fontes para ir além", "", "As referências que a aula usou — a documentação oficial e o que vale abrir depois:", ""];
    for (const f of apostila.fontes) linhas.push(`- [${f.titulo.replace(/[[\]]/g, "")}](${f.url})${f.descricao ? ` — ${f.descricao}` : ""}`);
    paginas.push({ titulo: "Fontes para ir além", conteudo: linhas.join("\n") });
  }
  return paginas;
}
