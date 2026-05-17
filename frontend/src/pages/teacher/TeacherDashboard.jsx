import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import AppLayout from '../../components/layout/Navbar'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'
import { subjectColors } from '../../utils/necta'

const ASSESSMENT_TYPES = [
  { value: 'midterm_exam',   label: 'Mid-Term Exam',   icon: '🗓', desc: 'Mid-term examination' },
  { value: 'terminal_exam',  label: 'Terminal Exam',   icon: '📋', desc: 'End of term examination' },
  { value: 'annual_exam',    label: 'Annual Exam',     icon: '🎓', desc: 'Annual final examination' },
  { value: 'set',    label: 'Set Exam',     icon: '🪓', desc: 'Set examination' },
]

function AssessmentModal({ open, onClose, assignment, assessments }) {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(null)

  const handleOpen = () => {
    if (!selected) return
    const assess = assessments?.find(a => a.name === selected && a.class_id === assignment.class_id)
    if (!assess) { toast.error('Assessment not created yet. Ask admin to create it.'); return }
    navigate(`/teacher/scoresheet?assessment_id=${assess.id}&subject_id=${assignment.subject_id}&class_id=${assignment.class_id}`)
    onClose()
  }

  // Build a lookup from the assignment's own assessment_status array (from /teacher/assignments)
  const myStatusMap = {}
  for (const a of (assignment?.assessments ?? [])) {
    myStatusMap[a.assessment_name] = a.status // 'submitted' | 'in_progress' | 'not_started'
  }

  return (
    <Modal open={open} onClose={onClose} title={`Select Assessment — ${assignment?.subject_name} ${assignment?.class_name}`} size="md">
      <div className="space-y-3">
        {ASSESSMENT_TYPES.map(t => {
          const assess = assessments?.find(a => a.name === t.value && a.class_id === assignment?.class_id)
          const myStatus = myStatusMap[t.value] ?? (assess ? 'not_started' : null)
          const exists   = !!assess
          return (
            <button key={t.value} onClick={() => setSelected(t.value)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                selected === t.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <span className="text-2xl">{t.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-slate-800">{t.label}</div>
                <div className="text-xs text-slate-500">{t.desc}</div>
              </div>
              <div>
                {myStatus === 'submitted'    && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">✓ Submitted</span>}
                {myStatus === 'in_progress'  && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">● In progress</span>}
                {myStatus === 'not_started'  && exists && <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Not started</span>}
                {!exists                     && <span className="text-xs bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">Not created</span>}
              </div>
            </button>
          )
        })}
      </div>
      <div className="flex justify-end gap-3 mt-6">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={handleOpen} disabled={!selected}>Open Sheet</button>
      </div>
    </Modal>
  )
}

export default function TeacherDashboard() {
  const { user } = useAuth()
  const [modalAssignment, setModalAssignment] = useState(null)

  const { data: assignments, isLoading: loadingA } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: () => api.get('/teacher/assignments').then(r => r.data)
  })

  const { data: assessments } = useQuery({
    queryKey: ['all-assessments'],
    queryFn: () => api.get('/admin/assessments').then(r => r.data).catch(() => [])
  })

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr  = now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">{greeting}, {user?.full_name?.split(' ')[0]}!</h1>
          <p className="text-slate-500 text-sm mt-1">{dateStr}</p>
        </div>

        {loadingA ? (
          <div className="flex items-center gap-3 text-slate-500 py-20 justify-center"><Spinner /> Loading your subjects…</div>
        ) : !assignments?.length ? (
          <div className="card text-center py-20">
            <div className="text-4xl mb-3">📚</div>
            <div className="text-slate-600 font-medium">No subjects assigned yet.</div>
            <div className="text-slate-400 text-sm mt-1">Contact the administrator to get subjects assigned.</div>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">My Subjects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {assignments.map(a => {
                const color = subjectColors[a.subject_code] ?? '#6366f1'
                return (
                  <div key={a.id} className="card hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setModalAssignment(a)}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: color }}>
                        {a.subject_code?.slice(0, 3)}
                      </div>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{a.class_name}</span>
                    </div>
                    <div className="font-semibold text-slate-800 text-lg">{a.subject_name}</div>
                    <div className="text-sm text-slate-500 mt-0.5">{a.class_name}</div>
                    <button className="btn-primary mt-4 w-full text-sm" onClick={e => { e.stopPropagation(); setModalAssignment(a) }}>
                      Open Score Sheet
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Published Results link */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Results</h2>
          <Link to="/teacher/standings" className="card hover:shadow-md transition-shadow flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center text-lg">📊</div>
            <div>
              <div className="font-semibold text-slate-800">Published Standings</div>
              <div className="text-sm text-slate-500">View class results published by admin</div>
            </div>
          </Link>
        </div>
      </div>

      {modalAssignment && (
        <AssessmentModal
          open={!!modalAssignment}
          onClose={() => setModalAssignment(null)}
          assignment={modalAssignment}
          assessments={assessments ?? []}
        />
      )}
    </AppLayout>
  )
}
