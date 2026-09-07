"use client";

import { useCallback, useEffect, useState } from "react";
import { CY, OR, mono } from "@/lib/theme.js";
import { CHART } from "@/lib/chartPalette.js";
import HBarChart from "@/components/panels/HBarChart.js";
import SentinelKanban from "@/components/panels/SentinelKanban.js";

const VIEWS = [{ key: "kanban", label: "KANBAN" }, { key: "dashboard", label: "DASHBOARD" }, { key: "news", label: "NOTÍCIAS & CLIMA" }];

const WEATHER_ICON = { rain: "🌧️", drizzle: "🌦️", storm: "⛈️", cloud: "☁️", partly: "⛅", clear: "☀️", fog: "🌫️", snow: "❄️" };
function iconForCode(code) {
  if (code === 0) return WEATHER_ICON.clear;
  if (code <= 2) return WEATHER_ICON.partly;
  if (code === 3) return WEATHER_ICON.cloud;
  if (code === 45 || code === 48) return WEATHER_ICON.fog;
  if (code >= 51 && code <= 57) return WEATHER_ICON.drizzle;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return WEATHER_ICON.rain;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return WEATHER_ICON.snow;
  if (code >= 95) return WEATHER_ICON.storm;
  return "🌡️";
}
function fmtWeekday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
}

