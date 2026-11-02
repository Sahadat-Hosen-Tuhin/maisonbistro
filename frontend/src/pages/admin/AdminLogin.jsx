import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import './admin.css'

function AdminLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      if (!['admin', 'owner'].includes(data.data.user.role)) {
        throw new Error('This account does not have admin access')
      }
      localStorage.setItem('maison_admin_token', data.data.token)
      localStorage.setItem('maison_admin_user', JSON.stringify(data.data.user))
      navigate('/admin', { replace: true })
      toast.success('Welcome back')
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-card">
        <div className="admin-login-brand">
          <img src="/images/logo.png" alt="Maison Bistro" />
          <span>Maison Bistro</span>
        </div>
        <p className="admin-eyebrow">ADMINISTRATION</p>
        <h1>Welcome back</h1>
        <p className="admin-muted">Sign in to manage your restaurant.</p>
        <form onSubmit={handleSubmit} className="admin-form">
          <label>
            Email address
            <input
              type="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="admin@example.com"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Enter your password"
            />
          </label>
          <button type="submit" className="admin-primary-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in to dashboard'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default AdminLogin
