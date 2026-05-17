import axios from 'axios'

// Vite automatically sets import.meta.env.PROD to true when building for Vercel
const isProduction = import.meta.env.PROD

const api = axios.create({
  // In production, point directly to the backend. Locally, use the Vite proxy.
  baseURL: isProduction 
    ? 'https://scholanexusapi.vercel.app/api/v1' 
    : '/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
