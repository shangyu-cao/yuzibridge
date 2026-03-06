import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export const notFoundHandler = (req, res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (error, req, res, next) => {
  void next;

  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: error.issues,
    });
  }

  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({
      message: error.message,
      details: error.details,
    });
  }

  if (error?.name === "MulterError") {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "Image is too large. Max size is 5MB.",
      });
    }

    return res.status(400).json({
      message: "File upload failed.",
      details: error.message ?? null,
    });
  }

  if (error?.code === "23503") {
    return res.status(409).json({
      message: "Operation violates data relationship constraints.",
      details: error.detail ?? null,
    });
  }

  if (error?.code === "23505") {
    return res.status(409).json({
      message: "Duplicate resource.",
      details: error.detail ?? null,
    });
  }

  if (error?.message === "DATABASE_URL is not configured.") {
    return res.status(500).json({
      message: "Server database is not configured. Set DATABASE_URL in deployment environment.",
    });
  }

  console.error("[api:error]", error);
  return res.status(500).json({
    message: "Internal server error",
  });
};
