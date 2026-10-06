import { z } from 'zod'
export const roles = ['member', 'librarian', 'director', 'admin']
export const idSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid record ID')
