/**
 * POST /api/auth/login
 *
 * Authenticates a user with email + password.
 * Returns a signed JWT in an HttpOnly cookie on success.
 * Logs the auth event to the audit table.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@server/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  signToken,
  buildAuthCookie,
  extractClientIP,
  type TokenPayload,
} from "@server/lib/auth";
import { logAction } from "@/server/_core/account-hub/audit-logger";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const { email, password } = parsed.data;
  const ip = extractClientIP(
    req.headers as Record<string, string | string[] | undefined>,
    req.socket.remoteAddress
  );

  // Placeholder hash used when no user is found – ensures constant-time
  // comparison to prevent user enumeration via timing attacks.
  const TIMING_ATTACK_PREVENTION_HASH =
    "$2a$12$invalidhashfortimingattackprevention";

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    const passwordHash = user?.passwordHash ?? TIMING_ATTACK_PREVENTION_HASH;
    const valid = await verifyPassword(password, passwordHash);

    if (!user || !valid) {
      // Audit failed attempt when we have a user to attribute it to
      if (user?.accountId) {
        await logAction({
          accountId: user.accountId,
          userId: user.userId,
          action: "auth.login.failed",
          entityType: "user",
          entityId: user.userId,
          ipAddress: ip,
        }).catch((err) => {
          console.error("[auth/login] audit-log failed:", err);
        });
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Audit successful login
    if (user.accountId) {
      await logAction({
        accountId: user.accountId,
        userId: user.userId,
        action: "auth.login.success",
        entityType: "user",
        entityId: user.userId,
        ipAddress: ip,
      }).catch((err) => {
        console.error("[auth/login] audit-log failed:", err);
      });
    }

    const payload: TokenPayload = {
      sub: user.userId,
      email: user.email,
      role: user.role as "admin" | "staff",
      accountId: user.accountId ?? null,
    };

    const token = await signToken(payload);

    res.setHeader("Set-Cookie", buildAuthCookie(token));
    return res.status(200).json({
      userId: user.userId,
      email: user.email,
      role: user.role,
      accountId: user.accountId ?? null,
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
