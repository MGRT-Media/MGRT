/**
 * Intentionally blank page shell for /work, /about and /contact.
 *
 * These three pages are designed individually in a later phase. All this
 * renders is the page identifier, which exists so routing can be verified —
 * it is a placeholder, not a design decision, and no layout, content or
 * imagery should accumulate here. When each page gets its real treatment it
 * should get its own component rather than growing branches inside this one.
 */
export default function BlankPage({ title }) {
  return (
    <main className="page">
      <h1 className="page__title">{title}</h1>
    </main>
  )
}
