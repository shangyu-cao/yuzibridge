import express from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/async-handler.js";
import {
  createPublicOrderBySlug,
  getPublicMenuBySlug,
  getStoreLanguagesBySlug,
} from "../services/public-menu-service.js";

const router = express.Router();

const storeSlugSchema = z.object({
  storeSlug: z.string().min(1).max(100),
});

const menuQuerySchema = z.object({
  lang: z.string().min(2).max(10).optional(),
});

const createOrderBodySchema = z.object({
  tableCode: z.string().trim().max(30).optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(80),
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
    const dynamicTranslateRaw =
      typeof req.query.dynamicTranslate === "string" ? req.query.dynamicTranslate.toLowerCase() : "";
    const dynamicTranslate = ["1", "true", "yes", "on"].includes(dynamicTranslateRaw);

    const payload = await getPublicMenuBySlug({
      storeSlug,
      requestedLanguage: lang,
      dynamicTranslate,
    });
    res.json(payload);
  }),
);

router.post(
  "/stores/:storeSlug/orders",
  asyncHandler(async (req, res) => {
    const { storeSlug } = storeSlugSchema.parse(req.params);
    const payload = createOrderBodySchema.parse(req.body);

    const order = await createPublicOrderBySlug({
      storeSlug,
      tableCode: payload.tableCode,
      note: payload.note,
      items: payload.items,
    });

    res.status(201).json(order);
  }),
);

export { router as publicRouter };
