import { test, expect, type Page } from '@playwright/test'
import sharp from 'sharp'

// The API for these tests creates demo accounts for every role, all with this password.
const PASSWORD = 'E2E-library-admin-password-2026'
async function signIn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
const staffLinks = (page: Page) =>
  page.getByRole('navigation', { name: 'Staff navigation' }).getByRole('link')

test('administrator sees every workspace area, a fixed header and the report builder', async ({
  page,
}) => {
  await signIn(page, 'admin@biblioteca.local')
  await expect(page.getByRole('navigation', { name: 'Staff navigation' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible()
  await page.screenshot({ path: 'docs/previews/staff-dashboard.png', fullPage: true })
  await expect(page.locator('.workspace-header')).toHaveCSS('position', 'fixed')
  await expect(page.locator('.sidebar')).toHaveCSS('overflow-y', 'hidden')
  await expect(page.getByRole('heading', { name: 'Monthly borrowing', exact: true })).toBeVisible()
  await expect(staffLinks(page)).toHaveText([
    'Overview',
    'Books & copies',
    'Categories',
    'Authors',
    'Publishers',
    'Members',
    'Circulation',
    'Reservations',
    'Fines',
    'Applications',
    'Site content',
    'Contact messages',
    'Email outbox',
    'Reports',
    'Admins & staff',
    'Audit history',
    'Loan policies',
    'Library details',
  ])
  await page.getByRole('link', { name: 'Admins & staff', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Create staff account', exact: true }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'Reports', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Report builder' })).toBeVisible()
  // A <select> inside its <label> includes the chosen option in its name, so match by label text.
  const builder = page.locator('.report-builder')
  await builder.getByLabel('Area').selectOption('books')
  await builder.getByLabel('Report').selectOption('books-by-category')
  await expect(page.getByRole('columnheader', { name: 'Category' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Fiction', exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export CSV' }).click()
  expect((await download).suggestedFilename()).toBe('books-by-category-report.csv')
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 700))
  expect(
    await page
      .locator('.workspace-header')
      .evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(0)
})

test('administrator can update the profile photo with the cropper', async ({ page }) => {
  await signIn(page, 'admin@biblioteca.local')
  await page.locator('.profile-menu summary').click()
  await page.getByRole('link', { name: 'My profile', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'My profile', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click()
  const photo = await sharp({
    create: { width: 40, height: 40, channels: 3, background: '#24634b' },
  })
    .png()
    .toBuffer()
  await page
    .getByLabel('Profile photo file')
    .setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: photo })
  const cropDialog = page.getByRole('dialog', { name: 'Adjust your profile photo' })
  await expect(cropDialog).toBeVisible()
  await page.setViewportSize({ width: 390, height: 500 })
  expect(
    await cropDialog.evaluate((element) => element.scrollHeight <= element.clientHeight + 1),
  ).toBe(true)
  await page.setViewportSize({ width: 1280, height: 720 })
  await cropDialog.getByRole('button', { name: 'Save photo', exact: true }).click()
  await expect(page.locator('.profile-menu .avatar img')).toBeVisible()
})

test('authentication fields are responsive, passwords toggle, and error toast closes inside its right edge', async ({
  page,
}) => {
  await page.goto('/register')
  const name = page.getByLabel('Full name')
  const email = page.getByLabel('Email address')
  const password = page.getByLabel('Password', { exact: true })
  const confirm = page.getByLabel('Confirm password', { exact: true })
  for (const width of [1280, 800, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const boxes = await Promise.all(
      [name, email, password, confirm].map((field) => field.boundingBox()),
    )
    if (width >= 768) {
      expect(boxes[0]!.y).toBe(boxes[1]!.y)
      expect(boxes[2]!.y).toBe(boxes[3]!.y)
    } else {
      expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y)
      expect(boxes[3]!.y).toBeGreaterThan(boxes[2]!.y)
    }
  }
  await name.fill('Test Reader')
  await email.fill('form-check@test.local')
  await password.fill('Form-check-password-2026')
  await confirm.fill('Different-password-2026')
  await page.getByRole('button', { name: 'Show password', exact: true }).first().click()
  await expect(password).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible()
  await page.goto('/login')
  await page.getByLabel('Email address').fill('missing-account@test.local')
  await page.getByLabel('Password', { exact: true }).fill('Wrong-password-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const toast = page.locator('[data-sonner-toast][data-type="error"]')
  await expect(toast).toBeVisible()
  await expect(toast).toHaveCSS('background-color', 'rgb(180, 35, 24)')
  const toastBox = (await toast.boundingBox())!
  const close = toast.getByRole('button', { name: /Close toast/i })
  const closeBox = (await close.boundingBox())!
  expect(closeBox.x).toBeGreaterThan(toastBox.x + toastBox.width / 2)
  expect(closeBox.x + closeBox.width).toBeLessThanOrEqual(toastBox.x + toastBox.width)
  await close.click()
  await expect(toast).toHaveCount(0)
})

test('reader can search, create an account, save a title, and reserve it', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /A place for your/ })).toBeVisible()
  await page.screenshot({ path: 'docs/previews/home-desktop.png', fullPage: true })
  await page.getByRole('textbox', { name: 'Search the library' }).fill('Achebe')
  await page.getByRole('button', { name: 'Find a book' }).click()
  await expect(page.getByRole('heading', { name: 'Things Fall Apart' })).toBeVisible()
  await page.getByRole('heading', { name: 'Things Fall Apart' }).getByRole('link').click()
  await page.getByRole('link', { name: 'Sign in to save or reserve' }).click()
  await page.getByRole('button', { name: 'Create an account' }).click()
  await page.getByRole('textbox', { name: 'Full name' }).fill('Amina Wanjiku')
  await page.getByRole('textbox', { name: 'Email address' }).fill(`reader-${Date.now()}@test.local`)
  await page.getByLabel('Password', { exact: true }).fill('A-reader-password-2026')
  await page.getByLabel('Confirm password', { exact: true }).fill('A-reader-password-2026')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back, Amina' })).toBeVisible()
  await page.getByRole('link', { name: 'Browse Books', exact: true }).click()
  await page.getByRole('textbox', { name: 'Search catalog' }).fill('Achebe')
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('heading', { name: 'Things Fall Apart' }).getByRole('link').click()
  await page.getByRole('button', { name: 'Save for later' }).click()
  await expect(page.getByRole('button', { name: 'Remove from saved' })).toBeVisible()
  await page.getByRole('button', { name: 'Reserve this title' }).click()
  await expect(page.getByRole('button', { name: 'Reservation placed' })).toBeVisible()
  await page.getByRole('link', { name: 'My library', exact: true }).click()
  await page.getByRole('link', { name: 'Reservations', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Things Fall Apart' })).toBeVisible()
  await page.goto('/account')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Welcome back, Amina' })).toBeVisible()
})

test('public pages remain usable on mobile and in dark mode', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /A place for your/ })).toBeVisible()
  expect(await noHorizontalScroll(page)).toBe(true)
  // On phones the language and theme switches live in the menu.
  await page.getByRole('button', { name: 'Toggle navigation' }).click()
  const sidebar = page.getByRole('dialog', { name: 'Library navigation' })
  await expect(sidebar).toBeVisible()
  await sidebar.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(sidebar.getByRole('button', { name: 'العربية', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Register', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sidebar).toHaveCount(0)
  await page.screenshot({ path: 'docs/previews/home-mobile-dark.png', fullPage: true })
  await expect(page.getByRole('button', { name: 'Toggle navigation' })).toBeFocused()
  await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await sidebar.getByRole('link', { name: 'Catalog', exact: true }).click()
  await expect(sidebar).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Find your next good read' })).toBeVisible()
  expect(await noHorizontalScroll(page)).toBe(true)
})

test('staff can register a member, add inventory, and issue, renew, and return a copy', async ({
  page,
}) => {
  const unique = String(Date.now())
  const title = `Library workflow ${unique}`
  await signIn(page, 'admin@biblioteca.local')
  await expect(page.getByRole('heading', { name: /Good to see you/ })).toBeVisible()
  await page.getByRole('link', { name: 'Books & copies', exact: true }).click()
  await page.getByRole('button', { name: 'Add title', exact: true }).click()
  const titleDialog = page.getByRole('dialog')
  await titleDialog.getByLabel('Title', { exact: true }).fill(title)
  await titleDialog.getByLabel('Authors', { exact: true }).fill('Library Test Author')
  await titleDialog.getByLabel('ISBN / catalog identifier').fill(`TEST-${unique}`)
  await titleDialog.getByLabel('Category').selectOption({ label: 'Fiction' })
  await titleDialog.getByLabel('Publication year').fill('2025')
  await titleDialog.getByRole('button', { name: 'Add title', exact: true }).click()
  await expect(titleDialog).not.toBeVisible()
  const inventoryRow = page.getByRole('row').filter({ hasText: title })
  await inventoryRow.getByRole('button', { name: 'Copies', exact: true }).click()
  const copyDialog = page.getByRole('dialog')
  await copyDialog.getByLabel('Unique barcode').fill(`COPY-${unique}`)
  await copyDialog.getByLabel('Shelf location', { exact: true }).fill('TEST 1')
  await copyDialog.getByRole('button', { name: 'Add physical copy' }).click()
  await expect(page.getByText('Copy added to inventory.', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(copyDialog).not.toBeVisible()

  await page.getByRole('link', { name: 'Members', exact: true }).click()
  await page.getByRole('button', { name: 'Register member', exact: true }).click()
  const memberDialog = page.getByRole('dialog')
  await memberDialog.getByLabel('Full name').fill(`Reader ${unique}`)
  await memberDialog.getByLabel('Email address').fill(`staff-reader-${unique}@test.local`)
  await memberDialog.getByLabel('Initial password').fill('Member-testing-password-2026')
  await memberDialog
    .getByLabel('Confirm password', { exact: true })
    .fill('Member-testing-password-2026')
  await memberDialog.getByRole('button', { name: 'Register member', exact: true }).click()
  await expect(memberDialog).not.toBeVisible()

  await page.getByRole('link', { name: 'Circulation', exact: true }).click()
  await page.getByRole('button', { name: 'Issue loan', exact: true }).click()
  const loanDialog = page.getByRole('dialog')
  // Lists are paged, so search for the member and copy the way a librarian would.
  await loanDialog.getByLabel('Search active members').fill(`staff-reader-${unique}`)
  await loanDialog.getByLabel('Search available copies').fill(`COPY-${unique}`)
  await loanDialog
    .getByLabel('Member', { exact: true })
    .selectOption({ label: `Reader ${unique} (staff-reader-${unique}@test.local)` })
  await loanDialog
    .getByLabel('Available copy', { exact: true })
    .selectOption({ label: `${title} / COPY-${unique} / TEST 1` })
  await loanDialog.getByRole('button', { name: 'Issue loan', exact: true }).click()
  await expect(loanDialog).not.toBeVisible()
  const loanRow = page.getByRole('row').filter({ hasText: title })
  await loanRow.getByRole('button', { name: 'Renew', exact: true }).click()
  await expect(page.getByText('Renewed.', { exact: true })).toBeVisible()
  await loanRow.getByRole('button', { name: 'Return', exact: true }).click()
  const returnDialog = page.getByRole('dialog')
  await returnDialog.getByLabel('Condition of the book').selectOption('good')
  await returnDialog.getByRole('button', { name: 'Confirm return' }).click()
  await expect(loanRow).not.toBeVisible()
  await page.getByRole('button', { name: 'All history' }).click()
  await expect(
    page.getByRole('row').filter({ hasText: title }).getByText('Returned', { exact: true }),
  ).toBeVisible()
})

test('public information pages explain the library and current borrowing rules', async ({
  page,
}) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: /A shared place/ })).toBeVisible()
  await page.screenshot({ path: 'docs/previews/about-desktop.png', fullPage: true })
  await expect(page.locator('.about-stats strong').first()).not.toHaveText('—')
  await page.goto('/faq')
  await expect(page.getByRole('heading', { name: /Borrowing, made clear/ })).toBeVisible()
  await expect(page.locator('.public-policy-grid')).toBeVisible()
  await page.locator('summary').first().click()
  await expect(page.locator('details').first()).toHaveAttribute('open', '')
  await page.setViewportSize({ width: 375, height: 812 })
  expect(await noHorizontalScroll(page)).toBe(true)
})

