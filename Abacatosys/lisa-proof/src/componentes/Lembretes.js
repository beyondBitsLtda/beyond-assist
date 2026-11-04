"use client";

import { useEffect, useState } from "react";
import { obter, criar, pedir } from "@/lib/api.js";
import { reagir } from "./Neuro.js";

/** A chave pública VAPID vem em base64url; o navegador quer bytes. */
function paraBytes(base64url) {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function ehIphoneNoNavegador() {
  const ua = navigator.userAgent || "";
  const ios = /iPhone|iPad|iPod/.test(ua);
  const instalado = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  return ios && !instalado;
}

/**
 * Liga e desliga os lembretes deste aparelho.
 *
 * Os lembretes são enviados pelo relógio do iMac (scripts/lembretes.mjs) ao meio-dia e às 20h:
 * "ofensiva em risco" se o dia ainda não teve estudo, ou "o quiz de hoje está te esperando".
 */
export default function Lembretes() {
  const [estado, setEstado] = useState("carregando"); // carregando | sem-suporte | iphone | indisponivel | desligado | ligado | negado
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setEstado(ehIphoneNoNavegador() ? "iphone" : "sem-suporte");
      }
      try {
        const info = await obter("/api/push");
        if (!info.disponivel) return setEstado("indisponivel");
        const reg = await navigator.serviceWorker.getRegistration("/");
        const inscricao = await reg?.pushManager.getSubscription();
        if (Notification.permission === "denied") return setEstado("negado");
        setEstado(inscricao ? "ligado" : "desligado");
      } catch (e) {
        setErro(e.message);
        setEstado("desligado");
      }
    })();
  }, []);

  async function ligar() {
    setOcupado(true);
    setErro("");
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") {
        setEstado(permissao === "denied" ? "negado" : "desligado");
        return;
      }
      const { chave } = await obter("/api/push");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const inscricao = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraBytes(chave) }));
      await criar("/api/push", inscricao.toJSON());
      setEstado("ligado");
      reagir("feliz", "Combinado! Eu te cutuco se a ofensiva ficar em risco. 🔔");
    } catch (e) {
      setErro(e.message || "não deu para ativar neste navegador");
    } finally {
      setOcupado(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    setErro("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const inscricao = await reg?.pushManager.getSubscription();
      if (inscricao) {
        await pedir("/api/push", { metodo: "DELETE", corpo: { endpoint: inscricao.endpoint } });
        await inscricao.unsubscribe();
      }
      setEstado("desligado");
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  }

  const textos = {
    carregando: "Verificando…",
    "sem-suporte": "Este navegador não recebe notificações. No celular, use o Chrome (Android) ou instale o app (iPhone).",
    iphone: "No iPhone, os lembretes só funcionam com o app instalado: toque em Compartilhar → Adicionar à Tela de Início, abra por lá e volte aqui.",
    indisponivel: "Os lembretes ainda não estão configurados neste servidor.",
    desligado: "Receba um aviso ao meio-dia e às 20h quando a ofensiva estiver em risco ou o quiz do dia estiver pendente.",
    ligado: "Lembretes ligados neste aparelho. 🔔",
    negado: "As notificações estão bloqueadas para este site. Libere nas configurações do navegador e tente de novo.",
  };

  return (
    <section className="pf-cartao">
      <h2 className="pf-secao__titulo">Lembretes</h2>
      <p className="pf-estat__nota" style={{ marginTop: 0, marginBottom: 12 }}>{textos[estado]}</p>
      {erro && <div className="pf-aviso pf-aviso--erro" style={{ marginBottom: 12 }}>{erro}</div>}
      {estado === "desligado" && (
        <button type="button" className="pf-botao pf-botao--pequeno" onClick={ligar} disabled={ocupado}>
          {ocupado ? "Ativando…" : "Ativar lembretes neste aparelho"}
        </button>
      )}
      {estado === "ligado" && (
        <button type="button" className="pf-botao pf-botao--sec pf-botao--pequeno" onClick={desligar} disabled={ocupado}>
          {ocupado ? "Desligando…" : "Desligar lembretes"}
        </button>
      )}
    </section>
  );
}
