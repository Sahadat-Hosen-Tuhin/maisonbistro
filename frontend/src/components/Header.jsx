import { Search, ShoppingBag, UserRound } from 'lucide-react'
import { useLocation } from 'react-router-dom'

import './site-chrome.css'

const navigation = ['Home', 'Menu', 'Categories', 'About', 'Contact']

function Header({ cartCount = 0, onCartClick }) {
  const { pathname } = useLocation()

  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Maison Bistro home">
        <img src="/images/logo.png" alt="Maison Bistro" />
      </a>

      <nav className="main-navigation" aria-label="Main navigation">
        {navigation.map((item) => (
          <a
            className={(item === 'Home' && pathname === '/') || pathname === `/${item.toLowerCase()}` ? 'navigation-link active' : 'navigation-link'}
            href={item === 'Home' ? '/' : item === 'Menu' ? '/menu' : item === 'Categories' ? '/categories' : item === 'About' ? '/about' : item === 'Contact' ? '/contact' : `#${item.toLowerCase()}`}
            key={item}
          >
            {item}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <button type="button" className="icon-button" aria-label="Search">
          <Search size={16} strokeWidth={2} />
        </button>
        <a href={localStorage.getItem('maison_customer_token') ? '/customer' : '/customer/login'} className="icon-button" aria-label="Account">
          <UserRound size={16} strokeWidth={2} />
        </a>
        <button type="button" className="icon-button cart-button" aria-label="Shopping bag" onClick={onCartClick}>
          <ShoppingBag size={16} strokeWidth={2} />
          {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
        </button>
        <a className="order-button" href="/menu">
          Order Now
        </a>
      </div>

      <button type="button" className="mobile-menu-button" aria-label="Open menu">
        <span />
        <span />
        <span />
      </button>
    </header>
  )
}

export default Header
