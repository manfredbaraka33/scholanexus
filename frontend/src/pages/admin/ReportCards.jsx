import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import AppLayout from '../../components/layout/Navbar'
import Spinner from '../../components/ui/Spinner'
import api from '../../api/axios'

export default function ReportCards() {
  const [assessmentId, setAssessmentId] = useState('')
  const [classId,      setClassId]      = useState('')
  const [loading,      setLoading]      = useState(false)

  const { data: assessments = [] } = useQuery({
    queryKey: ['admin-assessments'],
    queryFn: () => api.get('/admin/assessments').then(r => r.data)
  })
  const { data: classes = [] } = useQuery({
    queryKey: ['admin-classes'],
    queryFn: () => api.get('/admin/classes').then(r => r.data)
  })

  const assessLabel = { midterm_exam: 'Mid-Term Exam', terminal_exam: 'Terminal Exam', annual_exam: 'Annual Exam' }

  const handleGenerate = async () => {
    if (!assessmentId) return
    setLoading(true)
    try {
      const res = await api.get(`/reports/reportcards/${assessmentId}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err) {
      console.error('Failed to generate report cards', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Report Cards</h1>
          <p className="text-slate-500 text-sm">Generate PDF booklet with one page per student</p>
        </div>

        <div className="card mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Select Assessment</label>
            <select className="input-field max-w-sm" value={assessmentId} onChange={e => setAssessmentId(e.target.value)}>
              <option value="">— Choose assessment —</option>
              {assessments.map(a => (
                <option key={a.id} value={a.id}>{assessLabel[a.name] ?? a.name} — {a.class_name} ({a.academic_year})</option>
              ))}
            </select>
          </div>

          <button className="btn-primary flex items-center gap-2" onClick={handleGenerate} disabled={!assessmentId || loading}>
            {loading ? <><Spinner size="sm" /> Compiling report cards…</> : '📄 Generate Report Cards Booklet'}
          </button>
        </div>

        {/* Preview card */}
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Preview (Example)</h3>
          <div className="border-2 border-slate-200 rounded-xl p-4 font-mono text-xs text-slate-700 bg-slate-50 whitespace-pre">
{`  MUJUMUZI GOLDEN BRIDGE SECONDARY SCHOOL
       P.O BOX 1985 Bukoba | Tel: 0766941565
            "Discipline and Efficiency"
       MID-TERM EXAMINATION RESULTS — 2025
──────────────────────────────────────────────
 Name: Fatuma Said AMINA        Adm#: 2023/001
 Class: Form 2                  Gender: Female
──────────────────────────────────────────────
 Subject          Score  Total  Grade  Comment
──────────────────────────────────────────────
 Mathematics        72    100     B    Very Good
 Physics            78    100     A    Excellent
 Biology            55    100     C    Good
 Chemistry          48    100     C    Good
──────────────────────────────────────────────
 TOTAL             253    400     —      —
──────────────────────────────────────────────
 Division: I    Position: 5 / 33    Points: 8
──────────────────────────────────────────────
 Amekuwa wa _5_ kati ya _33_ akiwa na wastani 63.3 (C)
──────────────────────────────────────────────
 Form Master Remarks: ________________________
 Head of School: _____________________________
 Parent/Guardian Signature: __________________`}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
