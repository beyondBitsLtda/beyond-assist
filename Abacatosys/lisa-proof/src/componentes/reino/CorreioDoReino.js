"use client";

// A caixa de correio no Reino (03/11/2026, BEYOND-0016: "o carteiro com as mensagens e a caixa de correio
// devem ser vistos lá no reino"): tocar na caixa do mundo 3D (Mundo3D.js) abre esta folha, com as cartas
// que chegaram — o recado para avaliar e a pergunta do quiz para responder, ali mesmo.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Folha from "@/componentes/Folha.js";
import { obter, criar } from "@/lib/api.js";
import { Recebidas } from "@/componentes/correio/Cartas.js";
import { CORREIO } from "@/dominio/correio.js";

export default function CorreioDoReino({ aberta, aoFechar, aoLer }) {
  const [caixa, setCaixa] = useState(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(() => obter("/api/correio?destinatarios=0").then((d) => {
    setCaixa(d);
    setErro("");
    // abriu a caixa: as cartas estão lidas, e a bandeirinha desce
    if (d.naoLidas) criar("/api/correio", { acao: "ler" }).then(() => aoLer?.()).catch(() => {});
  }).catch((e) => setErro(e.message)), [aoLer]);
  useEffect(() => { if (aberta) { setAviso(""); carregar(); } }, [aberta, carregar]);

  const agir = useCallback(async (url, corpo, texto) => {
    try {
      const r = await criar(url, corpo);
      setAviso(texto(r));
      await carregar();
      return r;
    } catch (e) {
      setAviso(`Não deu: ${e.message}`);
      return null;
    }
  }, [carregar]);

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo={`${CORREIO.mensageiro} Correio do reino`}>
      <p className="pf-estat__nota">O pombo-carteiro traz os recados e as perguntas do quiz que mandaram para você.</p>
      {aviso && <div className="pf-aviso pf-aviso--ok">{aviso}</div>}
      {erro && <div className="pf-aviso pf-aviso--erro">{erro}</div>}
      {!caixa && !erro && <p className="pf-estat__nota">Abrindo a caixa…</p>}
      {caixa && <Recebidas cartas={caixa.recebidas.slice(0, 10)} agir={agir} />}
      <div className="pf-acoes">
        <Link className="pf-botao pf-botao--sec" href="/correio">Abrir o correio inteiro</Link>
        <Link className="pf-botao" href="/correio">✍️ Escrever um recado</Link>
      </div>
    </Folha>
  );
}
