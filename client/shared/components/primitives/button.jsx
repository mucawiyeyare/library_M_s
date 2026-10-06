import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'
const buttonVariants = cva('button', {
  variants: {
    variant: { default: '', outline: 'secondary', ghost: 'ghost' },
    size: { default: '', sm: 'small', icon: 'icon-button' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})
export const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : 'button'
    return (
      <Component
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
