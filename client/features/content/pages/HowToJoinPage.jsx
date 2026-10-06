import { useTranslation } from 'react-i18next'
import ContentPage, { JoinButton } from '../components/ContentPage'

export default function HowToJoinPage() {
  const { t } = useTranslation()
  return (
    <ContentPage
      kind="joininfo"
      page="howToJoin"
      footer={
        <div className="content-cta">
          <JoinButton label={t('pages.howToJoin.cta')} />
        </div>
      }
    />
  )
}
