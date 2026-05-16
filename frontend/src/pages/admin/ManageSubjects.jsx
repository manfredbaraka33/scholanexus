import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import AppLayout from '../../components/layout/Navbar'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'
import { subjectColors } from '../../utils/necta'

export default function ManageSubjects() {
  const qc = useQueryClient()
  const [addOpen, setAddOpen]   = useState(false)
  const [editSubject, setEditSubject] = useState(null) // subject object being edited

  const addForm  = useForm()
  const editForm = useForm()

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['admin-subjects'],
    queryFn: () => api.get('/admin/subjects').then(r => r.data),
  })

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/admin/subjects', { ...data, code: data.code.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subjects'] })
      toast.success('Subject added!')
      setAddOpen(false)
      addForm.reset()
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Error adding subject'),
  })

  const editMutation = useMutation({
    mutationFn: ({ id, data }) =>
      api.put(`/admin/subjects/${id}`, { ...data, code: data.code?.toUpperCase() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subjects'] })
      toast.success('Subject updated!')
      setEditSubject(null)
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Error updating subject'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/subjects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-subjects'] })
      toast.success('Subject deleted')
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Failed to delete — subject may be in use'),
  })

  const openEdit = (s) => {
    setEditSubject(s)
    editForm.setValue('name', s.name)
    editForm.setValue('code', s.code)
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Subjects</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Add the subjects offered at this school. Classes are configured in Assign Teachers.
            </p>
          </div>
          <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>
            + Add Subject
          </button>
        </div>

        <div className="card p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
              <Spinner /> Loading…
            </div>
          ) : subjects.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="text-3xl mb-2">📖</div>
              <div>No subjects yet. Add one above.</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Subject Name</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-2.5">
                      <span
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: subjectColors[s.code] ?? '#6b7280' }}
                      >
                        {s.code}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                    <td className="px-4 py-2.5 text-right flex items-center justify-end gap-3">
                      <button
                        className="text-blue-600 hover:underline text-xs"
                        onClick={() => openEdit(s)}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-500 hover:underline text-xs"
                        onClick={() =>
                          window.confirm(`Delete "${s.name}"? This cannot be undone.`) &&
                          deleteMutation.mutate(s.id)
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <Modal
        open={addOpen}
        onClose={() => { setAddOpen(false); addForm.reset() }}
        title="Add Subject"
        size="sm"
      >
        <form onSubmit={addForm.handleSubmit((d) => addMutation.mutate(d))} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Subject Code * <span className="text-slate-400">(e.g. PHY, MATH, ENG)</span>
            </label>
            <input
              className="input-field uppercase"
              placeholder="e.g. PHY"
              {...addForm.register('code', { required: true })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject Name *</label>
            <input
              className="input-field"
              placeholder="e.g. Physics"
              {...addForm.register('name', { required: true })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => { setAddOpen(false); addForm.reset() }}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
              {addMutation.isPending ? <Spinner size="sm" /> : 'Add Subject'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        open={!!editSubject}
        onClose={() => setEditSubject(null)}
        title={`Edit Subject — ${editSubject?.code}`}
        size="sm"
      >
        <form
          onSubmit={editForm.handleSubmit((d) =>
            editMutation.mutate({ id: editSubject.id, data: d }),
          )}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject Code *</label>
            <input
              className="input-field uppercase"
              {...editForm.register('code', { required: true })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject Name *</label>
            <input className="input-field" {...editForm.register('name', { required: true })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => setEditSubject(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={editMutation.isPending}>
              {editMutation.isPending ? <Spinner size="sm" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
