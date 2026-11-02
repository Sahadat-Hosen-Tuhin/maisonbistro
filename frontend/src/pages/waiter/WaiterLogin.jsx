import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import '../admin/admin.css'

function WaiterLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      if (data.data.user.role !== 'waiter') throw new Error('This account does not have waiter access')
      localStorage.setItem('maison_waiter_token', data.data.token)
      localStorage.setItem('maison_waiter_user', JSON.stringify(data.data.user))
      navigate('/waiter', { replace: true })
      toast.success('Welcome to your duty dashboard')
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to sign in')
    } finally { setLoading(false) }
  }

  return <main className="admin-login-page"><section className="admin-login-card"><div className="admin-login-brand"><img src="/images/logo.png" alt="Maison Bistro" /><span>Maison Bistro</span></div><p className="admin-eyebrow">WAITER DUTY</p><h1>Welcome back</h1><p className="admin-muted">Sign in to take and manage table orders.</p><form onSubmit={submit} className="admin-form"><label>Email address<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><button className="admin-primary-button" disabled={loading}>{loading ? 'Signing in...' : 'Enter duty dashboard'}</button></form></section></main>
}

export default WaiterLogin
