// Modo Deus do Mundo da Lisa: o que você pode mandar acontecer, e — mais importante — o que ela
// FAZ em cada caso.
//
// A regra que orienta tudo aqui: a reação tem que ser uma DECISÃO, não um efeito visual. Chuva
// não é só pingo caindo na tela; é ela largar o que estava fazendo, correr tirar a roupa do
// varal e depois se abrigar em casa. Zumbi não é só um boneco andando; é ela ir buscar a arma na
// oficina antes de enfrentar. É isso que faz parecer que tem alguém morando ali.
//
// Fica fora do componente porque é regra, não desenho: dá pra conferir os planos, as falas e as
// dependências sem navegador (npm run world-check).

/** Os botões do painel. `ms` é quanto o evento dura; 0 = instantâneo (vira estado do mundo). */
export const GOD_EVENTS = [
  { key: "chuva",  icon: "🌧", label: "Fazer chover",      ms: 40000, tipo: "clima" },
  { key: "neve",   icon: "❄",  label: "Fazer nevar",        ms: 40000, tipo: "clima" },
  { key: "vento",  icon: "🌬", label: "Vento forte",        ms: 26000, tipo: "clima" },
  { key: "dia",    icon: "☀",  label: "Virar dia",          ms: 0,     tipo: "hora" },
  { key: "noite",  icon: "🌙", label: "Virar noite",        ms: 0,     tipo: "hora" },
  { key: "steve",  icon: "🧔", label: "Chamar o Steve",     ms: 30000, tipo: "visita" },
  { key: "ladrao", icon: "🥷", label: "Soltar um ladrão",   ms: 34000, tipo: "ameaca" },
  { key: "zumbis", icon: "🧟", label: "Horda de zumbis",    ms: 52000, tipo: "ameaca" },
  { key: "calma",  icon: "✋", label: "Acabar com tudo",    ms: 0,     tipo: "parar" },
];

/**
 * O que ela diz. Sorteadas de um saco embaralhado (passa por todas antes de repetir), pra não
 * virar bordão. São falas prontas e não geradas pelo modelo de propósito: aqui a fala tem que
 * sair NO INSTANTE em que o zumbi aparece — esperar uma resposta de rede arruinaria a cena.
 */
export const FALAS = {
  chuva: ["choveu! a roupa!", "de novo não…", "corre que tá molhando tudo", "e eu que tinha acabado de varrer"],
  neve: ["neve? aqui?", "tá congelando", "vou acender a lareira", "isso não é normal e eu sei disso"],
  vento: ["que ventania!", "segura o varal!", "tá levando tudo", "de onde veio esse vento"],
  dia: ["amanheceu do nada", "bom dia, eu acho", "isso não foi natural"],
  noite: ["escureceu de repente", "boa noite então", "quem apagou o sol?"],
  steve: ["olha quem apareceu", "Steve! entra", "achei que você tinha sumido"],
  ladrao: ["ei! sai daqui!", "tem alguém no terreno", "Nala, pega!", "isso é invasão de propriedade"],
  zumbis: ["zumbis. sério.", "Nala, comigo!", "a oficina, rápido", "eu sabia que ia precisar daquilo"],
  vitoria: ["acabou", "terreno limpo", "foi mal, mas vocês começaram", "alguém vai ter que limpar isso"],
  abrigo: ["vou entrar", "melhor esperar passar lá dentro", "tô saindo dessa chuva"],
};

/**
 * O plano de reação: uma lista de passos que a Lisa executa em ordem. Cada passo é
 * `{ ir, fala, ms, faz }`, onde `ir` é o tile de destino (ou "casa" / "oficina" / "varal", que
 * o componente resolve pelo mapa) e `faz` é o que ela fica fazendo ao chegar.
 *
 * `needs` num passo pula ele quando aquela construção ainda não existe — sem varal não tem roupa
 * pra recolher, sem oficina ela enfrenta os zumbis de mãos vazias (e apanha mais).
 */
