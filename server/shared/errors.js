export class ApiError extends Error {
  status
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export function requireRecord(value, message = 'Record not found') {
  if (!value) throw new ApiError(404, message)
  return value
}
