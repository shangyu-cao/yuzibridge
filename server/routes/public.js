import express from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async-handler.js";
import { getPublicMenuBySlug, getStoreLanguagesBySlug } from "../services/public-menu-service.js";

const router = express.Router();

const storeSlugSchema = z.object({
  storeSlug: z.string().min(1).max(100),
});

const menuQuerySchema = z.object({
  lang: z.string().min(2).max(10).optional(),
});

router.get(
  "/stores/:storeSlug/languages",
  asyncHandler(async (req, res) => {
    const { storeSlug } = storeSlugSchema.parse(req.params);
    const payload = await getStoreLanguagesBySlug(storeSlug);
    res.json(payload);
  }),
);

router.get(
  "/stores/:storeSlug/menu",
  asyncHandler(async (req, res) => {
    const { storeSlug } = storeSlugSchema.parse(req.params);
    const { lang } = menuQuerySchema.parse(req.query);
    const payload = await getPublicMenuBySlug({
      storeSlug,
      requestedLanguage: lang,
    });
    res.json(payload);
  }),
);

export { router as publicRouter };
