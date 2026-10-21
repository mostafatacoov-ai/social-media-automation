import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Shared helpers for API route handlers.

export const ACTIVE_COMPANY_COOKIE = "ss_company";

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Unauthorized");
  return user;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  console.error("[api]", e);
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function getActiveCompanyId(): Promise<string | null> {
  const store = await cookies();
  const id = store.get(ACTIVE_COMPANY_COOKIE)?.value;
  if (id) {
    const company = await prisma.company.findUnique({ where: { id } });
    if (company) return company.id;
  }
  const first = await prisma.company.findFirst({ orderBy: { createdAt: "asc" } });
  return first?.id ?? null;
}

export async function setActiveCompanyId(id: string) {
  const store = await cookies();
  store.set(ACTIVE_COMPANY_COOKIE, id, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function parseJsonBody<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}
