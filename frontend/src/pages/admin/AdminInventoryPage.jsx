import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import './admin.css'

const emptyItem = { name: '', category: '', quantity: 0, unit: '', lowStockThreshold: 0, costPerUnit: 0 }

function AdminInventoryPage() {
  const managementBase = localStorage.getItem('maison_manager_token') ? '/manager' : '/admin'
  const [tab, setTab] = useState('items')
  const [items, setItems] = useState([])
  const [purchases, setPurchases] = useState([])
  const [expenses, setExpenses] = useState([])
  const [movements, setMovements] = useState([])
  const [form, setForm] = useState(emptyItem)
  const [editing, setEditing] = useState(null)
  const [movement, setMovement] = useState({ item: '', type: 'stock_in', quantity: '', source: 'manual', notes: '' })
  const [purchase, setPurchase] = useState({ item: '', quantity: '', unitPrice: '', purchaseDate: new Date().toISOString().slice(0, 10), supplierName: '', notes: '' })
  const [expense, setExpense] = useState({ category: '', description: '', amount: '', expenseDate: new Date().toISOString().slice(0, 10), notes: '' })
  const [lowStock, setLowStock] = useState(false)

  const fetchInventory = useCallback(async () => {
    return Promise.all([
      api.get(`${managementBase}/inventory/items${lowStock ? '?lowStock=true' : ''}`), api.get(`${managementBase}/inventory/purchases`),
      api.get(`${managementBase}/inventory/expenses`), api.get(`${managementBase}/inventory/movements`),
    ])
  }, [lowStock, managementBase])
  async function load() {
    const [itemResponse, purchaseResponse, expenseResponse, movementResponse] = await fetchInventory()
    setItems(itemResponse.data.data || []); setPurchases(purchaseResponse.data.data || [])
    setExpenses(expenseResponse.data.data || []); setMovements(movementResponse.data.data || [])
  }
  useEffect(() => {
    let active = true
    fetchInventory().then(([itemResponse, purchaseResponse, expenseResponse, movementResponse]) => {
      if (!active) return
      setItems(itemResponse.data.data || []); setPurchases(purchaseResponse.data.data || [])
      setExpenses(expenseResponse.data.data || []); setMovements(movementResponse.data.data || [])
    }).catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load inventory') })
    return () => { active = false }
  }, [fetchInventory])

  async function saveItem(event) {
    event.preventDefault()
    try { if (editing) await api.patch(`${managementBase}/inventory/items/${editing}`, form); else await api.post(`${managementBase}/inventory/items`, form); toast.success('Inventory item saved'); setForm(emptyItem); setEditing(null); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to save inventory item') }
  }
  async function submitMovement(event) {
    event.preventDefault()
    try { await api.post(`${managementBase}/inventory/movements`, movement); toast.success('Stock updated'); setMovement({ ...movement, quantity: '', notes: '' }); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to update stock') }
  }
  async function submitPurchase(event) {
    event.preventDefault()
    try { await api.post(`${managementBase}/inventory/purchases`, purchase); toast.success('Purchase recorded and stock added'); setPurchase({ ...purchase, quantity: '', unitPrice: '', supplierName: '', notes: '' }); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to record purchase') }
  }
  async function submitExpense(event) {
    event.preventDefault()
    try { await api.post(`${managementBase}/inventory/expenses`, expense); toast.success('Expense recorded'); setExpense({ ...expense, category: '', description: '', amount: '', notes: '' }); await load() }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to record expense') }
  }
  async function archive(id) { if (!window.confirm('Archive this inventory item?')) return; try { await api.delete(`${managementBase}/inventory/items/${id}`); await load() } catch (error) { toast.error(error.response?.data?.message || 'Unable to archive item') } }
  const set = (setter) => (event) => setter((current) => ({ ...current, [event.target.name]: event.target.value }))

  return <div>
    <div className="admin-page-heading"><div><p className="admin-eyebrow">STOCK CONTROL</p><h1>Inventory</h1></div></div>
    <div className="inventory-tabs">{[['items', 'Items'], ['movements', 'Stock movements'], ['purchases', 'Purchases'], ['expenses', 'Expenses']].map(([value, label]) => <button className={tab === value ? 'active' : ''} type="button" key={value} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === 'items' && <><form className="admin-panel inventory-form" onSubmit={saveItem}><div className="admin-form-grid"><label>Item name<input name="name" required value={form.name} onChange={set(setForm)} /></label><label>Category<input name="category" required value={form.category} onChange={set(setForm)} /></label><label>Unit<input name="unit" required placeholder="kg, litre, pcs" value={form.unit} onChange={set(setForm)} /></label><label>Quantity<input name="quantity" type="number" min="0" value={form.quantity} onChange={set(setForm)} /></label><label>Low stock threshold<input name="lowStockThreshold" type="number" min="0" value={form.lowStockThreshold} onChange={set(setForm)} /></label><label>Cost per unit<input name="costPerUnit" type="number" min="0" value={form.costPerUnit} onChange={set(setForm)} /></label></div><div className="menu-checkboxes"><button className="admin-primary-button compact" type="submit">{editing ? 'Update item' : 'Add item'}</button>{editing && <button type="button" className="admin-text-button" onClick={() => { setEditing(null); setForm(emptyItem) }}>Cancel</button>}</div></form><section className="admin-panel"><div className="admin-panel-heading"><h2>Inventory entries</h2><label className="inventory-filter"><input type="checkbox" checked={lowStock} onChange={(event) => setLowStock(event.target.checked)} /> Low stock only</label></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Category</th><th>Stock</th><th>Cost/unit</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.category}</td><td>{item.quantity} {item.unit}</td><td>৳{item.costPerUnit}</td><td><span className={`status-pill ${item.quantity <= item.lowStockThreshold ? 'cancelled' : 'paid'}`}>{item.quantity <= item.lowStockThreshold ? 'Low stock' : 'In stock'}</span></td><td><div className="staff-actions"><button type="button" onClick={() => { setEditing(item._id); setForm({ name: item.name, category: item.category, unit: item.unit, quantity: item.quantity, lowStockThreshold: item.lowStockThreshold, costPerUnit: item.costPerUnit }) }}>Edit</button><button type="button" className="danger" onClick={() => archive(item._id)}>Archive</button></div></td></tr>)}</tbody></table></div>{!items.length && <p className="admin-empty">No inventory entries found.</p>}</section></>}
    {tab === 'movements' && <><form className="admin-panel inventory-form" onSubmit={submitMovement}><div className="admin-form-grid"><label>Item<select name="item" required value={movement.item} onChange={set(setMovement)}><option value="">Select item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name} ({item.quantity} {item.unit})</option>)}</select></label><label>Movement type<select name="type" value={movement.type} onChange={set(setMovement)}><option value="stock_in">Stock in</option><option value="stock_out">Stock out</option><option value="adjustment">Set exact stock</option></select></label><label>Quantity<input name="quantity" required type="number" min="0.01" value={movement.quantity} onChange={set(setMovement)} /></label><label>Source<select name="source" value={movement.source} onChange={set(setMovement)}><option value="manual">Manual</option><option value="waste">Waste</option><option value="order">Order</option></select></label><label className="wide-field">Notes<input name="notes" value={movement.notes} onChange={set(setMovement)} /></label></div><div className="menu-checkboxes"><button className="admin-primary-button compact" type="submit">Save movement</button></div></form><DataTable columns={['Item', 'Type', 'Quantity', 'Source', 'Date']} rows={movements.map((entry) => [entry.item?.name, entry.type, `${entry.quantity} ${entry.unit || ''}`, entry.source, new Date(entry.createdAt).toLocaleString()])} /></>}
    {tab === 'purchases' && <><form className="admin-panel inventory-form" onSubmit={submitPurchase}><div className="admin-form-grid"><label>Item<select name="item" required value={purchase.item} onChange={set(setPurchase)}><option value="">Select item</option>{items.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label>Quantity<input name="quantity" required type="number" min="0.01" value={purchase.quantity} onChange={set(setPurchase)} /></label><label>Unit price<input name="unitPrice" required type="number" min="0" value={purchase.unitPrice} onChange={set(setPurchase)} /></label><label>Purchase date<input name="purchaseDate" required type="date" value={purchase.purchaseDate} onChange={set(setPurchase)} /></label><label>Supplier<input name="supplierName" value={purchase.supplierName} onChange={set(setPurchase)} /></label><label>Notes<input name="notes" value={purchase.notes} onChange={set(setPurchase)} /></label></div><div className="menu-checkboxes"><button className="admin-primary-button compact" type="submit">Record purchase</button></div></form><DataTable columns={['Item', 'Quantity', 'Total', 'Supplier', 'Date']} rows={purchases.map((entry) => [entry.itemName, `${entry.quantity} ${entry.unit}`, `৳${entry.totalAmount}`, entry.supplierName || '-', new Date(entry.purchaseDate).toLocaleDateString()])} /></>}
    {tab === 'expenses' && <><form className="admin-panel inventory-form" onSubmit={submitExpense}><div className="admin-form-grid"><label>Category<input name="category" required value={expense.category} onChange={set(setExpense)} /></label><label>Description<input name="description" required value={expense.description} onChange={set(setExpense)} /></label><label>Amount<input name="amount" required type="number" min="0" value={expense.amount} onChange={set(setExpense)} /></label><label>Expense date<input name="expenseDate" required type="date" value={expense.expenseDate} onChange={set(setExpense)} /></label><label className="wide-field">Notes<input name="notes" value={expense.notes} onChange={set(setExpense)} /></label></div><div className="menu-checkboxes"><button className="admin-primary-button compact" type="submit">Record expense</button></div></form><DataTable columns={['Category', 'Description', 'Amount', 'Date']} rows={expenses.map((entry) => [entry.category, entry.description, `৳${entry.amount}`, new Date(entry.expenseDate).toLocaleDateString()])} /></>}
  </div>
}

function DataTable({ columns, rows }) {
  return <section className="admin-panel"><div className="admin-table-wrap"><table className="admin-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell || '-'}</td>)}</tr>)}{!rows.length && <tr><td className="admin-empty" colSpan={columns.length}>No records found.</td></tr>}</tbody></table></div></section>
}

export default AdminInventoryPage
