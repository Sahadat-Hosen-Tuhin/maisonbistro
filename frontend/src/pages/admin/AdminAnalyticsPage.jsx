import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import './admin.css'

function AdminAnalyticsPage() {
  const [data, setData] = useState(null)
  const [days, setDays] = useState(30)
  useEffect(() => {
    let active = true
    api.get(`/admin/analytics?days=${days}`).then(({ data: response }) => { if (active) setData(response.data) }).catch((error) => { if (active) toast.error(error.response?.data?.message || 'Unable to load analytics') })
    return () => { active = false }
  }, [days])
  const revenue = (data?.sales || []).reduce((sum, entry) => sum + entry.revenue, 0)
  const orders = (data?.orders || []).reduce((sum, entry) => sum + entry.orders, 0)
  return <div><div className="admin-page-heading"><div><p className="admin-eyebrow">REPORTING</p><h1>Analytics</h1></div><select value={days} onChange={(event) => setDays(event.target.value)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></div><div className="admin-stat-grid"><article className="admin-stat-card"><span>Revenue</span><strong>৳{revenue.toLocaleString()}</strong></article><article className="admin-stat-card"><span>Orders</span><strong>{orders.toLocaleString()}</strong></article><article className="admin-stat-card"><span>Expenses</span><strong>৳{Number(data?.expenses || 0).toLocaleString()}</strong></article><article className="admin-stat-card"><span>Profit</span><strong>৳{(revenue - Number(data?.expenses || 0)).toLocaleString()}</strong></article></div><section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">TOP SELLERS</p><h2>Best-selling products</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Food item</th><th>Quantity</th><th>Sales revenue</th></tr></thead><tbody>{(data?.topItems || []).map((item) => <tr key={item._id}><td>{item.name}</td><td>{item.quantity}</td><td>৳{Number(item.revenue || 0).toLocaleString()}</td></tr>)}{!data?.topItems?.length && <tr><td colSpan="3" className="admin-empty">No sales data for this period.</td></tr>}</tbody></table></div></section><section className="admin-panel"><div className="admin-panel-heading"><div><p className="admin-eyebrow">DAILY PERFORMANCE</p><h2>Sales by day</h2></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Orders</th><th>Revenue</th><th>Payments</th></tr></thead><tbody>{(data?.sales || []).map((entry) => <tr key={entry._id}><td>{entry._id}</td><td>{data.orders?.find((order) => order._id === entry._id)?.orders || 0}</td><td>৳{Number(entry.revenue || 0).toLocaleString()}</td><td>{entry.payments}</td></tr>)}</tbody></table></div></section></div>
}

export default AdminAnalyticsPage
