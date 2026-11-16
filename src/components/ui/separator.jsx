export function Separator({ className = '', orientation = 'horizontal', decorative = true, ...props }) {
  return <div
    role={decorative ? 'none' : 'separator'}
    aria-orientation={decorative ? undefined : orientation}
    data-orientation={orientation}
    className={`separator ${className}`}
    {...props}
  />
}
