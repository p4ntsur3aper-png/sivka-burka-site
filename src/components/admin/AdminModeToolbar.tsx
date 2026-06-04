import { Eye, LogOut, Pencil, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isAdminAuthorized, isAdminEditMode, logoutAdmin, setAdminEditMode } from '../../services/adminContent';

export function AdminModeToolbar() {
  const [authorized, setAuthorized] = useState(isAdminAuthorized());
  const [editMode, setEditMode] = useState(isAdminEditMode());

  useEffect(() => {
    const syncState = () => {
      setAuthorized(isAdminAuthorized());
      setEditMode(isAdminEditMode());
    };

    window.addEventListener('orlov-admin-state-updated', syncState);
    return () => window.removeEventListener('orlov-admin-state-updated', syncState);
  }, []);

  if (!authorized) return null;

  return (
    <div className="admin-mode-toolbar" role="region" aria-label="Режим администратора">
      <button
        className={`admin-mode-toggle ${editMode ? 'active' : ''}`}
        type="button"
        onClick={() => setAdminEditMode(!editMode)}
      >
        {editMode ? <Eye size={17} /> : <Pencil size={17} />}
        {editMode ? 'Скрыть настройки' : 'Редактировать сайт'}
      </button>
      <Link to="/admin">
        <Settings size={17} /> Панель
      </Link>
      <button type="button" onClick={logoutAdmin}>
        <LogOut size={17} /> Выйти
      </button>
    </div>
  );
}
