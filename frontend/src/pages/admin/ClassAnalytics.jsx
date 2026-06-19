import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import AppLayout from '../../components/layout/Navbar'
import Spinner from '../../components/ui/Spinner'
import { GradeBadge } from '../../components/ui/Badge'
import api from '../../api/axios'
import { gradeColors } from '../../utils/necta'
import clsx from 'clsx'
import toast from 'react-hot-toast'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)
const GRADES = ['A', 'B', 'C', 'D', 'F']

export default function ClassAnalytics() {
  const [assessmentId, setAssessmentId] = useState('')

  const { data: assessments = [] } = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: () => api.get('/admin/assessments').then(r => r.data)
  })

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['analytics', assessmentId],
    queryFn: () => api.get(`/results/analytics?assessment_id=${assessmentId}`).then(r => r.data),
    enabled: !!assessmentId,
  })

  const assessLabel = { midterm_exam: 'Mid-Term Exam', terminal_exam: 'Terminal Exam', annual_exam: 'Annual Exam' }

  const [pdfLoading, setPdfLoading] = useState(false)
  const downloadPDF = async () => {
    if (!assessmentId) return
    setPdfLoading(true)
    try {
      const res = await api.get(`/reports/analytics/${assessmentId}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `analytics_${assessmentId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Failed to generate analytics PDF')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Class Analytics</h1>
            <p className="text-slate-500 text-sm">Grade distribution and GPA per subject</p>
          </div>
          {analytics && (
            <button onClick={downloadPDF} disabled={pdfLoading} className="btn-secondary text-sm flex items-center gap-1.5">
              {pdfLoading ? <Spinner size="sm" /> : '📄'} Download PDF
            </button>
          )}
        </div>

        <div className="card mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Assessment</label>
          <select className="input-field max-w-sm" value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>
            <option value="">— Choose assessment —</option>
            {assessments.map(a => (
              <option key={a.id} value={a.id}>{assessLabel[a.name] ?? a.name} — {a.class_name} ({a.academic_year})</option>
            ))}
          </select>
        </div>

        {!assessmentId && <div className="card text-center py-16"><div className="text-4xl mb-3">📈</div><div className="text-slate-400">Select an assessment</div></div>}
        {assessmentId && isLoading && <div className="flex items-center justify-center py-20 gap-3 text-slate-500"><Spinner />Loading…</div>}

        {analytics && (
          <>
            {/* Class GPA */}
            <div className="card mb-6 flex items-center gap-6">
              <div>
                <div className="text-xs text-slate-500 mb-1">Class GPA (NECTA)</div>
                <div className="text-5xl font-bold text-slate-600">{analytics.class_gpa?.toFixed(2) ?? '—'}</div>
                <div className="text-xs text-slate-400 mt-1">Lower is better</div>
              </div>
            </div>

            {/* Per-subject cards */}
            {analytics.subject_analytics?.map(subj => {
              const barData = {
                labels: GRADES,
                datasets: [
                  { label: 'Male',   data: GRADES.map(g => subj.grade_counts?.[g]?.M ?? 0), backgroundColor: '#3b82f6' },
                  { label: 'Female', data: GRADES.map(g => subj.grade_counts?.[g]?.F ?? 0), backgroundColor: '#ec4899' },
                ]
              }
              return (
                <div key={subj.subject_id} className="card mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-500 text-lg">{subj.subject_name}</h3>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">GPA</div>
                      <div className="text-2xl font-bold text-slate-600">{subj.gpa?.toFixed(2) ?? '—'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead><tr className="text-xs text-slate-500 font-semibold">
                          <th className="py-1 text-left">Grade</th>
                          <th className="py-1 text-center">M</th>
                          <th className="py-1 text-center">F</th>
                          <th className="py-1 text-center">Total</th>
                        </tr></thead>
                        <tbody>
                          {GRADES.map(g => {
                            const m = subj.grade_counts?.[g]?.M ?? 0
                            const f = subj.grade_counts?.[g]?.F ?? 0
                            return (
                              <tr key={g} className="border-t border-slate-50">
                                <td className="py-1.5"><span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', gradeColors[g])}>{g}</span></td>
                                <td className="py-1.5 text-center">{m}</td>
                                <td className="py-1.5 text-center">{f}</td>
                                <td className="py-1.5 text-center font-semibold">{m+f}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="h-40">
                      <Bar data={barData} options={{ plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, maintainAspectRatio: false }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </AppLayout>
  )
}
