import { useEffect, useMemo, useState } from "react";
import { resolveApiUrl } from "../lib/apiUrls";
import {
  DISTRICT_WEATHER_REFRESH_MS,
  getDistrictWeatherMap,
  type DistrictWeatherResponse,
} from "../lib/districtWeather";

const DISTRICT_WEATHER_API_URL = resolveApiUrl(
  (import.meta.env.VITE_DISTRICT_WEATHER_API_URL as string | undefined)?.trim(),
  "/api/district-weather",
);
const DISTRICT_WEATHER_DEBOUNCE_MS = 250;

let cachedWeatherResponse: DistrictWeatherResponse | null = null;
let cachedWeatherFetchedAt = 0;
let inFlightWeatherRequest: Promise<DistrictWeatherResponse> | null = null;
let queuedWeatherRequest: Promise<DistrictWeatherResponse> | null = null;

function fetchDistrictWeather(): Promise<DistrictWeatherResponse> {
  inFlightWeatherRequest = fetch(DISTRICT_WEATHER_API_URL).then(async (response) => {
    if (!response.ok) {
      throw new Error(`District weather request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as DistrictWeatherResponse;
    cachedWeatherResponse = payload;
    cachedWeatherFetchedAt = Date.now();
    return payload;
  });

  return inFlightWeatherRequest.finally(() => {
    inFlightWeatherRequest = null;
  });
}

async function requestDistrictWeather(forceRefresh = false): Promise<DistrictWeatherResponse> {
  const now = Date.now();
  const hasFreshCache =
    !forceRefresh &&
    cachedWeatherResponse &&
    now - cachedWeatherFetchedAt < DISTRICT_WEATHER_REFRESH_MS;

  if (hasFreshCache) {
    return cachedWeatherResponse;
  }

  if (inFlightWeatherRequest) {
    return inFlightWeatherRequest;
  }

  if (!queuedWeatherRequest) {
    queuedWeatherRequest = new Promise((resolve, reject) => {
      window.setTimeout(() => {
        fetchDistrictWeather().then(resolve, reject);
      }, DISTRICT_WEATHER_DEBOUNCE_MS);
    }).finally(() => {
      queuedWeatherRequest = null;
    });
  }

  return queuedWeatherRequest;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "District weather uplink offline.";
}

export function useDistrictWeather(refreshMs = DISTRICT_WEATHER_REFRESH_MS) {
  const [weather, setWeather] = useState<DistrictWeatherResponse | null>(cachedWeatherResponse);
  const [loading, setLoading] = useState(!cachedWeatherResponse);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (forceRefresh = false) => {
      if (!cachedWeatherResponse) {
        setLoading(true);
      }

      try {
        const payload = await requestDistrictWeather(forceRefresh);
        if (cancelled) return;
        setWeather(payload);
        setError(null);
      } catch (nextError) {
        if (cancelled) return;
        setError(getErrorMessage(nextError));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    const intervalId = window.setInterval(() => {
      void load(true);
    }, refreshMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [refreshMs]);

  const weatherByDistrict = useMemo(() => getDistrictWeatherMap(weather), [weather]);

  return {
    weather,
    weatherByDistrict,
    loading,
    error,
  };
}
