"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Uma linha dizendo quanto falta para o teto, na tela onde o teto vai ser atingido.
 *
 * ==========================================================================================
 * APARECE QUANDO AINDA DÁ TEMPO DE FAZER ALGO
 *
 * Quem tem limite descobre isso de dois jeitos: lendo aqui que restam 2 quadros, ou levando um
 * "não" ao clicar em criar. O segundo é o mesmo fato, entregue no pior momento possível.
 *
 * Por isso a linha some quando há folga (menos de 60% usado): um aviso permanente vira
 * paisagem, e quando ele finalmente importasse ninguém mais o leria. Quem não tem limite
 * nenhum nunca a vê.
 * ==========================================================================================
 *
 * `qual` é a chave dentro da resposta de /api/conta/plano — "quadros" ou "projetos".
 */
export default function AvisoDeLimite({ qual, nome }) {
  const [medida, setMedida] = useState(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/conta/plano")
      .then((r) => r.json())
      .then((d) => { if (vivo && d?.ok) setMedida(d.uso[qual]); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [qual]);

  if (!medida || medida.ilimitado) return null;
  if (medida.porcentagem < 60) return null;

  const classe = medida.cheio
    ? " abacato-medida--cheio"
    : medida.porcentagem >= 80 ? " abacato-medida--quase" : "";

  return (
    <div className={`abacato-medida${classe}`} style={{ marginBottom: 16 }}>
      <div className="abacato-medida__topo">
        <span className="abacato-medida__nome">
          {medida.cheio
            ? `Você chegou ao limite de ${nome} da sua conta`
            : `${nome} da sua conta`}
        </span>
        <span className="abacato-medida__valor">{medida.usado} / {medida.teto}</span>
      </div>
      <div className="abacato-medida__trilho">
        <div className="abacato-medida__barra" style={{ "--parte": `${medida.porcentagem}%` }} />
      </div>
      <p className="abacato-medida__nota">
        {medida.cheio
          ? "Arquive um que não usa mais para criar outro, ou peça mais espaço a quem administra."
          : `Restam ${medida.restam}.`}{" "}
        <Link href="/conta">Ver tudo que a sua conta inclui</Link>
      </p>
    </div>
  );
}
