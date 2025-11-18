import { useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  REALTIME_CONSTANTS,
  type RealtimeEventMessage,
} from "@/lib/realtimeClient";
import { updateManager } from "@/lib/updateManager";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";

const RELEVANT_PURCHASE_REQUEST_EVENTS = new Set([
  REALTIME_CONSTANTS.EVENTS.CREATED,
  REALTIME_CONSTANTS.EVENTS.UPDATED,
  REALTIME_CONSTANTS.EVENTS.PHASE_CHANGED,
]);

export function RealtimeSyncProvider() {
  const queryClient = useQueryClient();
  const status = useRealtimeStatus();

  const handlePurchaseRequestEvent = useCallback(
    (event: RealtimeEventMessage) => {
      if (!event?.event) {
        return;
      }

      if (!event.channel || event.channel !== REALTIME_CONSTANTS.CHANNELS.PURCHASE_REQUESTS) {
        return;
      }

      if (!RELEVANT_PURCHASE_REQUEST_EVENTS.has(event.event)) {
        return;
      }
      updateManager.start();
      updateManager.process(event);
    },
    [queryClient],
  );

  useRealtimeSubscription(
    REALTIME_CONSTANTS.CHANNELS.PURCHASE_REQUESTS,
    handlePurchaseRequestEvent,
  );

  useEffect(() => {
    const active = status === "offline" || status === "reconnecting";
    updateManager.setFallback(active);
  }, [status]);

  return null;
}
