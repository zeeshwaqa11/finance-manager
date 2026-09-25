import { useCallback, useEffect, useState } from 'react';

export function useApi(fetcher, deps = [], { keepPrevious = false } = {}) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key, data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetcher().then(
      (data) => !cancelled && setState({ key, data, error: null, loading: false }),
      (error) => !cancelled && setState({ key, data: null, error, loading: false }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  const fresh = state.key === key;
  return {
    data: fresh || keepPrevious ? state.data : null,
    error: fresh ? state.error : null,
    loading: fresh ? state.loading : true,
    reload,
  };
}
