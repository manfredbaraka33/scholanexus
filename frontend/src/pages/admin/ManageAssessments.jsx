import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import AppLayout from '../../components/layout/Navbar'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'

const ASSESSMENT_TYPES = [
  { value: 'midterm_exam',  label: 'Mid-Term Exam' },
  { value: 'terminal_exam', label: 'Terminal Exam' },
  { value: 'annual_exam',   label: 'Annual Exam' },
  {value: 'set', label: 'Set'}
]

const assessLabel = { midterm_exam: 'Mid-Term Exam', terminal_exam: 'Terminal Exam', annual_exam: 'Annual Exam' }

export default function ManageAssessments() {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const { register, handleSubmit, reset } = useForm()

  const { data: classes = [] } = useQuery({
    queryKey: ['admin-classes'],
    queryFn: () => api.get('/admin/classes').then(r => r.data)
  })

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: () => api.get('/admin/assessments').then(r => r.data)
  })

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/admin/assessments', { ...data, class_id: Number(data.class_id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-assessments'] }); toast.success('Assessment created!'); setModalOpen(false); reset() },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Error creating assessment')
  })

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Manage Assessments</h1>
          <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>+ Create Assessment</button>
        </div>

        <div className="card p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500"><Spinner />Loading…</div>
          ) : !assessments.length ? (
            <div className="text-center py-16 text-slate-500">No assessments yet. Create one above.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3 text-left">Assessment</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-left">Academic Year</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a, i) => (
                  <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{assessLabel[a.name] ?? a.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.class_name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{a.academic_year}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.is_finalized ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                        {a.is_finalized ? '✓ Finalized' : 'In Progress'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); reset() }} title="Create Assessment" size="sm">
        <form onSubmit={handleSubmit(d => addMutation.mutate(d))} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Assessment Type *</label>
            <select className="input-field" {...register('name', { required: true })}>
              <option value="">Select type</option>
              {ASSESSMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Class *</label>
            <select className="input-field" {...register('class_id', { required: true })}>
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.stream ?? ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Academic Year *</label>
            <input className="input-field" placeholder="e.g. 2025" {...register('academic_year', { required: true })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => { setModalOpen(false); reset() }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
              {addMutation.isPending ? <Spinner size="sm" /> : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  )
}
