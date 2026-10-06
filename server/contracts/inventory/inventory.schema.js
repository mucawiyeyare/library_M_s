import { z } from 'zod'
const objectId = z.string().regex(/^[a-f0-9]{24}$/i)
// An empty <select> sends ""; treat it as "none chosen".
const optionalId = z
  .union([z.literal('').transform(() => null), objectId])
  .nullable()
  .optional()
export const bookSchema = z
  .object({
    coverId: z
      .string()
      .regex(/^[a-f0-9]{24}$/i)
      .nullable()
      .optional(),
    title: z.string().trim().min(1).max(200),
    author: z.string().trim().min(1).max(150),
    isbn: z.string().trim().min(1).max(30),
    genre: z.string().trim().max(80).default(''),
    category: optionalId,
    publisher: optionalId,
    language: z.enum(['en', 'so', 'ar', 'other']).default('en'),
    edition: z.string().trim().max(50).default(''),
    featured: z.boolean().default(false),
    year: z.coerce
      .number()
      .int()
      .min(1000)
      .max(new Date().getFullYear() + 1),
    description: z.string().trim().max(3000).default(''),
    archived: z.boolean().default(false),
  })
  .refine((book) => book.category || book.genre, {
    path: ['category'],
    message: 'Choose a category.',
  })
export const copySchema = z.object({
  barcode: z.string().trim().min(1).max(80),
  shelf: z.string().trim().min(1).max(80),
})
