import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AppLayout from '../../components/layout/Navbar'
import Spinner from '../../components/ui/Spinner'
import { DivisionBadge } from '../../components/ui/Badge'
import api from '../../api/axios'
import { useLiveResults } from '../../hooks/useWebSocket'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function LiveStandings() {
  const [assessmentId, setAssessmentId] = useState('')
  const [editingCell, setEditingCell] = useState(null) // { studentId, subjectId, value }
  const [overriding, setOverriding] = useState(false)
  const cancelEditRef = useRef(false)
  const queryClient = useQueryClient()

  const { data: assessments = [] } = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: () => api.get('/admin/assessments').then(r => r.data)
  })

  const { data: standingsData, isLoading } = useQuery({
    queryKey: ['standings', assessmentId],
    queryFn: () => api.get(`/results/standings?assessment_id=${assessmentId}`).then(r => r.data),
    enabled: !!assessmentId,
  })

  const { data: liveData, isConnected } = useLiveResults(assessmentId || null)
  const results = liveData ?? standingsData

  const assessLabel = { midterm_exam: 'Mid-Term Exam', terminal_exam: 'Terminal Exam', annual_exam: 'Annual Exam' }
  const normalizeMarks = (value) => (value === '' ? null : Math.max(0, Math.min(100, Number(value))))
  const submitOverride = (studentId, subjectId, value) => {
    overrideMutation.mutate({
      assessment_id: Number(assessmentId),
      subject_id: subjectId,
      student_id: studentId,
      marks: normalizeMarks(value),
    })
  }
  const submitOverrideIfChanged = (studentId, subjectId, value, currentMarks) => {
    const nextMarks = normalizeMarks(value)
    const previousMarks = currentMarks == null ? null : Number(currentMarks)
    if (nextMarks === previousMarks) {
      setEditingCell(null)
      return
    }
    submitOverride(studentId, subjectId, value)
  }
  const overrideMutation = useMutation({
    mutationFn: (payload) => api.post('/admin/scores/override', payload).then(r => r.data),
    onMutate: () => setOverriding(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standings', assessmentId] })
      toast.success('Mark updated!')
      setEditingCell(null)
    },
    onError: () => toast.error('Failed to update mark'),
    onSettled: () => setOverriding(false),
  })



  const overrideMutation = useMutation({
    // We use the exact URL Vercel already knows and loves
    mutationFn: (payload) => api.post('/admin/scores/override', payload).then(r => r.data),
    onMutate: () => setOverriding(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['standings', assessmentId] })
      toast.success('Mark saved reliably!')
      setEditingCell(null)
    },
    onError: () => toast.error('Failed to save mark'),
    onSettled: () => setOverriding(false),
  })

  // Inside your table cell, your save button/enter key calls it like this:
  overrideMutation.mutate({ 
    student_id: Number(editingCell.studentId),
    subject_id: Number(editingCell.subjectId),
    assessment_id: Number(assessmentId), 
    marks: normalizeMarks(editingCell.value)
  })

  
  
  // Build ordered subject list from the first student's scores_by_subject (values contain code/name)
  const subjectCols = results?.students?.[0]
    ? Object.values(results.students[0].scores_by_subject ?? {})
        .sort((a, b) => a.subject_code.localeCompare(b.subject_code))
    : []

  const selectedAssessment = assessments.find(a => String(a.id) === String(assessmentId))

  const [publishing, setPublishing] = useState(false)
  const handlePublish = async () => {
    if (!assessmentId) return
    setPublishing(true)
    try {
      const res = await api.post(`/admin/assessments/${assessmentId}/publish`)
      queryClient.invalidateQueries({ queryKey: ['admin-assessments'] })
      toast.success(res.data.is_published ? 'Standings published — teachers can now view them.' : 'Standings unpublished.')
    } catch {
      toast.error('Failed to update publish status')
    } finally {
      setPublishing(false)
    }
  }

  const downloadCSV = () => {
    if (!sortedStudents.length) return
    const headers = ['S/No', 'First Name', 'Middle Name', 'Last Name', 'Gender',
      ...subjectCols.map(s => s.subject_code), 'Total', 'Avg', 'Division', 'Points', 'Rank']
    const rows = sortedStudents.map((row, i) => {
      const marks = subjectCols.map(s => row.scores_by_subject?.[s.subject_id]?.marks ?? '')
      const total = marks.filter(m => m !== '').reduce((a, b) => a + b, 0) || ''
      return [
        i + 1,
        row.student.first_name,
        row.student.middle_name || '',
        row.student.last_name,
        row.student.gender,
        ...marks,
        total,
        row.avg_marks?.toFixed(1) ?? '',
        row.division ?? '',
        row.total_points ?? '',
        row.position ?? '',
      ]
    })
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `standings_${assessmentId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [pdfLoading, setPdfLoading] = useState(false)
  const downloadPDF = async () => {
    if (!assessmentId) return
    setPdfLoading(true)
    try {
      const res = await api.get(`/reports/standings/${assessmentId}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `standings_${assessmentId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  // NECTA order: females first (by position), then males (by position); ties broken alphabetically
  const sortedStudents = results?.students
    ? [...results.students].sort((a, b) => {
        const genderRank = (g) => (g === 'F' ? 0 : 1)
        const gDiff = genderRank(a.student.gender) - genderRank(b.student.gender)
        if (gDiff !== 0) return gDiff
        const posDiff = (a.position ?? 9999) - (b.position ?? 9999)
        if (posDiff !== 0) return posDiff
        const la = `${a.student.first_name} ${a.student.middle_name ?? ''} ${a.student.last_name}`.toLowerCase().trim()
        const lb = `${b.student.first_name} ${b.student.middle_name ?? ''} ${b.student.last_name}`.toLowerCase().trim()
        return la.localeCompare(lb)
      })
    : []

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Live Standings</h1>
            <p className="text-slate-500 text-sm">Rankings update automatically as teachers submit</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isConnected && assessmentId && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Live · Updates automatically
              </div>
            )}
            {assessmentId && results && (
              <>
                <button onClick={downloadCSV} className="btn-secondary text-sm flex items-center gap-1.5">
                  ⬇ CSV
                </button>
                <button onClick={downloadPDF} disabled={pdfLoading} className="btn-secondary text-sm flex items-center gap-1.5">
                  {pdfLoading ? <Spinner size="sm" /> : '📄'} PDF
                </button>
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className={clsx(
                    'text-sm flex items-center gap-1.5 px-4 py-2 rounded-lg font-medium transition-colors',
                    selectedAssessment?.is_published
                      ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  )}
                >
                  {publishing ? <Spinner size="sm" /> : selectedAssessment?.is_published ? '🔒 Unpublish' : '🚀 Publish'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Assessment selector */}
        <div className="card mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Assessment</label>
          <select className="input-field max-w-sm" value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>
            <option value="">— Choose assessment —</option>
            {assessments.map(a => (
              <option key={a.id} value={a.id}>{assessLabel[a.name] ?? a.name} — {a.class_name} ({a.academic_year})</option>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">💡 Click any mark cell in the table to edit it (admin override).</p>
        </div>

        {!assessmentId && (
          <div className="card text-center py-16">
            <div className="text-4xl mb-3">⚡</div>
            <div className="text-slate-500">Select an assessment to see live standings</div>
          </div>
        )}

        {assessmentId && isLoading && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500"><Spinner />Loading standings…</div>
        )}

        {assessmentId && results && (
          <>
            {results.submission_progress && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-700">
                ⚡ Rankings based on <strong>{results.submission_progress.submitted_subjects}</strong> of{' '}
                <strong>{results.submission_progress.total_subjects}</strong> subjects submitted so far
              </div>
            )}

            <div className="card p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-3 py-3 text-center">S/No</th>
                    <th className="px-3 py-3 text-left">First Name</th>
                    <th className="px-3 py-3 text-left">Middle Name</th>
                    <th className="px-3 py-3 text-left">Last Name</th>
                    <th className="px-3 py-3 text-center">Gender</th>
                    {subjectCols.map(s => (
                      <th key={s.subject_id} className="px-3 py-3 text-center">{s.subject_code}</th>
                    ))}
                    <th className="px-3 py-3 text-center font-bold">Total</th>
                    <th className="px-3 py-3 text-center font-bold">Avg</th>
                    <th className="px-3 py-3 text-center">Division</th>
                    <th className="px-3 py-3 text-center">Points</th>
                    <th className="px-3 py-3 text-center">Rank</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((row, i) => {
                    // Compute total marks from submitted subjects
                    const markValues = subjectCols.map(s => row.scores_by_subject?.[s.subject_id]?.marks).filter(m => m != null)
                    const total = markValues.length ? markValues.reduce((a, b) => a + b, 0) : null
                    return (
                      <tr key={row.student.id} className={clsx('border-t border-slate-50', i % 2 === 0 ? 'bg-white' : 'bg-slate-50')}>
                        <td className="px-3 py-2.5 text-center text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2.5 text-slate-800">{row.student.first_name}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.student.middle_name || '—'}</td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{row.student.last_name}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={clsx('px-1.5 py-0.5 rounded text-xs font-semibold',
                            row.student.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')}>
                            {row.student.gender}
                          </span>
                        </td>
                        {subjectCols.map(s => {
                          const sc = row.scores_by_subject?.[s.subject_id]
                          return (
                            <td
                              key={s.subject_id}
                              className="px-3 py-2.5 text-slate-500 text-center font-mono group relative cursor-pointer hover:bg-yellow-50"
                              title="Click to edit mark"
                              onClick={() => setEditingCell({ studentId: row.student.id, subjectId: s.subject_id, value: sc?.marks ?? '' })}
                            >

                              {editingCell?.studentId === row.student.id && editingCell?.subjectId === s.subject_id ? (
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <input
                                      autoFocus
                                      type="number"
                                      min="0"
                                      max="100"
                                      className="w-16 text-center border border-blue-400 rounded px-1 py-0.5 text-sm focus:outline-none"
                                      value={editingCell.value}
                                      onChange={e => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          updateScoreMutation.mutate({ 
                                            studentId: editingCell.studentId, // ✅ Set explicitly from state
                                            subjectId: editingCell.subjectId, // ✅ Set explicitly from state
                                            assessmentId: assessmentId,       // ✅ Clean global file state
                                            newMarks: editingCell.value 
                                          })
                                        }
                                        if (e.key === 'Escape') setEditingCell(null)
                                      }}
                                    />
                                    
                                    <button
                                      className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 rounded shadow-sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        updateScoreMutation.mutate({ 
                                          studentId: editingCell.studentId, // ✅ Set explicitly from state
                                          subjectId: editingCell.subjectId, // ✅ Set explicitly from state
                                          assessmentId: assessmentId,       // ✅ Clean global file state
                                          newMarks: editingCell.value 
                                        })
                                      }}
                                      disabled={overriding}
                                    >
                                      {overriding ? '...' : 'Save'}
                                    </button>
                                  </div>
                                ) : (
                                  <span className="group-hover:underline group-hover:text-blue-600">
                                    {sc?.marks != null ? sc.marks : <span className="text-slate-300">—</span>}
                                  </span>
                                )}

                              
                            </td>
                          )
                        })}
                        <td className="px-3 py-2.5 text-center font-bold text-slate-800">{total ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-800">{row.avg_marks?.toFixed(1) ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center">
                          {row.division ? <DivisionBadge division={row.division} /> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center text-slate-600">{row.total_points ?? '—'}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-slate-700">{row.position ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
