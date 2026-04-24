/**
 * GET /api/auth/me
 *
 * Returns the currently authenticated user's public profile.
 * Requires a valid JWT in the rtps_auth_token cookie.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@server/lib/db";
import { users } from "@/drizzle/schema";
import { verifyToken, AUTH_COOKIE_NAME } from "@server/lib/auth";
import { eq } from "drizzle-orm";
import { parse } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cookieHeader = req.headers.cookie ?? "";
  const cookies = parse(cookieHeader);
  const token = cookies[AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = await verifyToken(token);

    const user = await db.query.users.findFirst({
      where: eq(users.id, payload.sub),
      columns: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    return res.status(200).json({ user });
  } catch {
    // JWT verification failure (expired, tampered, etc.)
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
