"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Suspenso, { GrupoDoMenu, ItemDoMenu, ChaveDoMenu, LinkDoMenu } from "./Suspenso.js";
import { GRUPOS_DE_PAINEIS, painelDe } from "@/lib/navegacao.js";
import { useLog } from "./LogProvider.js";
import { CY, OR, GR, dotColor } from "@/lib/theme.js";
import { runFullSync } from "@/lib/sync.js";
import { ACCENT_THEMES, DEFAULT_ACCENT, applyAccentTheme } from "@/lib/accentThemes.js";

const pad = (n) => String(n).padStart(2, "0");
const fmtClock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

/** "há 3 min" / "há 2 h" a partir de um ISO — usado no indicador de SYNC automático. */
function relTime(iso) {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, Date.now() - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

/** Converte a chave VAPID pública (base64 URL-safe) pro formato que o PushManager espera. */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Barra superior compartilhada por todos os painéis.
 *
 * Revisão visual (out/2026): era uma linha com relógio, quatro pílulas de conexão, AUTO-SYNC,
 * SYNC, sino e sete bolinhas de cor — e uma barra lateral com 18 painéis soltos. Agora é a marca,
 * o nome do painel atual, o menu "Painéis" (agrupado, em src/lib/navegacao.js) e UM ponto de
 * status que abre conexões, sincronização, notificações, cor de destaque e o relógio. Nenhuma
 * função saiu: só mudou de lugar. O espaço #bb-topo-extra recebe os menus próprios de cada
 * painel (o Assistente põe "Modos" e os ajustes ali, ver TopoExtra.js).
 */
export default function Topbar() {
  const { addLog } = useLog();
  const pathname = usePathname();
  // Começa neutro e só ganha a hora no navegador: o HTML é pré-renderizado no BUILD, e a hora
  // do build nunca bate com a do cliente — o React descartava a hidratação e refazia a raiz
  // inteira (erro #418), o que também apagava a tela de abertura.
  const [clock, setClock] = useState("--:--:--");
  const [uptime, setUptime] = useState("00:00:00");
  const [conn, setConn] = useState({ supabase: null, abacato: null, gemini: null, sentinel: null });
  const [ingesting, setIngesting] = useState(false);
  const [autoSync, setAutoSync] = useState(null); // status do SYNC automático (pg_cron) — ver /api/sync-status
  const [pushSupported, setPushSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [accentName, setAccentName] = useState(DEFAULT_ACCENT.name); // só pro seletor saber qual destacar
  const startRef = useRef(Date.now());

  // carrega a cor de destaque escolhida antes (Shell.js já aplica cedo — isso é só pro
  // seletor saber qual bolinha marcar como ativa)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = JSON.parse(localStorage.getItem("accentTheme") || "null");
      if (saved?.name) setAccentName(saved.name);
    } catch {}
  }, []);

  const chooseAccent = useCallback((theme) => {
    applyAccentTheme(theme);
    setAccentName(theme.name);
    if (typeof window !== "undefined") localStorage.setItem("accentTheme", JSON.stringify(theme));
  }, []);

  // relógio + uptime
  useEffect(() => {
    setClock(fmtClock(new Date()));
    const id = setInterval(() => {
      const d = new Date();
      const up = Math.floor((Date.now() - startRef.current) / 1000);
      setClock(fmtClock(d));
      setUptime(`${pad(Math.floor(up / 3600))}:${pad(Math.floor(up / 60) % 60)}:${pad(up % 60)}`);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // health check → bolinhas de conexão
  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => r.json())
      .then((s) => { if (alive) setConn(s); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // status do SYNC automático (cron do Supabase) — busca ao montar e a cada 30s, pra
  // refletir os ticks (1x/min) sem precisar recarregar a página.
  useEffect(() => {
    let alive = true;
    const check = () => {
      fetch("/api/sync-status")
        .then((r) => r.json())
        .then((s) => { if (alive) setAutoSync(s); })
        .catch(() => {});
    };
    check();
    const id = setInterval(check, 30000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // notificações push: registra o service worker e checa se este dispositivo já está inscrito
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setPushSupported(true);
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const toggleNotifications = useCallback(async () => {
    if (subBusy || typeof window === "undefined") return;
    setSubBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;

      if (subscribed) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          }).catch(() => {});
          await sub.unsubscribe();
        }
        setSubscribed(false);
        addLog("[PUSH]", CY, "notificações desativadas");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        addLog("[PUSH]", OR, `permissão negada (${permission})`);
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        throw new Error(
          "NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada nesse deploy. " +
          "Defina em Vercel → Settings → Environment Variables e refaça o deploy " +
          "(variáveis NEXT_PUBLIC_* só entram em vigor em um build novo)."
        );
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSubscribed(true);
      addLog("[PUSH]", GR, "notificações ativadas");
    } catch (err) {
      addLog("[PUSH]", OR, `falha: ${err.message}`);
    } finally {
      setSubBusy(false);
    }
  }, [subscribed, subBusy, addLog]);

  // ---- reindexar via /api/ingest em fatias com paginação (respeita quota Gemini) ----
  const reindex = useCallback(async () => {
    if (ingesting) return;
    setIngesting(true);
    await runFullSync({
      onProgress: (ev) => {
        if (ev.type === "start") addLog("[INGEST]", OR, `→ ${ev.label} · fatia ${ev.pageNum} (offset ${ev.offset})…`);
        else if (ev.type === "chunk") addLog("[INGEST]", GR, `✓ ${ev.label} f${ev.pageNum}: ${ev.processed}/${ev.total} chunks`);
        else if (ev.type === "error") addLog("[INGEST]", OR, `✗ ${ev.label}: ${ev.message}`);
        else if (ev.type === "finished") addLog("[INGEST]", CY, `finalizado · ${ev.grandTotal} chunks indexados`);
      },
    });
    setIngesting(false);
  }, [ingesting, addLog]);

  const connList = [
    { rotulo: "Banco", ok: conn.supabase },
    { rotulo: "Abacato", ok: conn.abacato },
    { rotulo: "Gemini", ok: conn.gemini },
    { rotulo: "Sentinela", ok: conn.sentinel },
  ];

  // indicador do SYNC automático (cron do Supabase) — cor/texto conforme o estado atual
  let autoSyncColor = "var(--bb-texto-3)"; // dim: ainda sem dado (carregando ou nunca rodou)
  let autoSyncLabel = "…";
  let autoSyncTitle = "Carregando status do SYNC automático…";
  if (autoSync) {
    if (!autoSync.ok) {
      autoSyncColor = OR;
      autoSyncLabel = "não configurado";
      autoSyncTitle = `Ciclo automático não configurado — rode db/schema.sql e db/cron.sql no Supabase (ver README). Detalhe: ${autoSync.error || "tabela sync_progress não encontrada"}`;
    } else if (!autoSync.started_at) {
      autoSyncColor = "var(--bb-texto-3)";
      autoSyncLabel = "nunca rodou";
      autoSyncTitle = "Nenhum ciclo automático rodou ainda — confira se db/cron.sql foi executado no Supabase.";
    } else if (autoSync.last_error) {
      autoSyncColor = OR;
      autoSyncLabel = relTime(autoSync.updated_at) || "erro";
      autoSyncTitle = `Último erro no ciclo automático: ${autoSync.last_error}`;
    } else if (autoSync.status === "running") {
      autoSyncColor = CY;
      autoSyncLabel = "em andamento";
      autoSyncTitle = `Ciclo em andamento desde ${relTime(autoSync.started_at)} · ${autoSync.grand_total || 0} chunks processados até agora`;
    } else {
      autoSyncColor = GR;
      autoSyncLabel = relTime(autoSync.updated_at) || "ok";
      autoSyncTitle = `Último ciclo automático concluído ${relTime(autoSync.updated_at)} · ${autoSync.grand_total || 0} chunks processados`;
    }
  }

  const algumFalhou = connList.some((c) => c.ok === false);
  const tudoOk = connList.every((c) => c.ok === true);
  const corDoStatus = ingesting ? CY : algumFalhou ? OR : tudoOk ? GR : "var(--bb-texto-3)";
  const tituloDoStatus = ingesting
    ? "Sincronizando…"
    : algumFalhou
    ? `Falha em: ${connList.filter((c) => c.ok === false).map((c) => c.rotulo).join(", ")}`
    : tudoOk ? "Tudo conectado" : "Verificando conexões…";
  const atual = painelDe(pathname);

  return (
    <header className="bb-topo">
      <Link href="/assistant" className="bb-topo-marca" aria-label="Lisa — Assistente">
        <span className="bb-marca bb-marca--topo" aria-hidden="true" />
        <span>Lisa</span>
      </Link>
      {atual && atual.href !== "/assistant" && <span className="bb-topo-onde">{atual.rotulo}</span>}

      <div className="bb-topo-direita">
        {/* menus próprios do painel aberto (ver TopoExtra.js) */}
        <div id="bb-topo-extra" className="bb-topo-extra" />

        <Suspenso
          titulo="Painéis"
          largura={290}
          rotulo={
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1.2" /><rect x="9" y="2" width="5" height="5" rx="1.2" /><rect x="2" y="9" width="5" height="5" rx="1.2" /><rect x="9" y="9" width="5" height="5" rx="1.2" /></svg>
              <span className="bb-rotulo">Painéis</span>
            </>
          }
        >
          {GRUPOS_DE_PAINEIS.map((g) => (
            <GrupoDoMenu key={g.titulo} titulo={g.titulo}>
              {g.itens.map((i) => (
                <LinkDoMenu key={i.href} href={i.href} detalhe={i.detalhe} atual={pathname === i.href}>{i.rotulo}</LinkDoMenu>
              ))}
            </GrupoDoMenu>
          ))}
        </Suspenso>

        <Suspenso
          titulo={tituloDoStatus}
          largura={290}
          classeDoBotao="bb-status-botao"
          rotulo={<i style={{ background: corDoStatus, boxShadow: `0 0 10px ${corDoStatus}`, animation: ingesting || autoSync?.status === "running" ? "bb-dot 0.9s ease-in-out infinite" : "none" }} />}
        >
          <GrupoDoMenu titulo="Conexões">
            {connList.map((c) => (
              <div key={c.rotulo} className="bb-linha-de-status">
                <span>{c.rotulo}</span>
                <em style={{ color: dotColor(c.ok) }}>{c.ok == null ? "…" : c.ok ? "ok" : "falhou"}</em>
              </div>
            ))}
          </GrupoDoMenu>
          <GrupoDoMenu titulo="Sincronização">
            <div className="bb-linha-de-status" title={autoSyncTitle}>
              <span>Automática</span>
              <em style={{ color: autoSyncColor }}>{autoSyncLabel}</em>
            </div>
            <ItemDoMenu
              onClick={reindex}
              disabled={ingesting}
              fecharAoClicar={false}
              title="Reindexar os quadros e o Beyond Brain agora mesmo (a automática roda sozinha)"
              detalhe="Quadros e Beyond Brain"
            >
              {ingesting ? "Sincronizando…" : "Sincronizar agora"}
            </ItemDoMenu>
          </GrupoDoMenu>
          {pushSupported && (
            <GrupoDoMenu titulo="Avisos">
              <ChaveDoMenu
                ligado={subscribed}
                onChange={() => toggleNotifications()}
                disabled={subBusy}
                detalhe="Chamado novo, SLA, tarefa atrasada…"
              >
                Notificações neste aparelho
              </ChaveDoMenu>
            </GrupoDoMenu>
          )}
          <GrupoDoMenu titulo="Cor de destaque">
            <div className="bb-cores" role="group" aria-label="Cor de destaque">
              {ACCENT_THEMES.map((th) => (
                <button
                  key={th.name}
                  type="button"
                  onClick={() => chooseAccent(th)}
                  title={th.name}
                  aria-label={th.name}
                  aria-pressed={accentName === th.name}
                  style={{ background: th.hex }}
                />
              ))}
            </div>
          </GrupoDoMenu>
          <div className="bb-relogio"><span>{clock}</span><span>no ar há {uptime}</span></div>
        </Suspenso>
      </div>
    </header>
  );
}
