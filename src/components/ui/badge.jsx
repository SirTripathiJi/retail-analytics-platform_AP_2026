export function Badge({ className = '', children, ...props }) {
  return <span className={`badge ${className}`} {...props}>{children}</span>
}
