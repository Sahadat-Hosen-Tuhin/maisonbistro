import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, FileWarning, LogOut, RefreshCw, Utensils } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import './staff.css'

function KitchenDashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('maison_kitchen_user') || '{}')
  const [orders, setOrders] = useState([])
  const [history, setHistory] = useState([])
  const [overview, setOverview] = useState({})
  const [attendance, setAttendance] = useState([])
  const [salary, setSalary] = useState([])
  const [notifications, setNotifications] = useState([])
  const [tab, setTab] = useState('live')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  async function load(showLoading = false) {
    if (showLoading) setLoading(true)
    try {
      const [orderResponse, overviewResponse, attendanceResponse, salaryResponse, notificationResponse] = await Promise.all([
        api.get('/kitchen/orders'), api.get('/kitchen/overview'), api.get('/kitchen/attendance'), api.get('/kitchen/salary'), api.get('/kitchen/notifications')
      ])
      setOrders(orderResponse.data.data || []); setOverview(overviewResponse.data.data || {})
      setAttendance(attendanceResponse.data.data || []); setSalary(salaryResponse.data.data || []); setNotifications(notificationResponse.data.data || [])
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load kitchen dashboard') }
    finally { if (showLoading) setLoading(false) }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.get('/kitchen/orders'), api.get('/kitchen/overview'), api.get('/kitchen/attendance'), api.get('/kitchen/salary'), api.get('/kitchen/notifications')])
      .then(([orderResponse, overviewResponse, attendanceResponse, salaryResponse, notificationResponse]) => {
        if (!active) return
        setOrders(orderResponse.data.data || []); setOverview(overviewResponse.data.data || {})
        setAttendance(attendanceResponse.data.data || []); setSalary(salaryResponse.data.data || []); setNotifications(notificationResponse.data.data || [])
      })
      .catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load kitchen dashboard') })
      .finally(() => { if (active) setLoading(false) })
    const timer = setInterval(() => { if (active) load() }, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  async function loadHistory() {
    try { const { data } = await api.get(`/kitchen/history${search ? `?search=${encodeURIComponent(search)}` : ''}`); setHistory(data.data || []) }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to load kitchen history') }
  }
  async function move(order, status) {
    try { const { data } = await api.patch(`/kitchen/orders/${order._id}/status`, { status }); setOrders((current) => current.map((entry) => entry._id === order._id ? data.data : entry)); toast.success(`Order ${status}`); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update order') }
  }
  async function reportIssue(order) {
    const issue = window.prompt('Describe the unavailable ingredient or preparation issue')
    if (!issue?.trim()) return
    try { await api.post(`/kitchen/orders/${order._id}/issue`, { issue }); toast.success('Issue reported'); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to report issue') }
  }
  async function priority(order) {
    const value = window.prompt('Priority: normal, high or urgent', order.kitchenPriority || 'normal')
    if (!['normal', 'high', 'urgent'].includes(value)) return toast.error('Invalid priority')
    try { await api.patch(`/kitchen/orders/${order._id}/priority`, { priority: value }); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update priority') }
  }
  async function attendanceAction(action) {
    try { await api.post(`/kitchen/attendance/${action}`); toast.success('Attendance submitted'); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update attendance') }
  }
  async function salaryAction(id, action) {
    try { await api.patch(`/kitchen/salary/${id}/${action}`, action === 'report' ? { issue: 'Payment issue reported by chef' } : {}); toast.success(action === 'confirm' ? 'Salary confirmed' : 'Salary issue reported'); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update salary') }
  }
  async function changePassword(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try { await api.patch('/kitchen/password', Object.fromEntries(form)); toast.success('Password changed'); event.currentTarget.reset() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to change password') }
  }
  function logout() { localStorage.removeItem('maison_kitchen_token'); localStorage.removeItem('maison_kitchen_user'); navigate('/kitchen/login', { replace: true }) }
  const today = overview.attendance
  return <div className="staff-shell"><StaffTopbar role="Kitchen" user={user} onRefresh={() => load(true)} onLogout={logout} /><main className="staff-main">
    <div className="staff-heading"><div><p>KITCHEN OPERATIONS</p><h1>Chef dashboard</h1></div><span>Auto-refreshes every minute</span></div>
    <section className="kitchen-stats">{[['Assigned today', overview.totalAssigned], ['Accepted', overview.accepted], ['Pending', overview.pending], ['Preparing', overview.preparing], ['Ready', overview.ready], ['Completed', overview.completed], ['Items prepared', overview.completedItems], ['Avg prep (min)', overview.averagePreparationMinutes]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value || 0}</strong></article>)}</section>
    <nav className="staff-tabs"><button className={tab === 'live' ? 'active' : ''} onClick={() => setTab('live')}>Live orders</button><button className={tab === 'history' ? 'active' : ''} onClick={() => { setTab('history'); loadHistory() }}>History</button><button className={tab === 'work' ? 'active' : ''} onClick={() => setTab('work')}>My work</button></nav>
    {loading && <p className="staff-empty">Loading kitchen dashboard...</p>}
    {!loading && tab === 'live' && <div className="kitchen-grid">{orders.map((order) => <KitchenOrder key={order._id} order={order} onMove={move} onIssue={reportIssue} onPriority={priority} />)}{!orders.length && <div className="staff-empty"><Utensils size={25} /><p>No live orders.</p></div>}</div>}
    {!loading && tab === 'history' && <section className="kitchen-history"><div className="cashier-toolbar"><input placeholder="Search order ID" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && loadHistory()} /><button onClick={loadHistory}>Search</button></div><DataTable columns={['Order', 'Type', 'Items', 'Status', 'Updated']} rows={history.map((order) => [order.orderNumber, order.type, order.items?.reduce((sum, item) => sum + item.quantity, 0), order.status, new Date(order.updatedAt).toLocaleString()])} /></section>}
    {!loading && tab === 'work' && <section className="chef-work"><div className="cashier-attendance-actions"><div><span>Today&apos;s attendance</span><strong>{today?.checkIn ? today.checkOut ? 'Checked out' : 'Checked in' : 'Not checked in'}</strong></div><button disabled={Boolean(today?.checkIn)} onClick={() => attendanceAction('check-in')}>Check in</button><button disabled={!today?.checkIn || Boolean(today?.checkOut)} onClick={() => attendanceAction('check-out')}>Check out</button></div><DataTable columns={['Date', 'Check in', 'Check out', 'Approval']} rows={attendance.map((entry) => [new Date(entry.date).toLocaleDateString(), entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : '-', entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString() : '-', entry.approval?.status || 'pending'])} /><DataTable columns={['Month', 'Payable', 'Paid', 'Status', 'Action']} rows={salary.map((entry) => [entry.salaryMonth, `৳${entry.totalPayable}`, `৳${entry.paymentAmount || 0}`, entry.status, entry.status === 'awaiting_confirmation' ? <><button onClick={() => salaryAction(entry._id, 'confirm')}>Confirm</button><button onClick={() => salaryAction(entry._id, 'report')}>Report</button></> : '-'])} /><form className="cashier-profile-card" onSubmit={changePassword}><h2>Change password</h2><input name="currentPassword" required type="password" placeholder="Current password" /><input name="newPassword" required minLength="8" type="password" placeholder="New password" /><button>Change password</button></form>{notifications.map((notice) => <p className="cashier-notice" key={notice._id}><strong>{notice.title}</strong> {notice.message}</p>)}</section>}
  </main></div>
}

function KitchenOrder({ order, onMove, onIssue, onPriority }) {
  const next = { pending: 'accepted', accepted: 'processing', processing: 'ready', ready: 'served' }[order.status]
  return <article className={`kitchen-order-card ${order.status}`}><div className="kitchen-order-head"><div><strong>#{order.orderNumber}</strong><span>{order.table?.name || order.type} · {new Date(order.createdAt).toLocaleTimeString()}</span></div><b>{order.status} · {order.kitchenPriority || 'normal'}</b></div><div className="kitchen-items">{order.items.map((item, index) => <div key={`${item.name}-${index}`}><strong>{item.quantity} × {item.name}</strong><span>{item.selectedSize || ''} {item.addOns?.map((addOn) => addOn.name).join(', ')}</span>{item.notes && <small>{item.notes}</small>}</div>)}</div>{order.kitchenIssue && <p className="kitchen-issue"><FileWarning size={13} /> {order.kitchenIssue}</p>}<div className="kitchen-order-footer"><span>৳{Number(order.total || 0).toFixed(2)}</span><button onClick={() => onPriority(order)}>Priority</button><button onClick={() => onIssue(order)}><FileWarning size={14} /> Issue</button>{next && <button onClick={() => onMove(order, next)}>{next === 'processing' ? <Clock3 size={14} /> : <CheckCircle2 size={14} />} {next}</button>}</div></article>
}

function DataTable({ columns, rows }) {
  return <section className="cashier-table-wrap"><table className="cashier-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell || '-'}</td>)}</tr>)}{!rows.length && <tr><td className="staff-empty" colSpan={columns.length}>No records found.</td></tr>}</tbody></table></section>
}

function StaffTopbar({ role, user, onRefresh, onLogout }) {
  return <header className="staff-topbar"><div className="staff-brand"><img src="/images/logo.png" alt="Maison Bistro" /><div><strong>Maison Bistro</strong><span>{role.toUpperCase()} DASHBOARD</span></div></div><div className="staff-actions"><span>{user.fullName || role}</span><button type="button" onClick={onRefresh}><RefreshCw size={14} /></button><button type="button" onClick={onLogout}><LogOut size={14} /> Sign out</button></div></header>
}

export { StaffTopbar }
export default KitchenDashboard
