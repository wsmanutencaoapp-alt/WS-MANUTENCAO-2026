import { cn } from '@/lib/utils';

export function Logo({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      className={cn("h-8 w-8", className)}
      {...props}
    >
      <g>
        {/* Outer Hexagon (orange) */}
        <path
          d="M50 2.5 L95.45 26.25 L95.45 73.75 L50 97.5 L4.55 73.75 L4.55 26.25 Z"
          fill="hsl(var(--primary))"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
        />
        
        {/* Inner "W" Shape (background color, creating the cut-out effect) */}
        <path
          d="M20 75 L35 35 L50 60 L65 35 L80 75 L65 75 L50 45 L35 75 Z"
          fill="hsl(var(--card))"
        />
      </g>
    </svg>
  );
}
