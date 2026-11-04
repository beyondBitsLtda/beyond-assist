"use client";

// A revisão da turma (31/10/2026): a fila dos pedidos dos colegas (sem nome de ninguém) e os meus
// pedidos. As regras moram em src/dominio/revisoes.js.

import { useEffect, useState } from "react";
import Link from "next/link";
import { obter } from "@/lib/api.js";
import { formatarDia, diaDe } from "@/dominio/datas.js";
import { comemorar, celebrar } from "@/componentes/Neuro.js";
import { useAviso } from "@/componentes/Pecas.js";
import { PedidoParaRevisar, ResultadoDoPedido } from "@/componentes/pratica/RevisaoDaTurma.js";

export default function Revisoes() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [Aviso, avisar] = useAviso();
  useEffect(() => { obter("/api/revisoes").then(setDados).catch((e) => setErro(e.message)); }, []);

  function revisado(id, r) {
    setDados((d) => ({ ...d, fila: d.fila.filter((p) => p.id !== id), revisadasHoje: d.revisadasHoje + 1 }));
    if (r.pagou) { if (!celebrar(r)) comemorar(`Obrigada pela revisão! +${r.pontos} pontos`); }
    else avisar("Revisão enviada. (O teto de revisões pagas de hoje já foi — amanhã volta.)");
  }

  if (!dados) return erro ? <div className="pf-aviso pf-aviso--erro">{erro}</div> : <div className="pf-carregando">Abrindo a fila da turma…</div>;
  const restantes = Math.max(0, dados.pagasPorDia - dados.revisadasHoje);
  return (
    <>
      <div className="pf-cabecalho">
        <div>
          <h1>Revisão da turma</h1>
          <p>
            Quando alguém discorda da Lisa num critério, um colega revisa. O que você confirmar passa a valer para a pessoa; você ganha {dados.pontosPorRevisao} pontos
            (e moedas no Reino) por revisão, até {dados.pagasPorDia} por dia. Ninguém vê o nome de ninguém, e você não revisa o mesmo colega duas vezes na semana.
          </p>
        </div>
      </div>
      <p className="pf-estat__nota">Hoje: {dados.revisadasHoje} revisão(ões) · {restantes ? `mais ${restantes} valendo pontos` : "o teto de pontos de hoje já foi"}</p>

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Para revisar <small>{dados.fila.length ? `${dados.fila.length} pedido(s)` : ""}</small></h2>
        {dados.fila.length ? (
          <div className="turma__fila">
            {dados.fila.map((p) => <PedidoParaRevisar key={p.id} pedido={p} aoRevisar={revisado} />)}
          </div>
        ) : <div className="pf-cartao pf-vazio"><p>Nenhum pedido esperando agora. Volte mais tarde. 🙂</p></div>}
      </section>

      <section className="pf-secao">
        <h2 className="pf-secao__titulo">Meus pedidos</h2>
        {dados.meus.length ? (
          <div className="turma__fila">
            {dados.meus.map((p) => (
              <div key={p.id} className="turma__meu">
                <Link href={`/pratica/${p.desafioId}`}><strong>{p.titulo}</strong></Link>
                <small className="pf-estat__nota">{p.tema} · pedido em {formatarDia(diaDe(new Date(p.criadoEm)))}</small>
                <ResultadoDoPedido pedido={p} />
              </div>
            ))}
          </div>
        ) : <p className="pf-estat__nota">Você ainda não pediu revisão. O botão aparece depois da avaliação de um desafio aberto ou de um projeto entregue por texto, fotos, áudio ou vídeo.</p>}
      </section>
      {Aviso}
    </>
  );
}
