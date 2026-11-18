import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ProviderInfo, SystemInfo, SystemStats } from '../lib/types';

export interface UseSystemInfoResult {
  info: SystemInfo | null;
  stats: SystemStats | null;
  providers: ProviderInfo[];
  online: boolean;
  refresh: () => Promise<void>;
}

export function useSystemInfo(): UseSystemInfoResult {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [nextInfo, nextStats, nextProviders] = await Promise.all([
        api.system.info(),
        api.system.stats(),
        api.ai.providers(),
      ]);
      setInfo(nextInfo);
      setStats(nextStats);
      setProviders(nextProviders);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { info, stats, providers, online, refresh };
}
