import bcrypt from "bcryptjs";
import express from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { query, withTransaction } from "../db/pool.js";
import { authenticateAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { HttpError } from "../utils/http-error.js";

const router = express.Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

const registerSchema = z.object({
  storeName: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
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

const slugify = (value) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized) return normalized;
  return `store-${Date.now().toString(36)}`;
};

const resolveDefaultLanguageCode = async (dbClient) => {
  const languageResult = await dbClient.query(
    `
      select code
      from languages
      order by code asc
    `,
  );
  const codes = languageResult.rows.map((row) => row.code);
  if (!codes.length) {
    throw new HttpError(500, "Languages are not initialized in database");
  }
  if (codes.includes("zh-CN")) return "zh-CN";
  if (codes.includes("en-US")) return "en-US";
  return codes[0];
};

const createStoreWithUniqueSlug = async (dbClient, { storeName, defaultLanguageCode }) => {
  const baseSlug = slugify(storeName);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidateSlug =
      attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const storeResult = await dbClient.query(
        `
          insert into stores
            (
              slug,
              legal_name,
              brand_name,
              logo_url,
              default_language_code,
              default_currency_code,
              timezone,
              address_text,
              contact_phone,
              contact_email,
              is_active
            )
          values
            ($1, $2, $3, null, $4, 'CNY', 'Asia/Shanghai', null, null, null, true)
          returning id, slug, brand_name
        `,
        [candidateSlug, storeName, storeName, defaultLanguageCode],
      );
      return storeResult.rows[0];
    } catch (error) {
      if (error?.code === "23505") {
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(500, "Failed to allocate unique store slug");
};

const isUsersEmailConflict = (error) => {
  if (!error) return false;
  const constraint = String(error?.constraint ?? "").toLowerCase();
  if (constraint === "users_email_key") return true;
  if (error?.code === "23505" && constraint.includes("users_email")) return true;

  const messageText = String(error?.message ?? "").toLowerCase();
  const detailText = String(error?.detail ?? "").toLowerCase();
  return messageText.includes("users_email_key") || detailText.includes("users_email_key");
};

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const existingUserResult = await query(
      `
        select id
        from users
        where email = $1
        limit 1
      `,
      [payload.email],
    );
    if (existingUserResult.rowCount > 0) {
      throw new HttpError(409, "Email is already registered");
    }

    const passwordHash = await bcrypt.hash(payload.password, 10);

    let created;
    try {
      created = await withTransaction(async (client) => {
        const defaultLanguageCode = await resolveDefaultLanguageCode(client);
        const store = await createStoreWithUniqueSlug(client, {
          storeName: payload.storeName,
          defaultLanguageCode,
        });

        const allLanguageResult = await client.query(
          `
            select code
            from languages
            order by code asc
          `,
        );

        await client.query(
          `
            insert into users
              (email, password_hash, display_name, is_platform_admin, is_active, last_login_at)
            values
              ($1, $2, $3, false, true, now())
          `,
          [payload.email, passwordHash, payload.displayName],
        );

        const userResult = await client.query(
          `
            select id, email, display_name, is_platform_admin, created_at, last_login_at
            from users
            where email = $1
            limit 1
          `,
          [payload.email],
        );
        const user = userResult.rows[0];

        await client.query(
          `
            insert into store_memberships (store_id, user_id, role)
            values ($1, $2, 'owner')
          `,
          [store.id, user.id],
        );

        for (const language of allLanguageResult.rows) {
          await client.query(
            `
              insert into store_languages (store_id, language_code, is_default, is_enabled)
              values ($1, $2, $3, true)
              on conflict (store_id, language_code)
              do update set
                is_default = excluded.is_default,
                is_enabled = true
            `,
            [store.id, language.code, language.code === defaultLanguageCode],
          );
        }

        return { user, store };
      });
    } catch (error) {
      if (isUsersEmailConflict(error)) {
        throw new HttpError(409, "Email is already registered");
      }
      throw error;
    }

    const memberships = await getMembershipsByUserId(created.user.id);
    res.status(201).json({
      ...toAuthPayload(created.user, memberships),
      accountMeta: {
        createdAt: created.user.created_at,
        lastLoginAt: created.user.last_login_at,
      },
      createdStore: {
        id: created.store.id,
        slug: created.store.slug,
        brandName: created.store.brand_name,
      },
    });
  }),
);

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
