import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import './admin.css'

const emptyFloor = { name: '', description: '', isActive: true, sections: [] }
const emptyTable = { name: '', capacity: 2, sectionId: '', status: 'available', isActive: true }
const sectionTypes = ['general', 'vip', 'family', 'outdoor', 'other']

function AdminFloorPage() {
  const [floors, setFloors] = useState([])
  const [tables, setTables] = useState({})
  const [floorForm, setFloorForm] = useState(emptyFloor)
  const [tableForm, setTableForm] = useState(emptyTable)
  const [editingFloor, setEditingFloor] = useState(null)
  const [editingTable, setEditingTable] = useState(null)
  const [activeFloor, setActiveFloor] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadFloors() {
    const { data } = await api.get('/admin/floors?limit=100')
    setFloors(data.data || [])
    const tableEntries = await Promise.all((data.data || []).map(async (floor) => {
      const response = await api.get(`/admin/floors/${floor._id}/tables`)
      return [floor._id, response.data.data || []]
    }))
    setTables(Object.fromEntries(tableEntries))
  }

  useEffect(() => {
    let active = true
    api.get('/admin/floors?limit=100').then(async ({ data }) => {
      if (!active) return
      setFloors(data.data || [])
      const tableEntries = await Promise.all((data.data || []).map(async (floor) => {
        const response = await api.get(`/admin/floors/${floor._id}/tables`)
        return [floor._id, response.data.data || []]
      }))
      if (active) setTables(Object.fromEntries(tableEntries))
    }).catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load floor management') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  function addSection() {
    setFloorForm((current) => ({ ...current, sections: [...current.sections, { name: '', type: 'general', description: '' }] }))
  }
  function updateSection(index, field, value) {
    setFloorForm((current) => ({ ...current, sections: current.sections.map((section, position) => position === index ? { ...section, [field]: value } : section) }))
  }
  function editFloor(floor) {
    setEditingFloor(floor._id)
    setFloorForm({ name: floor.name, description: floor.description || '', isActive: floor.isActive, sections: floor.sections || [] })
  }
  async function saveFloor(event) {
    event.preventDefault()
    try {
      if (editingFloor) await api.patch(`/admin/floors/${editingFloor}`, floorForm)
      else await api.post('/admin/floors', floorForm)
      toast.success(editingFloor ? 'Floor updated' : 'Floor added')
      setFloorForm(emptyFloor); setEditingFloor(null); await loadFloors()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save floor') }
  }
  async function removeFloor(id) {
    if (!window.confirm('Delete this floor?')) return
    try { await api.delete(`/admin/floors/${id}`); toast.success('Floor deleted'); await loadFloors() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to delete floor') }
  }
  function openTableForm(floorId, table = null) {
    setActiveFloor(floorId); setEditingTable(table?._id || null)
    setTableForm(table ? { name: table.name, capacity: table.capacity, sectionId: table.sectionId || '', status: table.status, isActive: table.isActive } : { ...emptyTable })
  }
  async function saveTable(event) {
    event.preventDefault()
    try {
      const path = editingTable ? `/admin/floors/${activeFloor}/tables/${editingTable}` : `/admin/floors/${activeFloor}/tables`
      if (editingTable) await api.patch(path, tableForm)
      else await api.post(path, tableForm)
      toast.success(editingTable ? 'Table updated' : 'Table added')
      setActiveFloor(null); setEditingTable(null); setTableForm(emptyTable); await loadFloors()
    } catch (error) { toast.error(error.response?.data?.message || 'Unable to save table') }
  }
  async function removeTable(floorId, tableId) {
    if (!window.confirm('Delete this table?')) return
    try { await api.delete(`/admin/floors/${floorId}/tables/${tableId}`); toast.success('Table deleted'); await loadFloors() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to delete table') }
  }

  return <div>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">RESTAURANT LAYOUT</p><h1>Floor management</h1></div><span className="admin-date">{floors.length} floor{floors.length === 1 ? '' : 's'}</span></div>
    <form className="admin-panel floor-form" onSubmit={saveFloor}><div className="admin-panel-heading"><div><p className="admin-eyebrow">FLOOR DETAILS</p><h2>{editingFloor ? 'Edit floor' : 'Add a floor'}</h2></div></div><div className="admin-form-grid"><label>Floor name<input required value={floorForm.name} onChange={(event) => setFloorForm({ ...floorForm, name: event.target.value })} placeholder="Ground floor" /></label><label className="wide-field">Description<textarea value={floorForm.description} onChange={(event) => setFloorForm({ ...floorForm, description: event.target.value })} placeholder="Describe this dining area" /></label></div><div className="floor-sections"><div className="floor-subheading"><strong>Sections</strong><button type="button" className="admin-text-button" onClick={addSection}>+ Add section</button></div>{floorForm.sections.map((section, index) => <div className="section-form-row" key={section._id || index}><input required placeholder="Section name" value={section.name} onChange={(event) => updateSection(index, 'name', event.target.value)} /><select value={section.type} onChange={(event) => updateSection(index, 'type', event.target.value)}>{sectionTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select><input placeholder="Description" value={section.description || ''} onChange={(event) => updateSection(index, 'description', event.target.value)} /><button type="button" className="admin-text-button danger-text" onClick={() => setFloorForm({ ...floorForm, sections: floorForm.sections.filter((_, position) => position !== index) })}>Remove</button></div>)}</div><div className="menu-checkboxes"><label><input type="checkbox" checked={floorForm.isActive} onChange={(event) => setFloorForm({ ...floorForm, isActive: event.target.checked })} /> Active floor</label><button className="admin-primary-button compact">{editingFloor ? 'Save floor' : 'Create floor'}</button>{editingFloor && <button type="button" className="admin-text-button" onClick={() => { setEditingFloor(null); setFloorForm(emptyFloor) }}>Cancel</button>}</div></form>
    {loading && <p className="admin-muted">Loading floors...</p>}
    <div className="floor-list">{!loading && floors.map((floor) => <section className="admin-panel floor-card" key={floor._id}><div className="admin-panel-heading"><div><p className="admin-eyebrow">FLOOR</p><h2>{floor.name}</h2><small>{floor.description || 'No description'} · {floor.sections?.length || 0} sections</small></div><div className="staff-actions"><button type="button" onClick={() => editFloor(floor)}>Edit floor</button><button type="button" className="danger" onClick={() => removeFloor(floor._id)}>Delete floor</button></div></div><div className="floor-table-heading"><strong>Tables</strong><button type="button" className="admin-primary-button compact" onClick={() => openTableForm(floor._id)}>+ Add table</button></div><div className="floor-table-grid">{(tables[floor._id] || []).map((table) => <article className="floor-table-card" key={table._id}><div><strong>{table.name}</strong><small>{table.capacity} seats · {floor.sections?.find((section) => String(section._id) === String(table.sectionId))?.name || 'General'}</small><span className={`status-pill ${table.status === 'available' ? 'paid' : table.status === 'occupied' ? 'cancelled' : ''}`}>{table.status}</span></div><div className="staff-actions"><button type="button" onClick={() => openTableForm(floor._id, table)}>Edit</button><button type="button" className="danger" onClick={() => removeTable(floor._id, table._id)}>Delete</button></div></article>)}{!tables[floor._id]?.length && <p className="admin-empty">No tables on this floor yet.</p>}</div></section>)}</div>
    {activeFloor && <div className="admin-modal-backdrop"><form className="admin-panel admin-modal" onSubmit={saveTable}><div className="admin-panel-heading"><div><p className="admin-eyebrow">TABLE SETUP</p><h2>{editingTable ? 'Edit table' : 'Add table'}</h2></div><button type="button" className="admin-text-button" onClick={() => setActiveFloor(null)}>Close</button></div><div className="admin-form-grid"><label>Table name<input required value={tableForm.name} onChange={(event) => setTableForm({ ...tableForm, name: event.target.value })} placeholder="Table 01" /></label><label>Capacity<input required type="number" min="1" value={tableForm.capacity} onChange={(event) => setTableForm({ ...tableForm, capacity: event.target.value })} /></label><label>Section<select value={tableForm.sectionId} onChange={(event) => setTableForm({ ...tableForm, sectionId: event.target.value })}><option value="">General</option>{floors.find((floor) => floor._id === activeFloor)?.sections?.map((section) => <option key={section._id} value={section._id}>{section.name}</option>)}</select></label><label>Status<select value={tableForm.status} onChange={(event) => setTableForm({ ...tableForm, status: event.target.value })}><option value="available">Available</option><option value="occupied">Occupied</option><option value="reserved">Reserved</option></select></label></div><div className="menu-checkboxes"><button className="admin-primary-button compact">{editingTable ? 'Save table' : 'Add table'}</button></div></form></div>}
  </div>
}

export default AdminFloorPage
