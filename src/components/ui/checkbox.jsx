export function Checkbox({ className = '', ...props }) {
  return <input className={`checkbox ${className}`} type="checkbox" {...props} />
}
