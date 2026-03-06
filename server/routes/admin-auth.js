import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);

    const userResult = await query(
      `
        select id, email, password_hash, display_name, is_platform_admin, is_active
        from users
        where email = $1
        limit 1
      `,
      [email],
    );

    if (userResult.rowCount === 0) {
      throw new HttpError(401, "Invalid email or password");
    }

    const user = userResult.rows[0];
    if (!user.is_active) {
      throw new HttpError(403, "User is inactive");
    }

    const passwordOk = await bcrypt.compare(password, user.password_hash);
    if (!passwordOk) {
      throw new HttpError(401, "Invalid email or password");
    }

    const membershipResult = await query(
      `
        select sm.store_id, sm.role, s.slug as store_slug, s.brand_name as store_brand_name
        from store_memberships sm
        join stores s on s.id = sm.store_id
        where sm.user_id = $1
        order by s.created_at asc
      `,
      [user.id],
    );

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        isPlatformAdmin: user.is_platform_admin,
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn },
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        isPlatformAdmin: user.is_platform_admin,
      },
      memberships: membershipResult.rows,
    });
  }),
);

export { router as adminAuthRouter };
