import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import AppLayout from '../../components/layout/Navbar'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'
import { subjectColors } from '../../utils/necta'
import clsx from 'clsx'

export default function ManageAssignments() {
  const qc = useQueryClient()
  const [selectedClass, setSelectedClass] = useState(null)
  const { register, handleSubmit, reset } = useForm()

  const { data: teachers = [] } = useQuery({
    queryKey: ['admin-teachers-active'],
    queryFn: () => api.get('/admin/teachers?active_only=true').then(r => r.data),
  })
  const { data: subjects = [] } = useQuery({
    queryKey: ['admin-subjects'],
    queryFn: () => api.get('/admin/subjects').then(r => r.data),
  })
  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['admin-classes'],
    queryFn: () => api.get('/admin/classes').then(r => r.data),
  })
  const { data: allAssignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ['admin-assignments'],
    queryFn: () => api.get('/admin/assignments').then(r => r.data),
  })

  // Auto-select first class once loaded
  useEffect(() => {
    if (classes.length && !selectedClass) setSelectedClass(classes[0])
  }, [classes])

  const classAssignments = allAssignments.filter(a => a.class_id === selectedClass?.id)
  const assignedSubjectIds = new Set(classAssignments.map(a => a.subject_id))
  const availableSubjects = subjects.filter(s => !assignedSubjectIds.has(s.id))

  const assignMutation = useMutation({
    mutationFn: (data) =>
      api.post('/admin/assign', {
        teacher_id: Number(data.teacher_id),
        subject_id: Number(data.subject_id),
        class_id: selectedClass.id,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-assignments'] })
      toast.success('Assignment added!')
      reset()
    },
    onError: (e) => toast.error(e.response?.data?.detail ?? 'Error assigning'),
  })

  const removeMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/assign/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-assignments'] })
      toast.success('Assignment removed')
    },
    onError: () => toast.error('Failed to remove'),
  })

  if (loadingClasses) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
          <Spinner /> Loading…
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Subject–Teacher Assignments</h1>
          <p className="text-slate-500 text-sm mt-1">
            Select a class to configure which subjects it has and who teaches them
          </p>
        </div>

        {classes.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-4xl mb-3">🏫</div>
            <div className="text-slate-600 font-medium">No classes found.</div>
            <div className="text-slate-400 text-sm mt-1">
              Create classes first via Manage Assessments.
            </div>
          </div>
        ) : (
          <>
            {/* Class selector tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {classes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedClass(c); reset() }}
                  className={clsx(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-all border',
                    selectedClass?.id === c.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:text-blue-600',
                  )}
                >
                  {c.name}
                  {c.stream ? ` ${c.stream}` : ''}
                  <span className={clsx('ml-1.5 text-xs', selectedClass?.id === c.id ? 'text-blue-200' : 'text-slate-400')}>
                    {c.academic_year}
                  </span>
                </button>
              ))}
            </div>

            {selectedClass && (
              <>
                {/* Assignments for selected class */}
                <div className="card mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="font-semibold text-slate-800 text-base">
                        {selectedClass.name} — Subjects &amp; Teachers
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {classAssignments.length} subject{classAssignments.length !== 1 ? 's' : ''} configured
                      </p>
                    </div>
                  </div>

                  {loadingAssignments ? (
                    <div className="flex items-center justify-center py-10 gap-3 text-slate-500">
                      <Spinner /> Loading…
                    </div>
                  ) : classAssignments.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl">
                      <div className="text-3xl mb-2">📚</div>
                      <div className="text-slate-500 font-medium">No subjects assigned yet</div>
                      <div className="text-slate-400 text-xs mt-1">
                        Use the form below to add subjects and teachers.
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {classAssignments.map((a) => {
                        const color = subjectColors[a.subject_code] ?? '#6b7280'
                        return (
                          <div
                            key={a.id}
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 group"
                          >
                            {/* Subject badge */}
                            <span
                              className="w-14 text-center px-2 py-1 rounded-lg text-xs font-bold text-white flex-shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {a.subject_code}
                            </span>

                            {/* Subject name */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-800 text-sm">{a.subject_name}</div>
                              <div className="text-xs text-slate-400">
                                {a.subject_code} · {selectedClass.name}
                              </div>
                            </div>

                            {/* Arrow */}
                            <span className="text-slate-300 text-sm flex-shrink-0">→</span>

                            {/* Teacher */}
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 flex-shrink-0">
                              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                {a.teacher_name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                              <span className="text-sm text-slate-700 font-medium">
                                {a.teacher_name}
                              </span>
                            </div>

                            {/* Remove */}
                            <button
                              title="Remove assignment"
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              onClick={() =>
                                window.confirm(
                                  `Remove ${a.subject_name} from ${selectedClass.name}?`,
                                ) && removeMutation.mutate(a.id)
                              }
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Add subject to this class */}
                <div className="card">
                  <h2 className="font-semibold text-slate-700 mb-1">
                    Add Subject to {selectedClass.name}
                  </h2>
                  <p className="text-xs text-slate-500 mb-4">
                    Choose a subject and the teacher who will teach it in this class.
                  </p>

                  {availableSubjects.length === 0 ? (
                    <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-4 text-center">
                      All subjects are already assigned to this class.
                    </div>
                  ) : teachers.length === 0 ? (
                    <div className="text-sm text-amber-600 bg-amber-50 rounded-xl p-4 text-center">
                      No active teachers found. Add teachers first in Manage Teachers.
                    </div>
                  ) : (
                    <form
                      onSubmit={handleSubmit((d) => assignMutation.mutate(d))}
                      className="flex flex-wrap gap-3 items-end"
                    >
                      <div className="flex-1 min-w-48">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Subject
                        </label>
                        <select className="input-field" {...register('subject_id', { required: true })}>
                          <option value="">— Select subject —</option>
                          {availableSubjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1 min-w-48">
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Teacher
                        </label>
                        <select className="input-field" {...register('teacher_id', { required: true })}>
                          <option value="">— Select teacher —</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={assignMutation.isPending}
                      >
                        {assignMutation.isPending ? <Spinner size="sm" /> : '+ Assign'}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}

            {/* Summary: all assignments across all classes */}
            {allAssignments.length > 0 && (
              <div className="mt-8">
                <h2 className="font-semibold text-slate-600 text-sm uppercase tracking-wider mb-3">
                  All Assignments Overview
                </h2>
                <div className="card p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="table-head">
                      <tr>
                        <th className="px-4 py-3 text-left">Class</th>
                        <th className="px-4 py-3 text-left">Subject</th>
                        <th className="px-4 py-3 text-left">Teacher</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allAssignments.map((a, i) => {
                        const color = subjectColors[a.subject_code] ?? '#6b7280'
                        return (
                          <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-4 py-2.5 font-medium text-slate-700">{a.class_name}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold text-white"
                                style={{ backgroundColor: color }}
                              >
                                {a.subject_code}
                              </span>
                              <span className="ml-2 text-slate-600">{a.subject_name}</span>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600">{a.teacher_name}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button
                                className="text-red-500 hover:underline text-xs"
                                onClick={() =>
                                  window.confirm('Remove this assignment?') &&
                                  removeMutation.mutate(a.id)
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
