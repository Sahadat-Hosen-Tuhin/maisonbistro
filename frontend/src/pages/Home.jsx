import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChefHat, Clock3, Heart, Leaf, Mail, Minus, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Star, Trash2, Truck, X } from 'lucide-react'
import api, { apiOrigin } from '../services/api'
import toast from 'react-hot-toast'
import Header from '../components/Header'
import Footer from '../components/Footer'
import { LogoLoader, ScrollReveal } from '../components/PublicEnhancements'
import '../styles/home.css'

const pageSize = 12

function imageUrl(image) {
  return image ? `${apiOrigin}${image}` : ''
}
function itemSlug(item) {
  return item.slug || item.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function formatPrice(value) {
  return `৳${Number(value || 0).toFixed(2)}`
}

function MenuCard({ item, onView, onAdd }) {
  return (
    <article className="public-menu-card" onClick={() => { onView(item); window.location.href = `/menu/${itemSlug(item)}` }}>
      <div className="public-menu-image">
        {item.image ? <img src={imageUrl(item.image)} alt={item.name} /> : <span>No image</span>}
        <button type="button" className="menu-favorite" aria-label={`Add ${item.name} to favorites`} onClick={(event) => event.stopPropagation()}><Heart size={15} /></button>
        {item.isFeatured && <span className="menu-badge">Featured</span>}
      </div>
      <div className="public-menu-card-content">
        <span className="public-menu-category">{item.category?.name || 'Maison Bistro'}</span>
        <h3>{item.name}</h3>
        <p>{item.description || 'Freshly prepared with quality ingredients.'}</p>
        <div className="menu-card-meta"><span><Star size={11} fill="currentColor" /> {Number(item.ratingAverage || 0).toFixed(1)}</span><strong>{formatPrice(item.offerPrice || item.regularPrice)}</strong><button type="button" aria-label={`Add ${item.name}`} onClick={(event) => { event.stopPropagation(); onAdd(item) }}><Plus size={15} /></button></div>
      </div>
    </article>
  )
}

function Home({ menuOnly = false }) {
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(() => new URLSearchParams(window.location.search).get('category') || '')
  const [dietary, setDietary] = useState('')
  const [sort, setSort] = useState('popular')
  const [page, setPage] = useState(1)
  const [recent, setRecent] = useState(() => {
    try { return JSON.parse(localStorage.getItem('maison_recent_menu') || '[]') } catch { return [] }
  })
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('maison_cart') || '[]') } catch { return [] }
  })
  const [cartOpen, setCartOpen] = useState(false)
  const [checkout, setCheckout] = useState({ name: '', phone: '', address: '' })
  const [customerProfile, setCustomerProfile] = useState(null)
  const [savedAddresses, setSavedAddresses] = useState([])
  const [placing, setPlacing] = useState(false)
  const [confirmation, setConfirmation] = useState('')

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

  useEffect(() => {
    if (!localStorage.getItem('maison_customer_token')) return
    Promise.all([api.get('/customer/dashboard'), api.get('/customer/addresses')])
      .then(([dashboardResponse, addressResponse]) => {
        const profile = dashboardResponse.data.data?.profile
        const addresses = addressResponse.data.data || []
        setCustomerProfile(profile)
        setSavedAddresses(addresses)
        const defaultAddress = addresses.find((entry) => entry.isDefault) || addresses[0]
        setCheckout((current) => ({
          ...current,
          name: profile?.fullName || '',
          phone: profile?.phone || '',
          address: defaultAddress?.addressLine || ''
        }))
      })
      .catch(() => {
        setCustomerProfile(null)
        setSavedAddresses([])
      })
  }, [])

  const filteredItems = useMemo(() => items.filter((item) => {
    const matchesSearch = !search || `${item.name} ${item.description || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !category || (item.category?._id || item.category) === category
    const matchesDietary = !dietary || item.dietary?.includes(dietary)
    return matchesSearch && matchesCategory && matchesDietary
  }).sort((first, second) => {
    if (sort === 'price') return Number(first.offerPrice || first.regularPrice) - Number(second.offerPrice || second.regularPrice)
    return Number(second.ratingAverage || 0) - Number(first.ratingAverage || 0)
  }), [items, search, category, dietary, sort])
  const totalPages = Math.max(Math.ceil(filteredItems.length / pageSize), 1)
  const pageItems = filteredItems.slice((page - 1) * pageSize, page * pageSize)

  function updateFilter(setter, value) { setter(value); setPage(1) }
  function viewItem(item) {
    const next = [item, ...recent.filter((entry) => entry._id !== item._id)].slice(0, 4)
    setRecent(next)
    localStorage.setItem('maison_recent_menu', JSON.stringify(next))
  }
  function addToCart(item) {
    setCart((current) => {
      const existing = current.find((entry) => entry.foodItem === item._id)
      const next = existing
        ? current.map((entry) => entry.foodItem === item._id ? { ...entry, quantity: entry.quantity + 1 } : entry)
        : [...current, { foodItem: item._id, name: item.name, unitPrice: Number(item.offerPrice || item.regularPrice), quantity: 1 }]
      localStorage.setItem('maison_cart', JSON.stringify(next))
      return next
    })
    toast.success(`${item.name} added to cart`)
  }
  function changeCart(foodItem, amount) {
    setCart((current) => {
      const next = current.map((entry) => entry.foodItem === foodItem ? { ...entry, quantity: entry.quantity + amount } : entry).filter((entry) => entry.quantity > 0)
      localStorage.setItem('maison_cart', JSON.stringify(next))
      return next
    })
  }
  async function placeCartOrder(event) {
    event.preventDefault()
    if (!cart.length) return
    setPlacing(true)
    try {
      const customerToken = localStorage.getItem('maison_customer_token')
      const endpoint = customerToken ? '/customer/orders' : '/customer/guest-orders'
      const payload = customerToken
        ? { type: 'online', items: cart, deliveryAddress: checkout.address }
        : { ...checkout, type: 'online', items: cart }
      const { data } = await api.post(endpoint, payload)
      setConfirmation(data.data.orderNumber)
      setCart([]); localStorage.removeItem('maison_cart')
      setCheckout({ name: '', phone: '', address: '' })
    } catch (error) { window.alert(error.response?.data?.message || 'Unable to place order') }
    finally { setPlacing(false) }
  }
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const bestSelling = [...items].sort((first, second) => Number(second.ratingAverage || 0) - Number(first.ratingAverage || 0)).slice(0, 4)
  const offers = items.filter((item) => Number(item.offerPrice || 0) > 0 && Number(item.offerPrice) < Number(item.regularPrice)).slice(0, 4)
  const featured = items.filter((item) => item.isFeatured).slice(0, 4)

  if (loading) {
    return <div className="landing-page"><Header cartCount={cartCount} onCartClick={() => setCartOpen(true)} /><LogoLoader label="Preparing the Maison menu..." /></div>
  }
  return (
    <div className="landing-page">
      <Header cartCount={cartCount} onCartClick={() => setCartOpen(true)} />
      <ScrollReveal><main className={menuOnly ? 'home-page menu-only-page' : 'home-page'}>
        {!menuOnly && <>
        <section className="home-hero">
          <div className="home-hero-copy"><p className="menu-kicker">WELCOME TO MAISON BISTRO</p><h1>Good food.<br /><em>Good mood.</em></h1><p>Freshly prepared favourites, made with care and served for every table.</p><div className="home-hero-actions"><a className="home-primary-button" href="/menu">Explore our menu <ArrowRight size={15} /></a><a className="home-secondary-link" href="/about">Our story <ArrowRight size={14} /></a></div><div className="home-hero-note"><span><ChefHat size={16} /> Made fresh daily</span><span><Leaf size={16} /> Quality ingredients</span></div></div>
          <div className="home-hero-art"><div className="home-hero-circle"><Sparkles size={20} /><strong>MAISON</strong><span>Fresh · Warm · Yours</span></div><div className="home-hero-stamp">EST.<br /><b>2024</b></div></div>
        </section>
        <section className="home-section home-category-section"><div className="home-section-heading"><div><p className="menu-kicker">EXPLORE THE MENU</p><h2>Something for every craving.</h2></div><a href="/categories">View all categories <ArrowRight size={14} /></a></div><div className="home-category-grid">{categories.slice(0, 6).map((entry) => <a className="home-category-card" href={`/?category=${entry._id}`} key={entry._id}>{entry.image ? <img src={imageUrl(entry.image)} alt={entry.name} /> : <ChefHat size={24} />}<div><strong>{entry.name}</strong><span>{entry.description || 'Made fresh for you'}</span></div><ArrowRight size={15} /></a>)}</div>{!loading && !categories.length && <p className="home-muted">Our categories are being prepared. Check back soon.</p>}</section>
        <section className="home-section" id="best-selling"><div className="home-section-heading"><div><p className="menu-kicker">CUSTOMER FAVOURITES</p><h2>Best selling products.</h2></div><a href="/menu">See the full menu <ArrowRight size={14} /></a></div><div className="home-product-grid">{bestSelling.map((item) => <MenuCard key={item._id} item={item} onView={viewItem} onAdd={addToCart} />)}</div></section>
        <section className="home-offer-banner"><div><p className="menu-kicker">MAISON SPECIAL</p><h2>A little more joy<br /><em>in every bite.</em></h2><p>Discover delicious deals made for sharing, available while supplies last.</p><a className="home-primary-button" href="#special-offers">View today&apos;s offers <ArrowRight size={15} /></a></div><div className="home-offer-art"><span>FRESH<br /><b>DEAL</b></span></div></section>
        {offers.length > 0 && <section className="home-section" id="special-offers"><div className="home-section-heading"><div><p className="menu-kicker">ONLY FOR A WHILE</p><h2>Special offers & deals.</h2></div></div><div className="home-product-grid">{offers.map((item) => <MenuCard key={item._id} item={item} onView={viewItem} onAdd={addToCart} />)}</div></section>}
        {featured.length > 0 && <section className="home-section home-featured-section"><div className="home-section-heading"><div><p className="menu-kicker">HANDPICKED FOR YOU</p><h2>Featured products.</h2></div><a href="/menu">Browse menu <ArrowRight size={14} /></a></div><div className="home-product-grid">{featured.map((item) => <MenuCard key={item._id} item={item} onView={viewItem} onAdd={addToCart} />)}</div></section>}
        <section className="home-section home-why-section"><div className="home-section-heading"><div><p className="menu-kicker">WHY MAISON</p><h2>Made for good moments.</h2></div><p>From our kitchen to your table, we keep things fresh, thoughtful and full of flavour.</p></div><div className="home-values"><article><span><Leaf size={20} /></span><h3>Fresh ingredients</h3><p>Thoughtful ingredients, prepared fresh for every order.</p></article><article><span><Clock3 size={20} /></span><h3>Made with care</h3><p>Quality food and warm service, right when you need it.</p></article><article><span><Truck size={20} /></span><h3>At your doorstep</h3><p>Easy online ordering and dependable delivery to your door.</p></article><article><span><ShieldCheck size={20} /></span><h3>Always reliable</h3><p>A comfortable experience you can come back to again and again.</p></article></div></section>
        <section className="home-about-strip"><div className="home-about-mark">M</div><div><p className="menu-kicker">ABOUT OUR RESTAURANT</p><h2>A neighbourhood table<br /><em>with a big heart.</em></h2><p>Maison Bistro is a place for quick lunches, family celebrations, late-night cravings and everyday meals that feel like home.</p><a className="home-secondary-link" href="/about">Read our story <ArrowRight size={14} /></a></div></section>
        <section className="home-newsletter"><div><p className="menu-kicker">STAY IN THE LOOP</p><h2>Good news, delivered.</h2><p>Get new dishes, special offers and a little Maison joy in your inbox.</p></div><form onSubmit={(event) => { event.preventDefault(); toast.success('Thanks for subscribing!') }}><Mail size={17} /><input type="email" required placeholder="Your email address" /><button type="submit">Subscribe <ArrowRight size={14} /></button></form></section>
        </>}
        {menuOnly && <section className="menu-page" id="menu">
        <section className="menu-hero"><div><p className="menu-kicker">MAISON BISTRO / MENU</p><h1>Full Menu</h1><p>Explore our freshly prepared favourites, made for every table.</p></div><div className="menu-search"><Search size={16} /><input value={search} onChange={(event) => updateFilter(setSearch, event.target.value)} placeholder="Search burgers, pizza, drinks..." /><button type="button">Search</button></div></section>
        <div className="menu-layout">
          <aside className="menu-filters">
            <div className="filter-heading"><h2>Filters</h2><SlidersHorizontal size={15} /></div>
            <fieldset><legend>Category</legend><label><input type="radio" checked={!category} onChange={() => updateFilter(setCategory, '')} /> All</label>{categories.map((entry) => <label key={entry._id}><input type="radio" checked={category === entry._id} onChange={() => updateFilter(setCategory, entry._id)} /> {entry.name}</label>)}</fieldset>
            <fieldset><legend>Dietary</legend>{[['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['spicy', 'Spicy'], ['gluten_free', 'Gluten-free'], ['meat_lovers', 'Meat lovers']].map(([value, label]) => <label key={value}><input type="radio" name="dietary" checked={dietary === value} onChange={() => updateFilter(setDietary, dietary === value ? '' : value)} /> {label}</label>)}</fieldset>
            <button type="button" className="clear-filter" onClick={() => { setCategory(''); setDietary(''); setSearch(''); setPage(1) }}>Clear all filters</button>
          </aside>
          <section className="menu-results" id="menu">
            <div className="menu-results-heading"><div><span className="menu-result-count">{filteredItems.length} menu items</span><h2>Good food, good mood.</h2></div><select aria-label="Sort menu" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1) }}><option value="popular">Sort by: Popular</option><option value="price">Price: Low to high</option></select></div>
            {loading && <div className="menu-empty">Loading our menu...</div>}
            {!loading && !pageItems.length && <div className="menu-empty">No menu items match your filters.</div>}
            <div className="public-menu-grid">{pageItems.map((item) => <MenuCard key={item._id} item={item} onView={viewItem} onAdd={addToCart} />)}</div>
            {totalPages > 1 && <div className="public-pagination"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map((value) => <button type="button" className={page === value ? 'active' : ''} key={value} onClick={() => setPage(value)}>{value}</button>)}<button type="button" disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>›</button></div>}
          </section>
        </div>
        {recent.length > 0 && <section className="recent-menu"><div className="recent-heading"><div><p className="menu-kicker">YOUR PICKS</p><h2>Recently viewed</h2></div></div><div className="recent-grid">{recent.map((item) => <MenuCard key={item._id} item={item} onView={viewItem} onAdd={addToCart} />)}</div></section>}
        </section>}
      </main></ScrollReveal>
      <Footer />
      {cartOpen && <div className="cart-drawer-backdrop" onClick={() => setCartOpen(false)}><aside className="cart-drawer" onClick={(event) => event.stopPropagation()}><button className="cart-close" type="button" onClick={() => setCartOpen(false)}><X size={18} /></button><p className="menu-kicker">YOUR ORDER</p><h2>Cart <span>{cartCount} items</span></h2>{confirmation ? <div className="cart-confirmation"><strong>Order received</strong><p>Your reference is <b>#{confirmation}</b>.</p><p>Cash on Delivery · Waiting for cashier confirmation</p><button type="button" onClick={() => setConfirmation('')}>Place another order</button></div> : <>{!cart.length && <p className="cart-empty">Your cart is empty. Add something delicious from the menu.</p>}{cart.map((item) => <div className="cart-line" key={item.foodItem}><div><strong>{item.name}</strong><small>৳{item.unitPrice.toFixed(2)}</small></div><div><button type="button" onClick={() => changeCart(item.foodItem, -1)}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeCart(item.foodItem, 1)}><Plus size={13} /></button><button type="button" className="cart-remove" onClick={() => changeCart(item.foodItem, -item.quantity)}><Trash2 size={13} /></button></div></div>)}{cart.length > 0 && <><div className="cart-total"><span>Total</span><strong>৳{cartTotal.toFixed(2)}</strong></div><form className="cart-checkout-form" onSubmit={placeCartOrder}>{customerProfile ? <><p>Ordering as <strong>{customerProfile.fullName}</strong>{customerProfile.phone ? ` · ${customerProfile.phone}` : ''}</p>{savedAddresses.length > 0 && <select value={checkout.address} onChange={(event) => setCheckout({ ...checkout, address: event.target.value })}>{savedAddresses.map((entry) => <option value={entry.addressLine} key={entry._id}>{entry.label}: {entry.addressLine}</option>)}</select>}</> : <><input required placeholder="Your name" value={checkout.name} onChange={(event) => setCheckout({ ...checkout, name: event.target.value })} /><input required placeholder="Phone number" value={checkout.phone} onChange={(event) => setCheckout({ ...checkout, phone: event.target.value })} /></>}<textarea required rows="3" placeholder="Delivery address" value={checkout.address} onChange={(event) => setCheckout({ ...checkout, address: event.target.value })} /><div className="cod-label"><span>Payment method</span><strong>Cash on Delivery</strong></div><button disabled={placing} type="submit">{placing ? 'Placing order...' : 'Place order'}</button></form></>}</>}</aside></div>}
    </div>
  )
}

export default Home
