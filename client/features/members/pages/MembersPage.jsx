import { useTranslation } from 'react-i18next'
import { usePagedList } from '../../../shared/hooks/usePagedList'
import Pagination from '../../../shared/components/Pagination'
import { Input } from '../../../shared/components/primitives/input'
import { Button } from '../../../shared/components/primitives/button'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import {
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeading,
  Status,
} from '../../../shared/components/ui'
import MemberForm from '../components/MemberForm'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../auth/providers/AuthProvider'
export default function MembersPage({ team = false }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [editor, setEditor] = useState(null)
  const members = usePagedList(
    team ? 'team' : 'members',
    '/staff/members',
    `group=${team ? 'team' : 'members'}&q=${encodeURIComponent(search)}`,
  )
  const filtered = members.data
  if (team && user?.role !== 'admin') return <Navigate to="/staff" replace />
  return (
    <>
      <PageHeading
        eyebrow={t('ui.members.eyebrow')}
        title={team ? t('nav.team') : t('nav.members')}
        description={team ? t('ui.members.teamIntro') : t('ui.members.intro')}
      >
        <Button className="button" onClick={() => setEditor('new')}>
          <Plus size={18} />
          {team ? t('ui.members.createStaff') : t('ui.members.register')}
        </Button>
      </PageHeading>
      <section className="panel">
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={18} />
            <Input
              aria-label={t('ui.members.search')}
              placeholder={t('reports.searchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <span className="muted">{t('ui.members.count', { count: members.total })}</span>
        </div>
        {members.isPending ? (
          <Loading />
        ) : members.error ? (
          <ErrorState error={members.error} />
        ) : filtered.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('ui.issue.member')}</th>
                  <th>{t('home.email')}</th>
                  <th>{t('ui.members.role')}</th>
                  <th>{t('member.status')}</th>
                  <th>{t('member.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
                  <tr key={member._id}>
                    <td>
                      <div className="member-cell">
                        <span className="avatar">{member.name.slice(0, 2).toUpperCase()}</span>
                        <strong>{member.name}</strong>
                      </div>
                    </td>
                    <td>{member.email}</td>
                    <td>{t(`ui.roles.${member.role}`)}</td>
                    <td>
                      <Status value={member.status} />
                    </td>
                    <td>
                      <Button className="button secondary small" onClick={() => setEditor(member)}>
                        {t('ui.members.manage')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t('ui.members.empty')} />
        )}
        <Pagination
          page={members.page}
          pages={members.pages}
          total={members.total}
          setPage={members.setPage}
        />
      </section>
      <Modal
        title={
          team
            ? editor === 'new'
              ? t('ui.members.createStaff')
              : t('ui.members.manageStaff')
            : editor === 'new'
              ? t('ui.members.registerTitle')
              : t('ui.members.manageMember')
        }
        description={t('ui.members.dialogIntro')}
        open={!!editor}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        {editor && (
          <MemberForm
            team={team}
            key={editor === 'new' ? 'new' : editor._id}
            member={editor === 'new' ? undefined : editor}
            onSaved={() => setEditor(null)}
          />
        )}
      </Modal>
    </>
  )
}