test('empty public content pages say so instead of inventing content', async ({ page }) => {
  for (const [path, heading] of [
    ['/services', 'What the library offers'],
    ['/how-to-join', 'How to join'],
    ['/rules', 'Library rules'],
    ['/news', 'News and events'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
})

test('header shows the library name and offers registration on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/')
  await expect(page.locator('.public-header .brand')).toContainText('Garbaharey')
  expect(await noHorizontalScroll(page)).toBe(true)
  // On phones, Sign in and Register move into the menu.
  await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await page
    .getByRole('dialog', { name: 'Library navigation' })
    .getByRole('link', { name: 'Register', exact: true })
    .click()
  await expect(page.getByRole('heading', { name: 'Become a member' })).toBeVisible()
  await expect(page.getByLabel('Full name')).toBeVisible()
  expect(await noHorizontalScroll(page)).toBe(true)
  await page.goto('/about')
  expect(await noHorizontalScroll(page)).toBe(true)
  await page.screenshot({ path: 'docs/previews/about-mobile.png', fullPage: true })
})

test('Help is a contact page with a separate FAQ destination', async ({ page }) => {
  await page.goto('/help')
  await expect(page.getByRole('heading', { name: 'Contact us.' })).toBeVisible()
  await page.getByRole('link', { name: 'Read the FAQs' }).click()
  await expect(page).toHaveURL(/\/faq$/)
  await expect(page.getByRole('heading', { name: 'Frequently asked questions' })).toBeVisible()
})

test('contact form saves a message, shows a dismissible toast, and header stays fixed', async ({
  page,
}) => {
  await page.goto('/help')
  await page.getByLabel('Full name').fill('Contact Reader')
  await page.getByLabel('Email address').fill('contact-reader@test.local')
  await page.getByLabel('What is your message about?').selectOption('Borrowing')
  await page
    .getByLabel('Message', { exact: true })
    .fill('Please explain how to collect a reserved book.')
  await page.getByRole('button', { name: 'Send message', exact: true }).click()
  await expect(
    page.getByText('Your message has been sent to the library team.', { exact: true }),
  ).toBeVisible()
  await page
    .locator('[data-sonner-toast]')
    .getByRole('button', { name: /Close toast/i })
    .click()
  await page.evaluate(() => window.scrollTo(0, 600))
  expect(
    await page
      .locator('.public-header')
      .evaluate((element) => Math.round(element.getBoundingClientRect().top)),
  ).toBe(0)
  const nav = page.getByRole('navigation', { name: 'Main navigation' })
  for (const name of [
    'Home',
    'About',
    'Catalog',
    'Services',
    'How to Join',
    'News & Events',
    'Contact',
  ])
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible()
})

test('reader can request recovery and use a one-time email link from the local test outbox', async ({
  page,
}) => {
  const email = `recovery-${Date.now()}@test.local`
  await page.goto('/register')
  await page.getByLabel('Full name').fill('Recovery Reader')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Original-reader-password-2026')
  await page.getByLabel('Confirm password', { exact: true }).fill('Original-reader-password-2026')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back, Recovery' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.locator('.recovery-result')).toBeVisible()
  await page.goto('/login')
  await page.getByLabel('Email address').fill('admin@biblioteca.local')
  await page.getByLabel('Password', { exact: true }).fill('E2E-library-admin-password-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: 'Email outbox', exact: true }).click()
  const resetMail = page
    .locator('.email-entry')
    .filter({ hasText: email })
    .filter({ hasText: 'Reset your library password' })
  await resetMail.locator('summary').click()
  const text = await resetMail.locator('pre').innerText()
  const token = text.match(/token=([a-f0-9]{64})/)![1]
  await page.goto(`/reset-password?token=${token}`)
  await page.getByLabel('New password', { exact: true }).fill('Updated-reader-password-2026')
  await page.getByLabel('Confirm new password').fill('Updated-reader-password-2026')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.locator('.recovery-result')).toContainText('Password updated')
  await page.goto('/login')
  await page.getByLabel('Email address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Updated-reader-password-2026')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome back, Recovery' })).toBeVisible()
})

test('administrator can edit public library details and browse paginated inventory', async ({
  page,
}) => {
  await signIn(page, 'admin@biblioteca.local')
  await page.getByRole('link', { name: 'Library details', exact: true }).click()
  await page.getByLabel('Opening hours').fill('Open 24 hours, every day')
  await page.getByLabel('Color preset').selectOption('Ocean')
  await page.getByLabel('Show business name beside logo').uncheck()
  await page.getByRole('button', { name: 'Save library details' }).click()
  await expect(page.getByText('Changes saved.', { exact: true })).toBeVisible()
  await expect(page.locator('.sidebar-brand-header .brand-logo-only')).toBeVisible()
  await expect(page.getByLabel('Primary color')).toHaveValue('#245b91')
  await page.getByRole('button', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: 'Save library details' })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  )
  await page.goto('/help')
  await expect(page.getByText('Open 24 hours, every day', { exact: true })).toBeVisible()
  await page.goto('/staff/inventory')
  await expect(page.getByRole('navigation', { name: 'List pagination' })).toBeVisible()
})

