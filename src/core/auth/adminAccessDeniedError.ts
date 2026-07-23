/** adminLogin: authenticated user lacks admin/community registration. */
export class AdminAccessDeniedError extends Error {
  constructor() {
    super('Admin access denied');
    this.name = 'AdminAccessDeniedError';
  }
}

export function isAdminAccessDeniedError(err: unknown): err is AdminAccessDeniedError {
  return err instanceof AdminAccessDeniedError;
}
