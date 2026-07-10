import type { PropsWithChildren } from "react";

export function AuthLayout({ children }: PropsWithChildren) {
  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <div className="brand-mark">P</div>
        <div>
          <p className="eyebrow">Pearlix Clinic</p>
          <h1>Dental clinic management</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
