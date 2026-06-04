interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  text?: string;
}

export function SectionTitle({ eyebrow, title, text }: SectionTitleProps) {
  return (
    <div className="section-title">
      {eyebrow && <span>{eyebrow}</span>}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}
