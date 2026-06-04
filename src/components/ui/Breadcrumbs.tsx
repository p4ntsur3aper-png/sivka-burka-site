import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="breadcrumbs" aria-label="Хлебные крошки">
      <Link to="/" aria-label="Главная">
        <Home size={15} />
      </Link>
      {items.map((item) => (
        item.to ? (
          <Link key={item.label} to={item.to}>{item.label}</Link>
        ) : (
          <span key={item.label}>{item.label}</span>
        )
      ))}
    </nav>
  );
}
