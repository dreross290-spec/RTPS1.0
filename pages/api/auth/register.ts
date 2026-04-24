import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { users, authAuditLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { hashPassword, signToken, serializeTokenCookie } from "@/server/lib/auth";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long"),
  role: z.enum(["admin", "staff"]).default("staff"),
});

async function logAuthEvent(params: {
  userId?: string;
  email?: string;
  event: string;
  ipAddress?: string;
  userAgent?: string;
  detail?: string;
}) {
  await db.insert(authAuditLogs).values({
    userId: params.userId ?? null,
    email: params.email ?? null,
    event: params.event,
    ipAddress: params.ipAddress ?? null,
    userAgent: params.userAgent ?? null,
    detail: params.detail ?? null,
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket.remoteAddress
    ?? "unknown";
  const userAgent = req.headers["user-agent"] ?? "unknown";

  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Validation failed",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password, role } = parsed.data;

  try {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existing) {
      await logAuthEvent({
        email,
        event: "register_failed",
        ipAddress: ip,
        userAgent,
        detail: "Email already registered",
      });
      return res.status(409).json({ error: "Email already registered" });
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        role,
      })
      .returning({
        userId: users.userId,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!newUser) {
      throw new Error("Failed to create user");
    }

    const token = await signToken({
      sub: newUser.userId,
      email: newUser.email,
      role: newUser.role,
    });

    await logAuthEvent({
      userId: newUser.userId,
      email: newUser.email,
      event: "registered",
      ipAddress: ip,
      userAgent,
    });

    res.setHeader("Set-Cookie", serializeTokenCookie(token));
    return res.status(201).json({
      user: { userId: newUser.userId, email: newUser.email, role: newUser.role },
    });
  } catch (error) {
    console.error("[auth/register] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
