const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
const WEATHER_RETRY_ATTEMPTS = 3;
const WEATHER_RETRY_BASE_DELAY_MS = 2000;
const HEAVY_RAIN_MM = 7;
const HEATWAVE_TEMP_C = 35;
const STRONG_WIND_KPH = 45;
const HEAVY_RAIN_CODES = new Set([63, 65, 82, 95, 96, 99]);

const DISTRICT_WEATHER_LOCATIONS = {
  Airaway: { city: 'Brisbane', state: 'QLD', latitude: -27.4698, longitude: 153.0251 },
  Electropolis: { city: 'Sydney', state: 'NSW', latitude: -33.8688, longitude: 151.2093 },
  'Glass City': { city: 'Melbourne', state: 'VIC', latitude: -37.8136, longitude: 144.9631 },
  'The Grid': { city: 'Canberra', state: 'ACT', latitude: -35.2809, longitude: 149.13 },
  Batteryville: { city: 'Adelaide', state: 'SA', latitude: -34.9285, longitude: 138.6007 },
  'The Roads': { city: 'Alice Springs', state: 'NT', latitude: -23.698, longitude: 133.8807 },
  Nightshade: { city: 'Perth', state: 'WA', latitude: -31.9523, longitude: 115.8613 },
  'The Forest': { city: 'Hobart', state: 'TAS', latitude: -42.8821, longitude: 147.3272 },
};

function roundWeatherMetric(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Number(value.toFixed(1));
}

export function resolveWeatherSummary({ rainMm, weatherCode, windSpeedKph, temperatureC }) {
  if ((rainMm ?? 0) >= HEAVY_RAIN_MM || HEAVY_RAIN_CODES.has(weatherCode ?? -1)) return 'Heavy rain';
  if ((rainMm ?? 0) > 0) return 'Rain';
  if ((windSpeedKph ?? 0) >= STRONG_WIND_KPH) return 'Strong wind';
  if ((temperatureC ?? 0) >= HEATWAVE_TEMP_C) return 'Heatwave';
  return 'Clear';
}

export function buildWeatherAccessRule(district, city, summary) {
  if (summary !== 'Heavy rain') return null;
  return {
    requiredBoardType: 'Mountain',
    reason: `Heavy rain over ${city} has turned ${district} into Mountain-board-only territory.`,
    source: 'heavy-rain',
  };
}

