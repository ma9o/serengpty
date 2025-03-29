import { cn } from '@enclaveid/ui-utils';

const sizeMap = {
  xs: 'w-5', // 1.25rem, 20px
  sm: 'w-6', // 1.5rem, 24px
  md: 'w-8', // 2rem, 32px
  lg: 'w-10', // 2.5rem, 40px
  xl: 'w-12', // 3rem, 48px
  '2xl': 'w-16', // 4rem, 64px
};

// Dynamic font size based on circle size
const fontSizeMap = {
  'w-5': 'text-[0.5rem]',
  'w-6': 'text-[0.6rem]',
  'w-8': 'text-xs',
  'w-10': 'text-sm',
  'w-12': 'text-base',
  'w-16': 'text-lg',
};

export interface ScoreCircleProps {
  /**
   * The percentage value to display (0-1)
   */
  percentage: number;
  /**
   * The size of the circle
   * @default "md"
   */
  size?: keyof typeof sizeMap;
  /**
   * Optional label to display
   */
  label?: string;
  /**
   * Optional className for additional styling
   */
  className?: string;
}

export function ScoreCircle({
  percentage,
  size = 'md',
  label,
  className,
}: ScoreCircleProps) {
  const sizeClass = sizeMap[size] || sizeMap.md;
  const viewBoxSize = 100;
  const strokeWidth = 10;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - percentage * circumference;

  const getColor = (percent: number) => {
    if (percent < 0.5) return '#FF6B6B';
    if (percent < 0.66) return '#FFD93D';
    return '#6BCB77';
  };

  return (
    <div className={cn('flex items-center', className)}>
      <div className={`relative ${sizeClass} aspect-square`}>
        <svg
          className="w-full h-full -rotate-90"
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        >
          <circle
            className="text-gray-200"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={viewBoxSize / 2}
            cy={viewBoxSize / 2}
          />
          <circle
            className="transition-all duration-500 ease-out"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            stroke={getColor(percentage)}
            fill="transparent"
            r={radius}
            cx={viewBoxSize / 2}
            cy={viewBoxSize / 2}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset: strokeDashoffset,
            }}
          />
        </svg>
        <div
          className={`text-muted-foreground dark:text-passiveLinkColor absolute inset-0 flex items-center justify-center text-center font-bold ${
            fontSizeMap[sizeClass] || 'text-[0.6rem]'
          }`}
        >
          {(percentage * 100).toFixed(0)}
        </div>
      </div>
      {label && (
        <span className="ml-1 text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
