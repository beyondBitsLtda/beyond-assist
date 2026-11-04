"use client";

// O microfone do celular, como o do WhatsApp (as regras e o porquê: src/lib/falaComoWhatsApp.js).
//
//   variante "chat"  o botão redondo da barra; gravando, uma faixa cobre o campo (ponto vermelho,
//                    relógio, "‹ deslize para cancelar") e um cadeado sobe acima do botão
//   variante "voz"   o botão grande do modo voz, com as mesmas dicas em volta
//
// Travada (deslizou para cima): grava sem segurar, com lixeira e enviar. Depois de soltar (ou de
// enviar), "transcrevendo…" até o texto ir para a conversa por `aoTexto`.
//
// Dois cuidados de toque: o botão CAPTURA o dedo (setPointerCapture), então ele pode andar pela
// tela sem a gravação parar — antes, sair 1 px do botão encerrava tudo. E travada, o botão vira
// outro elemento (a `key`): o soltar do dedo que travou não vira um clique em "enviar".

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GESTO, LIMITE_DA_FALA, PICO_DE_SILENCIO, DICAS, gestoDoDedo, aoSoltar, relogioDaFala, dicaDoErro,
} from "@/lib/falaComoWhatsApp.js";
import { comecarGravacao, falaEmWav, transcreverFala } from "@/lib/gravadorDeFala.js";

const vibrar = (padrao) => { try { navigator.vibrate?.(padrao); } catch { /* sem vibração */ } };

const ICONE_MIC = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
  </svg>
);
const ICONE_ENVIAR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const ICONE_LIXEIRA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
  </svg>
);
const ICONE_CADEADO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="9.5" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

