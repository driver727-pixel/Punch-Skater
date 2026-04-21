const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';
const WEATHER_CACHE_TTL_MS = 15 * 60 * 1000;
const WEATHER_RETRY_ATTEMPTS = 3;
const WEATHER_RETRY_BASE_DELAY_MS = 1000;
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

function resolveWeatherSummary({ rainMm, weatherCode, windSpeedKph, temperatureC }) {
  if ((rainMm ?? 0) >= HEAVY_RAIN_MM || HEAVY_RAIN_CODES.has(weatherCode ?? -1)) return 'Heavy rain';
  if ((rainMm ?? 0) > 0) return 'Rain';
  if ((windSpeedKph ?? 0) >= STRONG_WIND_KPH) return 'Strong wind';
  if ((temperatureC ?? 0) >= HEATWAVE_TEMP_C) return 'Heatwave';
  return 'Clear';
}

function buildWeatherAccessRule(district, city, summary) {
  if (summary !== 'Heavy rain') return null;
  return {
    requiredBoardType: 'Mountain',
    reason: `Heavy rain over ${city} has turned ${district} into Mountain-board-only territory.`,
    source: 'heavy-rain',
  };
}

function buildFallbackDistrictWeatherPayload() {
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

async function fetchDistrictWeatherSnapshot(district, location) {
  const url = new URL(WEATHER_URL);
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('current', 'temperature_2m,rain,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'Australia/Sydney');
  url.searchParams.set('forecast_days', '1');

  let lastError = new Error(`Weather upstream rate limited for ${district}.`);
  for (let attempt = 0; attempt < WEATHER_RETRY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(WEATHER_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
    const upstream = await fetch(url);
    if (upstream.status === 429) {
      lastError = new Error(`Weather upstream rate limited for ${district} (attempt ${attempt + 1}).`);
      continue;
    }
    if (!upstream.ok) {
      throw new Error(`Weather upstream failed for ${district} with ${upstream.status}.`);
    }

    const data = await upstream.json();
    const current = data?.current ?? {};
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
      updatedAt: new Date().toISOString(),
      accessRule: buildWeatherAccessRule(district, location.city, summary),
    };
  }
  throw lastError;
}

async function buildDistrictWeatherPayload() {
  const districtEntries = Object.entries(DISTRICT_WEATHER_LOCATIONS);
  const districtFetchResults = await Promise.all(
    districtEntries.map(async ([district, location]) => {
      try {
        const snapshot = await fetchDistrictWeatherSnapshot(district, location);
        return { status: 'fulfilled', district, location, snapshot };
      } catch (error) {
        return { status: 'rejected', district, location, error };
      }
    }),
  );
  const fallbackGeneratedAt = new Date().toISOString();
  const districts = districtFetchResults.map((result) => {
    if (result.status === 'fulfilled') {
      return result.snapshot;
    }
    const { district, location } = result;
    console.error(`District weather refresh failed for ${district}:`, result.error);
    return {
      district,
      city: location.city,
      state: location.state,
      summary: 'Weather uplink offline',
      temperatureC: null,
      windSpeedKph: null,
      rainMm: null,
      weatherCode: null,
      updatedAt: fallbackGeneratedAt,
      accessRule: null,
      source: 'fallback',
    };
  });
  const stale = districtFetchResults.some((result) => result.status === 'rejected');

  return {
    generatedAt: new Date().toISOString(),
    stale,
    source: stale ? 'partial-live' : 'live',
    districts,
  };
}

export function registerWeatherRoutes(app, { weatherRateLimit }) {
  let districtWeatherCache = {
    payload: null,
    fetchedAt: 0,
  };

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

    try {
      const payload = await buildDistrictWeatherPayload();
      districtWeatherCache = { payload, fetchedAt: now };
      return payload;
    } catch (err) {
      console.error('District weather refresh failed:', err);

      if (districtWeatherCache.payload) {
        return {
          ...districtWeatherCache.payload,
          stale: true,
          source: districtWeatherCache.payload.source === 'fallback' ? 'fallback' : 'cache',
        };
      }

      const fallback = buildFallbackDistrictWeatherPayload();
      districtWeatherCache = { payload: fallback, fetchedAt: now };
      return fallback;
    }
  }

  app.get('/api/district-weather', weatherRateLimit, async (_req, res) => {
    const payload = await getDistrictWeatherPayload();
    res.json(payload);
  });
}
