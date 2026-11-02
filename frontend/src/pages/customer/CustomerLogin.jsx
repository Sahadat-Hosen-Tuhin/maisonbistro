import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import '../admin/admin.css'

function CustomerLogin() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  async function submit(event) {
    event.preventDefault()
    try {
      const { data } = await api.post('/auth/login', form)
      if (data.data.user.role !== 'customer') throw new Error('This account does not have customer access')
      localStorage.setItem('maison_customer_token', data.data.token); localStorage.setItem('maison_customer_user', JSON.stringify(data.data.user))
      navigate('/customer', { replace: true }); toast.success('Welcome back')
    } catch (error) { toast.error(error.response?.data?.message || error.message || 'Unable to sign in') }
  }
  return <main className="customer-auth"><section className="customer-auth-card"><img src="/images/logo.png" alt="Maison Bistro" /><p className="admin-eyebrow">CUSTOMER ACCOUNT</p><h1>Welcome back</h1><form className="admin-form" onSubmit={submit}><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><button className="admin-primary-button">Sign in</button></form><p><Link to="/customer/register">Create an account</Link></p></section></main>
}
export default CustomerLogin
