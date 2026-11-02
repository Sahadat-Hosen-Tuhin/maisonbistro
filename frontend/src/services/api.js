import axios from 'axios'

export const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
export const apiOrigin = apiBaseUrl.replace(/\/api\/v\d+\/?$/, '')

const api = axios.create({
  baseURL: apiBaseUrl,
})

api.interceptors.request.use((config) => {
  const role = ['waiter', 'kitchen', 'cashier', 'delivery', 'manager', 'customer'].find((name) => config.url?.startsWith(`/${name}`))
  const sharedRole = config.url?.startsWith('/reservations')
    ? ['cashier', 'manager'].find((name) => window.location.pathname.startsWith(`/${name}/`))
    : undefined
  const token = role
    ? localStorage.getItem(`maison_${role}_token`)
    : sharedRole
      ? localStorage.getItem(`maison_${sharedRole}_token`)
    : config.url?.startsWith('/employee')
      ? ['delivery', 'manager', 'waiter', 'kitchen', 'cashier'].map((name) => localStorage.getItem(`maison_${name}_token`)).find(Boolean)
      : localStorage.getItem('maison_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