export default function SentinelPage() {
  const [view, setView] = useState("kanban");
  const [projectId, setProjectId] = useState("all");
  const [projects, setProjects] = useState([]);

  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  // lista de projetos pro filtro — carrega uma vez
  useEffect(() => {
    let alive = true;
    fetch("/api/sentinel/projects")
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setProjects(d.projects || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const res = await fetch(`/api/sentinel/dashboard?project=${encodeURIComponent(projectId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSummary(data);
    } catch (err) {
      setSummaryError(err.message);
    } finally {
      setLoadingSummary(false);
    }
  }, [projectId]);

  // busca o dashboard quando ele fica visível, e de novo sempre que o projeto do filtro muda
  useEffect(() => {
    if (view === "dashboard") loadSummary();
  }, [view, loadSummary]);

  // aba Notícias & Clima — RSS de tecnologia (português) + previsão de BH/Vespasiano
  const [news, setNews] = useState([]);
  const [weather, setWeather] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState(null);

  const loadNewsAndWeather = useCallback(async () => {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const [newsRes, weatherRes] = await Promise.all([fetch("/api/news"), fetch("/api/weather")]);
      const newsData = await newsRes.json();
      const weatherData = await weatherRes.json();
      if (newsData.ok) setNews(newsData.items);
      if (weatherData.ok) setWeather(weatherData.cities);
      if (!newsData.ok && !weatherData.ok) throw new Error(newsData.error || weatherData.error || "falha ao carregar");
    } catch (err) {
      setNewsError(err.message);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === "news") loadNewsAndWeather();
  }, [view, loadNewsAndWeather]);

  const statusRows = summary
    ? Object.entries(summary.byStatus).map(([status, count]) => ({ key: status, label: status, values: [count] }))
    : [];
  const priorityRows = summary
    ? Object.entries(summary.byPriority).map(([p, count]) => ({ key: p, label: p, values: [count] }))
    : [];
  const slaRows = summary
    ? [
        { key: "response", label: "SLA de resposta estourado", values: [summary.sla.responseBreached], flag: "critical" },
        { key: "resolution", label: "SLA de resolução estourado", values: [summary.sla.resolutionBreached], flag: "critical" },
      ]
    : [];
  const oneSeries = [{ key: "count", name: "Chamados", color: CHART.categorical[0] }];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 26px", borderBottom: "1px solid rgba(var(--accent-rgb),0.1)", flexWrap: "wrap" }}>
        <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY }}>◈ SENTINELA</div>
        <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              style={{
                ...mono, fontSize: 9.5, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
                border: `1px solid ${view === v.key ? CY : "rgba(var(--accent-rgb),0.18)"}`,
                background: view === v.key ? "rgba(var(--accent-rgb),0.1)" : "transparent",
                color: view === v.key ? "#eafcff" : "rgba(207,239,251,0.55)",
                cursor: "pointer",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view !== "news" && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{ ...mono, fontSize: 9.5, padding: "6px 8px", borderRadius: 3, border: "1px solid rgba(var(--accent-rgb),0.18)", background: "#08131a", color: "#eafcff", marginLeft: "auto" }}
          >
            <option value="all">Todos os projetos</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {view === "kanban" && <SentinelKanban project={projectId} />}

        {view === "dashboard" && (
          <div style={{ padding: "20px 24px", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button
                onClick={loadSummary}
                disabled={loadingSummary}
                style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: loadingSummary ? "wait" : "pointer" }}
              >
                {loadingSummary ? "…" : "↻ ATUALIZAR"}
              </button>
            </div>
            {summaryError && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {summaryError}</div>}
            <div className="bb-chart-grid">
              <HBarChart title="CHAMADOS POR STATUS" rows={statusRows} series={oneSeries} />
              <HBarChart title="CHAMADOS POR PRIORIDADE" rows={priorityRows} series={oneSeries} />
              <HBarChart title="SLA ESTOURADO (ABERTOS)" rows={slaRows} series={oneSeries} />
            </div>
          </div>
        )}

        {view === "news" && (
          <div style={{ padding: "20px 24px", height: "100%", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button
                onClick={loadNewsAndWeather}
                disabled={newsLoading}
                style={{ ...mono, fontSize: 9, letterSpacing: 2, padding: "6px 12px", border: `1px solid ${CY}`, borderRadius: 3, background: "rgba(var(--accent-rgb),0.06)", color: "#eafcff", cursor: newsLoading ? "wait" : "pointer" }}
              >
                {newsLoading ? "…" : "↻ ATUALIZAR"}
              </button>
            </div>
            {newsError && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 16 }}>⚠ {newsError}</div>}

            <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginBottom: 10 }}>◈ PREVISÃO DO TEMPO</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              {weather.map((c) => (
                <div key={c.city} style={{ border: "1px solid rgba(var(--accent-rgb),0.14)", borderRadius: 8, padding: "14px 16px", minWidth: 240 }}>
                  <div style={{ ...mono, fontSize: 11, letterSpacing: 1, color: "#eafcff", marginBottom: 10 }}>{c.city}</div>
                  <div style={{ display: "flex", gap: 14 }}>
                    {c.days.map((d) => (
                      <div key={d.date} style={{ textAlign: "center" }}>
                        <div style={{ ...mono, fontSize: 9, color: "rgba(207,239,251,0.5)", textTransform: "uppercase" }}>{fmtWeekday(d.date)}</div>
                        <div style={{ fontSize: 22, margin: "4px 0" }}>{iconForCode(d.code)}</div>
                        <div style={{ ...mono, fontSize: 10.5, color: "#eafcff" }}>{Math.round(d.max)}°/{Math.round(d.min)}°</div>
                        <div style={{ ...mono, fontSize: 8.5, color: CY, marginTop: 2 }}>💧{d.rainChance}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {!weather.length && !newsLoading && <div style={{ fontSize: 12, color: "rgba(207,239,251,0.45)" }}>sem dados de clima ainda</div>}
            </div>

            <div style={{ ...mono, fontSize: 10, letterSpacing: 2, color: "rgba(var(--accent-rgb),0.5)", marginBottom: 10 }}>◈ NOTÍCIAS DE TECNOLOGIA</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 720 }}>
              {news.map((n, i) => (
                <a
                  key={i}
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "block", padding: "10px 14px", border: "1px solid rgba(var(--accent-rgb),0.1)", borderRadius: 6, textDecoration: "none", color: "#eafcff" }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>{n.title}</div>
                  <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.45)" }}>
                    {n.source}{n.pubDate ? ` · ${new Date(n.pubDate).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}
                  </div>
                </a>
              ))}
              {!news.length && !newsLoading && <div style={{ fontSize: 12, color: "rgba(207,239,251,0.45)" }}>sem notícias carregadas ainda</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
