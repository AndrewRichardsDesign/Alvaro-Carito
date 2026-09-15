/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: { center: true, padding: '1.5rem' },
    extend: {
      /* Every colour resolves through a CSS variable holding "R G B" channels,
         so the admin theme editor can repaint the whole site at runtime while
         Tailwind's opacity modifiers (bg-accent/20) keep working. */
      colors: {
        canvas: 'rgb(var(--ac-canvas) / <alpha-value>)',
        surface: 'rgb(var(--ac-surface) / <alpha-value>)',
        ink: 'rgb(var(--ac-ink) / <alpha-value>)',
        display: 'rgb(var(--ac-display) / <alpha-value>)',
        muted: 'rgb(var(--ac-muted) / <alpha-value>)',
        accent: 'rgb(var(--ac-accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--ac-accent-ink) / <alpha-value>)',
        line: 'rgb(var(--ac-line) / <alpha-value>)',

        /* Admin chrome keeps its own fixed palette so it stays legible no
           matter how the couple repaints the site itself. The <alpha-value>
           placeholder is what makes `bg-background/95` resolve — without it
           Tailwind drops the opacity modifier and the surface goes clear. */
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: { DEFAULT: 'hsl(var(--card) / <alpha-value>)', foreground: 'hsl(var(--card-foreground) / <alpha-value>)' },
        popover: { DEFAULT: 'hsl(var(--popover) / <alpha-value>)', foreground: 'hsl(var(--popover-foreground) / <alpha-value>)' },
        primary: { DEFAULT: 'hsl(var(--primary) / <alpha-value>)', foreground: 'hsl(var(--primary-foreground) / <alpha-value>)' },
        secondary: { DEFAULT: 'hsl(var(--secondary) / <alpha-value>)', foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)' },
        destructive: { DEFAULT: 'hsl(var(--destructive) / <alpha-value>)', foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)' },
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--ac-font-display)', 'Georgia', 'serif'],
        body: ['var(--ac-font-body)', 'system-ui', 'sans-serif'],
      },
      letterSpacing: { eyebrow: '0.28em' },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'fade-rise': { from: { opacity: '0', transform: 'translateY(22px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-rise': 'fade-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
