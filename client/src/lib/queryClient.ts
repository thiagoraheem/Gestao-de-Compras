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

export async function apiRequest(
  url: string,
  options: {
    method: string;
    body?: unknown;
  },
): Promise<Response> {
  const { method, body } = options;
  const isFormData = body instanceof FormData;
  
  const res = await fetch(url, {
    method,
    headers: isFormData ? {} : body ? { "Content-Type": "application/json" } : {},
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
