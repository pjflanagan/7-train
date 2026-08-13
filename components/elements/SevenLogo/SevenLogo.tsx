import React from 'react';

export interface SevenLogoProps {
  /** Rendered size in px; the badge is square. */
  size?: number;
  className?: string;
  title?: string;
}

/**
 * The 7-line bullet. Kept as geometry rather than a text glyph so it renders
 * identically wherever it lands — header, favicon, or an installed icon —
 * without depending on a font being available.
 */
export const SevenLogo: React.FC<SevenLogoProps> = ({ size = 32, className, title }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 64 64"
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    xmlns="http://www.w3.org/2000/svg"
  >
    {title ? <title>{title}</title> : null}
    <circle cx="32" cy="32" r="32" fill="var(--brand-seven)" />
    {/* Flat top bar into a steep diagonal — the subway bullet's "7". */}
    <path d="M20 17h25.5v8.6L32.5 49H22.2l13.1-23.4H20z" fill="var(--text-on-accent)" />
  </svg>
);
