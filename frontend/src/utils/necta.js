export function marksToGrade(marks) {
  if (marks === null || marks === undefined || marks === '') return null
  const m = Number(marks)
  if (m >= 75) return 'A'
  if (m >= 65) return 'B'
  if (m >= 45) return 'C'
  if (m >= 30) return 'D'
  return 'F'
}

export function gradeToPoints(grade) {
  return { A: 1, B: 2, C: 3, D: 4, F: 5 }[grade] ?? 5
}

export const gradeColors = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-teal-100 text-teal-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-orange-100 text-orange-800',
  F: 'bg-red-100 text-red-800',
}

export const subjectColors = {
  MATH: '#6366f1', ENG: '#0ea5e9', PHY: '#8b5cf6',
  CHEM: '#ec4899', BIO: '#10b981', HIST: '#f59e0b',
  GEO: '#14b8a6',  KIS: '#f97316', COMM: '#06b6d4',
  BK:   '#84cc16',
}
