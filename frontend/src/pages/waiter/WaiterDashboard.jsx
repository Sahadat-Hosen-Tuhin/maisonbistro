import { useEffect, useMemo, useState } from 'react'
import { Check, Clock3, LogOut, Minus, Plus, RefreshCw, ShoppingCart, Utensils, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import api, { apiOrigin } from '../../services/api'
import './waiter.css'

const sizeLabels = { small: 'Small', medium: 'Medium', large: 'Large', '9_inch': '9 inch', '10_inch': '10 inch', '11_inch': '11 inch', '12_inch': '12 inch', family: 'Family' }
const spicyLabels = { '25_percent': '25%', '50_percent': '50%', '75_percent': '75%', super_duper_naga: 'Super Duper Naga' }
function basePrice(item) { return Number(item.offerPrice || item.regularPrice) }
function optionPrice(item, size) { return basePrice(item) + Number(item.sizePricing?.find((entry) => entry.size === size)?.adjustment || 0) }

function WaiterDashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('maison_waiter_user') || '{}')
  const [categories, setCategories] = useState([])
  const [items, setItems] = useState([])
  const [tables, setTables] = useState([])
  const [orders, setOrders] = useState([])
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [table, setTable] = useState('')
  const [orderType, setOrderType] = useState('dine_in')
  const [guest, setGuest] = useState({ name: '', phone: '' })
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedSize, setSelectedSize] = useState('')
  const [selectedSpicy, setSelectedSpicy] = useState('')
  const [tab, setTab] = useState('order')
  const [loading, setLoading] = useState(true)
  const [overview, setOverview] = useState({})
  const [attendance, setAttendance] = useState([])
  const [salary, setSalary] = useState([])
  const [notifications, setNotifications] = useState([])

  async function loadData(showLoading = false) {
    if (showLoading) setLoading(true)
    try {
      const [menuResponse, tableResponse, orderResponse, overviewResponse] = await Promise.all([
        api.get('/waiter/menu'), api.get('/waiter/tables'), api.get('/waiter/orders'), api.get('/waiter/overview')
      ])
      setCategories(menuResponse.data.data.categories || [])
      setItems(menuResponse.data.data.items || [])
      setTables(tableResponse.data.data || [])
      setOrders(orderResponse.data.data || [])
      setOverview(overviewResponse.data.data || {})
      const [attendanceResponse, salaryResponse, notificationResponse] = await Promise.all([
        api.get('/waiter/attendance'), api.get('/waiter/salary'), api.get('/waiter/notifications')
      ])
      setAttendance(attendanceResponse.data.data || [])
      setSalary(salaryResponse.data.data || [])
      setNotifications(notificationResponse.data.data || [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load duty dashboard')
    } finally { if (showLoading) setLoading(false) }
  }

  useEffect(() => {
    let active = true
    Promise.all([api.get('/waiter/menu'), api.get('/waiter/tables'), api.get('/waiter/orders'), api.get('/waiter/overview'), api.get('/waiter/attendance'), api.get('/waiter/salary'), api.get('/waiter/notifications')])
      .then(([menuResponse, tableResponse, orderResponse, overviewResponse, attendanceResponse, salaryResponse, notificationResponse]) => {
        if (!active) return
        setCategories(menuResponse.data.data.categories || [])
        setItems(menuResponse.data.data.items || [])
        setTables(tableResponse.data.data || [])
        setOrders(orderResponse.data.data || [])
        setOverview(overviewResponse.data.data || {})
        setAttendance(attendanceResponse.data.data || [])
        setSalary(salaryResponse.data.data || [])
        setNotifications(notificationResponse.data.data || [])
      }).catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load duty dashboard') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesCategory = !category || (item.category?._id || item.category) === category
    const matchesSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  }), [items, category, search])
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const activeOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status))

  function openItem(item) {
    setSelectedItem(item)
    setSelectedSize(item.availableSizes?.[0] || '')
    setSelectedSpicy('')
  }
  function addSelectedItem() {
    const key = `${selectedItem._id}:${selectedSize}:${selectedSpicy}`
    setCart((current) => {
      const existing = current.find((entry) => entry.key === key)
      if (existing) return current.map((entry) => entry.key === key ? { ...entry, quantity: entry.quantity + 1 } : entry)
      return [...current, {
        key, foodItem: selectedItem._id, name: selectedItem.name, unitPrice: optionPrice(selectedItem, selectedSize),
        quantity: 1, selectedSize: selectedSize || undefined,
        addOns: selectedSpicy ? [{ name: selectedSpicy, type: 'spicy_level', price: 0 }] : []
      }]
    })
    setSelectedItem(null)
  }
  function changeQuantity(key, amount) {
    setCart((current) => current.map((item) => item.key === key ? { ...item, quantity: item.quantity + amount } : item).filter((item) => item.quantity > 0))
  }
  async function placeOrder(event) {
    event.preventDefault()
    if (!cart.length) return toast.error('Select food items first')
    if (orderType === 'dine_in' && !table) return toast.error('Select a table first')
    try {
      const { data } = await api.post('/waiter/orders', { type: orderType, table: orderType === 'dine_in' ? table : undefined, guest, items: cart })
      setOrders((current) => [data.data, ...current]); setCart([]); setTable(''); setGuest({ name: '', phone: '' })
      toast.success(`Order ${data.data.orderNumber} placed`); await loadData()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to place order') }
  }
  async function updateStatus(order, status) {
    try {
      const { data } = await api.patch(`/waiter/orders/${order._id}/status`, { status })
      setOrders((current) => current.map((entry) => entry._id === order._id ? data.data : entry))
      if (['completed', 'cancelled'].includes(status)) await loadData()
      toast.success(`Order marked ${status}`)
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update order') }
  }
  function logout() { localStorage.removeItem('maison_waiter_token'); localStorage.removeItem('maison_waiter_user'); navigate('/waiter/login', { replace: true }) }

  return <div className="waiter-shell">
    <header className="waiter-topbar"><div className="waiter-brand"><img src="/images/logo.png" alt="Maison Bistro" /><div><strong>Maison Bistro</strong><span>DUTY DASHBOARD</span></div></div><div className="waiter-user"><span>{user.fullName || 'Waiter'}</span><button type="button" onClick={logout}><LogOut size={15} /> Sign out</button></div></header>
    <main className="waiter-main">
      <div className="waiter-heading"><div><p>GOOD TO SEE YOU</p><h1>Duty dashboard</h1></div><div className="waiter-heading-actions"><span className="waiter-date">{new Date().toLocaleDateString()}</span><button type="button" className="waiter-refresh" onClick={() => loadData(true)}><RefreshCw size={14} /> Refresh</button></div></div>
      <div className="waiter-stat-grid"><article><span>Open orders</span><strong>{activeOrders.length}</strong></article><article><span>Available tables</span><strong>{tables.filter((entry) => entry.status === 'available').length}</strong></article><article><span>Today&apos;s orders</span><strong>{overview.orderCount ?? orders.length}</strong></article><article><span>Attendance</span><strong>{overview.attendance?.checkIn ? (overview.attendance.checkOut ? 'Done' : 'On duty') : 'Not in'}</strong></article></div>
      <nav className="waiter-tabs"><button className={tab === 'order' ? 'active' : ''} type="button" onClick={() => setTab('order')}>Take order</button><button className={tab === 'active' ? 'active' : ''} type="button" onClick={() => setTab('active')}>Active orders <b>{activeOrders.length}</b></button><button className={tab === 'tables' ? 'active' : ''} type="button" onClick={() => setTab('tables')}>Tables</button><button className={tab === 'account' ? 'active' : ''} type="button" onClick={() => setTab('account')}>My work</button></nav>
      {tab === 'order' && <div className="waiter-layout"><section className="waiter-menu-panel"><div className="waiter-section-heading"><div><span>MENU</span><h2>What would they like?</h2></div><Utensils size={19} /></div><div className="waiter-menu-tools"><div className="waiter-categories"><button type="button" className={!category ? 'active' : ''} onClick={() => setCategory('')}>All items</button>{categories.map((entry) => <button type="button" className={category === entry._id ? 'active' : ''} key={entry._id} onClick={() => setCategory(entry._id)}>{entry.name}</button>)}</div><input placeholder="Search menu..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>{loading ? <p className="waiter-empty">Loading menu...</p> : <div className="waiter-item-grid">{visibleItems.map((item) => <button type="button" className="waiter-item-card" key={item._id} onClick={() => openItem(item)}>{item.image ? <img src={`${apiOrigin}${item.image}`} alt="" /> : <div className="waiter-item-placeholder">No image</div>}<div><strong>{item.name}</strong><span>৳{basePrice(item).toFixed(2)}</span><small>{item.availableSizes?.length ? 'Choose options' : 'Click to add'}</small></div></button>)}</div>}</section><aside className="waiter-order-panel"><div className="waiter-section-heading"><div><span>CURRENT ORDER</span><h2><ShoppingCart size={17} /> {cart.reduce((sum, item) => sum + item.quantity, 0)} items</h2></div>{cart.length > 0 && <button type="button" className="clear-cart" onClick={() => setCart([])}>Clear</button>}</div><form onSubmit={placeOrder}><div className="waiter-order-types">{[['dine_in', 'Dine in'], ['takeaway', 'Takeaway'], ['walk_in', 'Walk-in']].map(([value, label]) => <button type="button" className={orderType === value ? 'active' : ''} key={value} onClick={() => { setOrderType(value); if (value !== 'dine_in') setTable('') }}>{label}</button>)}</div>{orderType === 'dine_in' && <label>Table<select required value={table} onChange={(event) => setTable(event.target.value)}><option value="">Select available table</option>{tables.filter((entry) => entry.status === 'available').map((entry) => <option value={entry._id} key={entry._id}>{entry.name} · {entry.floor?.name || 'Floor'} · {entry.capacity} seats</option>)}</select></label>}<div className="waiter-guest-grid"><input placeholder="Guest name" value={guest.name} onChange={(event) => setGuest({ ...guest, name: event.target.value })} /><input placeholder="Phone (optional)" value={guest.phone} onChange={(event) => setGuest({ ...guest, phone: event.target.value })} /></div><div className="waiter-cart">{!cart.length && <p className="waiter-empty">Click a menu item to add it here.</p>}{cart.map((item) => <div className="waiter-cart-row" key={item.key}><div><strong>{item.name}</strong><small>{item.selectedSize ? `${sizeLabels[item.selectedSize]} · ` : ''}{item.addOns?.[0] ? spicyLabels[item.addOns[0].name] : ''} · ৳{item.unitPrice.toFixed(2)}</small></div><div><button type="button" onClick={() => changeQuantity(item.key, -1)}><Minus size={12} /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.key, 1)}><Plus size={12} /></button></div></div>)}</div><div className="waiter-total"><span>Subtotal</span><strong>৳{subtotal.toFixed(2)}</strong></div><button className="waiter-place-button" type="submit" disabled={!cart.length}>Place order</button></form></aside></div>}
      {tab === 'active' && <section className="waiter-recent waiter-full-panel"><div className="waiter-section-heading"><div><span>ORDER CONTROL</span><h2>Active orders</h2></div></div>{activeOrders.length ? activeOrders.map((order) => <OrderRow key={order._id} order={order} onStatus={updateStatus} />) : <p className="waiter-empty">No active orders.</p>}</section>}
      {tab === 'tables' && <section className="waiter-recent waiter-full-panel"><div className="waiter-section-heading"><div><span>FLOOR SERVICE</span><h2>Table status</h2></div></div><div className="waiter-table-grid">{tables.map((entry) => <article className={`waiter-table-status ${entry.status}`} key={entry._id}><strong>{entry.name}</strong><span>{entry.floor?.name || 'Floor'} · {entry.capacity} seats</span><b>{entry.status}</b></article>)}</div></section>}
      {tab === 'account' && <WaiterWorkPanel user={user} overview={overview} attendance={attendance} salary={salary} notifications={notifications} onReload={loadData} onNotifications={setNotifications} />}
      <section className="waiter-recent"><div className="waiter-section-heading"><div><span>YOUR ACTIVITY</span><h2>Recent orders</h2></div></div>{orders.slice(0, 8).map((order) => <OrderRow key={order._id} order={order} onStatus={updateStatus} />)}{!orders.length && <p className="waiter-empty">No orders yet.</p>}</section>
    </main>
    {selectedItem && <div className="waiter-modal-backdrop"><section className="waiter-modal"><button type="button" className="waiter-modal-close" onClick={() => setSelectedItem(null)}><X size={17} /></button><div className="waiter-modal-image">{selectedItem.image ? <img src={`${apiOrigin}${selectedItem.image}`} alt="" /> : <span>No image</span>}</div><span className="waiter-modal-category">{selectedItem.category?.name || 'Menu item'}</span><h2>{selectedItem.name}</h2><p>{selectedItem.description || 'Freshly prepared for your table.'}</p>{selectedItem.availableSizes?.length > 0 && <label>Choose size<select value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>{selectedItem.availableSizes.map((size) => <option value={size} key={size}>{sizeLabels[size]} · ৳{optionPrice(selectedItem, size).toFixed(2)}</option>)}</select></label>}{selectedItem.spicyLevels?.length > 0 && <label>Spicy level<select value={selectedSpicy} onChange={(event) => setSelectedSpicy(event.target.value)}><option value="">Regular</option>{selectedItem.spicyLevels.map((level) => <option value={level} key={level}>{spicyLabels[level]}</option>)}</select></label>}<button type="button" className="waiter-place-button" onClick={addSelectedItem}>Add to order · ৳{optionPrice(selectedItem, selectedSize).toFixed(2)}</button></section></div>}
  </div>
}

function WaiterWorkPanel({ user, overview, attendance, salary, notifications, onReload, onNotifications }) {
  const [form, setForm] = useState({ fullName: user.fullName || '', phone: user.phone || '', address: user.address || '', currentPassword: '', newPassword: '' })
  const [picture, setPicture] = useState(null)
  async function attendanceAction(action) {
    try { await api.post(`/waiter/attendance/${action}`); toast.success(action === 'check-in' ? 'Check-in submitted for approval' : 'Check-out submitted'); await onReload() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update attendance') }
  }
  async function saveProfile(event) {
    event.preventDefault()
    try {
      const data = new FormData()
      data.append('fullName', form.fullName); data.append('phone', form.phone); data.append('address', form.address)
      if (picture) data.append('profilePicture', picture)
      const { data: response } = await api.patch('/waiter/profile', data)
      localStorage.setItem('maison_waiter_user', JSON.stringify(response.data))
      toast.success('Profile updated'); await onReload()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to update profile') }
  }
  async function changePassword(event) {
    event.preventDefault()
    try { await api.patch('/waiter/password', { currentPassword: form.currentPassword, newPassword: form.newPassword }); toast.success('Password changed'); setForm((current) => ({ ...current, currentPassword: '', newPassword: '' })) }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to change password') }
  }
  async function salaryAction(id, action) {
    try { await api.patch(`/waiter/salary/${id}/${action}`, action === 'report' ? { issue: 'Payment issue reported by waiter' } : {}); toast.success(action === 'confirm' ? 'Salary confirmed' : 'Salary issue reported'); await onReload() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update salary') }
  }
  async function markRead(id) {
    try { await api.patch(`/waiter/notifications/${id}/read`); onNotifications((current) => current.map((notice) => notice._id === id ? { ...notice, isRead: true } : notice)) }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update notification') }
  }
  const today = overview.attendance
  return <section className="waiter-work-panel">
    <div className="waiter-work-cards"><article><span>Today</span><strong>{today?.status || 'Not submitted'}</strong><small>Check in: {today?.checkIn ? new Date(today.checkIn).toLocaleTimeString() : '-'}</small><small>Check out: {today?.checkOut ? new Date(today.checkOut).toLocaleTimeString() : '-'}</small><div className="waiter-work-actions"><button disabled={Boolean(today?.checkIn)} onClick={() => attendanceAction('check-in')}>Check in</button><button disabled={!today?.checkIn || Boolean(today?.checkOut)} onClick={() => attendanceAction('check-out')}>Check out</button></div></article><article><span>Latest salary</span><strong>{overview.salary?.status || 'No record'}</strong><small>{overview.salary?.salaryMonth || '-'}</small><small>Amount: ৳{Number(overview.salary?.totalPayable || 0).toFixed(2)}</small></article></div>
    <div className="waiter-work-section"><h2>Attendance history</h2><div className="waiter-data-table">{attendance.map((entry) => <p key={entry._id}><span>{new Date(entry.date).toLocaleDateString()}</span><span>{entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : '-'} – {entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString() : '-'}</span><b>{entry.approval?.status || 'pending'}{entry.approval?.rejectionReason ? ` · ${entry.approval.rejectionReason}` : ''}</b></p>)}{!attendance.length && <p className="waiter-empty">No attendance records yet.</p>}</div></div>
    <div className="waiter-work-section"><h2>Salary history</h2><div className="waiter-data-table">{salary.map((entry) => <p key={entry._id}><span>{entry.salaryMonth}</span><span>৳{Number(entry.paymentAmount || entry.totalPayable || 0).toFixed(2)} · {entry.paymentDate ? new Date(entry.paymentDate).toLocaleDateString() : 'unpaid'}</span><b>{entry.status}{entry.status === 'awaiting_confirmation' && <><button onClick={() => salaryAction(entry._id, 'confirm')}>Confirm</button><button onClick={() => salaryAction(entry._id, 'report')}>Report</button></>}</b></p>)}{!salary.length && <p className="waiter-empty">No salary records yet.</p>}</div></div>
    <div className="waiter-work-section"><h2>Notifications</h2>{notifications.map((notice) => <p className={`waiter-notice ${notice.isRead ? '' : 'unread'}`} key={notice._id}><strong>{notice.title}</strong> {notice.message}{!notice.isRead && <button onClick={() => markRead(notice._id)}>Mark read</button>}</p>)}{!notifications.length && <p className="waiter-empty">No notifications.</p>}</div>
    <div className="waiter-profile-grid"><form className="waiter-profile-card" onSubmit={saveProfile}><h2>Personal profile</h2><label>Full name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label>Address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label>Profile picture<input type="file" accept="image/*" onChange={(event) => setPicture(event.target.files?.[0] || null)} /></label><button>Save profile</button></form><form className="waiter-profile-card" onSubmit={changePassword}><h2>Change password</h2><label>Current password<input required type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label><label>New password<input required minLength="8" type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label><button>Change password</button></form></div>
  </section>
}

function OrderRow({ order, onStatus }) {
  const nextStatus = order.status === 'pending' ? 'processing' : order.status === 'processing' ? 'ready' : order.status === 'ready' ? 'served' : ''
  return <div className="waiter-order-row"><strong>#{order.orderNumber}</strong><span>{order.table?.name || order.type}</span><span>{order.items?.reduce((sum, item) => sum + item.quantity, 0)} items</span><b>{order.status}</b>{['pending', 'processing', 'ready'].includes(order.status) && <div className="waiter-order-actions"><button type="button" title={`Mark ${nextStatus}`} onClick={() => onStatus(order, nextStatus)}>{nextStatus === 'served' ? <Check size={13} /> : <Clock3 size={13} />}</button><button type="button" title="Cancel order" onClick={() => onStatus(order, 'cancelled')}><X size={13} /></button></div>}</div>
}

export default WaiterDashboard
