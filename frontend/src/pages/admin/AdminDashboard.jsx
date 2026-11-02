import { useEffect, useState } from 'react'
import api from '../../services/api'
import './admin.css'

const cards = [
  ['Total orders', 'orders'],
  ["Today's orders", 'todayOrders'],
  ['Total revenue', 'revenue', true],
  ['Total expenses', 'expenses', true],
  ['Total profit', 'profit', true],
  ['Customers', 'customers'],
  ['Employees', 'employees'],
  ['Reservations', 'reservations'],
  ['Available tables', 'availableTables'],
  ['Occupied tables', 'occupiedTables'],
]

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(({ data }) => setDashboard(data.data))
      .catch((requestError) => setError(requestError.response?.data?.message || 'Dashboard data is unavailable'))
  }, [])

  const totals = dashboard?.totals || {}
  return (
    <div>
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">OVERVIEW</p><h1>Dashboard</h1></div>
        <span className="admin-date">{new Date().toLocaleDateString()}</span>
      </div>
      {error && <div className="admin-alert">{error}. Start the backend and sign in again when MongoDB is ready.</div>}
      <div className="admin-stat-grid">
        {cards.map(([label, key, currency]) => (
          <article className="admin-stat-card" key={key}>
            <span>{label}</span>
            <strong>{currency ? `৳${Number(totals[key] || 0).toLocaleString()}` : (totals[key] || 0).toLocaleString()}</strong>
            <small>Compared with last period</small>
          </article>
        ))}
      </div>
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-eyebrow">ACTIVITY</p><h2>Recent orders</h2></div><a href="/admin/orders">View all</a></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order ID</th><th>Customer</th><th>Type</th><th>Total</th><th>Status</th></tr></thead>
            <tbody>
              {(dashboard?.recentOrders || []).map((order) => (
                <tr key={order._id}><td><a href={`/admin/orders?view=${order._id}`}>#{order.orderNumber}</a></td><td>{order.customer?.fullName || order.guest?.name || 'Walk-in'}</td><td>{order.type}</td><td>৳{Number(order.total || 0).toLocaleString()}</td><td><span className={`status-pill ${order.status}`}>{order.status}</span></td></tr>
              ))}
              {!dashboard?.recentOrders?.length && <tr><td colSpan="5" className="admin-empty">No recent orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default AdminDashboard
