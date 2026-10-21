// Os personagens (visuais do Neuro) que dá para comprar com moedas — pedido de um usuário em
// chamado de 20/10/2026 ("quero mais opções de personagem, quero comprar o personagem"). Puro.
//
// Cada personagem é o mesmo Neuro com outras cores e um acessório desenhado por cima (em
// src/componentes/Neuro.js e src/app/neuro.css), então funciona com todos os humores, em todas
// as telas e no boneco de papel do Reino em 3D. O Neuro Clássico é de todo mundo, de graça.

export const PERSONAGENS = {
  neuro: { nome: "Neuro Clássico", emoji: "🧠", preco: 0, descricao: "O Neuro de sempre, rosa e curioso." },
  ninja: { nome: "Neuro Ninja", emoji: "🥷", preco: 300, descricao: "Silencioso, azul-ardósia e com a faixa vermelha amarrada na testa." },
  astronauta: { nome: "Neuro Astronauta", emoji: "🧑‍🚀", preco: 500, descricao: "Capacete de vidro e antena: estuda até fora da órbita." },
  mago: { nome: "Neuro Mago", emoji: "🧙", preco: 800, descricao: "Chapéu de estrelas e um tom lilás de quem conhece todos os feitiços (e os algoritmos)." },
  pirata: { nome: "Neuro Pirata", emoji: "🏴‍☠️", preco: 1200, descricao: "Chapéu de três pontas e tapa-olho, caçando tesouros de conhecimento." },
  robo: { nome: "Neuro Robô", emoji: "🤖", preco: 2000, descricao: "Metálico, com parafusos e uma antena que brilha. Processa qualquer matéria." },
};
export const ORDEM_DOS_PERSONAGENS = ["neuro", "ninja", "astronauta", "mago", "pirata", "robo"];

/** Os personagens que a pessoa tem (o Clássico sempre, mesmo que a lista venha vazia). */
export function personagensDe(lista) {
  const validos = (Array.isArray(lista) ? lista : []).filter((p) => PERSONAGENS[p]);
  return [...new Set(["neuro", ...validos])];
}

/**
 * Escolher um personagem: se já é seu, só veste; se não é, compra (com moedas) e veste.
 * Devolve { ok, compra, custo, motivo }.
 */
export function podeEscolherPersonagem({ id, possui, saldo }) {
  const def = PERSONAGENS[id];
  if (!def) return { ok: false, motivo: "personagem desconhecido" };
  if (personagensDe(possui).includes(id)) return { ok: true, compra: false, custo: 0 };
  if (saldo < def.preco) return { ok: false, compra: true, custo: def.preco, motivo: `faltam ${def.preco - saldo} moeda(s)` };
  return { ok: true, compra: true, custo: def.preco };
}
