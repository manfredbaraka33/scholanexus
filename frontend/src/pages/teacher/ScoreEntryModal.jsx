import { useState } from 'react'
import { marksToGrade, gradeToPoints } from '../../utils/necta'
import Modal from '../../components/ui/Modal'

export default function ScoreEntryModal({ open, onClose, student, marks, onChange, onSaveNext }) {
  const [val, setVal] = useState(marks ?? '')
  const grade  = marksToGrade(val)
  const points = grade ? gradeToPoints(grade) : null

  const handleChange = (v) => {
    const clamped = Math.max(0, Math.min(100, Number(v)))
    setVal(clamped)
    onChange(clamped)
  }

  const name = student
    ? `${student.last_name}, ${student.first_name}${student.middle_name ? ' ' + student.middle_name : ''}`
    : ''

  return (
    <Modal open={open} onClose={onClose} title="Enter Score" size="sm">
      <div className="text-center">
        <div className="font-semibold text-slate-800 text-base mb-4">{name}</div>
        <div className="flex items-center justify-center gap-3 mb-4">
          <button onClick={() => handleChange((val || 0) - 1)}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-bold transition-colors">−</button>
          <input
            type="number" min="0" max="100"
            value={val}
            onChange={e => handleChange(e.target.value)}
            className="w-28 text-center text-4xl font-bold text-slate-900 border-2 border-blue-400 rounded-xl py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button onClick={() => handleChange((val || 0) + 1)}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xl font-bold transition-colors">+</button>
        </div>

        {grade && (
          <div className="flex items-center justify-center gap-4 py-3 bg-slate-50 rounded-xl mb-4">
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Grade</div>
              <div className="text-2xl font-bold text-slate-800">{grade}</div>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div>
              <div className="text-xs text-slate-500 mb-0.5">Points</div>
              <div className="text-2xl font-bold text-slate-800">{points}</div>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button className="btn-ghost flex-1" onClick={onClose}>Close</button>
          <button className="btn-primary flex-1" onClick={() => { onSaveNext(); onClose() }}>Save & Next</button>
        </div>
      </div>
    </Modal>
  )
}
