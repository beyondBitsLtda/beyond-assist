"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { obter } from "@/lib/api.js";
import { Quiz, Exercicio, Projeto } from "@/componentes/Desafios.js";

/** Um desafio da prática: quiz, exercício ou projeto, cada um com a sua tela. */
export default function Desafio() {
  const { id } = useParams();
  const [desafio, setDesafio] = useState(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    obter(`/api/desafios/${id}`).then((r) => setDesafio(r.desafio)).catch((e) => setErro(e.message));
  }, [id]);

  if (!desafio) {
    return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Abrindo o desafio…</div>;
  }

  return (
    <>
      {desafio.tipo !== "quiz" && (
        <div className="pf-cabecalho">
          <div>
            <p style={{ margin: 0 }}><Link href="/pratica">← Prática</Link></p>
            <h1>{desafio.titulo}</h1>
            <p>{desafio.nome} · {desafio.tema}</p>
          </div>
        </div>
      )}
      {desafio.tipo === "quiz" && <Quiz desafio={desafio} />}
      {desafio.tipo === "exercicio" && <Exercicio desafio={desafio} />}
      {(desafio.tipo === "projeto_semanal" || desafio.tipo === "projeto_mensal") && <Projeto desafio={desafio} />}
    </>
  );
}
