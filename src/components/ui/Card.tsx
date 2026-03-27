import { type HTMLAttributes, forwardRef } from 'react';

type CardVariant = 'default' | 'ocean' | 'coral' | 'glass';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-deep-800/80 border border-deep-600/50',
  ocean: 'bg-ocean-900/70 border border-ocean-700/50 shadow-ocean',
  coral: 'bg-deep-800/80 border border-coral-600/50 shadow-coral',
  glass: 'bg-white/10 backdrop-blur-md border border-white/20',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-7',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hoverable = false,
      padding = 'md',
      className = '',
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={[
          'rounded-2xl',
          variantClasses[variant],
          paddingClasses[padding],
          hoverable
            ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-glow cursor-pointer'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}

export const CardHeader = ({ className = '', children, ...props }: CardHeaderProps) => (
  <div className={`mb-3 border-b border-white/10 pb-3 ${className}`} {...props}>
    {children}
  </div>
);

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

export const CardTitle = ({ className = '', children, ...props }: CardTitleProps) => (
  <h3 className={`font-quest text-xl text-ocean-200 ${className}`} {...props}>
    {children}
  </h3>
);

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

export const CardBody = ({ className = '', children, ...props }: CardBodyProps) => (
  <div className={`text-pearl-200 ${className}`} {...props}>
    {children}
  </div>
);

export default Card;
