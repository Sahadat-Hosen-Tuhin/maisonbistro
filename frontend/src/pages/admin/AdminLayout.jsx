import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import './admin.css'

const navigation = [
  { label: 'Dashboard', path: '/admin' },
  { label: 'Floor Management', path: '/admin/floors' },
  { label: 'Orders', path: '/admin/orders' },
  { label: 'Reservations', path: '/admin/reservations' },
  { label: 'Staff', path: '/admin/staff' },
  { label: 'Menu', path: '/admin/menu' },
  { label: 'Inventory', path: '/admin/inventory' },
  { label: 'Purchases & Expenses', path: '/admin/inventory' },
  { label: 'Analytics', path: '/admin/analytics' },
  { label: 'Settings', path: '/admin/settings' },
]

function AdminLayout() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('maison_admin_user') || '{}')

  function signOut() {
    localStorage.removeItem('maison_admin_token')
    localStorage.removeItem('maison_admin_user')
    toast.success('Signed out')
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <img src="/images/logo.png" alt="" />
          <div><strong>Maison</strong><span>Bistro</span></div>
        </div>
        <p className="admin-nav-heading">MAIN MENU</p>
        <nav className="admin-nav">
          {navigation.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) => isActive ? 'admin-nav-link active' : 'admin-nav-link'}
            >
              <span className="admin-nav-dot" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <button type="button" onClick={signOut}>Sign out</button>
        </div>
      </aside>
      <section className="admin-content">
        <header className="admin-topbar">
          <div>
            <p className="admin-eyebrow">ADMIN PANEL</p>
            <span className="admin-topbar-title">Good morning, {user.fullName || 'Admin'}</span>
          </div>
          <div className="admin-profile">
            <span className="admin-avatar">{(user.fullName || 'A').charAt(0).toUpperCase()}</span>
            <span>{user.fullName || 'Administrator'}</span>
          </div>
        </header>
        <main className="admin-main"><Outlet /></main>
      </section>
    </div>
  )
}

export default AdminLayout