export function buildFallbackDistrictWeatherPayload() {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    stale: true,
    source: 'fallback',
    districts: Object.entries(DISTRICT_WEATHER_LOCATIONS).map(([district, location]) => ({
      district,
      city: location.city,
      state: location.state,
      summary: 'Weather uplink offline',
      temperatureC: null,
      windSpeedKph: null,
      rainMm: null,
      weatherCode: null,
      updatedAt: generatedAt,
      accessRule: null,
    })),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Batches all district locations into a single open-meteo request.
// open-meteo supports comma-separated latitude/longitude values and returns an
// array of results in the same order.  One request instead of eight eliminates
// the per-district rate-limit pressure that caused repeated 429 failures.
async function fetchAllDistrictWeatherSnapshots() {
  const districtEntries = Object.entries(DISTRICT_WEATHER_LOCATIONS);
  const latitudes = districtEntries.map(([, loc]) => loc.latitude).join(',');
  const longitudes = districtEntries.map(([, loc]) => loc.longitude).join(',');

  const url = new URL(WEATHER_URL);
  url.searchParams.set('latitude', latitudes);
  url.searchParams.set('longitude', longitudes);
  url.searchParams.set('current', 'temperature_2m,rain,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'Australia/Sydney');
  url.searchParams.set('forecast_days', '1');

  let lastError = new Error('Weather upstream rate limited.');
  for (let attempt = 0; attempt < WEATHER_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const jitter = Math.random() * WEATHER_RETRY_BASE_DELAY_MS;
      await sleep(WEATHER_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) + jitter);
    }
    const upstream = await fetch(url);
    if (upstream.status === 429) {
      const retryAfterSecs = Number(upstream.headers.get('retry-after') ?? 0);
      const baseDelay = retryAfterSecs > 0
        ? retryAfterSecs * 1000
        : WEATHER_RETRY_BASE_DELAY_MS * 2 ** attempt;
      const jitter = Math.random() * WEATHER_RETRY_BASE_DELAY_MS;
      lastError = new Error(`Weather upstream rate limited (attempt ${attempt + 1}).`);
      await sleep(baseDelay + jitter);
      continue;
    }
    if (!upstream.ok) {
      throw new Error(`Weather upstream batch failed with ${upstream.status}.`);
    }

    const data = await upstream.json();
    if (!Array.isArray(data) || data.length !== districtEntries.length) {
      throw new Error(`Weather upstream returned unexpected response shape.`);
    }
    const results = data;
    const updatedAt = new Date().toISOString();

    return districtEntries.map(([district, location], i) => {
      const current = results[i]?.current ?? null;
      if (!current) {
        return {
          district,
          city: location.city,
          state: location.state,
          summary: 'Weather uplink offline',
          temperatureC: null,
          windSpeedKph: null,
          rainMm: null,
          weatherCode: null,
          updatedAt,
          accessRule: null,
          source: 'fallback',
        };
      }
      const temperatureC = roundWeatherMetric(current.temperature_2m);
      const windSpeedKph = roundWeatherMetric(current.wind_speed_10m);
      const rainMm = roundWeatherMetric(current.rain);
      const weatherCode = typeof current.weather_code === 'number' ? current.weather_code : null;
      const summary = resolveWeatherSummary({ rainMm, weatherCode, windSpeedKph, temperatureC });
      return {
        district,
        city: location.city,
        state: location.state,
        summary,
        temperatureC,
        windSpeedKph,
        rainMm,
        weatherCode,
        updatedAt,
        accessRule: buildWeatherAccessRule(district, location.city, summary),
      };
    });
  }
  throw lastError;
}

async function buildDistrictWeatherPayload() {
  const districts = await fetchAllDistrictWeatherSnapshots();
  const stale = districts.some((d) => d.source === 'fallback');
  return {
    generatedAt: new Date().toISOString(),
    stale,
    source: stale ? 'partial-live' : 'live',
    districts,
  };
}

export function createDistrictWeatherService() {
  let districtWeatherCache = {
    payload: null,
    fetchedAt: 0,
  };
  // Deduplicates concurrent cache-miss requests: if a fetch is already in
  // progress, all subsequent callers await the same Promise instead of each
  // making their own upstream request (which would trigger rate limiting).
  let inFlightFetch = null;

  async function getDistrictWeatherPayload() {
    const now = Date.now();
    const hasFreshCache =
      districtWeatherCache.payload &&
      now - districtWeatherCache.fetchedAt < WEATHER_CACHE_TTL_MS;

    if (hasFreshCache) {
      return {
        ...districtWeatherCache.payload,
        stale: false,
        source: districtWeatherCache.payload.source === 'fallback' ? 'fallback' : 'cache',
      };
    }

    if (inFlightFetch) {
      return inFlightFetch;
    }

    inFlightFetch = buildDistrictWeatherPayload()
      .then((payload) => {
        districtWeatherCache = { payload, fetchedAt: Date.now() };
        return payload;
      })
      .catch((err) => {
        console.error('District weather refresh failed:', err);

        if (districtWeatherCache.payload) {
          return {
            ...districtWeatherCache.payload,
            stale: true,
            source: districtWeatherCache.payload.source === 'fallback' ? 'fallback' : 'cache',
          };
        }

        const fallback = buildFallbackDistrictWeatherPayload();
        districtWeatherCache = { payload: fallback, fetchedAt: Date.now() };
        return fallback;
      })
      .finally(() => {
        inFlightFetch = null;
      });

    return inFlightFetch;
  }

  return {
    getDistrictWeatherPayload,
  };
}

export function registerWeatherRoutes(app, { weatherRateLimit, districtWeatherService = createDistrictWeatherService() }) {
  const { getDistrictWeatherPayload } = districtWeatherService;

  app.get('/api/district-weather', weatherRateLimit, async (_req, res) => {
    const payload = await getDistrictWeatherPayload();
    res.json(payload);
  });
}
