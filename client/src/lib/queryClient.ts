import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If we can't parse JSON, use the default message
    }
    throw new Error(errorMessage);
  }
}

// Sobrecarga para chamadas apenas com URL
export async function apiRequest(url: string): Promise<any>;
// Sobrecarga para chamadas com options
export async function apiRequest(
  url: string,
  options: {
    method: string;
    body?: unknown;
  }
): Promise<any>;
// Implementação
export async function apiRequest(
  url: string,
  options: {
    method: string;
    body?: unknown;
  } = { method: "GET" },
): Promise<any> {
  const { method, body } = options;
  const isFormData = body instanceof FormData;
  try {
    const w: any = window as any;
    w.__traffic = w.__traffic || { http: 0, ws: 0 };
    w.__traffic.http += 1;
  } catch {}
  const res = await fetch(url, {
    method,
    headers: isFormData ? {} : body ? { "Content-Type": "application/json" } : {},
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const errorData = await res.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch (parseError) {
      // If we can't parse JSON, use the default message
    }
    throw new Error(errorMessage);
  }
  return await res.json();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    try {
      const controller = new AbortController();
      
      // Link the query's abort signal to our controller
      if (signal) {
        signal.addEventListener('abort', () => controller.abort());
      }

      const response = await fetch(queryKey[0] as string, {
        credentials: "include",
        signal: controller.signal,
      });
      try {
        const w: any = window as any;
        w.__traffic = w.__traffic || { http: 0, ws: 0 };
        w.__traffic.http += 1;
      } catch {}

      if (!response.ok) {
        if (unauthorizedBehavior === "returnNull" && response.status === 401) {
          return null;
        }
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (parseError) {
          // If we can't parse JSON, use the default message
        }
        throw new Error(errorMessage);
      }
      
      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw error; // Let React Query handle aborted requests properly
      }
      if (unauthorizedBehavior === "returnNull" && error.status === 401) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false, // Disable to prevent unnecessary requests
      staleTime: 1000 * 60 * 2, // 2 minutes - reduce aggressive refetching
      gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes (renamed from cacheTime)
      refetchOnMount: false, // Only refetch if data is stale
      retry: (failureCount, error: any) => {
        // Don't retry on abort errors or 401/403
        if (error?.name === 'AbortError' || error?.status === 401 || error?.status === 403) {
          return false;
        }
        return failureCount < 1; // Only one retry attempt
      },
    },
    mutations: {
      retry: false,
    },
  },
});