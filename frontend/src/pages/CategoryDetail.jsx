import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import api, { apiOrigin } from '../services/api'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { LogoLoader, ScrollReveal } from '../components/PublicEnhancements'
import '../styles/home.css'
import './categories.css'

function CategoryDetail() {
  const { slug } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get(`/menu/categories/slug/${slug}`).then(({ data: response }) => setData(response.data)).catch(() => setData(null)).finally(() => setLoading(false))
  }, [slug])
  if (loading) return <div className="landing-page"><Header /><LogoLoader label="Loading this category..." /></div>
  return <div className="landing-page"><Header /><ScrollReveal><main className="category-detail-page"><section className="category-detail-hero"><p className="menu-kicker">MAISON BISTRO / CATEGORY</p><h1>{data?.category?.name || 'Category not found'}</h1><p>{data?.category?.description || 'Explore freshly prepared choices.'}</p></section>{data?.items?.length ? <div className="category-detail-grid">{data.items.map((item) => <Link className="category-detail-card" to={`/menu/${item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} key={item._id}><div className="category-detail-image">{item.image ? <img src={`${apiOrigin}${item.image}`} alt={item.name} /> : <span>No image</span>}</div><div className="category-detail-content"><span className="public-menu-category">{data.category.name}</span><h2>{item.name}</h2><p>{item.description || 'Freshly prepared with quality ingredients.'}</p><strong>{`৳${Number(item.offerPrice || item.regularPrice).toFixed(2)}`} <ArrowRight size={14} /></strong></div></Link>)}</div> : <p className="menu-empty">No items found in this category.</p>}</main></ScrollReveal><Footer /></div>
}

export default CategoryDetail
