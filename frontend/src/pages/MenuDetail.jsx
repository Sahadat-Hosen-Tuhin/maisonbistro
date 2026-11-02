import { useEffect, useState } from 'react'
import { ArrowLeft, ShoppingBag } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { apiOrigin } from '../services/api'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { LogoLoader, ScrollReveal } from '../components/PublicEnhancements'
import '../styles/home.css'

function MenuDetail() {
  const { slug } = useParams()
  const [item, setItem] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cartCount, setCartCount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('maison_cart') || '[]').reduce((sum, entry) => sum + entry.quantity, 0) } catch { return 0 }
  })
  useEffect(() => { api.get(`/menu/items/slug/${slug}`).then(({ data }) => setItem(data.data)).catch(() => setItem(null)).finally(() => setLoading(false)) }, [slug])
  function addToCart() {
    const cart = JSON.parse(localStorage.getItem('maison_cart') || '[]')
    const price = Number(item.offerPrice || item.regularPrice)
    const existing = cart.find((entry) => entry.foodItem === item._id)
    const next = existing
      ? cart.map((entry) => entry.foodItem === item._id ? { ...entry, quantity: entry.quantity + 1 } : entry)
      : [...cart, { foodItem: item._id, name: item.name, unitPrice: price, quantity: 1 }]
    localStorage.setItem('maison_cart', JSON.stringify(next))
    setCartCount(next.reduce((sum, entry) => sum + entry.quantity, 0))
    toast.success(`${item.name} added to cart`)
  }
  if (loading) return <div className="landing-page"><Header /><LogoLoader label="Preparing your menu item..." /></div>
  return <div className="landing-page"><Header cartCount={cartCount} onCartClick={() => { window.location.href = '/menu' }} /><ScrollReveal><main className="menu-page"><Link className="home-secondary-link" to="/menu"><ArrowLeft size={14} /> Back to menu</Link>{item ? <article className="menu-detail-card"><div className="menu-detail-image">{item.image ? <img src={`${apiOrigin}${item.image}`} alt={item.name} /> : <span>No image</span>}</div><div><p className="menu-kicker">{item.category?.name || 'MAISON BISTRO'}</p><h1>{item.name}</h1><p>{item.description || 'Freshly prepared with quality ingredients.'}</p><strong>৳{Number(item.offerPrice || item.regularPrice).toFixed(2)}</strong><button className="home-primary-button" type="button" onClick={addToCart}><ShoppingBag size={15} /> Add to cart</button></div></article> : <p className="menu-empty">Menu item not found.</p>}</main></ScrollReveal><Footer /></div>
}

export default MenuDetail
