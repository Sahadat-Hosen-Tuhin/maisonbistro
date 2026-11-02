import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import '../admin/admin.css'

const config = {
  kitchen: { label: 'KITCHEN STAFF', title: 'Kitchen dashboard', description: 'See incoming orders and keep the kitchen moving.' },
  cashier: { label: 'CASHIER DESK', title: 'Cashier dashboard', description: 'Collect payments and close served orders.' },
  delivery: { label: 'DELIVERY DESK', title: 'Delivery dashboard', description: 'Accept approved online orders, deliver them, and hand over collected cash.' },
  manager: { label: 'MANAGER DESK', title: 'Manager dashboard', description: 'Monitor operations, attendance, leave, reservations and staff performance.' },
}

function StaffLogin({ role }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const content = config[role]

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      const expectedRole = role === 'kitchen' ? 'chef' : role
      if (data.data.user.role !== expectedRole) throw new Error(`This account does not have ${role} access`)
      localStorage.setItem(`maison_${role}_token`, data.data.token)
      localStorage.setItem(`maison_${role}_user`, JSON.stringify(data.data.user))
      navigate(`/${role}`, { replace: true })
      toast.success(`Welcome to the ${role} dashboard`)
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to sign in')
    } finally { setLoading(false) }
  }

  return <main className="admin-login-page"><section className="admin-login-card"><div className="admin-login-brand"><img src="/images/logo.png" alt="Maison Bistro" /><span>Maison Bistro</span></div><p className="admin-eyebrow">{content.label}</p><h1>{content.title}</h1><p className="admin-muted">{content.description}</p><form onSubmit={submit} className="admin-form"><label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><button className="admin-primary-button" disabled={loading}>{loading ? 'Signing in...' : 'Enter dashboard'}</button></form></section></main>
}

export default StaffLogin
