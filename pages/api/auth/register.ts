/**
 * POST /api/auth/register
 *
 * Registers a new user (admin or staff).
 * Hashes password with bcrypt, stores in the users table,
 * and returns a signed JWT in an HttpOnly cookie.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@server/lib/db";
import { users } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  hashPassword,
  signToken,
  buildAuthCookie,
  extractClientIP,
  type TokenPayload,
} from "@server/lib/auth";
import { logAction } from "@/server/_core/account-hub/audit-logger";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  role: z.enum(["admin", "staff"]).default("staff"),
  accountId: z.string().uuid("Invalid account ID").optional(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const { email, password, role, accountId = null } = parsed.data;

  try {
    // Check for existing user
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        role,
        accountId: accountId ?? undefined,
      })
      .returning({
        userId: users.userId,
        email: users.email,
        role: users.role,
        accountId: users.accountId,
      });

    if (!user) {
      throw new Error("User insert did not return a row");
    }

    // Audit log
    if (accountId) {
      await logAction({
        accountId,
        userId: user.userId,
        action: "auth.register",
        entityType: "user",
        entityId: user.userId,
        ipAddress: extractClientIP(
          req.headers as Record<string, string | string[] | undefined>,
          req.socket.remoteAddress
        ),
      }).catch(() => {
        /* non-blocking */
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
    return res.status(201).json({
      userId: user.userId,
      email: user.email,
      role: user.role,
      accountId: user.accountId ?? null,
    });
  } catch (err) {
    console.error("[auth/register]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
