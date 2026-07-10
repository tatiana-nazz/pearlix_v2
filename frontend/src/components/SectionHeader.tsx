interface SectionHeaderProps {
  title: string;
  description?: string;
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <header className="section-header">
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </header>
  );
}
