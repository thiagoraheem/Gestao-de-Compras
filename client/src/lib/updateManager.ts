import { queryClient } from "./queryClient";
import { REALTIME_CONSTANTS, type RealtimeEventMessage, realtimeClient } from "./realtimeClient";
import debug from "./debug";

type Priority = "urgent" | "routine";

type PurchaseChangePayload = {
  id?: number;
  currentPhase?: string;
  updatedAt?: string;
  changes?: Record<string, any> | null;
  request?: any;
  reason?: string;
};

function now() {
  return Date.now();
}

class Throttle {
  private last = 0;
  private timer: any = null;
  constructor(private intervalMs: number, private fn: () => void) {}
  run() {
    const elapsed = now() - this.last;
    if (elapsed >= this.intervalMs) {
      this.last = now();
      this.fn();
      return;
    }
    if (this.timer) return;
    const delay = this.intervalMs - elapsed;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.last = now();
      this.fn();
    }, Math.max(0, delay));
  }
}

class UpdateManager {
  private listInvalidateThrottle = new Throttle(500, () => {
    queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"], exact: true });
  });
  private fallbackTimer: any = null;
  private isFallbackActive = false;

  start() {
    realtimeClient.subscribe(REALTIME_CONSTANTS.CHANNELS.PURCHASE_REQUESTS, (ev) => this.handle(ev));
  }

  process(event: RealtimeEventMessage) {
    this.handle(event);
  }

  setFallback(active: boolean) {
    if (active && !this.isFallbackActive) {
      this.isFallbackActive = true;
      if (!this.fallbackTimer) {
        this.fallbackTimer = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"], exact: true });
        }, 60000);
      }
    } else if (!active && this.isFallbackActive) {
      this.isFallbackActive = false;
      if (this.fallbackTimer) {
        clearInterval(this.fallbackTimer);
        this.fallbackTimer = null;
      }
    }
  }

  private handle(ev: RealtimeEventMessage) {
    const prio: Priority = ev.event === REALTIME_CONSTANTS.EVENTS.PHASE_CHANGED ? "urgent" : "routine";
    const payload = (ev.payload || {}) as PurchaseChangePayload;
    try {
      if (ev.event === REALTIME_CONSTANTS.EVENTS.CREATED) {
        this.onCreated(payload, prio);
        return;
      }
      if (ev.event === REALTIME_CONSTANTS.EVENTS.UPDATED) {
        this.onUpdated(payload, prio);
        return;
      }
      if (ev.event === REALTIME_CONSTANTS.EVENTS.PHASE_CHANGED) {
        this.onPhaseChanged(payload, prio);
        return;
      }
    } catch (e) {
      debug.error("UpdateManager error", e);
    }
  }

  private onCreated(payload: PurchaseChangePayload, prio: Priority) {
    const req = payload.request;
    if (req && typeof req.id === "number") {
      const list = queryClient.getQueryData<any[]>(["/api/purchase-requests"]) || [];
      const exists = Array.isArray(list) && list.some((x) => x.id === req.id);
      if (!exists) {
        queryClient.setQueryData(["/api/purchase-requests"], [req, ...(Array.isArray(list) ? list : [])]);
      } else {
        queryClient.setQueryData(["/api/purchase-requests"], (old: any[]) => Array.isArray(old) ? old.map((x) => (x.id === req.id ? req : x)) : old);
      }
      return;
    }
    this.listInvalidate(prio);
  }

  private onUpdated(payload: PurchaseChangePayload, prio: Priority) {
    const id = payload.id;
    const changes = payload.changes || null;
    if (typeof id === "number" && changes) {
      queryClient.setQueryData(["/api/purchase-requests"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        return old.map((x) => (x.id === id ? { ...x, ...changes, updatedAt: payload.updatedAt ?? x.updatedAt } : x));
      });
      return;
    }
    this.listInvalidate(prio);
  }

  private onPhaseChanged(payload: PurchaseChangePayload, prio: Priority) {
    const id = payload.id;
    if (typeof id === "number" && payload.currentPhase) {
      queryClient.setQueryData(["/api/purchase-requests"], (old: any[]) => {
        if (!Array.isArray(old)) return old;
        return old.map((x) => (x.id === id ? { ...x, currentPhase: payload.currentPhase, updatedAt: payload.updatedAt ?? x.updatedAt } : x));
      });
      return;
    }
    this.listInvalidate(prio);
  }

  private listInvalidate(prio: Priority) {
    if (prio === "urgent") {
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-requests"], exact: true });
    } else {
      this.listInvalidateThrottle.run();
    }
  }
}

export const updateManager = new UpdateManager();