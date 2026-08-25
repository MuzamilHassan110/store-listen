import type { RequestHandler } from "express";
import multer from "multer";
import { sendError } from "../lib/api-response.js";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "audio/webm",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/oga",
]);

class UploadHttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "UploadHttpError";
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype.split(";")[0]?.trim() ?? "";
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      cb(new UploadHttpError(415, "Unsupported audio type.", "UNSUPPORTED_MEDIA_TYPE"));
      return;
    }
    cb(null, true);
  },
});

const parseAudio = upload.single("audio");

export const uploadAudio: RequestHandler = (req, res, next) => {
  parseAudio(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }

    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      sendError(res, 413, "Audio file exceeds the 50MB limit.", "FILE_TOO_LARGE");
      return;
    }

    if (err instanceof UploadHttpError) {
      sendError(res, err.statusCode, err.message, err.code);
      return;
    }

    next(err);
  });
};
