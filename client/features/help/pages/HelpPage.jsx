import { useLibrarySettings } from '../../../shared/hooks/useLibrarySettings'
import ContactForm from '../components/ContactForm'
import { ArrowRight, Mail, Phone, MapPin, Clock, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import '../../information/styles/information.css'
import '../styles/contact.css'

export default function HelpPage() {
  const { t } = useTranslation()
  const details = useLibrarySettings()
  const contact = details.data ?? { email: '', phone: '', address: '', hours: '' }
  const hasDetails = [contact.email, contact.phone, contact.address, contact.hours].some(Boolean)
  return (
    <div className="contact-page">
      <header className="contact-heading">
        <div className="container">
          <p className="eyebrow">{t('contact.eyebrow')}</p>
          <h1>{t('contact.title')}</h1>
          <p>{t('contact.intro')}</p>
        </div>
      </header>
      <div className="container page contact-content">
        <ContactForm />
        <div className="contact-sidebar">
          <section className="contact-details" aria-labelledby="contact-title">
            <h2 id="contact-title">{t('contact.speakTitle')}</h2>
            <p className="muted">{t('contact.speakText')}</p>
            {hasDetails ? (
              <dl className="contact-list">
                {contact.email && (
                  <div>
                    <Mail aria-hidden="true" size={21} />
                    <dt>{t('home.email')}</dt>
                    <dd>
                      <a href={`mailto:${contact.email}`}>{contact.email}</a>
                    </dd>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <Phone aria-hidden="true" size={21} />
                    <dt>{t('home.phone')}</dt>
                    <dd>
                      <a href={`tel:${contact.phone.replace(/[^+0-9]/g, '')}`} dir="ltr">
                        {contact.phone}
                      </a>
                    </dd>
                  </div>
                )}
                {contact.address && (
                  <div>
                    <MapPin aria-hidden="true" size={21} />
                    <dt>{t('contact.visit')}</dt>
                    <dd>{contact.address}</dd>
                  </div>
                )}
                {contact.hours && (
                  <div>
                    <Clock aria-hidden="true" size={21} />
                    <dt>{t('home.hours')}</dt>
                    <dd>{contact.hours}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="contact-unavailable">{t('contact.unavailable')}</p>
            )}
          </section>
          <aside className="contact-self-service">
            <BookOpen size={28} aria-hidden="true" />
            <h2>{t('contact.quickTitle')}</h2>
            <p>{t('contact.quickText')}</p>
            <Link className="button" to="/faq">
              {t('contact.faq')} <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="text-link" to="/account">
              {t('contact.manage')} <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </div>
    </div>
  )
}
