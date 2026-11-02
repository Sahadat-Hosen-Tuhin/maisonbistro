import { useEffect, useState } from 'react'
import { LogOut, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import './staff.css'

function ManagerDashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('maison_manager_user') || '{}')
  const [dashboard, setDashboard] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [leave, setLeave] = useState([])
  const [tab, setTab] = useState('overview')
  async function load() {
    try {
      const [dashboardResponse, attendanceResponse, leaveResponse] = await Promise.all([api.get('/manager/dashboard'), api.get('/manager/attendance/requests'), api.get('/manager/leave?status=pending')])
      setDashboard(dashboardResponse.data.data); setAttendance(attendanceResponse.data.data || []); setLeave(leaveResponse.data.data || [])
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load manager dashboard') }
  }
  useEffect(() => { let active = true; Promise.all([api.get('/manager/dashboard'), api.get('/manager/attendance/requests'), api.get('/manager/leave?status=pending')]).then(([dashboardResponse, attendanceResponse, leaveResponse]) => { if (!active) return; setDashboard(dashboardResponse.data.data); setAttendance(attendanceResponse.data.data || []); setLeave(leaveResponse.data.data || []) }).catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load manager dashboard') }); return () => { active = false } }, [])
  async function review(path, body) { try { await api.patch(path, body); toast.success('Updated successfully'); await load() } catch (error) { toast.error(error.response?.data?.message || 'Unable to update') } }
  function logout() { localStorage.removeItem('maison_manager_token'); localStorage.removeItem('maison_manager_user'); navigate('/manager/login', { replace: true }) }
  const totals = dashboard?.totals || {}
  return <div className="staff-shell"><header className="staff-topbar"><div className="staff-brand"><img src="/images/logo.png" alt="Maison Bistro" /><div><strong>Maison Bistro</strong><span>MANAGER DASHBOARD</span></div></div><div className="staff-actions"><span>{user.fullName || 'Manager'}</span><button type="button" onClick={load}><RefreshCw size={14} /> Refresh</button><button type="button" onClick={logout}><LogOut size={14} /> Sign out</button></div></header><main className="staff-main"><div className="staff-heading"><div><p>OPERATIONS CONTROL</p><h1>Manager dashboard</h1></div><div className="staff-heading-actions"><Link className="staff-link-button" to="/manager/inventory">Inventory management</Link><Link className="staff-link-button" to="/manager/reservations">Reservations</Link></div></div><section className="cashier-summary cashier-summary-wide">{[['Orders', totals.orders], ['Revenue', `৳${Number(totals.revenue || 0).toFixed(2)}`], ['Net sales', `৳${Number(totals.netSales || 0).toFixed(2)}`], ['Reservations', totals.reservations], ['Available tables', totals.availableTables], ['Pending attendance', totals.pendingAttendance], ['Low stock', totals.lowStock]].map(([label, value]) => <article key={label}><span>{label}</span><strong>{value || 0}</strong></article>)}</section><nav className="staff-tabs"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Recent activity</button><button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance ({attendance.length})</button><button className={tab === 'leave' ? 'active' : ''} onClick={() => setTab('leave')}>Leave ({leave.length})</button></nav>{tab === 'overview' && <section className="cashier-list">{dashboard?.recentOrders?.map((order) => <article className="cashier-order" key={order._id}><div><strong>#{order.orderNumber}</strong><span>{order.type} · {order.status} · {order.paymentStatus}</span></div><b>৳{Number(order.total || 0).toFixed(2)}</b></article>)}</section>}{tab === 'attendance' && <section className="cashier-list">{attendance.map((entry) => <article className="cashier-order" key={entry._id}><div><strong>{entry.employee?.fullName}</strong><span>{entry.employee?.role} · {new Date(entry.date).toLocaleDateString()}</span></div><button onClick={() => review(`/manager/attendance/${entry._id}/approve`, {})}>Approve</button><button onClick={() => review(`/manager/attendance/${entry._id}/reject`, { reason: 'Attendance details require correction' })}>Reject</button></article>)}</section>}{tab === 'leave' && <section className="cashier-list">{leave.map((entry) => <article className="cashier-order" key={entry._id}><div><strong>{entry.employee?.fullName}</strong><span>{new Date(entry.startDate).toLocaleDateString()} - {new Date(entry.endDate).toLocaleDateString()} · {entry.reason}</span></div><button onClick={() => review(`/manager/leave/${entry._id}/review`, { status: 'approved' })}>Approve</button><button onClick={() => review(`/manager/leave/${entry._id}/review`, { status: 'rejected', reason: 'Leave request rejected by manager' })}>Reject</button></article>)}</section>}</main></div>
}

export default ManagerDashboard
