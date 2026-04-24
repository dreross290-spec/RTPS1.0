import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/server/lib/db";
import { authAuditLogs } from "@/drizzle/schema";
import {
  verifyToken,
  extractTokenFromCookieHeader,
  clearTokenCookie,
} from "@/server/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = extractTokenFromCookieHeader(req.headers.cookie);

  if (token) {
    try {
      const payload = await verifyToken(token);
      await db.insert(authAuditLogs).values({
        userId: payload.sub,
        email: payload.email ?? null,
        event: "logout",
        ipAddress:
          (req.headers["x-forwarded-for"] as string | undefined)
            ?.split(",")[0]
            ?.trim() ?? req.socket.remoteAddress ?? null,
        userAgent: req.headers["user-agent"] ?? null,
      });
    } catch {
      // Token already invalid — still clear the cookie
    }
  }

  res.setHeader("Set-Cookie", clearTokenCookie());
  return res.status(200).json({ success: true });
}
