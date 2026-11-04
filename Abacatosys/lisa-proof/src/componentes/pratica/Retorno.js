"use client";

// O retorno de uma entrega: o cartão da avaliação (nota, requisitos, o que ficou bom e o que
// melhorar) e a reação do Neuro. Mora aqui, e não em Desafios.js, para as telas dos motores
// (Motores.js) usarem o mesmo retorno sem um importar o outro.

import { NOTA_DE_APROVACAO } from "@/dominio/pratica.js";
import { reagir, comemorar, celebrar } from "../Neuro.js";

export function Avaliacao({ avaliacao, nota }) {
  if (!avaliacao) return null;
  const valor = nota ?? avaliacao.nota;
  const ok = valor >= NOTA_DE_APROVACAO;
  return (
    <div className="pf-cartao avaliacao">
      <div className="avaliacao__topo">
        <div className={`avaliacao__nota${ok ? " avaliacao__nota--ok" : ""}`}>{valor}</div>
        <div>
          <span className={`pf-pilula ${ok ? "pf-pilula--verde" : "pf-pilula--atencao"}`}>{ok ? "Aprovado" : `Ainda não (mínimo ${NOTA_DE_APROVACAO})`}</span>
          {avaliacao.comentario && <p style={{ margin: "8px 0 0" }}>{avaliacao.comentario}</p>}
        </div>
      </div>
      {avaliacao.requisitos?.length > 0 && (
        <ul className="avaliacao__lista">
          {avaliacao.requisitos.map((r, i) => (
            <li key={i} className={r.atendido ? "avaliacao__ok" : "avaliacao__falta"}>
              <b aria-hidden="true">{r.atendido ? "✓" : "✗"}</b>
              <span>{r.requisito}{r.observacao && <small>{r.observacao}</small>}</span>
            </li>
          ))}
        </ul>
      )}
      {avaliacao.extras?.length > 0 && (
        <ul className="avaliacao__lista">
          {avaliacao.extras.map((r, i) => (
            <li key={i} className={r.atendido ? "avaliacao__ok" : "avaliacao__falta"}>
              <b aria-hidden="true">{r.atendido ? "✓" : "–"}</b>
              <span>Extra: {r.requisito}{r.observacao && <small>{r.observacao}</small>}</span>
            </li>
          ))}
        </ul>
      )}
      {avaliacao.pontosFortes?.length > 0 && (
        <>
          <p className="pf-campo__rotulo">O que ficou bom</p>
          <ul className="avaliacao__simples">{avaliacao.pontosFortes.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </>
      )}
      {avaliacao.melhorias?.length > 0 && (
        <>
          <p className="pf-campo__rotulo">Para melhorar</p>
          <ul className="avaliacao__simples">{avaliacao.melhorias.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </>
      )}
    </div>
  );
}

/**
 * A reação a uma entrega avaliada: a festa da ofensiva, da meta e das conquistas; os pontos; e,
 * no projeto, a semana que abriu (ou a trilha que terminou). `avisar`: o aviso da tela.
 */
export function reagirAEntrega(r, { projeto, avisar }) {
  celebrar(r);
  if (projeto) {
    // projeto em partes: o que conta é o que esta entrega garantiu de NOVO
    if (r.completo) comemorar(`Projeto completo! ${r.pontos > 0 ? `+${r.pontos} pontos` : ""}`);
    else if (r.pontos > 0) comemorar(`+${r.pontos} pontos garantidos!`);
    else reagir("pensando", "Nada novo garantido desta vez — veja na avaliação o que faltou.", 6000);
  } else if (r.avaliacao.aprovado) {
    comemorar(`Aprovado com ${r.avaliacao.nota}! ${r.pontos > 0 ? `+${r.pontos} pontos` : ""}`);
    if (r.reenviar && r.avaliacao.nota < 100) setTimeout(() => reagir("feliz", `Quer buscar uma nota maior? Ainda tem ${r.restantes} tentativa(s) — vale a melhor.`, 6000), 4200);
  }
  else reagir("triste", r.restantes ? `Faltou pouco! Você ainda tem ${r.restantes} tentativa(s).` : "Não foi dessa vez, mas olha quanta coisa boa na avaliação.", 6000);
  if (r.pontos > 0 && !r.avaliacao.aprovado) avisar?.(`+${r.pontos} pontos`);
  // a trilha amarrada: o projeto aprovado abre a semana seguinte; o final fecha a trilha
  if (r.semana?.trilhaConcluida) setTimeout(() => comemorar("Trilha concluída! 🏆"), 4400);
  else if (r.semana?.liberou) setTimeout(() => comemorar(`Semana ${r.semana.liberou} liberada! 🔓`), 4400);
  else if (r.semana?.podeOutro) setTimeout(() => reagir("pensando", "As entregas acabaram sem aprovação — na trilha dá para gerar um projeto novo para esta semana.", 7000), 4400);
}
