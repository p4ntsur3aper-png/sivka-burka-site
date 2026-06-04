import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/SectionTitle';
import { isAdminAuthorized, loginAdmin } from '../services/adminContent';
import { isManagerAuthorized, loginManager } from '../services/managerAuth';
import { isTrainerAuthorized, loginTrainer } from '../services/trainerAuth';

type StaffRole = 'admin' | 'manager' | 'trainer';

export function StaffLoginPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<StaffRole>('trainer');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    setErrorText('');
    setLogin('');
    setPassword('');
  }, [role]);

  if (isAdminAuthorized()) {
    return <Navigate to="/admin" replace />;
  }

  if (isManagerAuthorized()) {
    return <Navigate to="/manager/dashboard" replace />;
  }

  if (isTrainerAuthorized()) {
    return <Navigate to="/trainer/schedule" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorText('');
    setSubmitting(true);

    try {
      if (role === 'admin') {
        const ok = await loginAdmin(login, password);
        if (!ok) {
          setErrorText('Проверьте логин и пароль администратора.');
          return;
        }
        navigate('/admin', { replace: true });
        return;
      }

      if (role === 'manager') {
        const ok = await loginManager(login, password);
        if (!ok) {
          setErrorText('Проверьте логин и пароль управляющего.');
          return;
        }
        navigate('/manager/dashboard', { replace: true });
        return;
      }

      if (!login.trim()) {
        setErrorText('Введите логин тренера.');
        return;
      }

      const ok = await loginTrainer(login, password);
      if (!ok) {
        setErrorText('Проверьте логин и пароль тренера.');
        return;
      }
      navigate('/trainer/schedule', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section trainer-page">
      <SectionTitle
        eyebrow="Служебный вход"
        title="Вход для сотрудников"
        text="Клиентам авторизация не требуется. Доступ к рабочим разделам открыт только после выбора роли и проверки учетных данных."
      />

      <form className="form-card trainer-login" onSubmit={handleSubmit}>
        <div className="staff-role-switch staff-role-switch--three">
          <Button type="button" variant={role === 'trainer' ? 'primary' : 'secondary'} onClick={() => setRole('trainer')}>
            Тренер
          </Button>
          <Button type="button" variant={role === 'manager' ? 'primary' : 'secondary'} onClick={() => setRole('manager')}>
            Управляющий
          </Button>
          <Button type="button" variant={role === 'admin' ? 'primary' : 'secondary'} onClick={() => setRole('admin')}>
            Администратор
          </Button>
        </div>

        <label>
          <span>{role === 'trainer' ? 'Логин тренера' : 'Логин'}</span>
          <input
            value={login}
            onChange={(event) => setLogin(event.target.value)}
            autoComplete="username"
            placeholder="Введите логин"
          />
        </label>

        <label>
          <span>Пароль</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </label>

        {errorText && <small className="standalone-error">{errorText}</small>}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Проверяем...' : 'Войти'}
        </Button>
        <p className="form-note">
          Учетные данные выдаются администратором клуба.
        </p>
      </form>
    </section>
  );
}
