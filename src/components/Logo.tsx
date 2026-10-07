import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

/**
 * The Digital Dude wordmark.
 *
 * The two files are named after the colour of the artwork, not the background
 * they sit on: `-dark` is the black mark and belongs on light surfaces, `-light`
 * is the white one for dark surfaces. Swapping those is the easy mistake, so
 * the choice is made here once rather than at every call site.
 */
export function Logo({
  size = 'md',
  className,
  /** Force one variant, for a surface whose colour does not follow the theme. */
  variant,
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  variant?: 'onLight' | 'onDark';
}) {
  const resolved = useTheme((state) => state.resolved);
  const onDark = variant ? variant === 'onDark' : resolved === 'dark';

  const heights = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-11',
  };

  return (
    <img
      src={onDark ? '/digital-dude-logo-light.png' : '/digital-dude-logo-dark.png'}
      alt="Digital Dude"
      // The artwork is 350x95; width follows height so it never distorts.
      className={cn('w-auto select-none', heights[size], className)}
      draggable={false}
    />
  );
}

/**
 * The character on its own, for places too narrow for the wordmark - the
 * collapsed sidebar, and anywhere a square mark reads better.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center overflow-hidden rounded-lg bg-primary px-0.5',
        className,
      )}
      aria-label="Digital Dude"
      role="img"
    >
      {/* The character sits at the left of the 350x95 artwork. Letting the image
          keep its ratio at full height and clipping the overflow leaves exactly
          that character visible, with no hand-tuned crop to drift. */}
      <img
        src="/digital-dude-logo-light.png"
        alt=""
        aria-hidden
        className="h-full w-auto max-w-none"
        draggable={false}
      />
    </span>
  );
}
