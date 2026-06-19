import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AppLayout from '../../components/layout/Navbar'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'
import { useLiveResults } from '../../hooks/useWebSocket'
import clsx from 'clsx'

export default function ResultsProgress() {
  const [assessmentId, setAssessmentId] = useState('')

  const { data: assessments = [] } = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: () => api.get('/admin/assessments').then(r => r.data)
  })

  const { data: progress, isLoading, refetch } = useQuery({
    queryKey: ['progress', assessmentId],
    queryFn: () => api.get(`/results/progress?assessment_id=${assessmentId}`).then(r => r.data),
    enabled: !!assessmentId,
    refetchInterval: 30000,
  })

  // Live WS updates
  const { data: liveData, isConnected } = useLiveResults(assessmentId || null)
  const displayProgress = liveData?.submission_progress ?? progress

  const assessLabel = { midterm_exam: 'Mid-Term Exam', terminal_exam: 'Terminal Exam', annual_exam: 'Annual Exam' }
  const pct = displayProgress?.percentage ?? 0
  const selectedAssessment = assessments.find(a => String(a.id) === String(assessmentId))
  const isPublished = selectedAssessment?.is_published ?? false

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Results Progress</h1>
            <p className="text-slate-500 text-sm">Track submission status per teacher/subject</p>
          </div>
          {isConnected && assessmentId && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </div>
          )}
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
        </div>

        {!assessmentId && (
          <div className="card text-center py-16">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-slate-500">Select an assessment to view progress</div>
          </div>
        )}

        {assessmentId && isLoading && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500"><Spinner />Loading…</div>
        )}

        {assessmentId && displayProgress && (
          <>
            {/* Overall progress */}
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-slate-800">Overall Progress</h2>
                {isPublished
                  ? <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-semibold">✅ Published</span>
                  : <span className="text-2xl font-bold text-blue-600">{pct.toFixed(1)}%</span>}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-4 mb-3">
                <div
                  className={clsx('h-4 rounded-full transition-all duration-500', isPublished ? 'bg-emerald-500' : 'bg-blue-600')}
                  style={{ width: isPublished ? '100%' : `${pct}%` }}
                />
              </div>
              <p className="text-sm text-slate-500">
                {isPublished
                  ? 'Results have been published to teachers.'
                  : `${displayProgress.submitted_count} of ${displayProgress.total_teacher_subject_slots} score sheets submitted`}
              </p>
            </div>

            {/* Subject table */}
            <div className="card p-0 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">Teacher</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-left">Submitted At</th>
                  </tr>
                </thead>
                <tbody>
                  {displayProgress.subjects_status?.map((s, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 font-medium text-slate-800">{s.subject_name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.teacher_name}</td>
                      <td className="px-4 py-3 text-center">
                        {s.is_submitted
                          ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">✅ Submitted</span>
                          : <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">⏳ Pending</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleString('en-GB') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  )
}
