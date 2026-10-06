import { useLibrarySettings, defaultLibrary } from '../../../shared/hooks/useLibrarySettings'
import { ArrowRight, ArrowUpRight, Search } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import '../styles/hero.css'
export default function HomeHero({ categories }) {
  const { t } = useTranslation()
  const library = useLibrarySettings()
  const navigate = useNavigate()
  return (
    <section className="library-hero" aria-labelledby="home-title">
      <img
        className="library-hero-image"
        src="/images/library-hero.png"
        alt=""
        fetchPriority="high"
        width="1672"
        height="941"
      />
      <div className="library-hero-content">
        <p className="eyebrow">{t('hero.eyebrow')}</p>
        <h1 id="home-title">
          {t('hero.titleStart')} <span>{t('hero.titleAccent')}</span>
        </h1>
        <p className="library-hero-intro">
          {t('hero.intro', { name: library.data?.name ?? defaultLibrary.name })}
        </p>
        <form
          className="library-hero-search"
          onSubmit={(event) => {
            event.preventDefault()
            const query = new FormData(event.currentTarget).get('query')
            navigate(`/catalog?q=${encodeURIComponent(String(query ?? '').trim())}`)
          }}
        >
          <label className="sr-only" htmlFor="home-search">
            {t('hero.searchLabel')}
          </label>
          <Search size={21} aria-hidden="true" />
          <Input id="home-search" name="query" placeholder={t('hero.searchPlaceholder')} />
          <Button type="submit">
            {t('hero.find')} <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </form>
        <div className="library-hero-topics">
          <span>{t('hero.follow')}</span>
          <div>
            {categories.slice(0, 4).map((category) => (
              <Link key={category._id} to={`/catalog?category=${category._id}`}>
                {category.name}
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
        <Link to="/about" className="library-hero-about">
          {t('hero.about')} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}
