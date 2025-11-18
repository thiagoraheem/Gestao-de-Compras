import type { Express } from "express";
import { isAuthenticated } from "./middleware";
import { configureVapid, saveSubscription, pushApprovalsUpdate } from "../services/pushService";

export function registerNotificationRoutes(app: Express) {
  const pub = process.env.VAPID_PUBLIC_KEY ?? "";
  const priv = process.env.VAPID_PRIVATE_KEY ?? "";
  if (pub && priv) configureVapid(pub, priv, process.env.VAPID_SUBJECT);

  app.get("/api/notifications/vapid-public-key", isAuthenticated, async (_req, res) => {
    const key = process.env.VAPID_PUBLIC_KEY ?? "";
    res.json({ publicKey: key });
  });

  app.post("/api/notifications/subscribe", isAuthenticated, async (req, res) => {
    const userId = req.session.userId!;
    const sub = req.body;
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return res.status(400).json({ message: "Invalid subscription" });
    }
    await saveSubscription(userId, sub);
    res.json({ ok: true });
  });

  app.post("/api/approvals/push-refresh", isAuthenticated, async (req, res) => {
    const userId = req.session.userId!;
    const { total, a1, a2 } = req.body || {};
    if (typeof total !== "number") return res.status(400).json({ message: "Invalid payload" });
    const result = await pushApprovalsUpdate(userId, { total, a1: Number(a1 || 0), a2: Number(a2 || 0) });
    res.json({ sent: result.length });
  });
}