/**
 * POST /api/auth/register
 *
 * Creates a new user account. Returns 201 with the user object on success.
 * Passwords are hashed with bcrypt; the plaintext is never stored.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@server/lib/db";
import { users } from "@/drizzle/schema";
import { hashPassword, signToken, AUTH_COOKIE_NAME, AUTH_COOKIE_OPTIONS } from "@server/lib/auth";
import { eq } from "drizzle-orm";
import { serialize } from "cookie";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  role: z.enum(["admin", "staff"]).optional().default("staff"),
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
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password, role } = parsed.data;

  try {
    // Check for duplicate email
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const hashedPassword = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        hashedPassword,
        role,
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!newUser) {
      return res.status(500).json({ error: "Failed to create user" });
    }

    // Issue a JWT and set it in an httpOnly cookie
    const token = await signToken({
      sub: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    res.setHeader(
      "Set-Cookie",
      serialize(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS)
    );

    return res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err) {
    console.error("[auth/register]", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
