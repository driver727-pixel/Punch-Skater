import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { District, Rarity } from "../../lib/types";
import { generateImage, getImageDimensions, type ImageGenOptions } from "../../services/imageGen";
import { getCachedImage, setCachedImage } from "../../services/imageCache";
import { getStaticBackgroundUrl, getStaticFrameUrl } from "../../services/staticAssets";

export type ForgeLayer = "background" | "character" | "frame";

export interface LayerState {
  backgroundUrl?: string;
  characterUrl?: string;
  frameUrl?: string;
  loading: Record<ForgeLayer, boolean>;
  errors: string[];
}

export interface LayerGenParams {
  key: string;
  prompt: string;
  seed?: string;
  attempts?: Array<{ seed: string; generationOptions?: ImageGenOptions }>;
  postProcess?: (url: string) => Promise<string>;
  validateResult?: (url: string) => Promise<void>;
  generationOptions?: ImageGenOptions;
}

const INITIAL_LAYER_STATE: LayerState = {
  loading: { background: false, character: false, frame: false },
  errors: [],
};

const MAX_LAYER_RETRIES = 1;

function toFileSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-");
}

export function createCharacterLayerValidator(minDimensions: { width: number; height: number }) {
  return async (url: string) => {
    const { width, height } = await getImageDimensions(url);
    if (width < minDimensions.width || height < minDimensions.height) {
      throw new Error(
        `Character layer dimensions ${width}×${height} are below the minimum ${minDimensions.width}×${minDimensions.height}.`,
      );
    }
  };
}

export function useForgeLayers() {
  const [layers, setLayers] = useState<LayerState>(INITIAL_LAYER_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const retryCountRef = useRef<Record<ForgeLayer, number>>({
    background: 0,
    character: 0,
    frame: 0,
  });
  const layerParamsRef = useRef<Record<ForgeLayer, LayerGenParams | null>>({
    background: null,
    character: null,
    frame: null,
  });

  useEffect(() => () => abortRef.current?.abort(), []);

  const abortGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const replaceAbortController = useCallback(() => {
    abortGeneration();
    const controller = new AbortController();
    abortRef.current = controller;
    return controller;
  }, [abortGeneration]);

  const generateLayer = useCallback(
    async (
      layer: ForgeLayer,
      cacheKey: string,
      prompt: string,
      seed: string | undefined,
      signal: AbortSignal,
      postProcess?: (url: string) => Promise<string>,
      validateResult?: (url: string) => Promise<void>,
      generationOptions?: ImageGenOptions,
      attempts?: Array<{ seed: string; generationOptions?: ImageGenOptions }>,
      skipCache = false,
    ) => {
      setLayers((current) => ({ ...current, loading: { ...current.loading, [layer]: true } }));
      try {
        if (!skipCache) {
          const staticUrl =
            layer === "background"
              ? getStaticBackgroundUrl(seed as District)
              : layer === "frame"
                ? getStaticFrameUrl(seed as Rarity)
                : null;

          if (staticUrl) {
            if (signal.aborted) return;
            const urlKey = `${layer}Url` as const;
            setLayers((current) => ({
              ...current,
              [urlKey]: staticUrl,
              loading: { ...current.loading, [layer]: false },
            }));
            return;
          }

          const cached = await getCachedImage(cacheKey);
          if (signal.aborted) return;
          if (cached) {
            const urlKey = `${layer}Url` as const;
            setLayers((current) => ({
              ...current,
              [urlKey]: cached,
              loading: { ...current.loading, [layer]: false },
            }));
            return;
          }
        }

        const seedAttempts = attempts?.length
          ? attempts
          : seed
            ? [{ seed, generationOptions }]
            : [];

        if (seedAttempts.length === 0) {
          throw new Error(`No generation seed configured for ${layer} layer.`);
        }

        let finalUrl: string | null = null;
        let lastGenerationError: unknown = null;

        for (const attempt of seedAttempts) {
          try {
            const result = await generateImage(prompt, attempt.seed, attempt.generationOptions ?? generationOptions);
            if (signal.aborted) return;

            let candidateUrl = result.imageUrl;
            if (postProcess) {
              candidateUrl = await postProcess(candidateUrl);
              if (signal.aborted) return;
            }
            if (validateResult) {
              await validateResult(candidateUrl);
              if (signal.aborted) return;
            }

            finalUrl = candidateUrl;
            break;
          } catch (error) {
            lastGenerationError = error;
          }
        }

        if (!finalUrl) {
          throw lastGenerationError ?? new Error(`Failed to generate ${layer} layer.`);
        }

        if (layer === "background") {
          console.info(`[StaticAsset] Generated background for ${seed}: ${finalUrl}`);
          console.info(`  → Download and save to public/assets/backgrounds/${toFileSlug(seed ?? "background")}.jpg`);
          console.info(`  → Then register it in src/services/staticAssets.ts`);
        } else if (layer === "frame") {
          console.info(`[StaticAsset] Generated frame for ${seed}: ${finalUrl}`);
          console.info(`  → Download and save to public/assets/frames/${toFileSlug(seed ?? "frame")}.webp`);
          console.info(`  → Then register it in src/services/staticAssets.ts`);
        }

        await setCachedImage(cacheKey, finalUrl, { prompt, layer, seed });
        const urlKey = `${layer}Url` as const;
        setLayers((current) => ({
          ...current,
          [urlKey]: finalUrl,
          loading: { ...current.loading, [layer]: false },
        }));
      } catch (error) {
        if (signal.aborted) return;
        const message = error instanceof Error ? error.message : String(error);
        setLayers((current) => ({
          ...current,
          loading: { ...current.loading, [layer]: false },
          errors: [...current.errors, `${layer}: ${message}`],
        }));
      }
    },
    [],
  );

  const handleLayerError = useCallback((layer: ForgeLayer) => {
    const params = layerParamsRef.current[layer];
    if (!params || retryCountRef.current[layer] >= MAX_LAYER_RETRIES) return;

    retryCountRef.current[layer] += 1;
    setLayers((current) => ({
      ...current,
      [`${layer}Url`]: undefined,
      errors: current.errors.filter((error) => !error.startsWith(`${layer}:`)),
    }));

    const controller = new AbortController();
    abortRef.current = controller;
    void generateLayer(
      layer,
      params.key,
      params.prompt,
      params.seed,
      controller.signal,
      params.postProcess,
      params.validateResult,
      params.generationOptions,
      params.attempts,
      true,
    );
  }, [generateLayer]);

  const resetLayerSession = useCallback(() => {
    setLayers(INITIAL_LAYER_STATE);
    retryCountRef.current = { background: 0, character: 0, frame: 0 };
  }, []);

  const setLayerParams = useCallback((params: Record<ForgeLayer, LayerGenParams | null>) => {
    layerParamsRef.current = params;
  }, []);

  const isAnyLayerLoading = useMemo(
    () => layers.loading.background || layers.loading.character || layers.loading.frame,
    [layers.loading],
  );
  const hasAnyLayerUrl = useMemo(
    () => Boolean(layers.backgroundUrl || layers.characterUrl || layers.frameUrl),
    [layers.backgroundUrl, layers.characterUrl, layers.frameUrl],
  );

  return {
    abortGeneration,
    generateLayer,
    handleLayerError,
    hasAnyLayerUrl,
    isAnyLayerLoading,
    layers,
    replaceAbortController,
    resetLayerSession,
    setLayerParams,
    setLayers,
  };
}
