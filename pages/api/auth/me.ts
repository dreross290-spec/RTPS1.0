import type { NextApiRequest, NextApiResponse } from "next";
import { verifyToken, extractTokenFromCookieHeader } from "@/server/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = extractTokenFromCookieHeader(req.headers.cookie);

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = await verifyToken(token);
    return res.status(200).json({
      user: {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      },
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
