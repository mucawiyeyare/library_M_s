import { z } from 'zod'
import { roles } from '../common/common.schema.js'
export const memberSchema = z.object({
  name: z.string().trim().min(2).max(100),
  status: z.enum(['active', 'suspended']),
  role: z.enum(roles),
})
