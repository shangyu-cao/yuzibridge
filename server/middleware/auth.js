import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { HttpError } from "../utils/http-error.js";

const authHeaderSchema = z.string().min(1);

export const authenticateAdmin = async (req, _res, next) => {
  const headerResult = authHeaderSchema.safeParse(req.headers.authorization);
  if (!headerResult.success) {
    return next(new HttpError(401, "Missing Authorization header"));
  }

  const [scheme, token] = headerResult.data.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "Authorization header must use Bearer token"));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.auth = {
      userId: payload.sub,
      email: payload.email,
      isPlatformAdmin: Boolean(payload.isPlatformAdmin),
    };
    return next();
  } catch {
    return next(new HttpError(401, "Invalid or expired token"));
  }
};

const roleSchema = z.enum(["owner", "manager", "editor", "viewer"]);
const storeIdSchema = z.string().uuid();

export const requireStoreRole = (allowedRoles) => async (req, _res, next) => {
  const storeIdParse = storeIdSchema.safeParse(req.params.storeId);
  if (!storeIdParse.success) {
    return next(new HttpError(400, "Invalid storeId"));
  }

  if (!req.auth?.userId) {
    return next(new HttpError(401, "Unauthenticated"));
  }

  const userResult = await query(
    `
      select id, is_active, is_platform_admin
      from users
      where id = $1
      limit 1
    `,
    [req.auth.userId],
  );

  if (userResult.rowCount === 0 || !userResult.rows[0].is_active) {
    return next(new HttpError(401, "User not found or inactive"));
  }

  if (userResult.rows[0].is_platform_admin) {
    req.storeRole = "owner";
    return next();
  }

  const membershipResult = await query(
    `
      select role
      from store_memberships
      where store_id = $1 and user_id = $2
      limit 1
    `,
    [storeIdParse.data, req.auth.userId],
  );

  if (membershipResult.rowCount === 0) {
    return next(new HttpError(403, "No access to this store"));
  }

  const currentRole = roleSchema.parse(membershipResult.rows[0].role);
  if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
    return next(new HttpError(403, "Insufficient role for this operation"));
  }

  req.storeRole = currentRole;
  return next();
};
