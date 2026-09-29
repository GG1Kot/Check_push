import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";

const Schema = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) });

export async function POST(request: Request) {
  const sub = Schema.parse(await request.json());
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: request.headers.get("user-agent") },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: request.headers.get("user-agent") },
  });
  return NextResponse.json({ ok: true });
}
