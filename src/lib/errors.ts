export type FieldErrors = Record<string, string[]>;

// Each feature subclasses this so pages and route handlers only map that module's own errors.
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields: FieldErrors = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export type AppErrorClass<E extends AppError = AppError> = new (
  status: number,
  message: string,
  fields?: FieldErrors,
) => E;
