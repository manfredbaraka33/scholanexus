import clsx from 'clsx'

export default function Button({ children, variant = 'primary', className, loading, ...props }) {
  const cls = {
    primary: 'btn-primary',
    ghost:   'btn-ghost',
    danger:  'btn-danger',
    success: 'btn-success',
  }
  return (
    <button className={clsx(cls[variant], className)} disabled={loading} {...props}>
      {loading ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 align-middle" /> : null}
      {children}
    </button>
  )
}
