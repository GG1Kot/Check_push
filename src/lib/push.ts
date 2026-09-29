import webpush from "web-push";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export async function sendPush(payload: { title: string; body: string; url: string; tag?: string }) {
  if (!env.vapidPublicKey || !env.vapidPrivateKey || !env.vapidSubject) return { sent: 0, skipped: true };
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
  const subscriptions = await prisma.pushSubscription.findMany();
  let sent = 0;
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (error: any) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => undefined);
      } else {
        console.error("Push failed", error);
      }
    }
  }));
  return { sent, skipped: false };
}
