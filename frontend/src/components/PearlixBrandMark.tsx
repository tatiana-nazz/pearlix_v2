import type { SVGProps } from "react";
import { useId } from "react";

export function PearlixToothMark(props: SVGProps<SVGSVGElement>) {
  const gradientId = useId();
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false" data-brand-mark="pearlix-tooth" {...props}><defs><linearGradient id={gradientId} x1="5" y1="4" x2="27" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#11bfd7" /><stop offset="1" stopColor="#1366d8" /></linearGradient></defs><path d="M16 6.4c-2.8-2.3-7.7-2.2-9.7.7-2.2 3.2-.5 7.5 1 10.1 1.2 2.2 1.3 8.5 3.9 9.1 2.3.6 2.4-5.4 4.8-5.4s2.5 6 4.8 5.4c2.6-.6 2.7-6.9 3.9-9.1 1.5-2.6 3.2-6.9 1-10.1-2-2.9-6.9-3-9.7-.7Z" stroke={`url(#${gradientId})`} strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" /><path d="M11 8.9c1.2 1 2.8 1.5 5 1.5s3.8-.5 5-1.5" stroke={`url(#${gradientId})`} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export const PearlixBrandMark = PearlixToothMark;
