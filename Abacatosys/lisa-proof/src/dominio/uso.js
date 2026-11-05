// O USO DO PROOF (05/11/2026: "um painel para o meu usuário lá no Proof para que eu possa ver quando as pessoas
// logaram, quanto tempo elas passaram no Proof e o que fizeram").
//
// Como o tempo é medido: com a aba do Proof aberta e visível, a tela manda uma BATIDA por minuto, com a área em que
// a pessoa está. Cada batida soma o tempo desde a anterior (com teto, para uma aba esquecida não contar a tarde
// inteira) e um minuto na área. Uma pausa de mais de 5 minutos fecha o ACESSO e a próxima batida abre outro. O login
// também abre um acesso. Nada do que a pessoa escreve é guardado aqui: só quando, quanto tempo, onde e o aparelho.
//
// "O que fizeram" sai do que o Proof já grava: os eventos de estudo (proof_eventos) e o livro-caixa das moedas do
// Reino (proof_reino_movimentos). Puro: sem banco, sem relógio (o "agora" vem de fora).

export const PRESENCA = {
  batidaSegundos: 60,     // de quanto em quanto tempo a tela manda a batida
  pausaParaNovoAcesso: 300, // sem batida por mais que isso, a próxima abre um acesso novo
  tetoPorBatida: 90,      // uma batida soma no máximo isso (a aba que dormiu e acordou não conta o sono)
};

export const PERIODOS_DO_USO = [7, 30, 90];

/** As áreas do Proof, pela primeira parte do caminho. */
export const AREAS = {
  hoje: "Hoje", trilhas: "Trilhas", pratica: "Prática", agenda: "Agenda", cadernos: "Cadernos", biblioteca: "Biblioteca",
  acervo: "Acervo", reino: "Reino", dominio: "Domínio", bootcamp: "Bootcamp", bolsa: "Bolsa", ranking: "Ranking",
  correio: "Correio", lisa: "Lisa joga", progresso: "Progresso", "raio-x": "Raio-X", presentes: "Presentes",
  chamados: "Chamados", cartoes: "Cartões", revisoes: "Revisão da turma", forja: "Forja", ilhas: "Ilhas", arena: "Minigame",
  uso: "Uso", entrar: "Entrada", outras: "Outras telas",
};

/** A área de um caminho ("/reino/teste" → "reino"; "/" → "hoje"). */
export function areaDoCaminho(caminho) {
  const primeira = String(caminho || "/").split("?")[0].split("/").filter(Boolean)[0] || "hoje";
  return Object.hasOwn(AREAS, primeira) ? primeira : "outras";
}

/** O aparelho pelo navegador (só o tipo: nada que identifique a máquina). */
export function aparelhoDe(agenteDoNavegador) {
  const ua = String(agenteDoNavegador || "");
  if (/iPad|Tablet|Android(?!.*Mobile)/i.test(ua)) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua)) return "celular";
  return "computador";
}

/**
 * Uma batida sobre o acesso aberto: devolve o que gravar ({ segundos, paginas, ultimo }) ou `null` quando o acesso
 * já fechou (a pausa passou do limite) e a batida tem de abrir outro.
 */
export function somarBatida(acesso, agora, area, { semTempo = false } = {}) {
  if (!acesso) return null;
  const desde = (new Date(agora).getTime() - new Date(acesso.ultimo).getTime()) / 1000;
  if (!(desde >= 0) || desde > PRESENCA.pausaParaNovoAcesso) return null;
  const paginas = { ...(acesso.paginas || {}) };
  paginas[area] = (paginas[area] || 0) + 1;
  return {
    // a aba que voltou a ficar visível marca a presença, mas não conta o tempo em que ficou escondida
    segundos: (acesso.segundos || 0) + (semTempo ? 0 : Math.round(Math.min(desde, PRESENCA.tetoPorBatida))),
    paginas,
    ultimo: new Date(agora).toISOString(),
  };
}

