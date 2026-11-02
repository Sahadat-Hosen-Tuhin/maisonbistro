import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api, { apiOrigin } from '../../services/api'
import './customer.css'

function CustomerDashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState({ totals: {}, recent: [], reservations: [], notifications: [], profile: {} })
  const [orders, setOrders] = useState([])
  const [addresses, setAddresses] = useState([])
  const [tab, setTab] = useState('overview')
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', currentPassword: '', newPassword: '' })
  const [picture, setPicture] = useState(null)
  const [address, setAddress] = useState({ label: 'Home', addressLine: '', city: '', postalCode: '', phone: '', isDefault: false })

  async function load() {
    try {
      const [dashboard, orderResponse, addressResponse] = await Promise.all([api.get('/customer/dashboard'), api.get('/customer/orders'), api.get('/customer/addresses')])
      setData(dashboard.data.data); setOrders(orderResponse.data.data || []); setAddresses(addressResponse.data.data || [])
      setForm((current) => ({ ...current, ...dashboard.data.data.profile }))
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load customer dashboard') }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.get('/customer/dashboard'), api.get('/customer/orders'), api.get('/customer/addresses')]).then(([dashboard, orderResponse, addressResponse]) => {
      if (!active) return
      setData(dashboard.data.data); setOrders(orderResponse.data.data || []); setAddresses(addressResponse.data.data || [])
      setForm((current) => ({ ...current, ...dashboard.data.data.profile }))
    }).catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load customer dashboard') })
    return () => { active = false }
  }, [])
  async function cancelOrder(id) { try { await api.patch(`/customer/orders/${id}/cancel`, {}); toast.success('Order cancelled'); await load() } catch (error) { toast.error(error.response?.data?.message || 'Unable to cancel order') } }
  async function reorder(id) { try { await api.post(`/customer/orders/${id}/reorder`); toast.success('Order placed again'); await load() } catch (error) { toast.error(error.response?.data?.message || 'Unable to reorder') } }
  async function saveProfile(event) {
    event.preventDefault()
    try {
      const payload = new FormData()
      ;['fullName', 'email', 'phone'].forEach((key) => payload.append(key, form[key] || ''))
      if (picture) payload.append('profilePicture', picture)
      const result = await api.patch('/customer/profile', payload)
      localStorage.setItem('maison_customer_user', JSON.stringify(result.data.data)); toast.success('Profile updated'); await load()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update profile') }
  }
  async function changePassword(event) {
    event.preventDefault()
    try { await api.patch('/customer/password', { currentPassword: form.currentPassword, newPassword: form.newPassword }); toast.success('Password changed'); setForm((current) => ({ ...current, currentPassword: '', newPassword: '' })) } catch (error) { toast.error(error.response?.data?.message || 'Unable to change password') }
  }
  async function saveAddress(event) { event.preventDefault(); try { await api.post('/customer/addresses', address); toast.success('Address saved'); setAddress({ label: 'Home', addressLine: '', city: '', postalCode: '', phone: '', isDefault: false }); await load() } catch (error) { toast.error(error.response?.data?.message || 'Unable to save address') } }
  async function readNotification(id) { try { await api.patch(`/customer/notifications/${id}/read`); setData((current) => ({ ...current, notifications: current.notifications.map((notice) => notice._id === id ? { ...notice, isRead: true } : notice) })) } catch (error) { toast.error(error.response?.data?.message || 'Unable to update notification') } }
  function logout() { localStorage.removeItem('maison_customer_token'); localStorage.removeItem('maison_customer_user'); navigate('/customer/login', { replace: true }) }
  const profile = data.profile || {}
  return <div className="customer-shell"><header className="customer-topbar"><Link to="/" className="customer-logo"><img src="/images/logo.png" alt="Maison Bistro" /></Link><div><span>{profile.fullName || 'Customer'}</span><Link className="customer-order-link" to="/#menu">Order from menu</Link><button onClick={logout}>Logout</button></div></header><main className="customer-main"><div className="customer-heading"><p>YOUR MAISON BISTRO ACCOUNT</p><h1>Customer dashboard</h1></div><nav className="customer-tabs">{[['overview', 'Overview'], ['orders', 'My orders'], ['reservations', 'Reservations'], ['addresses', 'Addresses'], ['profile', 'Profile'], ['notifications', 'Notifications']].map(([value, label]) => <button type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{label}</button>)}</nav>{tab === 'overview' && <><Stats totals={data.totals} /><CustomerOrders orders={data.recent} onCancel={cancelOrder} onReorder={reorder} /></>}{tab === 'orders' && <CustomerOrders orders={orders} onCancel={cancelOrder} onReorder={reorder} />}{tab === 'reservations' && <CustomerReservations reservations={data.reservations} />}{tab === 'addresses' && <section className="customer-panel"><h2>Saved addresses</h2>{addresses.map((entry) => <p className="customer-row" key={entry._id}><span><strong>{entry.label}</strong> {entry.addressLine}, {entry.city}</span>{entry.isDefault && <b>Default</b>}</p>)}<form className="customer-form" onSubmit={saveAddress}><input placeholder="Label" value={address.label} onChange={(event) => setAddress({ ...address, label: event.target.value })} /><input required placeholder="Address" value={address.addressLine} onChange={(event) => setAddress({ ...address, addressLine: event.target.value })} /><input placeholder="City" value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /><label><input type="checkbox" checked={address.isDefault} onChange={(event) => setAddress({ ...address, isDefault: event.target.checked })} /> Default address</label><button>Save address</button></form></section>}{tab === 'profile' && <div className="customer-profile-grid"><form className="customer-panel customer-form" onSubmit={saveProfile}><h2>Profile information</h2><input required value={form.fullName || ''} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Name" /><input required type="email" value={form.email || ''} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Email" /><input value={form.phone || ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone" /><input type="file" accept="image/*" onChange={(event) => setPicture(event.target.files?.[0] || null)} /><button>Save profile</button>{profile.profilePicture && <img className="customer-picture" src={`${apiOrigin}${profile.profilePicture}`} alt="" />}</form><form className="customer-panel customer-form" onSubmit={changePassword}><h2>Change password</h2><input required type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} placeholder="Current password" /><input required minLength="8" type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} placeholder="New password" /><button>Change password</button></form></div>}{tab === 'notifications' && <section className="customer-panel"><h2>Notifications</h2>{data.notifications.map((notice) => <p className={`customer-notice ${notice.isRead ? '' : 'unread'}`} key={notice._id}><strong>{notice.title}</strong> {notice.message}{!notice.isRead && <button onClick={() => readNotification(notice._id)}>Mark read</button>}</p>)}{!data.notifications.length && <p>No notifications.</p>}</section>}</main></div>
}

function Stats({ totals }) { return <section className="customer-stats">{[['Total orders', totals.total], ['Pending', totals.pending], ['Completed', totals.completed], ['Cancelled', totals.cancelled]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value || 0}</strong></article>)}</section> }
function CustomerOrders({ orders, onCancel, onReorder }) { return <section className="customer-panel"><h2>Orders</h2>{orders.map((order) => <article className="customer-order" key={order._id}><div><strong>#{order.orderNumber}</strong><span>{order.type} · {order.items?.length} items · {order.paymentStatus}</span></div><b>৳{Number(order.total || 0).toFixed(2)}</b><em>{order.onlineApproval === 'pending' ? 'Awaiting cashier confirmation' : order.onlineApproval === 'rejected' ? 'Rejected by cashier' : order.status}</em><div><button onClick={() => onReorder(order._id)}>Reorder</button>{['pending', 'accepted'].includes(order.status) && <button onClick={() => onCancel(order._id)}>Cancel</button>}</div></article>)}{!orders.length && <p>No orders yet.</p>}</section> }
function CustomerReservations({ reservations }) { return <section className="customer-panel"><h2>My reservations</h2>{reservations.map((entry) => <p className="customer-row" key={entry._id}><span><strong>{entry.reservationNumber}</strong> · {new Date(entry.date).toLocaleDateString()} · {entry.startTime}</span><b>{entry.status}</b></p>)}{!reservations.length && <p>No reservations yet.</p>}</section> }
export default CustomerDashboard
