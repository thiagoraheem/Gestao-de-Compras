import { useEffect, useState } from "react";
import { realtimeClient, type RealtimeStatus } from "@/lib/realtimeClient";

export function useRealtimeStatus(): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>(() => realtimeClient.getStatus());

  useEffect(() => {
    const unsubscribe = realtimeClient.onStatusChange(setStatus);
    return () => {
      unsubscribe();
    };
  }, []);

  return status;
}
