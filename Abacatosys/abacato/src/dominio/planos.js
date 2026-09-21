/**
 * Quanto cada tipo de conta pode usar.
 *
 * ==========================================================================================
 * OS NÚMEROS MORAM AQUI, E NÃO NO BANCO
 *
 * Poderia haver uma coluna por limite em cada pessoa. Não há, porque limite é regra de
 * produto: mudar "10 quadros" para "15" viraria uma migração e um UPDATE em todas as linhas,
 * e quem se cadastrou antes ficaria com o número velho para sempre. Aqui é uma linha, e vale
 * para todo mundo na mesma hora.
 *
 * O preço dessa escolha é não dar para abrir exceção para uma conta específica. Quando isso
 * for preciso, entra uma coluna de exceção ao lado — e ela sobrepõe o número daqui, em vez de
 * substituí-lo.
 *
 * Puro: nenhuma dependência, nenhum banco. Quem conta o uso é src/lib/limites.js.
 * ==========================================================================================
 */

const SEM_LIMITE = Infinity;
const GB = 1024 * 1024 * 1024;

export const PLANOS = {
  /** Quem é da casa. Sem teto — o teto é a confiança, e ela já foi dada ao criar a conta. */
  interno: {
    rotulo: "Interno",
    quadros: SEM_LIMITE,
    quadrosCompartilhados: SEM_LIMITE,
    membrosPorQuadro: SEM_LIMITE,
    projetos: SEM_LIMITE,
    projetosCompartilhados: SEM_LIMITE,
    membrosPorProjeto: SEM_LIMITE,
    armazenamento: SEM_LIMITE,
    lisa: true,
    /** Vê a lista de quem existe no sistema, para poder convidar clicando. */
    verDiretorio: true,
  },

  /**
   * Quem vem de fora.
   *
   * Uma conta de cliente nasce sem alcançar NADA do que já existe. Ela só vê o que ela mesma
   * criou e o que alguém compartilhou com ela — que é a mesma regra de todo mundo, sem
   * exceção nenhuma para o tipo.
   */
  cliente: {
    rotulo: "Cliente",
    quadros: 10,
    quadrosCompartilhados: 3,
    membrosPorQuadro: 3,
    projetos: 10,
    projetosCompartilhados: 3,
    membrosPorProjeto: 3,
    armazenamento: 4 * GB,
    lisa: false,
    // NÃO vê a lista de quem existe. Um cliente que abre o sistema não deve poder listar os
    // outros clientes nem a equipe — é o tipo de vazamento que ninguém percebe porque a tela
    // nunca mostrou, mas a resposta da API trazia.
    verDiretorio: false,
  },
};

export const TIPOS = Object.keys(PLANOS);

export function tipoValido(tipo) {
  return TIPOS.includes(tipo);
}

/** O plano de um tipo. Tipo desconhecido cai no MAIS restrito, e não no mais permissivo. */
export function planoDe(tipo) {
  return PLANOS[tipo] || PLANOS.cliente;
}

export function semLimite(valor) {
  return valor === SEM_LIMITE;
}

/* ------------------------------------------------------------------ tamanhos */

/** Bytes como gente lê: "3,2 GB". */
export function emTamanho(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < GB) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / GB).toFixed(2).replace(".", ",")} GB`;
}

/* ------------------------------------------------------- o que já foi usado */

/**
 * Um limite, do jeito que a tela precisa mostrar e a rota precisa decidir.
 *
 * `restam` pode ser negativo: quando alguém teve o plano reduzido, ou quando um limite baixou,
 * o uso pode estar acima do teto. Devolver zero esconderia isso, e a tela diria "0 restantes"
 * em vez de "você está 2 acima do que o plano permite".
 */
export function medir(usado, teto) {
  if (semLimite(teto)) {
    return { usado, teto: null, ilimitado: true, restam: null, cheio: false, porcentagem: 0 };
  }
  return {
    usado,
    teto,
    ilimitado: false,
    restam: teto - usado,
    cheio: usado >= teto,
    porcentagem: teto > 0 ? Math.min(100, Math.round((usado / teto) * 100)) : 0,
  };
}

/**
 * O texto que aparece quando alguém esbarra num limite.
 *
 * Fica aqui, e não espalhado pelas rotas, por um motivo: esta é a frase que a pessoa lê no
 * pior momento — quando queria fazer algo e não deu. Uma versão diferente em cada rota vira
 * uma frase seca num lugar e uma explicação em outro, e quem lê não sabe se é a mesma coisa.
 */
export const RECADOS = {
  quadros: (teto) =>
    `Você chegou ao limite de ${teto} quadros da sua conta. Arquive um que não usa mais, ou peça mais espaço a quem administra.`,
  projetos: (teto) =>
    `Você chegou ao limite de ${teto} projetos de documentação da sua conta. Arquive um que não usa mais, ou peça mais espaço a quem administra.`,
  quadrosCompartilhados: (teto) =>
    `Sua conta pode compartilhar ${teto} quadros, e eles já estão compartilhados. Tire alguém de um deles para liberar.`,
  projetosCompartilhados: (teto) =>
    `Sua conta pode compartilhar ${teto} projetos, e eles já estão compartilhados. Tire alguém de um deles para liberar.`,
  membrosPorQuadro: (teto) =>
    `Cada quadro da sua conta aceita ${teto} pessoas além de você.`,
  membrosPorProjeto: (teto) =>
    `Cada projeto da sua conta aceita ${teto} pessoas além de você.`,
  armazenamento: (teto, usado) =>
    `Seus arquivos somam ${emTamanho(usado)} e o limite da sua conta é ${emTamanho(teto)}. ` +
    `Apague alguma versão antiga para liberar espaço.`,
};
