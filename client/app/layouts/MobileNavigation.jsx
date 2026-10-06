import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import LanguageSelector from '../../shared/components/LanguageSelector'
import ThemeButton from '../../shared/components/ThemeButton'
import Brand from '../../shared/components/Brand'
import { useAuth } from '../../features/auth/providers/AuthProvider'
export default function MobileNavigation() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  useEffect(() => {
    const query = window.matchMedia('(min-width: 801px)')
    const closeOnDesktop = () => {
      if (query.matches) setOpen(false)
    }
    query.addEventListener('change', closeOnDesktop)
    return () => query.removeEventListener('change', closeOnDesktop)
  }, [])
  const links = [
    ['/', t('nav.home')],
    ['/about', t('nav.about')],
    ['/catalog', t('nav.catalog')],
    ['/services', t('nav.services')],
    ['/how-to-join', t('nav.howToJoin')],
    ['/news', t('nav.news')],
    ['/rules', t('nav.rules')],
    ['/help', t('nav.contactUs')],
    ['/faq', t('nav.faq')],
    ...(user
      ? [
          ['/account', t('nav.myLibrary')],
          ...(user.role !== 'member' ? [['/staff', t('nav.staffWorkspace')]] : []),
        ]
      : [
          ['/login', t('nav.signIn')],
          ['/register', t('nav.register')],
        ]),
  ]
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="icon-button mobile-menu" aria-label={t('nav.toggle')}>
          <Menu size={22} aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="navigation-overlay" />
        <Dialog.Content className="navigation-sidebar" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{t('nav.libraryNavigation')}</Dialog.Title>
          <div className="navigation-sidebar-heading">
            <Brand />
            <Dialog.Close className="icon-button" aria-label={t('nav.close')}>
              <X size={22} aria-hidden="true" />
            </Dialog.Close>
          </div>
          <nav aria-label={t('nav.mobile')}>
            {links.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-preferences">
            <LanguageSelector />
            <ThemeButton />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
