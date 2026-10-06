// Conquistas: marcos da CONTA, não de um quadro. Cada uma vale pontos que entram no total do
// jogador (e no nível), uma vez só.
//
// Tudo é calculado a partir de `proof_eventos`, que já tem a história inteira: não há contador
// guardado que possa sair de sincronia. Desbloquear é gravar um evento `conquista:<codigo>` — a
// mesma chave única que impede pontuar duas vezes impede desbloquear duas vezes.

import { calcularOfensiva } from "./ofensiva.js";
import { NOTA_DE_APROVACAO } from "./pratica.js";

/** Pontos por trilha concluída (uma conquista por trilha: "Trilha concluída: JavaScript"). */
export const PONTOS_POR_TRILHA = 300;

const c = (categoria, medida, codigo, nome, descricao, icone, alvo, pontos) => ({ categoria, medida, codigo, nome, descricao, icone, alvo, pontos });

export const CONQUISTAS = [
  c("Ofensiva", "maiorOfensiva", "ofensiva-3", "Faísca", "3 dias seguidos de estudo", "🔥", 3, 20),
  c("Ofensiva", "maiorOfensiva", "ofensiva-7", "Semana em chamas", "7 dias seguidos de estudo", "🔥", 7, 50),
  c("Ofensiva", "maiorOfensiva", "ofensiva-14", "Duas semanas firme", "14 dias seguidos de estudo", "🔥", 14, 100),
  c("Ofensiva", "maiorOfensiva", "ofensiva-30", "Mês imparável", "30 dias seguidos de estudo", "☄️", 30, 250),
  c("Ofensiva", "maiorOfensiva", "ofensiva-60", "Lenda da constância", "60 dias seguidos de estudo", "☄️", 60, 500),
  c("Ofensiva", "maiorOfensiva", "ofensiva-100", "Centenário", "100 dias seguidos de estudo", "👑", 100, 1000),

  c("Metas do dia", "metas", "meta-1", "Meta batida!", "Bater a meta do dia pela primeira vez", "🎯", 1, 10),
  c("Metas do dia", "metas", "meta-7", "Sete metas", "Bater a meta do dia 7 vezes", "🎯", 7, 50),
  c("Metas do dia", "metas", "meta-30", "Trinta metas", "Bater a meta do dia 30 vezes", "🏹", 30, 200),
  c("Metas do dia", "metas", "meta-100", "Cem metas", "Bater a meta do dia 100 vezes", "🏹", 100, 600),

  c("Constância", "diasEstudados", "dias-10", "Dez dias", "Estudar em 10 dias diferentes", "📅", 10, 40),
  c("Constância", "diasEstudados", "dias-50", "Cinquenta dias", "Estudar em 50 dias diferentes", "📅", 50, 200),
  c("Constância", "diasEstudados", "dias-100", "Cem dias", "Estudar em 100 dias diferentes", "🗓️", 100, 500),

  c("Teoria", "tarefas", "tarefas-1", "Primeiro passo", "Marcar a primeira tarefa", "👣", 1, 10),
  c("Teoria", "tarefas", "tarefas-50", "Mão na massa", "Marcar 50 tarefas", "✍️", 50, 50),
  c("Teoria", "tarefas", "tarefas-200", "Incansável", "Marcar 200 tarefas", "📚", 200, 200),
  c("Teoria", "assuntos", "assuntos-1", "Primeiro assunto", "Concluir o primeiro assunto", "📗", 1, 20),
  c("Teoria", "assuntos", "assuntos-10", "Dez assuntos", "Concluir 10 assuntos", "📘", 10, 80),
  c("Teoria", "assuntos", "assuntos-50", "Cinquenta assuntos", "Concluir 50 assuntos", "📙", 50, 300),

  c("Prática", "quizzes", "quiz-1", "Primeiro quiz", "Terminar o primeiro quiz", "❓", 1, 10),
  c("Prática", "quizzes", "quiz-30", "Quizzeiro", "Terminar 30 quizzes", "❓", 30, 150),
  c("Prática", "quizzesPerfeitos", "quiz-perfeito-1", "Gabaritou!", "Acertar todas as perguntas de um quiz", "💯", 1, 30),
  c("Prática", "quizzesPerfeitos", "quiz-perfeito-10", "Mente afiada", "Gabaritar 10 quizzes", "🧠", 10, 150),
  c("Prática", "exercicios", "exercicio-1", "Primeiro código aprovado", "Ser aprovado num exercício", "⌨️", 1, 30),
  c("Prática", "exercicios", "exercicio-10", "Código de todo dia", "Ser aprovado em 10 exercícios", "💻", 10, 150),

  c("Projetos", "semanais", "semanal-1", "Primeiro projeto", "Ser aprovado num projeto da semana", "🎁", 1, 100),
  c("Projetos", "semanais", "semanal-4", "Quatro semanas construindo", "Ser aprovado em 4 projetos da semana", "🧰", 4, 300),
  c("Projetos", "mensais", "mensal-1", "Projeto do mês", "Ser aprovado num projeto do mês", "🏆", 1, 300),
  c("Projetos", "trilhas", "trilhas-3", "Tricampeão", "Concluir 3 trilhas", "🥇", 3, 300),
];

