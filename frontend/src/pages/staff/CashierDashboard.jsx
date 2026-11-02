import { useEffect, useState } from 'react'
import { CheckCircle2, FileText, RefreshCw, UserRound } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { StaffTopbar } from './KitchenDashboard'
import './staff.css'

function CashierDashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('maison_cashier_user') || '{}')
  const [tab, setTab] = useState('billing')
  const [overview, setOverview] = useState({})
  const [orders, setOrders] = useState([])
  const [onlineOrders, setOnlineOrders] = useState([])
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [attendance, setAttendance] = useState([])
  const [salary, setSalary] = useState([])
  const [notifications, setNotifications] = useState([])
  const [activity, setActivity] = useState([])
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState({})
  const [amount, setAmount] = useState({})
  const [loading, setLoading] = useState(true)

  async function load(showLoading = false) {
    if (showLoading) setLoading(true)
    try {
      const responses = await Promise.all([
        api.get('/cashier/overview'), api.get(`/cashier/orders${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        api.get('/cashier/payments'), api.get('/cashier/invoices'), api.get('/cashier/attendance'),
        api.get('/cashier/salary'), api.get('/cashier/notifications'), api.get('/cashier/activity'), api.get('/cashier/online-orders')
      ])
      setOverview(responses[0].data.data || {}); setOrders(responses[1].data.data || [])
      setPayments(responses[2].data.data || []); setInvoices(responses[3].data.data || [])
      setAttendance(responses[4].data.data || []); setSalary(responses[5].data.data || [])
      setNotifications(responses[6].data.data || []); setActivity(responses[7].data.data || [])
      setOnlineOrders(responses[8].data.data || [])
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load cashier dashboard') }
    finally { if (showLoading) setLoading(false) }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.get('/cashier/overview'), api.get('/cashier/orders'), api.get('/cashier/payments'), api.get('/cashier/invoices'), api.get('/cashier/attendance'), api.get('/cashier/salary'), api.get('/cashier/notifications'), api.get('/cashier/activity'), api.get('/cashier/online-orders')])
      .then((responses) => {
        if (!active) return
        setOverview(responses[0].data.data || {}); setOrders(responses[1].data.data || []); setPayments(responses[2].data.data || [])
        setInvoices(responses[3].data.data || []); setAttendance(responses[4].data.data || []); setSalary(responses[5].data.data || []); setNotifications(responses[6].data.data || []); setActivity(responses[7].data.data || []); setOnlineOrders(responses[8].data.data || [])
      }).catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load cashier dashboard') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function pay(order) {
    const paid = Number(order.paidAmount || 0)
    const remaining = Number((order.total - paid).toFixed(2))
    if (remaining <= 0) { await load(); return }
    const enteredAmount = Number(amount[order._id])
    const paymentAmount = Number.isFinite(enteredAmount) && enteredAmount > 0 ? enteredAmount : remaining
    try {
      await api.post(`/cashier/orders/${order._id}/pay`, { amount: paymentAmount, method: method[order._id] || 'cash' })
      toast.success(paymentAmount >= remaining ? `${order.orderNumber} paid` : 'Partial payment recorded')
      setAmount((current) => ({ ...current, [order._id]: '' })); await load()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to record payment') }
  }
  async function invoice(orderId) {
    try { const { data } = await api.post(`/cashier/invoices/${orderId}`); toast.success(`Invoice ${data.data.invoiceNumber} generated`); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to generate invoice') }
  }
  async function printInvoice(invoiceId) {
    try { await api.post(`/cashier/invoices/${invoiceId}/print`, { printerWidth: 80 }); toast.success('Invoice print recorded'); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to print invoice') }
  }
  async function attendanceAction(action) {
    try { await api.post(`/cashier/attendance/${action}`); toast.success(action === 'check-in' ? 'Checked in' : 'Checked out'); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update attendance') }
  }
  async function salaryAction(id, action) {
    try { await api.patch(`/cashier/salary/${id}/${action}`, action === 'report' ? { issue: 'Payment issue reported by cashier' } : {}); toast.success(action === 'confirm' ? 'Salary confirmed' : 'Salary issue reported'); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update salary') }
  }
  async function markNotification(id) {
    try { await api.patch(`/cashier/notifications/${id}/read`); setNotifications((current) => current.map((notice) => notice._id === id ? { ...notice, isRead: true } : notice)) }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update notification') }
  }
  async function reviewOnlineOrder(order, action) {
    try {
      const reason = action === 'reject' ? window.prompt('Why can this order not be confirmed?') : undefined
      if (action === 'reject' && !reason?.trim()) return
      await api.patch(`/cashier/online-orders/${order._id}/${action}`, action === 'reject' ? { reason } : {})
      toast.success(action === 'approve' ? `${order.orderNumber} approved and sent to kitchen` : `${order.orderNumber} rejected`)
      await load()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to review online order') }
  }
  async function receiveDelivery(order) {
    try { await api.patch(`/cashier/orders/${order._id}/receive-delivery`); toast.success(`${order.orderNumber} cash received from delivery staff`); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to receive delivery cash') }
  }
  function logout() { localStorage.removeItem('maison_cashier_token'); localStorage.removeItem('maison_cashier_user'); navigate('/cashier/login', { replace: true }) }
  const todayAttendance = overview.attendance

  return <div className="staff-shell"><StaffTopbar role="Cashier" user={user} onRefresh={() => load(true)} onLogout={logout} /><main className="staff-main">
    <div className="staff-heading"><div><p>PAYMENT DESK</p><h1>Cashier dashboard</h1></div><div className="staff-heading-actions"><Link className="staff-link-button" to="/cashier/reservations">Reservations</Link><span>{new Date().toLocaleDateString()}</span></div></div>
    <section className="cashier-summary cashier-summary-wide"><article><span>Today&apos;s bills</span><strong>{overview.bills || 0}</strong></article><article><span>Revenue collected</span><strong>৳{Number(overview.revenue || 0).toFixed(2)}</strong></article><article><span>Paid bills</span><strong>{overview.paidBills || 0}</strong></article><article><span>Partial / unpaid</span><strong>{(overview.partialBills || 0) + (overview.unpaidBills || 0)}</strong></article></section>
    <nav className="staff-tabs"><button className={tab === 'online' ? 'active' : ''} onClick={() => setTab('online')}>Online calls <b>{onlineOrders.length}</b></button><button className={tab === 'billing' ? 'active' : ''} onClick={() => setTab('billing')}>Billing</button><button className={tab === 'invoices' ? 'active' : ''} onClick={() => setTab('invoices')}>Invoices</button><button className={tab === 'transactions' ? 'active' : ''} onClick={() => setTab('transactions')}>Transactions</button><button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance</button><button className={tab === 'salary' ? 'active' : ''} onClick={() => setTab('salary')}>Salary</button><button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>Activity</button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Profile</button></nav>
    {loading && <p className="staff-empty">Loading cashier dashboard...</p>}
    {!loading && tab === 'online' && <section className="cashier-list online-order-list"><div className="online-order-heading"><div><p>CALL CUSTOMER TO CONFIRM</p><h2>Online orders awaiting approval</h2></div><strong>{onlineOrders.length} waiting</strong></div>{onlineOrders.map((order) => { const phone = order.customer?.phone || order.guest?.phone; return <article className="cashier-order online-order-card" key={order._id}><div><strong>#{order.orderNumber}</strong><span>{order.customer?.fullName || order.guest?.name || 'Guest'} · {phone ? <a href={`tel:${phone}`}>{phone}</a> : 'No phone'}</span><small>{order.items?.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</small><small>{order.deliveryAddress || order.guest?.address || 'No delivery address'}</small></div><b>৳{Number(order.total || 0).toFixed(2)}</b><button type="button" onClick={() => reviewOnlineOrder(order, 'approve')}><CheckCircle2 size={14} /> Call confirmed</button><button type="button" className="invoice-button" onClick={() => reviewOnlineOrder(order, 'reject')}>Reject</button></article> })}{!onlineOrders.length && <p className="staff-empty">No online orders waiting for confirmation.</p>}</section>}
    {!loading && tab === 'billing' && <section className="cashier-list"><div className="cashier-toolbar"><input placeholder="Search order ID..." value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} /><button type="button" onClick={() => load()}><RefreshCw size={13} /> Search</button></div>{orders.map((order) => { const remaining = Math.max(Number(order.total) - Number(order.paidAmount || 0), 0); return <article className="cashier-order cashier-bill-row" key={order._id}><div><strong>#{order.orderNumber}</strong><span>{order.table?.name || order.type} · {order.items.length} items · {order.paymentStatus}</span></div><b>৳{Number(order.total).toFixed(2)}</b>{order.type === 'online' && order.deliveryStatus === 'cash_collected' && <button type="button" onClick={() => receiveDelivery(order)}><CheckCircle2 size={14} /> Cash collected</button>    }{order.deliveryStatus !== 'cash_collected' && remaining > 0 && <><input className="cashier-amount" type="number" min="0.01" max={remaining} placeholder={`Due ৳${remaining.toFixed(2)}`} value={amount[order._id] || ''} onChange={(event) => setAmount((current) => ({ ...current, [order._id]: event.target.value }))} /><select value={method[order._id] || 'cash'} onChange={(event) => setMethod((current) => ({ ...current, [order._id]: event.target.value }))}><option value="cash">Cash</option><option value="mobile_banking">Mobile banking</option><option value="bank_transfer">Bank transfer</option></select><button type="button" onClick={() => pay(order)}><CheckCircle2 size={14} /> Pay</button></>}<button type="button" className="invoice-button" onClick={() => invoice(order._id)}><FileText size={14} /> Invoice</button></article>})}{!orders.length && <p className="staff-empty">No served orders requiring payment.</p>}</section>}
    {!loading && tab === 'invoices' && <DataTable columns={['Invoice', 'Order', 'Total', 'Status', 'Date', 'Print']} rows={invoices.map((entry) => [entry.invoiceNumber, entry.order?.orderNumber, `৳${entry.total}`, entry.order?.paymentStatus, new Date(entry.createdAt).toLocaleString(), <button className="table-actions" onClick={() => printInvoice(entry._id)}>Print / reprint</button>])} />}
    {!loading && tab === 'transactions' && <DataTable columns={['Order', 'Amount', 'Method', 'Received by', 'Date']} rows={payments.map((entry) => [entry.order?.orderNumber, `৳${entry.amount}`, entry.method, entry.receivedBy?.fullName, new Date(entry.createdAt).toLocaleString()])} />}
    {!loading && tab === 'attendance' && <><section className="cashier-attendance-actions"><div><span>Today&apos;s status</span><strong>{todayAttendance?.checkIn ? todayAttendance.checkOut ? 'Checked out' : 'Checked in' : 'Not checked in'}</strong></div><button disabled={Boolean(todayAttendance?.checkIn)} onClick={() => attendanceAction('check-in')}>Check in</button><button disabled={!todayAttendance?.checkIn || Boolean(todayAttendance?.checkOut)} onClick={() => attendanceAction('check-out')}>Check out</button></section><DataTable columns={['Date', 'Check in', 'Check out', 'Status', 'Approval']} rows={attendance.map((entry) => [new Date(entry.date).toLocaleDateString(), entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : '-', entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString() : '-', entry.status, entry.approval?.status || 'pending'])} /></>}
    {!loading && tab === 'salary' && <DataTable columns={['Month', 'Basic', 'Payable', 'Paid', 'Status', 'Action']} rows={salary.map((entry) => [entry.salaryMonth, `৳${entry.basicSalary}`, `৳${entry.totalPayable}`, `৳${entry.paymentAmount || 0}`, entry.status, entry.status === 'awaiting_confirmation' ? <span className="table-actions"><button onClick={() => salaryAction(entry._id, 'confirm')}>Confirm</button><button onClick={() => salaryAction(entry._id, 'report')}>Report issue</button></span> : '-'])} />}
    {!loading && tab === 'activity' && <DataTable columns={['Action', 'Resource', 'Date', 'Details']} rows={activity.map((entry) => [entry.action, entry.resourceType, new Date(entry.createdAt).toLocaleString(), entry.metadata ? JSON.stringify(entry.metadata) : '-'])} />}
    {!loading && tab === 'profile' && <ProfilePanel user={user} />}
    {notifications.length > 0 && <section className="cashier-notices"><h2>Recent notifications</h2>{notifications.map((notice) => <p key={notice._id} className={notice.isRead ? '' : 'unread'}><strong>{notice.title}</strong> {notice.message} {!notice.isRead && <button onClick={() => markNotification(notice._id)}>Mark read</button>}</p>)}</section>}
  </main></div>
}

function DataTable({ columns, rows }) {
  return <section className="cashier-table-wrap"><table className="cashier-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell || '-'}</td>)}</tr>)}{!rows.length && <tr><td className="staff-empty" colSpan={columns.length}>No records found.</td></tr>}</tbody></table></section>
}

function ProfilePanel({ user }) {
  const [form, setForm] = useState({ fullName: user.fullName || '', phone: user.phone || '', currentPassword: '', newPassword: '' })
  async function saveProfile(event) { event.preventDefault(); try { await api.patch('/cashier/profile', { fullName: form.fullName, phone: form.phone }); toast.success('Profile updated') } catch (error) { toast.error(error.response?.data?.message || 'Unable to update profile') } }
  async function changePassword(event) { event.preventDefault(); try { await api.patch('/cashier/password', { currentPassword: form.currentPassword, newPassword: form.newPassword }); toast.success('Password changed'); setForm({ ...form, currentPassword: '', newPassword: '' }) } catch (error) { toast.error(error.response?.data?.message || 'Unable to change password') } }
  return <div className="profile-grid"><form className="cashier-profile-card" onSubmit={saveProfile}><UserRound size={20} /><h2>Personal information</h2><label>Full name<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><button>Save profile</button><small>Profile picture changes require Admin, Owner or Manager permission.</small></form><form className="cashier-profile-card" onSubmit={changePassword}><h2>Change password</h2><label>Current password<input required type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label><label>New password<input required minLength="8" type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label><button>Change password</button></form></div>
}

export default CashierDashboard
