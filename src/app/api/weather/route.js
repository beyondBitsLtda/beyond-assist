import { getWeatherForecast } from "@/lib/weather.js";
import { jsonResponse } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/weather — previsão de Belo Horizonte e Vespasiano (MG), ver src/lib/weather.js. */
export async function GET() {
  try {
    const cities = await getWeatherForecast();
    return jsonResponse({ ok: true, cities });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
}
