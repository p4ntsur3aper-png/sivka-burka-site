import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { Button } from '../ui/Button';

interface StaffWorkspaceNavItem {
  to: string;
  label: string;
}

interface StaffWorkspaceNavProps {
  items: StaffWorkspaceNavItem[];
  onLogout: () => void;
}

export function StaffWorkspaceNav({ items, onLogout }: StaffWorkspaceNavProps) {
  return (
    <div className="staff-workspace-nav">
      <nav className="staff-workspace-links" aria-label="Внутренняя навигация">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `staff-workspace-link ${isActive ? 'active' : ''}`}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Button variant="ghost" onClick={onLogout}>
        <LogOut size={18} /> Выйти
      </Button>
    </div>
  );
}
