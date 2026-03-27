import { type ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'coral' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-ocean-500 hover:bg-ocean-400 text-white border border-ocean-400 shadow-ocean hover:shadow-glow',
  secondary:
    'bg-deep-700 hover:bg-deep-600 text-ocean-200 border border-deep-500 hover:border-ocean-500',
  coral:
    'bg-coral-500 hover:bg-coral-400 text-white border border-coral-400 shadow-coral',
  ghost:
    'bg-transparent hover:bg-white/10 text-ocean-200 border border-white/20 hover:border-ocean-400',
  danger:
    'bg-red-700 hover:bg-red-600 text-white border border-red-600',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-lg',
  md: 'px-5 py-2.5 text-base rounded-xl',
  lg: 'px-7 py-3 text-lg rounded-2xl',
  xl: 'px-10 py-4 text-xl rounded-2xl',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      isLoading = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={[
          'font-quest inline-flex items-center justify-center gap-2',
          'transition-all duration-200 active:scale-95 cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-ocean-400 focus:ring-offset-2 focus:ring-offset-ocean-900',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading…
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
