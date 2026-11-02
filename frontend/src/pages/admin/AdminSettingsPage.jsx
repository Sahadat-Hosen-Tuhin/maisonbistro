import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import './admin.css'

const initialSettings = {
  restaurantName: '', address: '', phone: '', email: '', currency: 'BDT',
  timeZone: 'Asia/Dhaka', dateTimeFormat: 'DD/MM/YYYY HH:mm', taxPercentage: 0,
  serviceChargePercentage: 0, enabledOrderTypes: ['dine_in', 'takeaway', 'online', 'walk_in'],
  openingHours: '{}', timeSlots: '', bookingCapacity: '', reservationPolicy: '',
  paperWidth: 80, onlineOrdersEnabled: true, websiteVisible: true, maintenanceMode: false,
}
const orderTypes = [['dine_in', 'Dine in'], ['takeaway', 'Takeaway'], ['online', 'Online'], ['walk_in', 'Walk-in']]

function AdminSettingsPage() {
  const [form, setForm] = useState(initialSettings)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/settings/current').then(({ data }) => {
      const settings = data.data
      if (!settings) return
      setForm({ ...initialSettings, ...settings, openingHours: JSON.stringify(settings.openingHours || {}, null, 2), timeSlots: settings.reservation?.timeSlots?.join(', ') || '', bookingCapacity: settings.reservation?.bookingCapacity || '', reservationPolicy: settings.reservation?.policy || '', paperWidth: settings.printer?.paperWidth || 80 })
    }).catch((error) => toast.error(error.response?.data?.message || 'Unable to load settings')).finally(() => setLoading(false))
  }, [])

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })) }

  async function save(event) {
    event.preventDefault()
    let openingHours
    try { openingHours = JSON.parse(form.openingHours || '{}') } catch { toast.error('Opening hours must be valid JSON'); return }
    try {
      await api.put('/admin/settings/current', {
        restaurantName: form.restaurantName, address: form.address, phone: form.phone, email: form.email,
        currency: form.currency, timeZone: form.timeZone, dateTimeFormat: form.dateTimeFormat,
        taxPercentage: Number(form.taxPercentage), serviceChargePercentage: Number(form.serviceChargePercentage),
        enabledOrderTypes: form.enabledOrderTypes, openingHours,
        reservation: { timeSlots: form.timeSlots.split(',').map((slot) => slot.trim()).filter(Boolean), bookingCapacity: Number(form.bookingCapacity) || 0, policy: form.reservationPolicy },
        printer: { paperWidth: Number(form.paperWidth) }, onlineOrdersEnabled: form.onlineOrdersEnabled,
        websiteVisible: form.websiteVisible, maintenanceMode: form.maintenanceMode,
      })
      toast.success('Settings saved')
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save settings') }
  }

  if (loading) return <p className="admin-muted">Loading settings...</p>
  return <div>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">CONFIGURATION</p><h1>Restaurant settings</h1></div></div>
    <form className="admin-panel admin-settings-form" onSubmit={save}>
      <div className="admin-form-grid">
        <label>Restaurant name<input required value={form.restaurantName} onChange={(event) => update('restaurantName', event.target.value)} /></label>
        <label>Phone<input value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label>
        <label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label>
        <label className="wide-field">Address<textarea value={form.address} onChange={(event) => update('address', event.target.value)} /></label>
        <label>Currency<input value={form.currency} onChange={(event) => update('currency', event.target.value)} /></label>
        <label>Time zone<input value={form.timeZone} onChange={(event) => update('timeZone', event.target.value)} /></label>
        <label>Date/time format<input value={form.dateTimeFormat} onChange={(event) => update('dateTimeFormat', event.target.value)} /></label>
        <label>Tax %<input type="number" min="0" value={form.taxPercentage} onChange={(event) => update('taxPercentage', event.target.value)} /></label>
        <label>Service charge %<input type="number" min="0" value={form.serviceChargePercentage} onChange={(event) => update('serviceChargePercentage', event.target.value)} /></label>
        <label>Booking capacity<input type="number" min="0" value={form.bookingCapacity} onChange={(event) => update('bookingCapacity', event.target.value)} /></label>
        <label>Printer width<select value={form.paperWidth} onChange={(event) => update('paperWidth', event.target.value)}><option value="58">58mm</option><option value="80">80mm</option></select></label>
        <label className="wide-field">Opening hours (JSON)<textarea rows="4" value={form.openingHours} onChange={(event) => update('openingHours', event.target.value)} placeholder={'{"monday":"10:00-22:00"}'} /></label>
        <label>Reservation time slots<input value={form.timeSlots} onChange={(event) => update('timeSlots', event.target.value)} placeholder="12:00, 14:00, 18:00" /></label>
        <label>Reservation policy<textarea value={form.reservationPolicy} onChange={(event) => update('reservationPolicy', event.target.value)} /></label>
      </div>
      <fieldset className="menu-options settings-options"><legend>Enabled order types</legend>{orderTypes.map(([value, label]) => <label key={value}><input type="checkbox" checked={form.enabledOrderTypes.includes(value)} onChange={(event) => update('enabledOrderTypes', event.target.checked ? [...form.enabledOrderTypes, value] : form.enabledOrderTypes.filter((type) => type !== value))} />{label}</label>)}</fieldset>
      <div className="menu-checkboxes"><label><input type="checkbox" checked={form.onlineOrdersEnabled} onChange={(event) => update('onlineOrdersEnabled', event.target.checked)} /> Online orders enabled</label><label><input type="checkbox" checked={form.websiteVisible} onChange={(event) => update('websiteVisible', event.target.checked)} /> Website visible</label><label><input type="checkbox" checked={form.maintenanceMode} onChange={(event) => update('maintenanceMode', event.target.checked)} /> Maintenance mode</label><button className="admin-primary-button compact" type="submit">Save settings</button></div>
    </form>
  </div>
}

export default AdminSettingsPage
