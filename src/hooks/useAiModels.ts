import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ModelInfo, ProviderId } from '../lib/types';

const cache = new Map<ProviderId, ModelInfo[]>();

export interface UseAiModelsResult {
  models: ModelInfo[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Fetch the models a provider exposes. Results are cached per provider for the
 * lifetime of the tab; `reload` forces a fresh request.
 */
export function useAiModels(provider: ProviderId, enabled: boolean): UseAiModelsResult {
  const [models, setModels] = useState<ModelInfo[]>(() => cache.get(provider) ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setModels([]);
      setError(null);
      return undefined;
    }

    const cached = cache.get(provider);
    if (cached) {
      setModels(cached);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    api.ai
      .models(provider)
      .then((list) => {
        cache.set(provider, list);
        if (!cancelled) setModels(list);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setModels([]);
        setError(cause instanceof Error ? cause.message : 'Could not list models');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provider, enabled, nonce]);

  const reload = useCallback(() => {
    cache.delete(provider);
    setNonce((value) => value + 1);
  }, [provider]);

  return { models, loading, error, reload };
}
