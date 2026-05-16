import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AppLayout from '../../components/layout/Navbar'
import Spinner from '../../components/ui/Spinner'
import { DivisionBadge } from '../../components/ui/Badge'
import api from '../../api/axios'
import clsx from 'clsx'

const ASSESS_LABEL = { midterm_exam: 'Mid-Term Exam', terminal_exam: 'Terminal Exam', annual_exam: 'Annual Exam' }

export default function PublishedStandings() {
  const [assessmentId, setAssessmentId] = useState('')

  const { data: published = [], isLoading: loadingList } = useQuery({
    queryKey: ['published-standings-list'],
    queryFn: () => api.get('/teacher/published-standings').then(r => r.data),
  })

  const { data: results, isLoading: loadingResults } = useQuery({
    queryKey: ['published-standings', assessmentId],
    queryFn: () => api.get(`/teacher/published-standings/${assessmentId}`).then(r => r.data),
    enabled: !!assessmentId,
  })

  const subjectCols = results?.students?.[0]
    ? Object.values(results.students[0].scores_by_subject ?? {})
        .sort((a, b) => a.subject_code.localeCompare(b.subject_code))
    : []

  const sortedStudents = results?.students
    ? [...results.students].sort((a, b) => {
        const genderRank = g => (g === 'F' ? 0 : 1)
        const gDiff = genderRank(a.student.gender) - genderRank(b.student.gender)
        if (gDiff !== 0) return gDiff
        const posDiff = (a.position ?? 9999) - (b.position ?? 9999)
        if (posDiff !== 0) return posDiff
        return `${a.student.last_name} ${a.student.first_name}`
          .localeCompare(`${b.student.last_name} ${b.student.first_name}`)
      })
    : []

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Published Results</h1>
          <p className="text-slate-500 text-sm">View standings published by the admin</p>
        </div>

        <div className="card mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Select Published Assessment</label>
          {loadingList ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm"><Spinner size="sm" /> Loading…</div>
          ) : published.length === 0 ? (
            <div className="text-slate-400 text-sm">No published results yet. Check back later.</div>
          ) : (
            <select className="input-field max-w-sm" value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>
              <option value="">— Choose assessment —</option>
              {published.map(a => (
                <option key={a.id} value={a.id}>
                  {ASSESS_LABEL[a.name] ?? a.name} — {a.class_name} ({a.academic_year})
                </option>
              ))}
            </select>
          )}
        </div>

        {!assessmentId && published.length > 0 && (
          <div className="card text-center py-16">
            <div className="text-4xl mb-3">📊</div>
            <div className="text-slate-500">Select an assessment to view standings</div>
          </div>
        )}

        {assessmentId && loadingResults && (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-500"><Spinner />Loading results…</div>
        )}

        {assessmentId && results && (
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
                  const markValues = subjectCols
                    .map(s => row.scores_by_subject?.[s.subject_id]?.marks)
                    .filter(m => m != null)
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
                          <td key={s.subject_id} className="px-3 py-2.5 text-center font-mono text-slate-600">
                            {sc?.marks != null ? sc.marks : <span className="text-slate-300">—</span>}
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
        )}
      </div>
    </AppLayout>
  )
}
