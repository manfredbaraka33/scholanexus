import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import AppLayout from '../../components/layout/Navbar'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'

export default function ManageTeachers() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen]         = useState(false)
  const [editTeacher, setEditTeacher] = useState(null)   // teacher for edit modal
  const [pwdTeacher, setPwdTeacher]   = useState(null)   // teacher for password-reset modal
  const [showInactive, setShowInactive] = useState(false)

  const addForm  = useForm()
  const editForm = useForm()
  const pwdForm  = useForm()
  const { register: rAdd, handleSubmit: hsAdd, reset: resetAdd, formState: { errors: eAdd } } = addForm
  const { register: rEdit, handleSubmit: hsEdit, formState: { errors: eEdit } } = editForm
  const { register: rPwd, handleSubmit: hsPwd, reset: resetPwd, formState: { errors: ePwd } } = pwdForm

  const { data: teachers = [], isLoading } = useQuery({
    queryKey: ['admin-teachers', showInactive],
    queryFn: () =>
      api.get(showInactive ? '/admin/teachers' : '/admin/teachers?active_only=true').then(r => r.data),
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: () => api.get('/admin/assignments').then(r => r.data).catch(() => []),
  })

  // ── Mutations ─────────────────────────────────────────────────

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/admin/teachers', { ...data, role: 'teacher' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-teachers'] })
      toast.success('Teacher added!')
      setAddOpen(false)
      resetAdd()
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Error adding teacher'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/admin/teachers/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-teachers'] })
      toast.success('Teacher updated!')
      setEditTeacher(null)
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Error updating teacher'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.patch(`/admin/teachers/${id}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-teachers'] })
      toast.success('Teacher deactivated')
    },
    onError: () => toast.error('Failed to deactivate'),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id) => api.patch(`/admin/teachers/${id}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-teachers'] })
      toast.success('Teacher reactivated')
    },
    onError: () => toast.error('Failed to reactivate'),
  })

  const resetPwdMutation = useMutation({
    mutationFn: ({ id, password }) =>
      api.patch(`/admin/teachers/${id}/reset-password`, { password }),
    onSuccess: () => {
      toast.success('Password reset successfully!')
      setPwdTeacher(null)
      resetPwd()
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Failed to reset password'),
  })

  // ── Helpers ───────────────────────────────────────────────────

  const openEdit = (t) => {
    setEditTeacher(t)
    editForm.setValue('full_name', t.full_name)
    editForm.setValue('email', t.email ?? '')
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Teachers</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Add teachers, set credentials, and assign subjects in Assign Teachers.
            </p>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Show inactive
            </label>
            <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>
              + Add Teacher
            </button>
          </div>
        </div>

        <div className="card p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <Spinner /> Loading
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              
              <div>No teachers yet. Add one above.</div>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Username</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Subjects Assigned</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t, i) => {
                  const assigned = assignments
                    .filter((a) => a.teacher_id === t.id)
                    .map((a) => `${a.subject_code} ${a.class_name}`)
                    .join(', ')
                  return (
                    <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{t.full_name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{t.username}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{t.email || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs max-w-52 truncate" title={assigned}>
                        {assigned || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            t.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {t.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="text-blue-600 hover:underline text-xs"
                            onClick={() => openEdit(t)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-slate-500 hover:underline text-xs"
                            onClick={() => { setPwdTeacher(t); resetPwd() }}
                          >
                            Reset Pwd
                          </button>
                          {t.is_active ? (
                            <button
                              className="text-red-500 hover:underline text-xs"
                              onClick={() =>
                                window.confirm(`Deactivate ${t.full_name}?`) &&
                                deactivateMutation.mutate(t.id)
                              }
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              className="text-emerald-600 hover:underline text-xs"
                              onClick={() => reactivateMutation.mutate(t.id)}
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Teacher Modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); resetAdd() }}
        title="Add Teacher"
        size="md"
      >
        <form onSubmit={hsAdd((d) => addMutation.mutate(d))} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
            <input className="input-field" {...rAdd('full_name', { required: true })} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username *</label>
            <input
              className="input-field"
              placeholder="Used to log in"
              {...rAdd('username', { required: true })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input className="input-field" type="text" {...rAdd('email')} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Initial Password *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Min 6 characters"
              {...rAdd('password', {
                required: true,
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
            />
            {eAdd.password && (
              <p className="text-red-500 text-xs mt-1">{eAdd.password.message}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">
              The teacher can change this in Account Settings after logging in.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => { setAddOpen(false); resetAdd() }}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
              {addMutation.isPending ? <Spinner size="sm" /> : 'Add Teacher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal
        open={!!editTeacher}
        onClose={() => setEditTeacher(null)}
        title={`Edit — ${editTeacher?.full_name}`}
        size="sm"
      >
        <form
          onSubmit={hsEdit((d) => editMutation.mutate({ id: editTeacher.id, data: d }))}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
            <input className="input-field" {...rEdit('full_name', { required: true })} />
            {eEdit.full_name && <p className="text-red-500 text-xs mt-1">Required</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input className="input-field" type="text" {...rEdit('email')} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setEditTeacher(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={editMutation.isPending}>
              {editMutation.isPending ? <Spinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        open={!!pwdTeacher}
        onClose={() => { setPwdTeacher(null); resetPwd() }}
        title={`Reset Password — ${pwdTeacher?.full_name}`}
        size="sm"
      >
        <form
          onSubmit={hsPwd((d) =>
            resetPwdMutation.mutate({ id: pwdTeacher.id, password: d.password }),
          )}
          className="space-y-3"
        >
          <p className="text-sm text-slate-600">
            Set a new password for <strong>{pwdTeacher?.username}</strong>. The teacher should
            change it after logging in.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              New Password *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="Min 6 characters"
              {...rPwd('password', {
                required: true,
                minLength: { value: 6, message: 'Min 6 characters' },
              })}
            />
            {ePwd.password && (
              <p className="text-red-500 text-xs mt-1">{ePwd.password.message}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setPwdTeacher(null); resetPwd() }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={resetPwdMutation.isPending}>
              {resetPwdMutation.isPending ? <Spinner size="sm" /> : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