export function planoDe(evento) {
  switch (evento) {
    case "chuva":
      return [
        { fala: "chuva", ms: 1200 },
        { ir: "varal", needs: "varal", faz: "recolher", fala: null, ms: 4200 },
        { fala: "abrigo", ms: 1000 },
        { ir: "casa", faz: "dentro", ms: 0 },
      ];
    case "neve":
      return [
        { fala: "neve", ms: 1600 },
        { ir: "casa", faz: "dentro", ms: 0 },
      ];
    case "vento":
      return [
        { fala: "vento", ms: 1200 },
        { ir: "varal", needs: "varal", faz: "segurar", ms: 5000 },
        { ir: "casa", faz: "dentro", ms: 0 },
      ];
    case "dia":
    case "noite":
      return [{ fala: evento, ms: 2200 }];
    case "steve":
      return [
        { fala: "steve", ms: 1400 },
        { ir: "porta", faz: "receber", ms: 26000 },
      ];
    case "ladrao":
      return [
        { fala: "ladrao", ms: 1200 },
        { faz: "perseguir", ms: 24000 },
        { fala: "vitoria", ms: 2000 },
      ];
    case "zumbis":
      return [
        { fala: "zumbis", ms: 1400 },
        { ir: "oficina", needs: "oficina", faz: "pegar-arma", ms: 2600 },
        { faz: "lutar", ms: 40000 },
        { fala: "vitoria", ms: 2500 },
      ];
    default:
      return [];
  }
}

/** Quantos inimigos cada ameaça solta. */
// 6 zumbis a Nala sozinha limpava enquanto a Lisa ia buscar a arma, e a luta nem acontecia.
export const HORDA = { ladrao: 1, zumbis: 10 };

/** Sorteia uma fala do grupo sem repetir enquanto houver opção nova. */
export function criarSorteador(grupo) {
  let saco = [];
  return () => {
    const fonte = FALAS[grupo] || [];
    if (!fonte.length) return null;
    if (!saco.length) {
      saco = [...fonte];
      for (let i = saco.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [saco[i], saco[j]] = [saco[j], saco[i]];
      }
    }
    return saco.pop();
  };
}

// ---------- as ameaças ----------
//
// Ficam aqui, e não no laço de desenho, pelo mesmo motivo da física do disco: assim dá pra
// simular uma horda inteira em node e conferir que ela é enfrentável — nem passeio, nem
// massacre. Ver npm run world-check.

export const ZUMBI_VIDA = 3;      // dois tiros e uma mordida. Com 2 a horda inteira caía
                                  // antes de ela chegar na oficina, e a luta nem acontecia.
export const ZUMBI_VEL = 1.15;    // tiles/s — mais devagar que ela de propósito
export const LADRAO_VEL = 2.9;    // o ladrão corre MAIS que ela; quem pega é a Nala
export const TIRO_ALCANCE = 11;   // tiles
export const TIRO_INTERVALO = 750; // ms
export const MORDIDA_ALCANCE = 1.4;

/** Solta os inimigos espalhados em volta do portão, com um atraso entre eles pra entrarem em
 * fila indiana em vez de num bloco só. */
export function criarInimigos(tipo, [px, py], n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const ang = (i / Math.max(1, n)) * Math.PI * 2;
    out.push({
      tipo,
      tx: px + Math.cos(ang) * 1.6,
      ty: py + Math.sin(ang) * 1.6,
      vida: tipo === "zumbis" ? ZUMBI_VIDA : 1,
      entraEm: i * 1600, // entram em fila: os últimos chegam quando ela já está armada
      fugindo: false,
      vivo: true,
    });
  }
  return out;
}

/** Um quadro de um inimigo. Muta `e`. Devolve true se ele encostou no alvo. */
export function passoInimigo(e, alvo, dt, saida) {
  const destino = e.fugindo ? saida : alvo;
  const dx = destino[0] - e.tx;
  const dy = destino[1] - e.ty;
  const dist = Math.hypot(dx, dy) || 1;
  const vel = e.tipo === "zumbis" ? ZUMBI_VEL : LADRAO_VEL;
  const passo = Math.min(vel * dt, dist);
  e.tx += (dx / dist) * passo;
  e.ty += (dy / dist) * passo;
  e.flip = dx - dy < 0;
  return dist < 1;
}
