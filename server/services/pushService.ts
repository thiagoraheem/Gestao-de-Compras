import webpush from "web-push";
import { db } from "../db";
import { pushSubscriptions } from "@shared/schema";
import { and, eq } from "drizzle-orm";

type Subscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export function configureVapid(publicKey: string, privateKey: string, subject?: string) {
  webpush.setVapidDetails(subject || "mailto:admin@example.com", publicKey, privateKey);
}

export async function saveSubscription(userId: number, sub: Subscription) {
  const existing = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, sub.endpoint));
  if (existing.length === 0) {
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    });
  }
}

export async function getUserSubscriptions(userId: number) {
  return await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

export async function pushApprovalsUpdate(userId: number, payload: { total: number; a1: number; a2: number }) {
  const subs = await getUserSubscriptions(userId);
  const notif = {
    type: "approvals_update",
    total: payload.total,
    a1: payload.a1,
    a2: payload.a2,
  } as any;
  const body = JSON.stringify(notif);
  const results: { endpoint: string; ok: boolean; status?: number }[] = [];
  for (const s of subs) {
    try {
      const r = await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
      results.push({ endpoint: s.endpoint, ok: true, status: (r as any).statusCode });
    } catch (e: any) {
      results.push({ endpoint: s.endpoint, ok: false, status: e?.statusCode });
    }
  }
  return results;
}