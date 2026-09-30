import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data from the API with honest loading, error and empty states.
 *
 * Several pages previously swallowed failures and fell back to invented
 * placeholder values, so a broken request looked exactly like real data. This
 * hook keeps the failure visible so a page can say what went wrong instead of
 * showing zeros that read as a genuine result.
 *
 * @param {() => Promise<any>} loader
 * @param {Array} deps        values that should trigger a reload when they change
 * @param {{enabled?: boolean}} [options]
 */
export function useApiData(loader, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);

  // Held in a ref so a loader that is recreated on every render does not put the
  // reload effect into an endless loop. It is refreshed before the loading
  // effect below runs, because effects execute in declaration order.
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await loaderRef.current();
      setData(result);
    } catch (caught) {
      setError(caught.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;

    loaderRef
      .current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((caught) => {
        if (active) setError(caught.message || 'Something went wrong.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refresh: run, setData };
}

/**
 * Tracks a one-off form submission so a page can show progress, a specific
 * failure, and whether it succeeded without duplicating that state by hand.
 */
export function useSubmit(action) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const actionRef = useRef(action);

  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  const submit = useCallback(async (...args) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await actionRef.current(...args);
      setSuccess(result);
      return result;
    } catch (caught) {
      setError(caught.message || 'Something went wrong.');
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return { submit, submitting, error, success, reset };
}

export default useApiData;
