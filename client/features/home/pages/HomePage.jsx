import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '../../../shared/lib/api'
import { ErrorState, Loading } from '../../../shared/components/ui'
import HomeHero from '../components/HomeHero'
import LibraryGuide from '../components/LibraryGuide'
import MembershipBanner from '../components/MembershipBanner'
import {
  Announcements,
  BookShelf,
  HoursAndContact,
  PopularCategories,
  ServicesPreview,
  StatsBand,
} from '../components/HomeSections'
import '../../content/styles/content.css'
import '../styles/home.css'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const home = useQuery({
    queryKey: ['home', i18n.language],
    queryFn: () => api(`/books/home?lang=${i18n.language}`),
  })
  const data = home.data
  return (
    <div className="home-page">
      <HomeHero categories={data?.categories ?? []} />
      <div className="container">
        {home.isPending ? (
          <Loading />
        ) : home.error ? (
          <ErrorState error={home.error} retry={() => void home.refetch()} />
        ) : (
          <>
            <StatsBand stats={data.stats} />
            <BookShelf
              id="featured-title"
              eyebrow={t('home.featuredEyebrow')}
              title={t('home.featuredTitle')}
              books={data.featured}
            />
            <BookShelf
              id="recent-title"
              eyebrow={t('home.recentEyebrow')}
              title={t('home.recentTitle')}
              intro={t('home.recentIntro')}
              books={data.recent}
            />
            <PopularCategories categories={data.categories} />
            <ServicesPreview services={data.services} />
            <Announcements items={data.announcements} />
            <HoursAndContact />
          </>
        )}
        <LibraryGuide />
        <MembershipBanner />
      </div>
    </div>
  )
}
