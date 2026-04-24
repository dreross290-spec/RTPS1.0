/**
 * POST /api/auth/login
 *
 * Authenticates a user with email + password, issues a JWT in an httpOnly
 * cookie, and returns the public user object.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@server/lib/db";
import { users } from "@/drizzle/schema";
import {
  verifyPassword,
  signToken,
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
} from "@server/lib/auth";
import { eq } from "drizzle-orm";
import { serialize } from "cookie";

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
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password } = parsed.data;

  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    // Use a constant-time comparison to prevent user enumeration.
    // This is a valid bcrypt hash of "dummy" with cost 12 to ensure
    // bcrypt.compare always runs the full work factor.
    if (!user) {
      await verifyPassword(password, "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeuQY9.rRAn.TZ6Ai");
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordValid = await verifyPassword(password, user.hashedPassword);
    if (!passwordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    res.setHeader(
      "Set-Cookie",
      serialize(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS)
    );

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
