import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { useState } from 'react'
import AppLayout from '../components/layout/Navbar'
import Spinner from '../components/ui/Spinner'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function AccountSettings() {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm()

  const newPassword = watch('new_password')

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      await api.put('/auth/change-password', {
        current_password: data.current_password,
        new_password: data.new_password,
      })
      toast.success('Password updated successfully!')
      reset()
    } catch (err) {
      toast.error(err.response?.data?.detail ?? 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">Account Settings</h1>

        {/* Profile card */}
        <div className="card mb-6">
          <h2 className="font-semibold text-slate-700 mb-4">Profile</h2>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-lg">{user?.full_name}</div>
              <div className="text-sm text-slate-500 mt-0.5">
                @{user?.username}
                <span className="mx-2 text-slate-300">·</span>
                <span className="capitalize">{user?.role}</span>
              </div>
              {user?.email && (
                <div className="text-sm text-slate-500 mt-0.5">{user.email}</div>
              )}
            </div>
          </div>
        </div>

        {/* Change password card */}
        <div className="card">
          <h2 className="font-semibold text-slate-700 mb-1">Change Password</h2>
          <p className="text-xs text-slate-500 mb-4">
            Choose a strong password of at least 6 characters.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Current Password *
              </label>
              <input
                type="password"
                autoComplete="current-password"
                className="input-field"
                {...register('current_password', { required: 'Required' })}
              />
              {errors.current_password && (
                <p className="text-red-500 text-xs mt-1">{errors.current_password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                New Password *
              </label>
              <input
                type="password"
                autoComplete="new-password"
                className="input-field"
                {...register('new_password', {
                  required: 'Required',
                  minLength: { value: 6, message: 'Minimum 6 characters' },
                })}
              />
              {errors.new_password && (
                <p className="text-red-500 text-xs mt-1">{errors.new_password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Confirm New Password *
              </label>
              <input
                type="password"
                autoComplete="new-password"
                className="input-field"
                {...register('confirm_password', {
                  required: 'Required',
                  validate: (v) =>
                    v === newPassword || 'Passwords do not match',
                })}
              />
              {errors.confirm_password && (
                <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner size="sm" /> : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
