import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import '../admin/admin.css'

function CustomerRegister() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirmPassword: '' })
  async function submit(event) {
    event.preventDefault()
    try {
      const { data } = await api.post('/auth/register', form)
      localStorage.setItem('maison_customer_token', data.data.token); localStorage.setItem('maison_customer_user', JSON.stringify(data.data.user))
      navigate('/customer', { replace: true }); toast.success('Account created')
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to create account') }
  }
  return <main className="customer-auth"><section className="customer-auth-card"><img src="/images/logo.png" alt="Maison Bistro" /><p className="admin-eyebrow">JOIN MAISON BISTRO</p><h1>Create account</h1><form className="admin-form" onSubmit={submit}><label>Name<input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>Email<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label>Password<input required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>Confirm password<input required minLength="8" type="password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label><button className="admin-primary-button">Create account</button></form><p><Link to="/customer/login">Already have an account?</Link></p></section></main>
}
export default CustomerRegister
