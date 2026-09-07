// Aba "Notícias & Clima" do Sentinela + assunto do Modo Rádio — previsão via Open-Meteo
// (https://open-meteo.com), API pública gratuita SEM chave/cadastro necessário.

const CITIES = [
  { key: "bh", name: "Belo Horizonte", lat: -19.9167, lon: -43.9345 },
  { key: "vespasiano", name: "Vespasiano", lat: -19.6889, lon: -43.9264 },
];

// Tabela padrão de códigos de tempo WMO (usada pelo Open-Meteo) — tradução resumida pro
// português, só os códigos que fazem sentido pro clima de MG.
const WEATHER_CODE_PT = {
  0: "céu limpo",
  1: "poucas nuvens",
  2: "parcialmente nublado",
  3: "nublado",
  45: "neblina",
  48: "neblina com geada",
  51: "garoa fraca",
  53: "garoa moderada",
  55: "garoa forte",
  56: "garoa congelante fraca",
  57: "garoa congelante forte",
  61: "chuva fraca",
  63: "chuva moderada",
  65: "chuva forte",
  66: "chuva congelante fraca",
  67: "chuva congelante forte",
  71: "neve fraca",
  73: "neve moderada",
  75: "neve forte",
  77: "grãos de neve",
  80: "pancadas de chuva fracas",
  81: "pancadas de chuva moderadas",
  82: "pancadas de chuva fortes",
  85: "pancadas de neve fracas",
  86: "pancadas de neve fortes",
  95: "trovoada",
  96: "trovoada com granizo fraco",
  99: "trovoada com granizo forte",
};

function describeCode(code) {
  return WEATHER_CODE_PT[code] || "condição desconhecida";
}

const CACHE_MS = 30 * 60 * 1000;
let _cache = null; // { at, data }

/** Previsão de 4 dias pra Belo Horizonte e Vespasiano (MG) — usada pela aba do Sentinela e
 * pelo Modo Rádio (categoria "weather"). */
export async function getWeatherForecast() {
  if (_cache && Date.now() - _cache.at < CACHE_MS) return _cache.data;

  const data = await Promise.all(
    CITIES.map(async (c) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=America%2FSao_Paulo&forecast_days=4`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} (${c.name})`);
      const json = await res.json();
      const days = json.daily.time.map((date, i) => ({
        date,
        max: json.daily.temperature_2m_max[i],
        min: json.daily.temperature_2m_min[i],
        rainChance: json.daily.precipitation_probability_max[i],
        code: json.daily.weathercode[i],
        description: describeCode(json.daily.weathercode[i]),
      }));
      return { city: c.name, days };
    })
  );

  _cache = { at: Date.now(), data };
  return data;
}
