import mongoose from 'mongoose'
import { config } from '../config/env.js'
import { Book } from '../features/inventory/book.model.js'
import { Copy } from '../features/inventory/copy.model.js'
import { User } from '../features/members/user.model.js'
import * as argon2 from '@node-rs/argon2'
import { linkCatalogReferences } from '../features/taxonomy/book-links.js'
import { allModels } from '../models.js'
// Development-only demo accounts, one per role. Never created in production.
export const demoUsers = [
  { name: 'Library Administrator', email: 'admin@biblioteca.local', role: 'admin' },
  { name: 'Lena Librarian', email: 'librarian@biblioteca.local', role: 'librarian' },
  { name: 'Dara Director', email: 'director@biblioteca.local', role: 'director' },
  { name: 'Sam Student', email: 'member@biblioteca.local', role: 'member' },
]
export const demoPassword = process.env.DEMO_PASSWORD || 'Library-Demo-2026!'
export async function seedUsers() {
  if (config.NODE_ENV === 'production') return
  await User.init()
  const passwordHash = await argon2.hash(demoPassword)
  for (const user of demoUsers)
    await User.updateOne(
      { email: user.email },
      { $setOnInsert: { ...user, passwordHash, emailVerified: true, status: 'active' } },
      { upsert: true },
    )
}
const titles = [
  {
    title: 'Things Fall Apart',
    author: 'Chinua Achebe',
    isbn: '9780385474542',
    genre: 'Fiction',
    year: 1958,
    description:
      'The story of Okonkwo and his community in late nineteenth-century Nigeria, exploring tradition, change, and the consequences of colonial rule.',
  },
  {
    title: 'A Room of One’s Own',
    author: 'Virginia Woolf',
    isbn: '9780156787338',
    genre: 'Essays',
    year: 1929,
    description:
      'An extended essay on women, writing, and the material conditions that make creative work possible.',
  },
  {
    title: 'Atomic Habits',
    author: 'James Clear',
    isbn: '9780735211292',
    genre: 'Personal growth',
    year: 2018,
    description:
      'A practical exploration of how small changes and repeatable systems shape everyday habits.',
  },
  {
    title: 'The River and the Source',
    author: 'Margaret A. Ogola',
    isbn: '9789966466507',
    genre: 'Fiction',
    year: 1994,
    description:
      'A Kenyan family saga following generations of women through changing social expectations and personal challenges.',
  },
  {
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    isbn: '9780857197689',
    genre: 'Personal growth',
    year: 2020,
    description:
      'Stories about the decisions, expectations, and emotions that influence how people think about money.',
  },
  {
    title: 'We Should All Be Feminists',
    author: 'Chimamanda Ngozi Adichie',
    isbn: '9781101911761',
    genre: 'Essays',
    year: 2014,
    description:
      'A concise essay examining gender expectations and offering a personal perspective on equality.',
  },
  {
    title: 'The Little Prince',
    author: 'Antoine de Saint-Exupéry',
    isbn: '9780156012195',
    genre: 'Children',
    year: 1943,
    description:
      'A small traveler visits different worlds and asks questions about friendship, responsibility, and what matters.',
  },
  {
    title: 'Deep Work',
    author: 'Cal Newport',
    isbn: '9781455586691',
    genre: 'Personal growth',
    year: 2016,
    description: 'A guide to making space for focused work in a world of interruptions.',
  },
  {
    title: 'Half of a Yellow Sun',
    author: 'Chimamanda Ngozi Adichie',
    isbn: '9781400095209',
    genre: 'Fiction',
    year: 2006,
    description:
      'Three lives intertwine during the Nigerian civil war in this novel of love, loyalty, and loss.',
  },
  {
    title: 'Americanah',
    author: 'Chimamanda Ngozi Adichie',
    isbn: '9780307455925',
    genre: 'Fiction',
    year: 2013,
    description:
      'A young Nigerian woman and her former love navigate identity, race, and belonging across three countries.',
  },
  {
    title: 'Weep Not, Child',
    author: 'Ngũgĩ wa Thiong’o',
    isbn: '9780435908300',
    genre: 'Fiction',
    year: 1964,
    description:
      'A boy in colonial Kenya dreams of education while his family is caught in the Mau Mau uprising.',
  },
  {
    title: 'Born a Crime',
    author: 'Trevor Noah',
    isbn: '9780399588174',
    genre: 'Biography',
    year: 2016,
    description:
      'Stories from a South African childhood under apartheid, told with humor and honesty.',
  },
  {
    title: 'Long Walk to Freedom',
    author: 'Nelson Mandela',
    isbn: '9780316548182',
    genre: 'Biography',
    year: 1994,
    description:
      'The autobiography of Nelson Mandela, from rural childhood to the presidency of South Africa.',
  },
  {
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    isbn: '9780062316110',
    genre: 'History',
    year: 2011,
    description: 'A brief history of humankind, from the Stone Age to the present.',
  },
  {
    title: 'Guns, Germs, and Steel',
    author: 'Jared Diamond',
    isbn: '9780393354324',
    genre: 'History',
    year: 1997,
    description:
      'An investigation into why human societies developed so differently across the continents.',
  },
  {
    title: 'A Brief History of Time',
    author: 'Stephen Hawking',
    isbn: '9780553380163',
    genre: 'Science',
    year: 1988,
    description: 'An accessible tour of black holes, the Big Bang, and the nature of time.',
  },
  {
    title: 'The Selfish Gene',
    author: 'Richard Dawkins',
    isbn: '9780198788607',
    genre: 'Science',
    year: 1976,
    description: 'A gene-centred view of evolution that reshaped how we think about life.',
  },
  {
    title: 'Cosmos',
    author: 'Carl Sagan',
    isbn: '9780345539434',
    genre: 'Science',
    year: 1980,
    description: 'A journey through the universe and humanity’s place within it.',
  },
  {
    title: 'Clean Code',
    author: 'Robert C. Martin',
    isbn: '9780132350884',
    genre: 'Technology',
    year: 2008,
    description: 'Principles and practices for writing readable, maintainable software.',
  },
  {
    title: 'The Pragmatic Programmer',
    author: 'Andrew Hunt and David Thomas',
    isbn: '9780135957059',
    genre: 'Technology',
    year: 1999,
    description: 'Practical advice on craft, tooling, and thinking for working programmers.',
  },
  {
    title: 'Eloquent JavaScript',
    author: 'Marijn Haverbeke',
    isbn: '9781593279509',
    genre: 'Technology',
    year: 2011,
    description: 'A modern introduction to programming with JavaScript.',
  },
  {
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    isbn: '9780141439518',
    genre: 'Classics',
    year: 1813,
    description: 'Elizabeth Bennet and Mr. Darcy navigate manners, money, and misjudgment.',
  },
  {
    title: '1984',
    author: 'George Orwell',
    isbn: '9780451524935',
    genre: 'Classics',
    year: 1949,
    description: 'A dystopian novel about surveillance, propaganda, and the fragility of truth.',
  },
  {
    title: 'To Kill a Mockingbird',
    author: 'Harper Lee',
    isbn: '9780061120084',
    genre: 'Classics',
    year: 1960,
    description: 'A child’s view of justice and prejudice in the American South.',
  },
  {
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    isbn: '9780062315007',
    genre: 'Fiction',
    year: 1988,
    description:
      'A shepherd travels in search of treasure and discovers what his journey is really about.',
  },
  {
    title: 'Matilda',
    author: 'Roald Dahl',
    isbn: '9780142410370',
    genre: 'Children',
    year: 1988,
    description:
      'A gifted girl uses her wits and telekinetic powers to outsmart the adults around her.',
  },
  {
    title: 'Charlotte’s Web',
    author: 'E. B. White',
    isbn: '9780064400558',
    genre: 'Children',
    year: 1952,
    description: 'A pig, a spider, and a barn full of friends in a story about loyalty and loss.',
  },
  {
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    isbn: '9780374533557',
    genre: 'Personal growth',
    year: 2011,
    description: 'Two systems of thought and the biases that shape our judgments.',
  },
]
export async function seedCatalog() {
  for (const model of allModels) await model.init()
  for (const [index, title] of titles.entries()) {
    const book = await Book.findOneAndUpdate(
      { isbn: title.isbn },
      { $setOnInsert: { ...title, language: 'en' } },
      { upsert: true, returnDocument: 'after' },
    )
    for (let copy = 1; copy <= 2; copy++)
      await Copy.updateOne(
        { barcode: `BIB-${String(index + 1).padStart(4, '0')}-${copy}` },
        {
          $setOnInsert: {
            book: book._id,
            shelf: `${title.genre.slice(0, 3).toUpperCase()} ${index + 1}`,
            status: 'available',
          },
        },
        { upsert: true },
      )
  }
  await linkCatalogReferences()
}
if (process.argv[1]?.endsWith('seed.js')) {
  try {
    await mongoose.connect(config.MONGODB_URI)
    await seedCatalog()
    await seedUsers()
    console.log(
      `Demo users (password: ${demoPassword}): ${demoUsers.map((u) => u.email).join(', ')}`,
    )
    console.log('Sample catalog seeded. Existing titles and copies were preserved.')
  } finally {
    await mongoose.disconnect()
  }
}
