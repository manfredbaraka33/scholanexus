import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'

function BookSparkIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="6" y="8" width="24" height="32" rx="3" fill="#2563eb" />
      <rect x="18" y="8" width="12" height="32" rx="2" fill="#1d4ed8" />
      <rect x="12" y="16" width="6" height="1.5" rx="0.75" fill="white" opacity="0.6" />
      <rect x="12" y="20" width="6" height="1.5" rx="0.75" fill="white" opacity="0.6" />
      <rect x="12" y="24" width="4" height="1.5" rx="0.75" fill="white" opacity="0.6" />
      <circle cx="36" cy="12" r="5" fill="#fbbf24" />
      <path d="M36 8v2M36 14v2M32 12h2M38 12h2M33.17 9.17l1.41 1.41M39.41 14.41l-1.41-1.41M33.17 14.83l1.41-1.41M38 10.58l1.41-1.41" stroke="#f59e0b" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const user = await login(data.username, data.password)
      toast.success(`Welcome back, ${user.full_name}!`)
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/teacher/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Invalid credentials', { duration: 6000 })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-900 relative overflow-hidden flex-col items-center justify-center p-12">
        {/* Geometric background */}
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 600 600" fill="none">
          <circle cx="300" cy="300" r="250" stroke="white" strokeWidth="1" />
          <circle cx="300" cy="300" r="180" stroke="white" strokeWidth="1" />
          <circle cx="300" cy="300" r="110" stroke="white" strokeWidth="1" />
          <line x1="50" y1="300" x2="550" y2="300" stroke="white" strokeWidth="0.5" />
          <line x1="300" y1="50" x2="300" y2="550" stroke="white" strokeWidth="0.5" />
          <line x1="100" y1="100" x2="500" y2="500" stroke="white" strokeWidth="0.5" />
          <line x1="500" y1="100" x2="100" y2="500" stroke="white" strokeWidth="0.5" />
        </svg>
        <div className="relative text-center">
          <div className="text-4xl font-bold text-white mb-2" style={{ fontFamily: 'Sora, sans-serif' }}>
            ScholaNexus
          </div>
          <div className="text-blue-200 text-lg font-medium mb-6">
            Mujumuzi Golden Bridge Secondary School
          </div>
          <div className="text-blue-300 text-base italic">
            "Discipline and Efficiency"
          </div>
          <div className="mt-10 text-blue-400 text-sm">
            P.O BOX 1985 Bukoba
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
            <div className="flex flex-col items-center mb-8">
              <BookSparkIcon />
              <h1 className="mt-4 text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
                Welcome back
              </h1>
              <p className="text-slate-500 text-sm mt-1">Sign in to ScholaNexus</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Enter your username"
                  {...register('username', { required: 'Username is required' })}
                />
                {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter your password"
                  {...register('password', { required: 'Password is required' })}
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
              >
                {loading && <Spinner size="sm" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <p className="text-center text-xs text-slate-400 mt-6">
              ScholaNexus v1.0 · Mujumuzi Golden Bridge
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
