// Generic data hook mirroring the app's load pattern:
//   1. call the API
//   2. on success persist to the offline cache
//   3. on failure fall back to the cache (fromCache = true)
import { useCallback, useEffect, useRef, useState } from 'react';
import { extractPayload } from '../api/client.js';
import { describeApiError } from '../api/errors.js';

export function useApi(fetcher, options = {}) {
  const {
    deps = [],
    enabled = true,
    cache = null,
    parse = extractPayload,
    transform = null,
    initial = null,
  } = options;

  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  const runId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const parseRef = useRef(parse);
  parseRef.current = parse;
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const cacheRef = useRef(cache);
  cacheRef.current = cache;

  const load = useCallback(async ({ silent = false } = {}) => {
    const id = runId.current + 1;
    runId.current = id;

    if (!silent) setLoading(true);
    setError(null);

    try {
      const response = await fetcherRef.current();
      if (id !== runId.current) return;
      let next = parseRef.current(response);
      if (transformRef.current) next = transformRef.current(next);
      setData(next);
      setFromCache(false);
      if (cacheRef.current?.write && next != null) {
        try {
          cacheRef.current.write(next);
        } catch {
          /* cache persistence is best-effort */
        }
      }
    } catch (err) {
      if (id !== runId.current) return;
      let cached = null;
      if (cacheRef.current?.read) {
        try {
          cached = cacheRef.current.read();
        } catch {
          cached = null;
        }
      }
      const hasCached = Array.isArray(cached) ? cached.length > 0 : cached != null;
      if (hasCached) {
        let next = cached;
        if (transformRef.current) next = transformRef.current(next);
        setData(next);
        setFromCache(true);
      } else {
        setError(describeApiError(err));
      }
    } finally {
      if (id === runId.current) setLoading(false);
    }
  }, []);

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    load();
    return () => {
      // Invalidate in-flight requests on deps change / unmount.
      runId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, depsKey, load]);

  const refresh = useCallback(() => load(), [load]);
  const silentRefresh = useCallback(() => load({ silent: true }), [load]);

  return {
    data,
    setData,
    loading,
    error,
    fromCache,
    refresh,
    silentRefresh,
  };
}
