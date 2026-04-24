/**
 * GET  /api/auth/me  – return the current authenticated user
 * POST /api/auth/me  – logout (clears the auth cookie)
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { extractToken, verifyToken, clearAuthCookie } from "@server/lib/auth";
import { db } from "@server/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "POST") {
    // Logout – clear the cookie
    res.setHeader("Set-Cookie", clearAuthCookie());
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = extractToken(
    req.headers as Record<string, string | string[] | undefined>
  );

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = await verifyToken(token);

    // Optionally re-fetch from DB to get the latest role / status
    const user = await db.query.users.findFirst({
      where: eq(users.userId, payload.sub),
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    return res.status(200).json({
      userId: user.userId,
      email: user.email,
      role: user.role,
      accountId: user.accountId ?? null,
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
