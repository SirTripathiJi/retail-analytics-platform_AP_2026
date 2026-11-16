export function Alert({ className = '', variant = 'default', ...props }) {
  return <div role={variant === 'destructive' ? 'alert' : 'status'} className={`alert alert-${variant} ${className}`} {...props} />
}