export default function MicrofoneDaLisa({ variante = "chat", desabilitado = false, rotulo = null, aoComecar, aoGravando, aoTexto }) {
  const [fase, setFase] = useState("parado"); // parado | abrindo | gravando | travada | transcrevendo
  const [segundos, setSegundos] = useState(0);
  const [arraste, setArraste] = useState({ dx: 0, dy: 0 });
  const [dica, setDica] = useState(null);
  const faseRef = useRef("parado");
  const gravacao = useRef(null);
  const toque = useRef(null); // { id, x, y, t } do dedo que está segurando
  const soltou = useRef(false);
  const desistiu = useRef(false);
  const relogio = useRef(null);
  const tempoDaDica = useRef(null);
  const montado = useRef(true);
  const avisos = useRef({ aoGravando, aoTexto });
  avisos.current = { aoGravando, aoTexto };

  const mudar = (f) => { faseRef.current = f; setFase(f); };
  const pararRelogio = () => { clearInterval(relogio.current); relogio.current = null; };
  const avisarGravando = (sim) => { try { avisos.current.aoGravando?.(sim); } catch { /* o visual não derruba a gravação */ } };
  const mostrarDica = useCallback((texto) => {
    clearTimeout(tempoDaDica.current);
    setDica(texto);
    tempoDaDica.current = setTimeout(() => { if (montado.current) setDica(null); }, 2800);
  }, []);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      pararRelogio();
      clearTimeout(tempoDaDica.current);
      gravacao.current?.cancelar();
      gravacao.current = null;
    };
  }, []);

  const cancelar = useCallback((mensagem = DICAS.cancelada) => {
    desistiu.current = true;
    pararRelogio();
    gravacao.current?.cancelar();
    gravacao.current = null;
    toque.current = null;
    avisarGravando(false);
    mudar("parado");
    setArraste({ dx: 0, dy: 0 });
    if (mensagem) { vibrar([12, 40, 12]); mostrarDica(mensagem); }
  }, [mostrarDica]);

  const enviar = useCallback(async () => {
    const g = gravacao.current;
    gravacao.current = null;
    toque.current = null;
    pararRelogio();
    avisarGravando(false);
    setArraste({ dx: 0, dy: 0 });
    if (!g) { mudar("parado"); return; }
    mudar("transcrevendo");
    try {
      const fala = await falaEmWav(await g.parar());
      if (fala.pico < PICO_DE_SILENCIO) { mostrarDica(DICAS.silencio); return; }
      const texto = await transcreverFala(fala.pedacos);
      if (!texto) { mostrarDica(DICAS.naoEntendi); return; }
      avisos.current.aoTexto?.(texto);
    } catch (e) {
      mostrarDica(`Não consegui transcrever: ${String(e?.message || e).slice(0, 90)}`);
    } finally {
      if (montado.current) mudar("parado");
    }
  }, [mostrarDica]);

  const travar = () => { mudar("travada"); setArraste({ dx: 0, dy: 0 }); vibrar(20); };

  const comecarRelogio = (g) => {
    pararRelogio();
    relogio.current = setInterval(() => {
      const s = g.segundos();
      setSegundos(s);
      if (s >= LIMITE_DA_FALA) enviar(); // no limite, vai sozinha
    }, 200);
  };

  const aoEncostar = (e) => {
    if (desabilitado || faseRef.current !== "parado") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura: segue igual */ }
    toque.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
    soltou.current = false;
    desistiu.current = false;
    setSegundos(0);
    setDica(null);
    try { aoComecar?.(); } catch { /* a Lisa calar não pode impedir a gravação */ }
    vibrar(15);
    mudar("abrindo");
    const pediuEm = performance.now();
    comecarGravacao().then((g) => {
      if (!montado.current || desistiu.current) { g.cancelar(); return; }
      if (soltou.current && faseRef.current !== "travada") {
        // soltou antes de o microfone abrir: um toque rápido, ou o tempo de responder à permissão
        g.cancelar();
        mudar("parado");
        mostrarDica(performance.now() - pediuEm > 1500 ? DICAS.liberado : DICAS.segure);
        return;
      }
      gravacao.current = g;
      if (faseRef.current === "abrindo") mudar("gravando");
      avisarGravando(true);
      comecarRelogio(g);
    }).catch((erro) => {
      if (!montado.current) return;
      mudar("parado");
      avisarGravando(false);
      mostrarDica(dicaDoErro(erro));
    });
  };

  const aoMover = (e) => {
    const t = toque.current;
    if (!t || e.pointerId !== t.id) return;
    const f = faseRef.current;
    if (f !== "abrindo" && f !== "gravando") return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    setArraste({ dx: Math.min(0, dx), dy: Math.min(0, dy) });
    const gesto = gestoDoDedo(dx, dy);
    if (gesto === "cancelar") cancelar();
    else if (gesto === "travar") travar();
  };

  const aoTirarODedo = (e) => {
    const t = toque.current;
    if (!t || e.pointerId !== t.id) return;
    soltou.current = true;
    const f = faseRef.current;
    const decisao = aoSoltar({ duracaoMs: performance.now() - t.t, travada: f === "travada" });
    if (decisao === "continuar") { setArraste({ dx: 0, dy: 0 }); return; }
    if (f === "abrindo") return; // decide quando o microfone abrir
    if (decisao === "curta") { cancelar(null); mostrarDica(DICAS.segure); return; }
    enviar();
  };

  const aoInterromper = (e) => {
    const t = toque.current;
    if (!t || e.pointerId !== t.id || faseRef.current === "travada") return;
    cancelar();
  };

  const gravando = fase === "abrindo" || fase === "gravando";
  const travada = fase === "travada";
  const ativo = gravando || travada;
  const quantoCancelou = Math.min(1, -arraste.dx / GESTO.cancelar);
  const quantoTravou = Math.min(1, -arraste.dy / GESTO.travar);

  const botao = travada ? (
    <button key="enviar" type="button" className={`bb-fala-botao bb-fala-botao--${variante} bb-fala-botao--enviar`} onClick={enviar} aria-label="Enviar a gravação">
      {ICONE_ENVIAR}
    </button>
  ) : (
    <button
      key="mic"
      type="button"
      className={`bb-fala-botao bb-fala-botao--${variante}${gravando ? " bb-fala-botao--gravando" : ""}`}
      style={gravando ? { transform: `translateX(${Math.max(arraste.dx, -GESTO.cancelar)}px) scale(${variante === "chat" ? 1.28 : 1.12})` } : undefined}
      onPointerDown={aoEncostar}
      onPointerMove={aoMover}
      onPointerUp={aoTirarODedo}
      onPointerCancel={aoInterromper}
      onContextMenu={(e) => e.preventDefault()}
      disabled={desabilitado || fase === "transcrevendo"}
      aria-label="Segure para falar"
      title={DICAS.segure}
    >
      {fase === "transcrevendo" ? <span className="bb-fala-girando" aria-hidden="true" /> : ICONE_MIC}
    </button>
  );
  // o cadeado: no chat, acima do botão (como no WhatsApp); no modo voz, ao lado, porque acima dele
  // fica o relógio
  const trava = gravando ? (
    <div
      className={`bb-fala-trava bb-fala-trava--${variante}`}
      style={{ transform: `${variante === "chat" ? "translateX(-50%) " : ""}translateY(${-quantoTravou * 26}px)`, opacity: 0.55 + quantoTravou * 0.45 }}
      aria-hidden="true"
    >
      <span>⌃</span>{ICONE_CADEADO}{variante === "voz" ? <small>deslize para travar</small> : null}
    </div>
  ) : null;
  const lixeira = (
    <button type="button" className={`bb-fala-lixeira bb-fala-lixeira--${variante}`} onClick={() => cancelar()} aria-label="Cancelar a gravação">
      {ICONE_LIXEIRA}
    </button>
  );
  const cancelarDica = (
    <span className="bb-fala-cancelar" style={{ opacity: 1 - quantoCancelou * 0.85, transform: `translateX(${Math.max(arraste.dx * 0.5, -40)}px)` }}>
      ‹ deslize para cancelar
    </span>
  );

  if (variante === "chat") {
    return (
      <>
        {ativo && (
          <div className="bb-fala-faixa" role="status">
            {travada && lixeira}
            <span className="bb-fala-ponto" aria-hidden="true" />
            <span className="bb-fala-relogio">{relogioDaFala(segundos)}</span>
            {travada ? <span className="bb-fala-texto">gravando…</span> : cancelarDica}
          </div>
        )}
        {fase === "transcrevendo" && (
          <div className="bb-fala-faixa" role="status">
            <span className="bb-fala-girando" aria-hidden="true" /><span className="bb-fala-texto">transcrevendo…</span>
          </div>
        )}
        {dica && fase === "parado" && <div className="bb-fala-dica" role="status">{dica}</div>}
        <div className="bb-fala-caixa">{trava}{botao}</div>
      </>
    );
  }

  return (
    <div className="bb-fala-voz">
      <div className="bb-celular-fala" role="status">
        {fase === "transcrevendo" ? "Entendendo…"
          : ativo ? <><span className="bb-fala-ponto" aria-hidden="true" /> {relogioDaFala(segundos)}{travada ? " · gravando" : ""}</>
            : dica || rotulo || "Segure para falar"}
      </div>
      <div className="bb-fala-voz-linha">
        <div className="bb-fala-voz-lado">{travada ? lixeira : gravando ? cancelarDica : null}</div>
        <div className="bb-fala-caixa">{botao}</div>
        <div className="bb-fala-voz-lado">{trava}</div>
      </div>
    </div>
  );
}
