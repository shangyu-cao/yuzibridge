import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { authenticateAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(320).optional(),
    currentPassword: z.string().min(8).max(200).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  })
  .refine(
    (value) => value.displayName !== undefined || value.email !== undefined || value.newPassword !== undefined,
    {
      message: "No update fields provided",
    },
  )
  .refine((value) => !value.newPassword || Boolean(value.currentPassword), {
    message: "Current password is required to set new password",
    path: ["currentPassword"],
  });

const getMembershipsByUserId = async (userId) => {
  const membershipResult = await query(
    `
      select sm.store_id, sm.role, s.slug as store_slug, s.brand_name as store_brand_name
      from store_memberships sm
      join stores s on s.id = sm.store_id
      where sm.user_id = $1
      order by s.created_at asc
    `,
    [userId],
  );
  return membershipResult.rows;
};

const signAdminToken = (user) =>
  jwt.sign(
    {
      sub: user.id,
      email: user.email,
      isPlatformAdmin: user.is_platform_admin,
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );

const toAuthPayload = (user, memberships) => ({
  token: signAdminToken(user),
  user: {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isPlatformAdmin: user.is_platform_admin,
  },
  memberships,
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

    const loginUserResult = await query(
      `
        update users
        set last_login_at = now()
        where id = $1
        returning id, email, display_name, is_platform_admin, created_at, last_login_at
      `,
      [user.id],
    );
    const loginUser = loginUserResult.rows[0];

    const memberships = await getMembershipsByUserId(loginUser.id);
    res.json({
      ...toAuthPayload(loginUser, memberships),
      accountMeta: {
        createdAt: loginUser.created_at,
        lastLoginAt: loginUser.last_login_at,
      },
    });
  }),
);

router.get(
  "/me",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, "Unauthenticated");
    }

    const userResult = await query(
      `
        select id, email, display_name, is_platform_admin, is_active, created_at, last_login_at
        from users
        where id = $1
        limit 1
      `,
      [userId],
    );

    if (userResult.rowCount === 0 || !userResult.rows[0].is_active) {
      throw new HttpError(401, "User not found or inactive");
    }

    const user = userResult.rows[0];
    const memberships = await getMembershipsByUserId(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        isPlatformAdmin: user.is_platform_admin,
      },
      memberships,
      accountMeta: {
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      },
    });
  }),
);

router.put(
  "/me",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const userId = req.auth?.userId;
    if (!userId) {
      throw new HttpError(401, "Unauthenticated");
    }

    const payload = updateMeSchema.parse(req.body);

    const currentUserResult = await query(
      `
        select id, email, password_hash, display_name, is_platform_admin, is_active
        from users
        where id = $1
        limit 1
      `,
      [userId],
    );

    if (currentUserResult.rowCount === 0 || !currentUserResult.rows[0].is_active) {
      throw new HttpError(401, "User not found or inactive");
    }

    const currentUser = currentUserResult.rows[0];
    let nextPasswordHash = null;
    if (payload.newPassword) {
      const passwordOk = await bcrypt.compare(payload.currentPassword, currentUser.password_hash);
      if (!passwordOk) {
        throw new HttpError(401, "Current password is incorrect");
      }
      nextPasswordHash = await bcrypt.hash(payload.newPassword, 10);
    }

    const updateFragments = [];
    const updateValues = [];
    const appendUpdate = (column, value) => {
      updateValues.push(value);
      updateFragments.push(`${column} = $${updateValues.length}`);
    };

    if (payload.displayName !== undefined) appendUpdate("display_name", payload.displayName);
    if (payload.email !== undefined) appendUpdate("email", payload.email);
    if (nextPasswordHash) appendUpdate("password_hash", nextPasswordHash);

    updateValues.push(userId);
    let updatedUserResult;
    try {
      updatedUserResult = await query(
        `
          update users
          set ${updateFragments.join(", ")}
          where id = $${updateValues.length}
          returning id, email, display_name, is_platform_admin
        `,
        updateValues,
      );
    } catch (error) {
      if (error?.code === "23505") {
        throw new HttpError(409, "Email is already used by another account");
      }
      throw error;
    }

    if (updatedUserResult.rowCount === 0) {
      throw new HttpError(404, "User not found");
    }

    const updatedUser = updatedUserResult.rows[0];
    const memberships = await getMembershipsByUserId(updatedUser.id);
    res.json(toAuthPayload(updatedUser, memberships));
  }),
);

export { router as adminAuthRouter };
