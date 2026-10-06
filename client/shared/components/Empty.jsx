import { BookOpen } from 'lucide-react'
export function Empty({ title, children }) {
  return (
    <div className="state empty">
      <BookOpen size={30} />
      <h3>{title}</h3>
      {children}
    </div>
  )
}
