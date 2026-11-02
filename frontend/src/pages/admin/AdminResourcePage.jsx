import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../../services/api'
import './admin.css'

const resources = {
  floors: ['Floors', ['name', 'description']],
  tables: ['Tables', ['name', 'capacity', 'status']],
  orders: ['Orders', ['orderNumber', 'type', 'status', 'paymentStatus', 'total']],
  reservations: ['Reservations', ['reservationNumber', 'date', 'guestCount', 'status']],
  staff: ['Staff', ['fullName', 'email', 'role', 'isActive']],
  menu: ['Menu items', ['name', 'regularPrice', 'isAvailable', 'isFeatured']],
  inventory: ['Inventory', ['name', 'category', 'quantity', 'unit']],
  finance: ['Purchases & expenses', ['description', 'amount', 'expenseDate', 'category']],
  analytics: ['Analytics records', ['resourceType', 'action', 'actorRole', 'createdAt']],
  settings: ['Restaurant settings', ['restaurantName', 'currency', 'timeZone', 'updatedAt']],
}

function AdminResourcePage() {
  const { resource = 'floors' } = useParams()
  const [searchParams] = useSearchParams()
  const [title, fields] = resources[resource] || resources.floors
  const apiResource = resource === 'menu' ? 'foodItems' : resource === 'finance' ? 'expenses' : resource === 'analytics' ? 'activityLogs' : resource
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)

  useEffect(() => {
    api.get(`/admin/${apiResource}`)
      .then(({ data }) => setItems(data.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [apiResource])

  useEffect(() => {
    if (resource !== 'orders' || !searchParams.get('view')) return
    api.get(`/admin/orders/${searchParams.get('view')}`).then(({ data }) => setSelectedOrder(data.data)).catch((error) => toast.error(error.response?.data?.message || 'Unable to load order details'))
  }, [resource, searchParams])

  async function cancelOrder() {
    const reason = window.prompt('Cancellation reason')
    if (!reason?.trim() || !selectedOrder) return
    try { const { data } = await api.patch(`/admin/orders/${selectedOrder._id}/cancel`, { reason }); setSelectedOrder(data.data); setItems((current) => current.map((item) => item._id === data.data._id ? data.data : item)); toast.success('Order cancelled') }
    catch (error) { toast.error(error.response?.data?.message || 'Unable to cancel order') }
  }

  return (
    <div>
      <div className="admin-page-heading"><div><p className="admin-eyebrow">MANAGEMENT</p><h1>{title}</h1></div></div>
      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr>{fields.map((field) => <th key={field}>{field.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</th>)}</tr></thead>
            <tbody>
              {!loading && items.map((item) => <tr key={item._id}>{fields.map((field) => <td key={field}>{typeof item[field] === 'boolean' ? (item[field] ? 'Yes' : 'No') : String(item[field] ?? '-')}</td>)}</tr>)}
              {!loading && !items.length && <tr><td colSpan={fields.length} className="admin-empty">No records found.</td></tr>}
              {loading && <tr><td colSpan={fields.length} className="admin-empty">Loading records...</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      {selectedOrder && <section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">ORDER DETAIL</p><h2>#{selectedOrder.orderNumber}</h2></div><button className="admin-text-button" onClick={() => setSelectedOrder(null)}>Close</button></div><p>{selectedOrder.type} · {selectedOrder.status} · {selectedOrder.paymentStatus}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th><th>Notes</th></tr></thead><tbody>{selectedOrder.items?.map((item, index) => <tr key={`${item.name}-${index}`}><td>{item.name}</td><td>{item.quantity}</td><td>৳{item.unitPrice}</td><td>{item.notes || '-'}</td></tr>)}</tbody></table></div>{!['completed', 'cancelled'].includes(selectedOrder.status) && <button className="admin-danger-button compact" onClick={cancelOrder}>Cancel order</button>}</section>}
    </div>
  )
}

export default AdminResourcePage
