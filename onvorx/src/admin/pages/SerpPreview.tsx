const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function SerpPreview({
  title,
  description,
  path,
}: {
  title: string
  description: string
  path: string
}) {
  return (
    <div className="admin-serp">
      <div className="admin-serp__url">onvorx.com{path === '/' ? '' : path}</div>
      <div className="admin-serp__title">{title ? truncate(title, 60) : '(no title set)'}</div>
      <div className="admin-serp__desc">
        {description ? truncate(description, 160) : '(no description set)'}
      </div>
    </div>
  )
}
