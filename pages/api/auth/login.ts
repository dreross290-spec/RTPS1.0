import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { db } from "@/server/lib/db";
import { users, authAuditLogs } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  signToken,
  serializeTokenCookie,
} from "@/server/lib/auth";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
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

    // Constant-time-safe: always run bcrypt compare even if user not found.
    // Use a properly formatted bcrypt v2a hash to ensure bcrypt.compare runs its full routine.
    const dummyHash = "$2a$12$LoremIpsumDummyHashXX.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
    const passwordValid = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, dummyHash).then(() => false);

    if (!user || !passwordValid) {
      await logAuthEvent({
        email,
        event: "login_failed",
        ipAddress: ip,
        userAgent,
        detail: "Invalid credentials",
      });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = await signToken({
      sub: user.userId,
      email: user.email,
      role: user.role,
    });

    await logAuthEvent({
      userId: user.userId,
      email: user.email,
      event: "login_success",
      ipAddress: ip,
      userAgent,
    });

    // Record last login time
    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.userId, user.userId));

    res.setHeader("Set-Cookie", serializeTokenCookie(token));
    return res.status(200).json({
      user: { userId: user.userId, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("[auth/login] Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
