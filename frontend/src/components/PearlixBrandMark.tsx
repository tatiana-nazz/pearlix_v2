import type { SVGProps } from "react";

export function PearlixBrandMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" {...props}>
      <path d="M8 5.5v6.25a8 8 0 0 0 16 0V5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M5.75 5.5h4.5M21.75 5.5h4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="7.25" cy="4.25" r="2.25" fill="currentColor" />
      <circle cx="24.75" cy="4.25" r="2.25" fill="currentColor" />
      <path d="M16 19.75v2.5a5 5 0 0 0 10 0v-1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="26" cy="18.25" r="2.25" stroke="currentColor" strokeWidth="2.1" />
    </svg>
  );
}
