import cors from "cors";
import express from "express";
import { config } from "./config.js";
import { hasDatabase, pingDatabase } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { adminAuthRouter } from "./routes/admin-auth.js";
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { resolveUploadsDirectory } from "./utils/uploads-directory.js";
import { asyncHandler } from "./utils/async-handler.js";

const app = express();
const uploadsDirectory = resolveUploadsDirectory();

app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(uploadsDirectory));

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    if (!hasDatabase) {
      return res.status(500).json({
        status: "error",
        message: "DATABASE_URL is not configured",
      });
    }

    try {
      await pingDatabase();
    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Database connection failed",
        details: error instanceof Error ? error.message : "Unknown database error",
      });
    }

    return res.json({
      status: "ok",
    });
  }),
);

app.use("/api/public", publicRouter);
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin", adminRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
