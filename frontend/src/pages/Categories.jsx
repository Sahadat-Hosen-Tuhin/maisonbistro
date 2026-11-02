import { useEffect, useState } from 'react'
import { ArrowRight, Utensils } from 'lucide-react'
import api, { apiOrigin } from '../services/api'
import Header from '../components/Header'
import Footer from '../components/Footer'
import './categories.css'
import { LogoLoader, ScrollReveal } from '../components/PublicEnhancements'

function Categories() {
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/menu/categories?limit=100'),
      api.get('/menu/items?limit=100&isAvailable=true'),
    ]).then(([categoryResponse, itemResponse]) => {
      if (!active) return
      setCategories(categoryResponse.data.data || [])
      setItems(itemResponse.data.data || [])
    }).catch(() => {
      if (active) { setCategories([]); setItems([]) }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <div className="landing-page"><Header /><LogoLoader label="Loading our categories..." /></div>
  return (
    <div className="landing-page">
      <Header />
      <ScrollReveal><main className="categories-page">
        <section className="categories-hero">
          <p className="menu-kicker">MAISON BISTRO / EXPLORE</p>
          <h1>Choose your craving.</h1>
          <p>From comforting classics to fresh favourites, find something made for your table.</p>
        </section>
        {loading && <div className="category-empty">Loading categories...</div>}
        {!loading && !categories.length && <div className="category-empty">No categories are available yet.</div>}
        <section className="category-grid">
          {categories.map((category) => {
            const count = items.filter((item) => (item.category?._id || item.category) === category._id).length
            return (
              <a className="category-card" href={`/categories/${category.slug || category.name.toLowerCase().replace(/\s+/g, '-')}`} key={category._id}>
                <div className="category-card-image">
                  {category.image ? <img src={`${apiOrigin}${category.image}`} alt={category.name} /> : <Utensils size={34} />}
                  <span><ArrowRight size={17} /></span>
                </div>
                <div className="category-card-content">
                  <div><h2>{category.name}</h2><p>{category.description || 'Freshly prepared choices for every mood.'}</p></div>
                  <strong>{count} {count === 1 ? 'item' : 'items'}</strong>
                </div>
              </a>
            )
          })}
        </section>
      </main></ScrollReveal>
      <Footer />
    </div>
  )
}

export default Categories
