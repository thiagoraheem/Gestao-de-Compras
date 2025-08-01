import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;

    try {
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } else {
        const text = await res.text();
        errorMessage = text || errorMessage;
      }
    } catch {
      // If parsing fails, use statusText
    }

    const error = new Error(errorMessage);
    (error as any).status = res.status;
    (error as any).response = { data: { message: errorMessage } };
    throw error;
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
  async ({ queryKey }) => {
    try {
      const response = await apiRequest(queryKey[0] as string);
      return response;
    } catch (error: any) {
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
      refetchOnWindowFocus: true, // Enable refetch on window focus for better UX
      staleTime: 0, // Data is immediately stale - forces fresh fetches
      cacheTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
      refetchOnMount: true, // Always refetch when component mounts
      retry: 1, // One retry attempt
    },
    mutations: {
      retry: false,
    },
  },
});