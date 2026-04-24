/**
 * POST /api/auth/logout
 *
 * Clears the auth cookie to log the user out.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { AUTH_COOKIE_NAME } from "@server/lib/auth";
import { serialize } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader(
    "Set-Cookie",
    serialize(AUTH_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
  );

  return res.status(200).json({ success: true });
}
