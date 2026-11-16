import { forwardRef } from 'react'

// Small shadcn-style primitives kept local so their appearance follows the reference theme.
export const Button = forwardRef(function Button({ variant = 'primary', className = '', ...props }, ref) {
  return <button ref={ref} className={`button button-${variant} ${className}`} {...props} />
})
