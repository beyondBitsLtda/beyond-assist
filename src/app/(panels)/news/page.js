"use client";

import { useEffect, useState } from "react";
import { CY, OR, mono } from "@/lib/theme.js";
import { NEWS_CATEGORIES } from "@/lib/techNews.js";

function formatDate(pubDate) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WeatherCard({ city }) {
  return (
    <div style={{ border: "1px solid rgba(var(--accent-rgb),0.16)", borderRadius: 6, padding: 14, background: "rgba(var(--accent-rgb),0.03)" }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 2, color: CY, marginBottom: 10 }}>{city.city.toUpperCase()}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {city.days.map((d, i) => (
          <div key={d.date} style={{ flex: "1 1 120px", minWidth: 110, border: "1px solid rgba(var(--accent-rgb),0.12)", borderRadius: 4, padding: "8px 10px" }}>
            <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(207,239,251,0.5)" }}>
              {i === 0 ? "HOJE" : new Date(d.date).toLocaleDateString("pt-BR", { weekday: "short" }).toUpperCase()}
            </div>
            <div style={{ fontSize: 12.5, color: "#eafcff", margin: "4px 0" }}>{d.description}</div>
            <div style={{ ...mono, fontSize: 13, color: "#eafcff" }}>
              {Math.round(d.max)}° <span style={{ color: "rgba(207,239,251,0.45)" }}>/ {Math.round(d.min)}°</span>
            </div>
            <div style={{ ...mono, fontSize: 9.5, color: "rgba(var(--accent-rgb),0.6)", marginTop: 2 }}>☔ {d.rainChance}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [category, setCategory] = useState("all");
  const [items, setItems] = useState([]);
  const [loadingNews, setLoadingNews] = useState(false);
  const [newsError, setNewsError] = useState(null);

  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoadingNews(true);
    setNewsError(null);
    const qs = category === "all" ? "" : `?category=${encodeURIComponent(category)}`;
    fetch(`/api/news${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.ok) throw new Error(d.error || "falha ao buscar notícias");
        setItems(d.items || []);
      })
      .catch((err) => { if (alive) setNewsError(err.message); })
      .finally(() => { if (alive) setLoadingNews(false); });
    return () => { alive = false; };
  }, [category]);

  useEffect(() => {
    let alive = true;
    setLoadingWeather(true);
    fetch("/api/weather")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (!d.ok) throw new Error(d.error || "falha ao buscar previsão");
        setWeather(d.cities || []);
      })
      .catch((err) => { if (alive) setWeatherError(err.message); })
      .finally(() => { if (alive) setLoadingWeather(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "20px 26px" }}>
      <div style={{ ...mono, fontSize: 11, letterSpacing: 3, color: CY, marginBottom: 16 }}>📰 NOTÍCIAS &amp; CLIMA</div>

      <div style={{ marginBottom: 24 }}>
        {weatherError && <div style={{ ...mono, fontSize: 11, color: OR }}>⚠ {weatherError}</div>}
        {loadingWeather && !weather && <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.5)" }}>carregando previsão…</div>}
        {weather && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {weather.map((c) => <WeatherCard key={c.city} city={c} />)}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        <button
          onClick={() => setCategory("all")}
          style={{
            ...mono, fontSize: 9.5, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
            border: `1px solid ${category === "all" ? CY : "rgba(var(--accent-rgb),0.18)"}`,
            background: category === "all" ? "rgba(var(--accent-rgb),0.1)" : "transparent",
            color: category === "all" ? "#eafcff" : "rgba(207,239,251,0.55)",
            cursor: "pointer",
          }}
        >
          TODAS
        </button>
        {NEWS_CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            style={{
              ...mono, fontSize: 9.5, letterSpacing: 1, padding: "5px 10px", borderRadius: 3,
              border: `1px solid ${category === c.key ? CY : "rgba(var(--accent-rgb),0.18)"}`,
              background: category === c.key ? "rgba(var(--accent-rgb),0.1)" : "transparent",
              color: category === c.key ? "#eafcff" : "rgba(207,239,251,0.55)",
              cursor: "pointer",
            }}
          >
            {c.label.toUpperCase()}
          </button>
        ))}
      </div>

      {newsError && <div style={{ ...mono, fontSize: 11, color: OR, marginBottom: 12 }}>⚠ {newsError}</div>}
      {loadingNews && items.length === 0 && <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.5)" }}>carregando notícias…</div>}
      {!loadingNews && items.length === 0 && !newsError && (
        <div style={{ ...mono, fontSize: 10.5, color: "rgba(207,239,251,0.5)" }}>nenhuma notícia encontrada nessa categoria.</div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => (
          <a
            key={`${item.link}-${i}`}
            href={item.link}
            target="_blank"
            rel="noreferrer noopener"
            style={{
              display: "block", padding: "10px 14px", borderRadius: 5,
              border: "1px solid rgba(var(--accent-rgb),0.12)", background: "rgba(var(--accent-rgb),0.02)",
              color: "#eafcff", textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{item.title}</div>
            <div style={{ ...mono, fontSize: 9, letterSpacing: 1, color: "rgba(var(--accent-rgb),0.6)", marginTop: 5, display: "flex", gap: 8 }}>
              <span>{item.source}</span>
              {formatDate(item.pubDate) && <span>· {formatDate(item.pubDate)}</span>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
