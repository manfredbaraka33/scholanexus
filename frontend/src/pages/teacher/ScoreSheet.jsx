import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement
} from 'chart.js'
import api from '../../api/axios'
import AppLayout from '../../components/layout/Navbar'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import ScoreEntryModal from './ScoreEntryModal'
import { marksToGrade, gradeToPoints, gradeColors } from '../../utils/necta'
import clsx from 'clsx'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement)

const GRADES = ['A', 'B', 'C', 'D', 'F']

async function openScoresheetPdf(assessmentId, subjectId) {
  const res = await api.get(`/reports/scoresheet/${assessmentId}/${subjectId}`, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

function computeAnalytics(students, scoresMap) {
  const dist = { A:{M:0,F:0}, B:{M:0,F:0}, C:{M:0,F:0}, D:{M:0,F:0}, F:{M:0,F:0} }
  let totalPoints = 0, count = 0
  for (const s of students) {
    const m = scoresMap[s.id]
    if (m === '' || m === null || m === undefined) continue
    const grade = marksToGrade(m)
    if (!grade) continue
    dist[grade][s.gender]++
    totalPoints += gradeToPoints(grade)
    count++
  }
  const gpa = count ? (totalPoints / count).toFixed(2) : null
  return { dist, gpa, count }
}

export default function ScoreSheet() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const assessmentId = Number(params.get('assessment_id'))
  const subjectId    = Number(params.get('subject_id'))
  const classId      = Number(params.get('class_id'))

  const [scoresMap, setScoresMap]   = useState({})
  const [saveStatus, setSaveStatus] = useState('idle') // idle | saving | saved
  const [lastSaved, setLastSaved]   = useState(null)
  const [locked, setLocked]         = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalStudent, setModalStudent] = useState(null)
  const dirtyRef     = useRef(false)
  const timerRef     = useRef(null)
  const scoresMapRef = useRef({})

  const { data: students = [], isLoading: loadingS } = useQuery({
    queryKey: ['students', classId],
    queryFn: () => api.get(`/teacher/students?class_id=${classId}`).then(r => r.data),
    enabled: !!classId
  })
  const sortedStudents = [...students].sort((a, b) => {
    const genderRank = (gender) => (gender === 'F' ? 0 : 1)
    const gDiff = genderRank(a.gender) - genderRank(b.gender)
    if (gDiff !== 0) return gDiff
    const nameA = `${a.first_name ?? ''} ${a.middle_name ?? ''} ${a.last_name ?? ''}`.toLowerCase().trim()
    const nameB = `${b.first_name ?? ''} ${b.middle_name ?? ''} ${b.last_name ?? ''}`.toLowerCase().trim()
    return nameA.localeCompare(nameB)
  })

  const { data: existingScores, isLoading: loadingE } = useQuery({
    queryKey: ['scores', assessmentId, subjectId],
    queryFn: () => api.get(`/teacher/scores?assessment_id=${assessmentId}&subject_id=${subjectId}`).then(r => r.data),
    enabled: !!assessmentId && !!subjectId
  })

  const { data: assessment } = useQuery({
    queryKey: ['assessment', assessmentId],
    queryFn: () => api.get(`/admin/assessments?class_id=${classId}`).then(r => r.data?.find(a => a.id === assessmentId)),
    enabled: !!assessmentId && !!classId
  })

  const { data: subjectInfo } = useQuery({
    queryKey: ['subject', subjectId],
    queryFn: () => api.get('/admin/subjects').then(r => r.data?.find(s => s.id === subjectId)),
    enabled: !!subjectId
  })

  useEffect(() => {
    if (!existingScores) return
    const map = {}
    for (const sc of existingScores) {
      map[sc.student_id] = sc.marks ?? ''
      if (sc.is_submitted) setLocked(true)
    }
    setScoresMap(map)
  }, [existingScores])

  // Keep ref in sync so autoSave always reads the latest marks (fixes stale-closure bug)
  useEffect(() => { scoresMapRef.current = scoresMap }, [scoresMap])

  const autoSave = useCallback(async () => {
    if (!dirtyRef.current || locked) return
    setSaveStatus('saving')
    try {
      const scores = students.map(s => ({ student_id: s.id, marks: scoresMapRef.current[s.id] === '' ? null : scoresMapRef.current[s.id] }))
      await api.put('/scores/save', { assessment_id: assessmentId, subject_id: subjectId, scores })
      setSaveStatus('saved')
      setLastSaved(new Date())
      dirtyRef.current = false
    } catch { setSaveStatus('idle') }
  }, [assessmentId, subjectId, students, locked])

  const handleMarksChange = (studentId, val) => {
    const clamped = val === '' ? '' : Math.max(0, Math.min(100, Number(val)))
    setScoresMap(prev => ({ ...prev, [studentId]: clamped }))
    dirtyRef.current = true
    setSaveStatus('idle')
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(autoSave, 1500)
  }

  const handleSave = async () => {
    clearTimeout(timerRef.current)
    await autoSave()
    toast.success('Scores saved!')
  }

  const handlePrint = async () => {
    clearTimeout(timerRef.current)
    if (dirtyRef.current) {
      try {
        await autoSave()
      } catch {
        toast.error('Failed to save before printing')
        return
      }
    }
    await openScoresheetPdf(assessmentId, subjectId).catch(() => toast.error('Failed to load PDF'))
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const scores = students.map(s => ({ student_id: s.id, marks: scoresMap[s.id] === '' ? null : scoresMap[s.id] }))
      await api.post('/scores/submit', { assessment_id: assessmentId, subject_id: subjectId, scores })
      toast.success('Score sheet submitted successfully!')
      setLocked(true)
      setSubmitOpen(false)
      await openScoresheetPdf(assessmentId, subjectId)
    } catch (e) {
      toast.error(e.response?.data?.detail ?? 'Submission failed')
    } finally {
      setSubmitting(false) }
  }

  const { dist, gpa } = computeAnalytics(students, scoresMap)
  const GRADES_LABELS = ['A', 'B', 'C', 'D', 'F']
  const barData = {
    labels: GRADES_LABELS,
    datasets: [
      { label: 'Male',   data: GRADES_LABELS.map(g => dist[g].M), backgroundColor: '#3b82f6' },
      { label: 'Female', data: GRADES_LABELS.map(g => dist[g].F), backgroundColor: '#ec4899' },
    ]
  }
  const passCount = (dist.A.M + dist.A.F) + (dist.B.M + dist.B.F) + (dist.C.M + dist.C.F)
  const failCount = (dist.D.M + dist.D.F) + (dist.F.M + dist.F.F)
  const doughnutData = {
    labels: ['Pass (A-C)', 'Fail (D-F)'],
    datasets: [{ data: [passCount, failCount], backgroundColor: ['#10b981', '#ef4444'] }]
  }

  const assessLabel = { midterm_exam: 'Mid-Term Exam', terminal_exam: 'Terminal Exam', annual_exam: 'Annual Exam' }
  const loading = loadingS || loadingE

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto pb-32">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 flex-wrap">
          <Link to="/teacher/dashboard" className="hover:text-blue-600">Dashboard</Link>
          <span>/</span>
          <span>{subjectInfo?.name ?? '…'}</span>
          <span>/</span>
          <span className="text-slate-800 font-medium">{assessLabel[assessment?.name] ?? '…'}</span>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{subjectInfo?.name ?? 'Score Sheet'}</h1>
            <p className="text-slate-500 text-sm mt-0.5">{assessLabel[assessment?.name]} · {assessment?.academic_year}</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === 'saving' && <><Spinner size="sm" /><span className="text-slate-500">Saving…</span></>}
            {saveStatus === 'saved'  && <span className="text-emerald-600">✓ Saved {lastSaved ? `at ${lastSaved.toLocaleTimeString()}` : ''}</span>}
          </div>
        </div>

        {locked && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm font-medium">
            🔒 This score sheet has been submitted and is locked.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500"><Spinner /> Loading students…</div>
        ) : (
          <>
            {/* Score Table */}
            <div className="card p-0 overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">#</th>
                    <th className="px-4 py-3 text-left">Student Name</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">Gender</th>
                    <th className="px-4 py-3 text-center w-32">Marks (0-100)</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">Grade</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStudents.map((s, idx) => {
                    const m = scoresMap[s.id]
                    const grade  = marksToGrade(m)
                    const points = grade ? gradeToPoints(grade) : null
                    const fullName = `${s.first_name}${s.middle_name ? ' ' + s.middle_name : ''} ${s.last_name}`
                    return (
                      <tr key={s.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">
                          <span className={clsx('cursor-pointer hover:text-blue-600', locked ? 'cursor-default' : '')}
                            onDoubleClick={() => !locked && setModalStudent(s)}>
                            {fullName}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center hidden md:table-cell">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold',
                            s.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700')}>
                            {s.gender}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <input type="number" min="0" max="100" disabled={locked}
                            value={m ?? ''}
                            onChange={e => handleMarksChange(s.id, e.target.value)}
                            onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const next = sortedStudents[idx+1]; if(next){ document.getElementById(`marks-${next.id}`)?.focus() } } }}
                            id={`marks-${s.id}`}
                            className={clsx('w-20 text-center text-slate-700 border rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
                              locked ? 'bg-slate-100 text-slate-700 cursor-not-allowed' : 'border-slate-200')}
                          />
                        </td>
                        <td className="px-4 py-2 text-center hidden md:table-cell">
                          {grade ? <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', gradeColors[grade])}>{grade}</span> : '—'}
                        </td>
                        <td className="px-4 py-2 text-center hidden md:table-cell text-slate-600">{points ?? '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Analytics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Grade Distribution */}
              <div className="card">
                <h3 className="font-semibold text-slate-700 mb-3 text-sm">Grade Distribution</h3>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-500 font-semibold">
                    <th className="py-1 text-left">Grade</th>
                    <th className="py-1 text-center">Male</th>
                    <th className="py-1 text-center">Female</th>
                    <th className="py-1 text-center">Total</th>
                  </tr></thead>
                  <tbody>
                    {GRADES.map(g => (
                      <tr key={g} className="border-t border-slate-50">
                        <td className="py-1.5">
                          <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', gradeColors[g])}>{g}</span>
                        </td>
                        <td className="py-1.5 text-center text-slate-700">{dist[g].M}</td>
                        <td className="py-1.5 text-center text-slate-700">{dist[g].F}</td>
                        <td className="py-1.5 text-center font-semibold">{dist[g].M + dist[g].F}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* GPA + Doughnut */}
              <div className="card flex flex-col gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Subject GPA (NECTA)</div>
                  <div className="text-5xl font-bold text-slate-700">{gpa ?? '—'}</div>
                  <div className="text-xs text-slate-400 mt-1">Lower is better</div>
                </div>
                <div className="max-h-40">
                  <Doughnut data={doughnutData} options={{ plugins: { legend: { position: 'bottom' } }, maintainAspectRatio: false }} />
                </div>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="card mb-6">
              <h3 className="font-semibold text-slate-700 mb-3 text-sm">Grade Distribution by Gender</h3>
              <Bar data={barData} options={{ plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, maintainAspectRatio: true }} />
            </div>
          </>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 z-20">
        <div className="flex items-center gap-3">
          <button className="btn-ghost text-slate-700" onClick={() => navigate('/teacher/dashboard')}>← Back</button>
          {!locked && (
            <>
              <button className="btn-ghost text-slate-700" disabled={saveStatus === 'saving'} onClick={handleSave}>
                {saveStatus === 'saving' ? <><Spinner size="sm" className="mr-1" />Saving…</> : saveStatus === 'saved' ? '✓ Saved' : '💾 Save'}
              </button>
              {lastSaved && <span className="text-xs text-slate-400 hidden sm:block">Saved {lastSaved.toLocaleTimeString()}</span>}
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={handlePrint}>
            🖨 Print Score Sheet
          </button>
          {!locked && (
            <button className="btn-success" disabled={submitting} onClick={() => setSubmitOpen(true)}>
              {submitting ? <><Spinner size="sm" className="mr-1" />Submitting…</> : '✓ Print & Submit'}
            </button>
          )}
        </div>
      </div>

      {/* Submit Confirmation */}
      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit Score Sheet?" size="sm">
        <p className="text-slate-600 text-sm mb-6">
          Once submitted, this score sheet will be <strong>locked</strong>. The results will be visible to the admin. Are you sure?
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-ghost text-slate-700" onClick={() => setSubmitOpen(false)}>Cancel</button>
          <button className="btn-success" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Spinner size="sm" className="mr-1" />Submitting…</> : 'Submit & Print'}
          </button>
        </div>
      </Modal>

      {/* Score Entry Modal */}
      {modalStudent && (
        <ScoreEntryModal
          open={!!modalStudent}
          onClose={() => setModalStudent(null)}
          student={modalStudent}
          marks={scoresMap[modalStudent.id]}
          onChange={v => handleMarksChange(modalStudent.id, v)}
          onSaveNext={() => {
            const idx = sortedStudents.findIndex(s => s.id === modalStudent.id)
            if (idx < sortedStudents.length - 1) setModalStudent(sortedStudents[idx + 1])
            else setModalStudent(null)
          }}
        />
      )}
    </AppLayout>
  )
}
