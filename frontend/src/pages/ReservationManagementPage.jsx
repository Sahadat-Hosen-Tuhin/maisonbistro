import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../services/api'
import './admin/admin.css'

const initialForm = { name: '', phone: '', email: '', date: '', startTime: '', endTime: '', guestCount: 2, table: '', notes: '' }

function ReservationManagementPage({ role = 'admin' }) {
  const [reservations, setReservations] = useState([])
  const [tables, setTables] = useState([])
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)

  async function load() {
    try {
      const [reservationResponse, tableResponse] = await Promise.all([
        api.get('/reservations'), api.get('/restaurant/tables?limit=100&isActive=true')
      ])
      setReservations(reservationResponse.data.data || [])
      setTables(tableResponse.data.data || [])
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to load reservations') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    let active = true
    Promise.all([api.get('/reservations'), api.get('/restaurant/tables?limit=100&isActive=true')])
      .then(([reservationResponse, tableResponse]) => {
        if (!active) return
        setReservations(reservationResponse.data.data || [])
        setTables(tableResponse.data.data || [])
      })
      .catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load reservations') })
      .finally(() => { if (active) { setLoading(false) } })
    return () => { active = false }
  }, [])

  function update(key, value) { setForm((current) => ({ ...current, [key]: value })) }
  async function createReservation(event) {
    event.preventDefault()
    try {
      await api.post('/reservations', {
        date: form.date, startTime: form.startTime, endTime: form.endTime || undefined,
        guestCount: Number(form.guestCount), table: form.table || undefined, notes: form.notes || undefined,
        guest: { name: form.name, phone: form.phone, email: form.email }
      })
      toast.success('Reservation created')
      setForm(initialForm)
      await load()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to create reservation') }
  }
  async function updateStatus(id, status) {
    try { await api.patch(`/reservations/${id}`, { status }); toast.success(`Reservation ${status}`); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update reservation') }
  }

  return <div className={role === 'admin' ? '' : 'staff-main'}>
    <div className={role === 'admin' ? 'admin-page-heading' : 'staff-heading'}><div><p className="admin-eyebrow">TABLE SERVICE</p><h1>Table reservations</h1></div><button className="reservation-refresh-button" type="button" onClick={load}>Refresh</button></div>
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><p className="admin-eyebrow">NEW BOOKING</p><h2>Create reservation</h2></div></div>
      <form className="admin-form-grid" onSubmit={createReservation}>
        <label>Guest name<input required value={form.name} onChange={(event) => update('name', event.target.value)} /></label>
        <label>Phone<input required value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
        <label>Date<input required type="date" value={form.date} onChange={(event) => update('date', event.target.value)} /></label>
        <label>Start time<input required type="time" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} /></label>
        <label>End time<input type="time" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} /></label>
        <label>Guests<input required min="1" type="number" value={form.guestCount} onChange={(event) => update('guestCount', event.target.value)} /></label>
        <label>Table<select value={form.table} onChange={(event) => update('table', event.target.value)}><option value="">Assign later</option>{tables.map((table) => <option key={table._id} value={table._id}>{table.name} ({table.capacity})</option>)}</select></label>
        <label className="admin-form-wide">Notes<textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} /></label>
        <button type="submit">Create reservation</button>
      </form>
    </section>
    <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">BOOKING REGISTER</p><h2>Reservations</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Number</th><th>Guest</th><th>Date / time</th><th>Guests</th><th>Table</th><th>Status</th><th>Action</th></tr></thead><tbody>{!loading && reservations.map((reservation) => <tr key={reservation._id}><td>{reservation.reservationNumber}</td><td>{reservation.guest?.name || '-' }<br />{reservation.guest?.phone || '-'}</td><td>{new Date(reservation.date).toLocaleDateString()}<br />{reservation.startTime}</td><td>{reservation.guestCount}</td><td>{reservation.table?.name || 'Unassigned'}</td><td>{reservation.status}</td><td>{['pending', 'confirmed'].includes(reservation.status) ? <><button className="admin-text-button" onClick={() => updateStatus(reservation._id, 'confirmed')}>Confirm</button><button className="admin-danger-button compact" onClick={() => updateStatus(reservation._id, 'cancelled')}>Cancel</button></> : '-'}</td></tr>)}{!loading && !reservations.length && <tr><td colSpan="7" className="admin-empty">No reservations found.</td></tr>}{loading && <tr><td colSpan="7" className="admin-empty">Loading reservations...</td></tr>}</tbody></table></div></section>
  </div>
}

export default ReservationManagementPage