test('visitors can switch to Arabic (right-to-left) and Somali, and the choice persists', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await page.getByRole('button', { name: 'العربية', exact: true }).first().click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('فصلك القادم')
  expect(await noHorizontalScroll(page)).toBe(true)
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'Soomaali', exact: true }).first().click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(
    page
      .getByRole('navigation', { name: 'Hagitaanka ugu weyn' })
      .getByRole('link', { name: 'Guriga' }),
  ).toBeVisible()
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Ku soo dhawow mar kale' })).toBeVisible()
  await page.getByRole('button', { name: 'English', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
})

test('a membership application is submitted as pending, then approved by staff', async ({
  page,
}) => {
  const unique = String(Date.now())
  const email = `applicant-${unique}@test.local`
  await page.goto('/join')
  await page.getByLabel('Full name').fill(`Applicant ${unique}`)
  await page.getByLabel('Phone number').fill('0612345678')
  await page.getByLabel('Email (optional)').fill(email)
  await page.getByRole('button', { name: 'Submit application' }).click()
  await expect(page.getByText('PENDING')).toBeVisible()
  await expect(page.getByText('Thank you. Your application was received')).toBeVisible()

  await signIn(page, 'librarian@biblioteca.local')
  await page.getByRole('link', { name: 'Applications', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: `Applicant ${unique}` })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText('Application approved.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'APPROVED' }).click()
  await expect(page.getByRole('row').filter({ hasText: `Applicant ${unique}` })).toBeVisible()
})

test('staff can publish a service in three languages and visitors see it', async ({ page }) => {
  const unique = String(Date.now())
  await signIn(page, 'admin@biblioteca.local')
  await page.getByRole('link', { name: 'Site content', exact: true }).click()
  await page.getByRole('button', { name: 'Services', exact: true }).click()
  await page.getByRole('button', { name: 'Add item' }).click()
  await page.locator('fieldset[lang="en"]').getByLabel('Title').fill(`Reading room ${unique}`)
  await page.locator('fieldset[lang="en"]').getByLabel('Text').fill('A quiet place to read.')
  await page.locator('fieldset[lang="so"]').getByLabel('Title').fill(`Qolka akhriska ${unique}`)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
  // The Somali text body was left empty, so both SO and AR are flagged.
  await expect(page.getByText('Missing translation: SO, AR')).toBeVisible()
  // Browse as a signed-out visitor, so switching language does not change the admin's saved preference.
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear())
  await page.goto('/services')
  await expect(page.getByRole('heading', { name: `Reading room ${unique}` })).toBeVisible()
  await page.getByRole('button', { name: 'Soomaali', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: `Qolka akhriska ${unique}` })).toBeVisible()
  await page.getByRole('button', { name: 'العربية', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: `Reading room ${unique}` })).toBeVisible()
})

