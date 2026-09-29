import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = z.object({ aiEnabled: z.boolean().nullable() }).parse(await request.json());
  const repository = await prisma.repository.update({ where: { id }, data: body });
  return NextResponse.json(repository);
}
