// Os personagens (visuais do Neuro) que dá para comprar com moedas — pedido de um usuário em
// chamado de 20/10/2026 ("quero mais opções de personagem, quero comprar o personagem"). Puro.
//
// Cada personagem é o mesmo Neuro com outras cores e um acessório desenhado por cima (em
// src/componentes/Neuro.js e src/app/neuro.css), então funciona com todos os humores, em todas
// as telas e no boneco de papel do Reino em 3D. O Neuro Clássico e o Neuro Abacate são de todo mundo, de graça.

import { faltam } from "./moedas.js";

export const PERSONAGENS = {
  neuro: { nome: "Neuro Clássico", emoji: "🧠", preco: 0, descricao: "O Neuro de sempre, rosa e curioso." },
  // o mascote do Abacato (23/10/2026): de graça, e todo mundo já tem
  abacato: { nome: "Neuro Abacate", emoji: "🥑", preco: 0, descricao: "O Neuro vestido de mascote do Abacato: verde, de luvas brancas e tênis, fazendo o sinal da paz." },
  ninja: { nome: "Neuro Ninja", emoji: "🥷", preco: 300, descricao: "Silencioso, azul-ardósia e com a faixa vermelha amarrada na testa." },
  astronauta: { nome: "Neuro Astronauta", emoji: "🧑‍🚀", preco: 500, descricao: "Capacete de vidro e antena: estuda até fora da órbita." },
  mago: { nome: "Neuro Mago", emoji: "🧙", preco: 800, descricao: "Chapéu de estrelas e um tom lilás de quem conhece todos os feitiços (e os algoritmos)." },
  pirata: { nome: "Neuro Pirata", emoji: "🏴‍☠️", preco: 1200, descricao: "Chapéu de três pontas e tapa-olho, caçando tesouros de conhecimento." },
  robo: { nome: "Neuro Robô", emoji: "🤖", preco: 2000, descricao: "Metálico, com parafusos e uma antena que brilha. Processa qualquer matéria." },
  // os dos ambientes das expedições (23/10/2026: "pode estrear novos personagens, baseados inclusive
  // nos ambientes de exploração") — bosque, fundo do mar, montanhas geladas, lava e planetoides
  cogumelo: { nome: "Neuro Cogumelo", emoji: "🍄", preco: 1000, descricao: "Saiu do Bosque dos Cogumelos com o chapéu vermelho de bolinhas e nunca mais tirou." },
  mergulhador: { nome: "Neuro Mergulhador", emoji: "🤿", preco: 1500, descricao: "Máscara, snorkel e bolhas: mergulha fundo em qualquer assunto, como no recife dos tritões." },
  yeti: { nome: "Neuro Yeti", emoji: "❄️", preco: 1800, descricao: "Peludo, de chifres e bochecha vermelha de frio, direto da trilha das montanhas geladas." },
  magma: { nome: "Neuro Magma", emoji: "🌋", preco: 2500, descricao: "Pedra vulcânica com as dobras em brasa e uma coroa de fogo. Forjado no rio de magma." },
  alienigena: { nome: "Neuro Alienígena", emoji: "👽", preco: 3000, descricao: "Verde, de antenas e um terceiro olho: chegou de um planetoide para estudar com você." },
};
export const ORDEM_DOS_PERSONAGENS = [
  "neuro", "abacato", "ninja", "astronauta", "mago", "cogumelo", "pirata", "mergulhador", "yeti", "robo", "magma", "alienigena",
];

/** Os de graça: todo mundo tem, mesmo que a lista guardada não diga. */
export const PERSONAGENS_DE_TODOS = ["neuro", "abacato"];

/** Os personagens que a pessoa tem (os de graça sempre, mesmo que a lista venha vazia). */
export function personagensDe(lista) {
  const validos = (Array.isArray(lista) ? lista : []).filter((p) => PERSONAGENS[p]);
  return [...new Set([...PERSONAGENS_DE_TODOS, ...validos])];
}

/**
 * Escolher um personagem: se já é seu, só veste; se não é, compra (com moedas) e veste.
 * Devolve { ok, compra, custo, motivo }.
 */
export function podeEscolherPersonagem({ id, possui, saldo }) {
  const def = PERSONAGENS[id];
  if (!def) return { ok: false, motivo: "personagem desconhecido" };
  if (personagensDe(possui).includes(id)) return { ok: true, compra: false, custo: 0 };
  if (saldo < def.preco) return { ok: false, compra: true, custo: def.preco, motivo: faltam(def.preco, saldo) };
  return { ok: true, compra: true, custo: def.preco };
}
