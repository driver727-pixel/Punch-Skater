import { useEffect, useState } from "react";

interface NetworkInformationLike extends EventTarget {
  saveData?: boolean;
}

interface NavigatorWithRuntimeCapabilities extends Navigator {
  connection?: NetworkInformationLike;
  deviceMemory?: number;
}

export interface RuntimeProfile {
  prefersReducedMotion: boolean;
  reduceEffects: boolean;
}

function matches(query: string) {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(query).matches;
}

export function getRuntimeProfile(): RuntimeProfile {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { prefersReducedMotion: false, reduceEffects: false };
  }

  const runtimeNavigator = navigator as NavigatorWithRuntimeCapabilities;
  const prefersReducedMotion = matches("(prefers-reduced-motion: reduce)");
  const prefersReducedData = matches("(prefers-reduced-data: reduce)");
  const hasConstrainedMemory = typeof runtimeNavigator.deviceMemory === "number"
    && runtimeNavigator.deviceMemory <= 2;
  const hasConstrainedCpu = typeof runtimeNavigator.hardwareConcurrency === "number"
    && runtimeNavigator.hardwareConcurrency <= 2;

  return {
    prefersReducedMotion,
    reduceEffects: prefersReducedMotion
      || prefersReducedData
      || runtimeNavigator.connection?.saveData === true
      || hasConstrainedMemory
      || hasConstrainedCpu,
  };
}

export function useRuntimeProfile() {
  const [profile, setProfile] = useState<RuntimeProfile>(getRuntimeProfile);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reducedData = window.matchMedia?.("(prefers-reduced-data: reduce)");
    const connection = (navigator as NavigatorWithRuntimeCapabilities).connection;
    const refresh = () => setProfile(getRuntimeProfile());

    refresh();
    reducedMotion?.addEventListener("change", refresh);
    reducedData?.addEventListener("change", refresh);
    connection?.addEventListener("change", refresh);

    return () => {
      reducedMotion?.removeEventListener("change", refresh);
      reducedData?.removeEventListener("change", refresh);
      connection?.removeEventListener("change", refresh);
    };
  }, []);

  return profile;
}
