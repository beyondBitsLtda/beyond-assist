"use client";

// A frase-senha da entrega (31/10/2026, src/dominio/senha.js): aparece quando o desafio pede áudio,
// foto ou vídeo. A pessoa fala no começo da gravação ou escreve num papel que aparece numa foto.

import { precisaDeSenha, TETO_SEM_SENHA } from "@/dominio/senha.js";

export function FraseSenha({ senha, aceitas }) {
  if (!senha || !precisaDeSenha(aceitas)) return null;
  return (
    <div className="senha" role="note">
      <span aria-hidden="true">🔑</span>
      <p style={{ margin: 0 }}>
        Frase-senha deste desafio: <strong className="senha__frase">“{senha}”</strong>. Fale no começo do áudio ou do vídeo, ou escreva num papel que apareça numa das fotos.
        <small> Sem ela, a entrega vale no máximo {TETO_SEM_SENHA}: é o que mostra que a gravação é sua.</small>
      </p>
    </div>
  );
}
