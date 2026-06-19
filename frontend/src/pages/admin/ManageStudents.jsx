import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import AppLayout from '../../components/layout/Navbar'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'

export default function ManageStudents() {
  const qc = useQueryClient()
  const [classFilter, setClassFilter] = useState('')
  const [modalOpen, setModalOpen]     = useState(false)
  const [editStudent, setEditStudent] = useState(null)
  const [bulkOpen,    setBulkOpen]    = useState(false)

  const { data: classes = [] }  = useQuery({ queryKey: ['admin-classes'],  queryFn: () => api.get('/admin/classes').then(r => r.data) })
  const { data: students = [], isLoading } = useQuery({
    queryKey: ['admin-students', classFilter],
    queryFn: () => api.get(`/admin/students${classFilter ? `?class_id=${classFilter}` : ''}`).then(r => r.data)
  })
  const sortedStudents = [...students].sort((a, b) => {
    const genderRank = (gender) => (gender === 'F' ? 0 : 1)
    const gDiff = genderRank(a.gender) - genderRank(b.gender)
    if (gDiff !== 0) return gDiff
    const nameA = `${a.first_name ?? ''} ${a.middle_name ?? ''} ${a.last_name ?? ''}`.toLowerCase().trim()
    const nameB = `${b.first_name ?? ''} ${b.middle_name ?? ''} ${b.last_name ?? ''}`.toLowerCase().trim()
    return nameA.localeCompare(nameB)
  })

  // Derived counts (UI-only, computed from sortedStudents)
  const totalCount  = sortedStudents.length
  const femaleCount = sortedStudents.filter(s => s.gender === 'F').length
  const maleCount   = sortedStudents.filter(s => s.gender === 'M').length

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  const saveMutation = useMutation({
    mutationFn: (data) => editStudent
      ? api.put(`/admin/students/${editStudent.id}`, data)
      : api.post('/admin/students', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-students'] })
      toast.success(editStudent ? 'Student updated!' : 'Student added!')
      setModalOpen(false); reset(); setEditStudent(null)
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Error saving student')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/students/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-students'] }); toast.success('Student deleted') },
    onError: () => toast.error('Failed to delete')
  })

  const openAdd = () => { setEditStudent(null); reset(); setModalOpen(true) }
  const openEdit = (s) => {
    setEditStudent(s)
    setValue('first_name',  s.first_name);  setValue('middle_name', s.middle_name ?? '')
    setValue('last_name',   s.last_name);   setValue('gender',      s.gender)
    setValue('class_id',    s.class_id);    setValue('admission_number', s.admission_number)
    setModalOpen(true)
  }

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    try {
      const res = await api.post('/admin/students/bulk', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      qc.invalidateQueries({ queryKey: ['admin-students'] })
      const { created, errors: errs } = res.data
      toast.success(`${created} student(s) imported!`)
      if (errs?.length) toast.error(`${errs.length} row(s) skipped — check the file`)
      setBulkOpen(false)
    } catch (err) { toast.error(err.response?.data?.detail ?? 'Import failed') }
  }

  const handleTemplateDownload = async () => {
    try {
      const res = await api.get('/admin/students/template', { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = 'students_template.csv'
      a.click(); URL.revokeObjectURL(url)
    } catch { toast.error('Failed to download template') }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-slate-900">Manage Students</h1>
          <div className="flex gap-2">
            <button className="btn-ghost text-sm" onClick={() => setBulkOpen(true)}>📥 Bulk Import</button>
            <button className="btn-primary text-sm" onClick={openAdd}>+ Add Student</button>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <select className="input-field max-w-xs" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.stream ?? ''} ({c.academic_year})</option>)}
          </select>
        </div>

        {/* Summary bar — shown only when there are students */}
        {!isLoading && totalCount > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              👥 Total: <span className="text-slate-900">{totalCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-pink-50 text-pink-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              ♀ Girls: <span>{femaleCount}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
              ♂ Boys: <span>{maleCount}</span>
            </span>
            {classFilter && (
              <span className="text-xs text-slate-400 italic">
                — filtered by class
              </span>
            )}
          </div>
        )}

        <div className="card p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-slate-500"><Spinner />Loading…</div>
          ) : !students.length ? (
            <div className="text-center py-16 text-slate-500">No students found. Add students above.</div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-400 font-medium w-10">#</th>
                  <th className="px-4 py-3 text-left">Adm #</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-center">Gender</th>
                  <th className="px-4 py-3 text-left">Class</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-2.5 text-xs text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{s.admission_number}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {s.first_name}{s.middle_name ? ' ' + s.middle_name : ''} {s.last_name}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>{s.gender}</span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{s.class_name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button className="text-blue-600 hover:underline text-xs mr-3" onClick={() => openEdit(s)}>Edit</button>
                      <button className="text-red-500 hover:underline text-xs"
                        onClick={() => window.confirm('Delete this student?') && deleteMutation.mutate(s.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditStudent(null); reset() }}
        title={editStudent ? 'Edit Student' : 'Add Student'} size="md">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
              <input className="input-field" {...register('first_name', { required: true })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Middle Name</label>
              <input className="input-field" {...register('middle_name')} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
            <input className="input-field" {...register('last_name', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Gender *</label>
              <select className="input-field" {...register('gender', { required: true })}>
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Class *</label>
              <select className="input-field" {...register('class_id', { required: true })}>
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name} {c.stream ?? ''}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Admission Number *</label>
            <input className="input-field" placeholder="e.g. 2024/001" {...register('admission_number', { required: true })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-ghost" onClick={() => { setModalOpen(false); reset() }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Spinner size="sm" /> : editStudent ? 'Update' : 'Add Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Bulk Import Students" size="sm">
        <p className="text-sm text-slate-600 mb-4">
          Upload a CSV file with columns: <code className="bg-slate-100 px-1 rounded text-xs">admission_number, first_name, middle_name, last_name, gender, class_name</code>
        </p>
        <button onClick={handleTemplateDownload} className="text-blue-600 hover:underline text-sm block mb-4 text-left">
          📥 Download CSV template
        </button>
        <input type="file" accept=".csv" className="input-field" onChange={handleBulkUpload} />
        <div className="flex justify-end mt-4">
          <button className="btn-ghost" onClick={() => setBulkOpen(false)}>Close</button>
        </div>
      </Modal>
    </AppLayout>
  )
}
