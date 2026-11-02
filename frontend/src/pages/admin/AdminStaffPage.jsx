import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api, { apiOrigin } from '../../services/api'
import './admin.css'

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  profilePicture: null,
  role: 'waiter',
  employeeId: '',
  salaryAmount: '',
  joiningDate: '',
  address: '',
}

const roleLabels = {
  manager: 'Manager',
  waiter: 'Waiter / Server',
  chef: 'Chef / Kitchen Staff',
  cashier: 'Cashier',
  delivery: 'Delivery Staff',
  cleaner: 'Cleaner / Housekeeping',
}

function AdminStaffPage() {
  const [staff, setStaff] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [attendanceRequests, setAttendanceRequests] = useState([])
  const [attendanceSheet, setAttendanceSheet] = useState([])
  const [salaryRecords, setSalaryRecords] = useState([])
  const [staffTab, setStaffTab] = useState('staff')
  const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().slice(0, 7))
  const presentDaysByStaff = attendanceSheet.reduce((summary, entry) => {
    if (entry.status === 'present' || entry.status === 'late') {
      summary[entry.employee?._id] = (summary[entry.employee?._id] || 0) + 1
    }
    return summary
  }, {})

  async function loadStaff() {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/staff?limit=100')
      setStaff(data.data || [])
      const attendanceResponse = await api.get('/admin/attendance/requests')
      setAttendanceRequests(attendanceResponse.data.data || [])
      const [sheetResponse, salaryResponse] = await Promise.all([api.get(`/admin/attendance/sheet?month=${salaryMonth}`), api.get(`/admin/salary/records?month=${salaryMonth}`)])
      setAttendanceSheet(sheetResponse.data.data || [])
      setSalaryRecords(salaryResponse.data.data || [])
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load staff')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([
      api.get('/admin/staff?limit=100'),
      api.get('/admin/attendance/requests'),
      api.get(`/admin/attendance/sheet?month=${salaryMonth}`),
      api.get(`/admin/salary/records?month=${salaryMonth}`)
    ])
      .then(([staffResponse, requestsResponse, sheetResponse, salaryResponse]) => {
        if (!active) return
        setStaff(staffResponse.data.data || [])
        setAttendanceRequests(requestsResponse.data.data || [])
        setAttendanceSheet(sheetResponse.data.data || [])
        setSalaryRecords(salaryResponse.data.data || [])
      })
      .catch((error) => {
        if (active) toast.error(error.response?.data?.message || 'Unable to load staff')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [salaryMonth])

  function updateField(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function startEdit(member) {
    setEditingId(member._id)
    setForm({
      fullName: member.fullName || '',
      email: member.email || '',
      phone: member.phone || '',
      password: '',
      profilePicture: null,
      role: member.role || 'waiter',
      employeeId: member.employeeId || '',
      salaryAmount: member.salaryAmount ?? '',
      joiningDate: member.joiningDate ? member.joiningDate.slice(0, 10) : '',
      address: member.address || '',
    })
    setShowForm(true)
  }

  async function saveStaff(event) {
    event.preventDefault()
    setSaving(true)
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined && key !== 'profilePicture') {
          payload.append(key, value)
        }
      })
      if (form.profilePicture) payload.append('profilePicture', form.profilePicture)
      if (editingId) {
        payload.delete('email')
        payload.delete('role')
        await api.patch(`/admin/staff/${editingId}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Staff member updated')
      } else {
        await api.post('/admin/staff', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Staff member added')
      }
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      await loadStaff()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save staff member')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(member) {
    try {
      await api.patch(`/admin/staff/${member._id}`, { isActive: !member.isActive })
      toast.success(member.isActive ? 'Staff deactivated' : 'Staff activated')
      await loadStaff()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update staff status')
    }
  }

  async function removeStaff(member) {
    if (!window.confirm(`Delete ${member.fullName}? This cannot be undone.`)) return
    try {
      await api.delete(`/admin/staff/${member._id}`)
      toast.success('Staff member deleted')
      await loadStaff()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete staff member')
    }

  }

  async function reviewAttendance(entry, action) {
    try {
      const reason = action === 'reject' ? window.prompt('Rejection reason') : undefined
      if (action === 'reject' && !reason?.trim()) return
      await api.patch(`/admin/attendance/${entry._id}/${action}`, action === 'reject' ? { reason } : {})
      toast.success(`Attendance ${action}d`)
      await loadStaff()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to review attendance') }
  }

  async function generateSalary() {
    try { await api.post('/admin/salary/generate', { salaryMonth }); toast.success('Salary records generated from approved attendance'); await loadStaff() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to generate salary') }
  }

  async function paySalary(entry) {
    const paymentAmount = window.prompt(`Payment amount for ${entry.employee?.fullName}`, String(entry.totalPayable || 0))
    if (paymentAmount === null) return
    try { await api.patch(`/admin/salary/${entry._id}/pay`, { paymentAmount: Number(paymentAmount), paymentMethod: 'cash' }); toast.success('Salary payment sent for staff confirmation'); await loadStaff() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to record salary payment') }
  }

  return (
    <div>
      <div className="admin-page-heading">
        <div><p className="admin-eyebrow">EMPLOYEE MANAGEMENT</p><h1>Staff</h1></div>
        <button className="admin-primary-button compact" type="button" onClick={startCreate}>+ Add staff</button>
      </div>
      <nav className="admin-tabs"><button className={staffTab === 'staff' ? 'active' : ''} onClick={() => setStaffTab('staff')}>Staff accounts</button><button className={staffTab === 'attendance' ? 'active' : ''} onClick={() => setStaffTab('attendance')}>Attendance sheet</button><button className={staffTab === 'salary' ? 'active' : ''} onClick={() => setStaffTab('salary')}>Salary management</button></nav>

      {staffTab === 'staff' && showForm && (
        <form className="admin-panel admin-staff-form" onSubmit={saveStaff}>
          <div className="admin-panel-heading">
            <div><p className="admin-eyebrow">STAFF ACCOUNT</p><h2>{editingId ? 'Edit staff member' : 'Add staff member'}</h2></div>
            <button type="button" className="admin-text-button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
          <div className="admin-form-grid">
            <label>Full name<input name="fullName" required value={form.fullName} onChange={updateField} /></label>
            <label>Email address<input name="email" type="email" required disabled={Boolean(editingId)} value={form.email} onChange={updateField} /></label>
            <label>Phone number<input name="phone" value={form.phone} onChange={updateField} /></label>
            <label>Designation<select name="role" disabled={Boolean(editingId)} value={form.role} onChange={updateField}>{Object.entries(roleLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>{editingId ? 'New password (optional)' : 'Initial password'}<input name="password" type="password" required={!editingId} value={form.password} onChange={updateField} /></label>
            <label>Profile picture<input name="profilePicture" type="file" accept="image/png,image/jpeg,image/webp" required={!editingId} onChange={(event) => setForm({ ...form, profilePicture: event.target.files?.[0] || null })} /></label>
            <label>Employee ID<input name="employeeId" value={form.employeeId} onChange={updateField} placeholder="Auto-generated if empty" /></label>
            <label>Salary amount<input name="salaryAmount" type="number" min="0" value={form.salaryAmount} onChange={updateField} /></label>
            <label>Joining date<input name="joiningDate" type="date" value={form.joiningDate} onChange={updateField} /></label>
            <label className="wide-field">Address<textarea name="address" rows="2" value={form.address} onChange={updateField} /></label>
          </div>
          <div className="admin-form-actions"><button className="admin-primary-button compact" disabled={saving} type="submit">{saving ? 'Saving...' : editingId ? 'Save changes' : 'Create staff account'}</button></div>
        </form>
      )}

      {staffTab === 'staff' && <section className="admin-panel staff-card-panel">
        <div className="admin-panel-heading"><div><p className="admin-eyebrow">STAFF DIRECTORY</p><h2>Team members</h2></div><label className="staff-month-filter">Attendance month<input type="month" value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} /></label></div>
        <div className="staff-card-grid">
          {!loading && staff.map((member) => (
            <article className="staff-profile-card" key={member._id}>
              <div className="staff-card-top"><div className="staff-person">{member.profilePicture ? <img className="staff-picture staff-card-picture" src={`${apiOrigin}${member.profilePicture}`} alt="" /> : <span className="admin-avatar staff-card-picture">{member.fullName.charAt(0).toUpperCase()}</span>}<div><strong>{member.fullName}</strong><small>{roleLabels[member.role] || member.role}</small><small className="staff-id">{member.employeeId || 'No employee ID'}</small></div></div><span className={`status-pill ${member.isActive ? 'active' : 'inactive'}`}>{member.isActive ? 'Active' : 'Inactive'}</span></div>
              <div className="staff-card-details"><div><span>Email</span><strong>{member.email}</strong></div><div><span>Phone</span><strong>{member.phone || '-'}</strong></div><div><span>Monthly salary</span><strong>{member.salaryAmount ? `৳${Number(member.salaryAmount).toLocaleString()}` : '-'}</strong></div><div><span>Present days · {salaryMonth}</span><strong className="staff-present-count">{presentDaysByStaff[member._id] || 0} days</strong></div></div>
              <div className="staff-actions staff-card-actions"><button type="button" onClick={() => startEdit(member)}>Edit</button><button type="button" onClick={() => toggleActive(member)}>{member.isActive ? 'Deactivate' : 'Activate'}</button><button type="button" className="danger" onClick={() => removeStaff(member)}>Delete</button></div>
            </article>
          ))}
          {!loading && !staff.length && <p className="admin-empty">No staff members found.</p>}
          {loading && <p className="admin-empty">Loading staff...</p>}
        </div>
      </section>}
      {staffTab === 'attendance' && <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">MONTHLY ATTENDANCE</p><h2>Staff attendance sheet</h2></div><input type="month" value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} /></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Employee</th><th>Role</th><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th><th>Approval</th></tr></thead><tbody>{attendanceSheet.map((entry) => <tr key={entry._id}><td>{entry.employee?.fullName || '-'}</td><td>{entry.employee?.role || '-'}</td><td>{new Date(entry.date).toLocaleDateString()}</td><td>{entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : '-'}</td><td>{entry.checkOut ? new Date(entry.checkOut).toLocaleTimeString() : '-'}</td><td>{entry.status}</td><td>{entry.approval?.status || 'pending'}{entry.approval?.approverRole ? ` (${entry.approval.approverRole})` : ''}</td></tr>)}{!attendanceSheet.length && <tr><td colSpan="7" className="admin-empty">No attendance records for this month.</td></tr>}</tbody></table></div></section>}
      {staffTab === 'salary' && <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">PAYROLL</p><h2>Salary management</h2></div><div><input type="month" value={salaryMonth} onChange={(event) => setSalaryMonth(event.target.value)} /><button className="admin-primary-button compact" onClick={generateSalary}>Generate salary</button></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Employee</th><th>Role</th><th>Basic</th><th>Deduction</th><th>Payable</th><th>Paid</th><th>Status</th><th>Action</th></tr></thead><tbody>{salaryRecords.map((entry) => <tr key={entry._id}><td>{entry.employee?.fullName || '-'}</td><td>{entry.designation || entry.employee?.role || '-'}</td><td>৳{Number(entry.basicSalary || 0).toFixed(2)}</td><td>৳{Number(entry.deductions || 0).toFixed(2)}</td><td>৳{Number(entry.totalPayable || 0).toFixed(2)}</td><td>৳{Number(entry.paymentAmount || 0).toFixed(2)}</td><td>{entry.status}</td><td>{entry.status === 'unpaid' && <button className="table-actions" onClick={() => paySalary(entry)}>Pay salary</button>}</td></tr>)}{!salaryRecords.length && <tr><td colSpan="8" className="admin-empty">Generate salary for this month.</td></tr>}</tbody></table></div></section>}
      <section className="admin-panel">
        <div className="admin-panel-heading"><div><p className="admin-eyebrow">APPROVALS</p><h2>Attendance requests</h2></div></div>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Staff</th><th>Role</th><th>Date</th><th>Check in</th><th>Actions</th></tr></thead><tbody>
          {attendanceRequests.map((entry) => <tr key={entry._id}><td>{entry.employee?.fullName || '-'}</td><td>{entry.employee?.role || '-'}</td><td>{new Date(entry.date).toLocaleDateString()}</td><td>{entry.checkIn ? new Date(entry.checkIn).toLocaleTimeString() : '-'}</td><td><div className="staff-actions"><button type="button" onClick={() => reviewAttendance(entry, 'approve')}>Approve</button><button type="button" className="danger" onClick={() => reviewAttendance(entry, 'reject')}>Reject</button></div></td></tr>)}
          {!attendanceRequests.length && <tr><td colSpan="5" className="admin-empty">No pending attendance requests.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  )
}

export default AdminStaffPage
