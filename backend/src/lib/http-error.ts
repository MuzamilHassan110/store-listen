export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = "INTERNAL_ERROR",
  ) {
    super(message);
    this.name = "HttpError";
  }
}
