import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  REALTIME_CONSTANTS,
  type RealtimeEventMessage,
} from "@/lib/realtimeClient";

const RELEVANT_PURCHASE_REQUEST_EVENTS = new Set([
  REALTIME_CONSTANTS.EVENTS.CREATED,
  REALTIME_CONSTANTS.EVENTS.UPDATED,
  REALTIME_CONSTANTS.EVENTS.PHASE_CHANGED,
]);

export function RealtimeSyncProvider() {
  const queryClient = useQueryClient();

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

        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            if (typeof key !== "string") {
              return false;
            }
            return key.startsWith("/api/purchase-requests");
          },
        });
    },
    [queryClient],
  );

  useRealtimeSubscription(
    REALTIME_CONSTANTS.CHANNELS.PURCHASE_REQUESTS,
    handlePurchaseRequestEvent,
  );

  return null;
}
