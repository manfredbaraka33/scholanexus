import clsx from 'clsx'

const variants = {
  green:  'bg-emerald-100 text-emerald-800',
  teal:   'bg-teal-100 text-teal-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  orange: 'bg-orange-100 text-orange-800',
  red:    'bg-red-100 text-red-800',
  blue:   'bg-blue-100 text-blue-800',
  pink:   'bg-pink-100 text-pink-800',
  gray:   'bg-slate-100 text-slate-600',
}

const gradeVariant = { A: 'green', B: 'teal', C: 'yellow', D: 'orange', F: 'red' }
const divVariant   = { 'I': 'green', 'II': 'teal', 'III': 'yellow', 'IV': 'orange', '0': 'red' }

export function GradeBadge({ grade }) {
  return <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', variants[gradeVariant[grade] ?? 'gray'])}>{grade ?? '—'}</span>
}

export function DivisionBadge({ division }) {
  const key = division?.replace('Division ', '').replace('Div ', '')
  return <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', variants[divVariant[key] ?? 'gray'])}>Div {key}</span>
}

export default function Badge({ children, variant = 'gray', className }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', variants[variant], className)}>
      {children}
    </span>
  )
}