/**
 * Os números da conta, tirados dos eventos.
 * @param eventos  `{ tipo, chave, dia, pontos, detalhe }` — todos os da pessoa
 */
export function estatisticas(eventos, hoje) {
  const s = {
    tarefas: 0, assuntos: 0, metas: 0, quizzes: 0, quizzesPerfeitos: 0, exercicios: 0,
    semanais: 0, mensais: 0, trilhas: 0, diasEstudados: 0, maiorOfensiva: 0, ofensiva: 0,
  };
  const dias = new Set();
  for (const e of eventos) {
    dias.add(e.dia);
    const d = e.detalhe || {};
    if (e.tipo === "item") s.tarefas++;
    else if (e.tipo === "card") s.assuntos++;
    else if (e.tipo === "meta_diaria") s.metas++;
    else if (e.tipo === "quiz") {
      s.quizzes++;
      if (d.total > 0 && d.acertos === d.total) s.quizzesPerfeitos++;
    } else if (e.tipo === "exercicio" && d.nota >= NOTA_DE_APROVACAO) s.exercicios++;
    else if (e.tipo === "projeto_semanal" && d.nota >= NOTA_DE_APROVACAO) s.semanais++;
    else if (e.tipo === "projeto_mensal" && d.nota >= NOTA_DE_APROVACAO) s.mensais++;
    else if (e.tipo === "conquista" && String(e.chave).startsWith("conquista:trilha:")) s.trilhas++;
  }
  const o = calcularOfensiva(dias, hoje);
  s.diasEstudados = dias.size;
  s.maiorOfensiva = o.recorde;
  s.ofensiva = o.atual;
  return s;
}

/** Códigos já desbloqueados, a partir das chaves `conquista:<codigo>`. */
export function desbloqueadasDe(eventos) {
  const mapa = new Map();
  for (const e of eventos) {
    if (e.tipo === "conquista") mapa.set(String(e.chave).replace(/^conquista:/, ""), e.dia);
  }
  return mapa;
}

/** O que os números já alcançaram e ainda não foi desbloqueado. */
export function conquistasNovas(stats, desbloqueadas) {
  return CONQUISTAS.filter((x) => !desbloqueadas.has(x.codigo) && (stats[x.medida] || 0) >= x.alvo);
}

/** A vitrine: todas as conquistas, com o progresso de cada uma e as de trilha no fim. */
export function vitrine(stats, eventos) {
  const desbloqueadas = desbloqueadasDe(eventos);
  const lista = CONQUISTAS.map((x) => ({
    codigo: x.codigo, nome: x.nome, descricao: x.descricao, icone: x.icone, pontos: x.pontos, categoria: x.categoria,
    alvo: x.alvo, atual: Math.min(stats[x.medida] || 0, x.alvo),
    desbloqueada: desbloqueadas.has(x.codigo), dia: desbloqueadas.get(x.codigo) || null,
  }));
  for (const e of eventos) {
    if (e.tipo !== "conquista" || !String(e.chave).startsWith("conquista:trilha:")) continue;
    lista.push({
      codigo: e.chave.replace(/^conquista:/, ""), nome: e.detalhe?.nome || "Trilha concluída", descricao: e.detalhe?.descricao || "",
      icone: "🏆", pontos: e.pontos, categoria: "Trilhas concluídas", alvo: 1, atual: 1, desbloqueada: true, dia: e.dia,
    });
  }
  return lista;
}
