export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message.replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://…')
  return String(err)
}
