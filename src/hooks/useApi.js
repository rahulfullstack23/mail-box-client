import { useCallback, useMemo } from "react";

const useApi = () => {
  const request = useCallback(async (url, options, config = {}) => {
    const { responseType = "json", getError } = config;
    const response = options ? await fetch(url, options) : await fetch(url);
    const data =
      responseType === "text" ? await response.text() : await response.json();

    if (!response.ok) {
      let errorData = data;
      if (responseType === "text") {
        try {
          errorData = data ? JSON.parse(data) : null;
        } catch {
          errorData = data;
        }
      }

      throw new Error(
        getError
          ? getError(errorData, response.status)
          : errorData?.error?.message || `Request failed (${response.status}).`,
      );
    }

    return data;
  }, []);

  return useMemo(() => ({ request }), [request]);
};

export default useApi;
