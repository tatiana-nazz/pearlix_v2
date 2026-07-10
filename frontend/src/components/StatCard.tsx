interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
  tone?: "default" | "attention" | "success";
}

export function StatCard({ label, value, description, tone = "default" }: StatCardProps) {
  return (
    <section className={`stat-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {description ? <span>{description}</span> : null}
    </section>
  );
}