/** "1 h 05 min", "12 min", "40 s". */
export function duracaoLegivel(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

/** O nome de cada ação, no singular e no plural ("1 quiz", "3 quizzes"), para a tela: eventos de estudo e movimentos do
 *  Reino. Fora daqui, a ação não aparece. */
export const ROTULOS_DAS_ACOES = {
  // estudo (proof_eventos)
  item: ["tarefa de teoria marcada", "tarefas de teoria marcadas"], card: ["assunto concluído", "assuntos concluídos"],
  meta_diaria: ["meta do dia batida", "metas do dia batidas"], quiz: ["quiz", "quizzes"], exercicio: ["exercício", "exercícios"],
  projeto_semanal: ["projeto da semana", "projetos da semana"], projeto_final: ["projeto final", "projetos finais"],
  projeto_mensal: ["projeto do mês", "projetos do mês"], conquista: ["conquista", "conquistas"],
  dominio: ["andar do Modo Domínio", "andares do Modo Domínio"], cartoes: ["revisão de cartões", "revisões de cartões"],
  revisao: ["revisão da turma", "revisões da turma"], diario: ["diário de estudo", "diários de estudo"],
  // jogo (proof_reino_movimentos)
  construcao: ["construção no Reino", "construções no Reino"], coleta: ["coleta da mina", "coletas da mina"],
  saque_ganho: ["invasão vencida", "invasões vencidas"], saque_perdido: ["invasão sofrida", "invasões sofridas"],
  vale: ["vale resgatado", "vales resgatados"], personagem: ["personagem comprado", "personagens comprados"],
  expedicao: ["expedição", "expedições"], paz_expedicao: ["expedição na paz", "expedições na paz"],
  veiculo: ["veículo comprado", "veículos comprados"], combustivel: ["combustível comprado", "combustíveis comprados"],
  operario: ["operário contratado", "operários contratados"], ouro: ["venda de ouro", "vendas de ouro"],
  aluguel_pago: ["operário alugado", "operários alugados"], aluguel_recebido: ["aluguel recebido", "aluguéis recebidos"],
  bolsa_compra: ["compra na Bolsa", "compras na Bolsa"], bolsa_venda: ["venda na Bolsa", "vendas na Bolsa"],
  bolsa_resgate: ["resgate na Bolsa", "resgates na Bolsa"], acervo: ["material aprovado no Acervo", "materiais aprovados no Acervo"],
  acervo_revisao: ["revisão no Acervo", "revisões no Acervo"], gorjeta_dada: ["gorjeta dada", "gorjetas dadas"],
  gorjeta_recebida: ["gorjeta recebida", "gorjetas recebidas"], mercado_compra: ["compra no mercado de tropas", "compras no mercado de tropas"],
  mercado_venda: ["venda no mercado de tropas", "vendas no mercado de tropas"], correio: ["recado útil no Correio", "recados úteis no Correio"],
  forja: ["artefato forjado", "artefatos forjados"], chefao: ["chefão derrubado", "chefões derrubados"],
  duelo: ["duelo com a Lisa", "duelos com a Lisa"], ilhas: ["ação nas Ilhas", "ações nas Ilhas"],
  arena: ["fase do minigame", "fases do minigame"], bootcamp: ["prova do Bootcamp", "provas do Bootcamp"],
};
/** "1 quiz", "3 quizzes". */
export function contagemDaAcao(chave, quantas) {
  const [um, varios] = ROTULOS_DAS_ACOES[chave] || [chave, chave];
  return `${quantas} ${quantas === 1 ? um : varios}`;
}
const comMaiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
/** Movimentos que não são ação de ninguém (ajustes e testes) ficam de fora. */
const FORA_DAS_ACOES = new Set(["teste", "estorno", "neuro", "treino"]);

/** A ação de um evento ou movimento: { chave, rotulo } ou null (fora da lista). Um tipo de evento e de movimento com o
 *  mesmo nome (dominio, arena) contam juntos. */
export function acaoDe(tipo) {
  if (FORA_DAS_ACOES.has(tipo) || !Object.hasOwn(ROTULOS_DAS_ACOES, tipo)) return null;
  return { chave: tipo, rotulo: comMaiuscula(ROTULOS_DAS_ACOES[tipo][0]) };
}

/**
 * O painel: uma linha por pessoa com o que ela fez no período. Entradas (todas já filtradas pelo período):
 *   pessoas    [{ id, nome, email, robo }]
 *   acessos    [{ usuario_id, inicio, ultimo, segundos, paginas, aparelho, entrou }]
 *   acoes      [{ usuario_id, tipo, quando, pontos?, valor? }]   (eventos e movimentos juntos)
 * Devolve { totais, pessoas: [...] } — as pessoas que usaram primeiro, pelo último acesso.
 */
export function resumoDoUso({ pessoas, acessos, acoes }) {
  const porPessoa = new Map(pessoas.map((p) => [p.id, {
    id: p.id, nome: p.nome || "", email: p.email || "", robo: Boolean(p.robo),
    ultimoAcesso: null, acessos: 0, logins: 0, segundos: 0, dias: new Set(), aparelhos: {}, areas: {},
    acoes: {}, historico: [], ultimasAcoes: [],
  }]));
  for (const a of acessos) {
    const p = porPessoa.get(a.usuario_id);
    if (!p) continue;
    p.acessos++;
    if (a.entrou) p.logins++;
    p.segundos += a.segundos || 0;
    if (!p.ultimoAcesso || a.ultimo > p.ultimoAcesso) p.ultimoAcesso = a.ultimo;
    p.dias.add(String(a.inicio).slice(0, 10));
    p.aparelhos[a.aparelho || "computador"] = (p.aparelhos[a.aparelho || "computador"] || 0) + 1;
    for (const [area, minutos] of Object.entries(a.paginas || {})) p.areas[area] = (p.areas[area] || 0) + minutos;
    p.historico.push({ inicio: a.inicio, ultimo: a.ultimo, segundos: a.segundos || 0, aparelho: a.aparelho || "computador", entrou: Boolean(a.entrou),
      areas: Object.entries(a.paginas || {}).sort((x, y) => y[1] - x[1]).map(([area]) => AREAS[area] || area) });
  }
  for (const x of acoes) {
    const p = porPessoa.get(x.usuario_id);
    const acao = acaoDe(x.tipo);
    if (!p || !acao) continue;
    p.acoes[acao.chave] = (p.acoes[acao.chave] || 0) + 1;
    p.ultimasAcoes.push({ quando: x.quando, rotulo: acao.rotulo, pontos: x.pontos ?? null, moedas: x.valor ?? null });
  }
  const lista = [...porPessoa.values()].map((p) => ({
    id: p.id, nome: p.nome, email: p.email, robo: p.robo, ultimoAcesso: p.ultimoAcesso, acessos: p.acessos, logins: p.logins,
    segundos: p.segundos, diasAtivos: p.dias.size, mediaPorAcesso: p.acessos ? Math.round(p.segundos / p.acessos) : 0,
    aparelho: Object.entries(p.aparelhos).sort((x, y) => y[1] - x[1])[0]?.[0] || null,
    areas: Object.entries(p.areas).sort((x, y) => y[1] - x[1]).map(([area, minutos]) => ({ area, rotulo: AREAS[area] || area, minutos })),
    acoes: Object.entries(p.acoes).sort((x, y) => y[1] - x[1]).map(([chave, quantas]) => ({ chave, quantas, texto: contagemDaAcao(chave, quantas) })),
    totalDeAcoes: Object.values(p.acoes).reduce((s, n) => s + n, 0),
    historico: p.historico.sort((x, y) => (x.inicio < y.inicio ? 1 : -1)).slice(0, 20),
    ultimasAcoes: p.ultimasAcoes.sort((x, y) => (x.quando < y.quando ? 1 : -1)).slice(0, 20),
  }));
  lista.sort((a, b) => (Number(a.robo) - Number(b.robo)) || (b.ultimoAcesso || "").localeCompare(a.ultimoAcesso || "") || a.nome.localeCompare(b.nome));
  const ativas = lista.filter((p) => p.acessos > 0 && !p.robo);
  return {
    totais: {
      pessoas: lista.filter((p) => !p.robo).length, ativas: ativas.length,
      acessos: ativas.reduce((s, p) => s + p.acessos, 0), segundos: ativas.reduce((s, p) => s + p.segundos, 0),
      acoes: ativas.reduce((s, p) => s + p.totalDeAcoes, 0),
    },
    pessoas: lista,
  };
}