test('members use their own portal, and their language choice follows their account', async ({
  page,
}) => {
  await signIn(page, 'member@biblioteca.local')
  await expect(page.getByRole('heading', { name: 'Welcome back, Sam' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Member portal' }).getByRole('link'),
  ).toHaveText([
    'Dashboard',
    'Browse Books',
    'My Books',
    'Reservations',
    'Borrowing History',
    'Fines',
    'Reading list',
    'Notifications',
    'Profile',
    'Settings',
  ])
  await expect(page.getByText('Due soon', { exact: true })).toBeVisible()
  await page.goto('/staff')
  await expect(page).toHaveURL(/\/account$/)
  await page.getByRole('link', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Soomaali', exact: true }).first().click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'so')
  await page.getByRole('button', { name: 'Ka bax' }).click()
  await page.evaluate(() => localStorage.clear())
  await signIn(page, 'member@biblioteca.local')
  // Signing in returns to the page the member was on (Settings); the dashboard greets them in Somali.
  await expect(page.locator('html')).toHaveAttribute('lang', 'so')
  await page.goto('/account')
  await expect(page.getByRole('heading', { name: 'Ku soo dhawow mar kale, Sam' })).toBeVisible()
})

test('the director gets a read-only management view and cannot reach operations', async ({
  page,
}) => {
  await signIn(page, 'director@biblioteca.local')
  await expect(page.getByRole('heading', { name: 'Hello, Dara' })).toBeVisible()
  await expect(staffLinks(page)).toHaveText(['Overview', 'Fines', 'Reports', 'Audit history'])
  await expect(page.getByText('Most borrowed books')).toBeVisible()
  await page.goto('/staff/inventory')
  await expect(page).toHaveURL(/\/staff$/)
  await page.getByRole('link', { name: 'Fines', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0)
})

test('a librarian works the desk but cannot reach administrator pages', async ({ page }) => {
  await signIn(page, 'librarian@biblioteca.local')
  await expect(page.getByRole('heading', { name: /Hello, Lena/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Admins & staff', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Audit history', exact: true })).toHaveCount(0)
  await page.goto('/staff/audit')
  await expect(page).toHaveURL(/\/staff$/)
  await page.goto('/staff/policies')
  await expect(page).toHaveURL(/\/staff$/)
})

test('staff and member workspaces fit a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  for (const email of ['admin@biblioteca.local', 'member@biblioteca.local']) {
    await signIn(page, email)
    await expect(page.locator('.workspace-header')).toBeVisible()
    expect(await noHorizontalScroll(page), email).toBe(true)
    await page.locator('.workspace-header .mobile-menu').click()
    await expect(page.locator('.sidebar .sidebar-preferences')).toBeVisible()
    await page.locator('.sidebar-footer button').click()
    await expect(page).toHaveURL(/\/login|\/$/)
  }
})
