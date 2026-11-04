// Roda o arnês de uma fase da Arena no navegador (no mesmo Worker com tempo-limite do "Rodar" dos exercícios) e
// separa o resultado dos testes, os erros e o que o código da pessoa imprimiu.

import { rodarCodigo } from "@/componentes/codigo/rodar.js";
import { lerArnes } from "@/dominio/arena.js";

export async function rodarNaArena(arnes) {
  const r = await rodarCodigo({ linguagem: "javascript", codigo: arnes });
  const linhas = r.linhas || [];
  const saida = linhas.filter((l) => l.tipo === "log").map((l) => l.texto).join("\n");
  return {
    resultado: lerArnes(saida),
    erros: linhas.filter((l) => l.tipo === "erro").map((l) => l.texto),
    logs: linhas.filter((l) => l.tipo === "log" && !l.texto.startsWith("ARENA:")).map((l) => l.texto).slice(0, 30),
    ms: r.ms,
  };
}

/** Guarda o código de cada fase só neste navegador (voltar depois e continuar de onde parou). */
export function codigoGuardado(chave, padrao) {
  try { return localStorage.getItem(`proof-arena:${chave}`) ?? padrao; } catch { return padrao; }
}
export function guardarCodigo(chave, codigo) {
  try { localStorage.setItem(`proof-arena:${chave}`, codigo); } catch { /* sem armazenamento: vale só nesta visita */ }
}
