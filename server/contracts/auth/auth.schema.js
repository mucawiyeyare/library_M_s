import { z } from 'zod'
export const loginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(1).max(128),
})
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(100),
  password: z.string().min(12, 'Use at least 12 characters').max(128),
})
