import { useState } from 'react'
export default function UserAvatar({ user, large = false }) {
  const [failed, setFailed] = useState(null)
  return (
    <span className={`avatar${large ? ' avatar-large' : ''}`}>
      {user?.avatarId && failed !== user.avatarId ? (
        <img
          src={`/api/covers/${user.avatarId}`}
          alt={`${user.name} profile photo`}
          onError={() => setFailed(user.avatarId)}
        />
      ) : (
        user?.name.slice(0, 2).toUpperCase()
      )}
    </span>
  )
}
