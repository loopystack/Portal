import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { teamApi } from '../../api/client';
import AdminTimeSheets from '../admin/AdminTimeSheets';
import dashboardStyles from '../dashboard/Dashboard.module.css';
import styles from './TeamTimeSheets.module.css';

export default function TeamTimeSheets() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const name = user?.display_name || user?.email || 'Member';

  const handleLogout = () => {
    logout();
    navigate('/signin', { replace: true });
  };

  return (
    <div className={styles.page}>
      <header className={dashboardStyles.header}>
        <h1>PYCE Portal</h1>
        <nav className={dashboardStyles.nav}>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/time-record">Time Record</Link>
          <Link to="/revenue">Revenue</Link>
          <Link to="/rankings">Rankings</Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className={dashboardStyles.adminLink}>Admin</Link>
          )}
          <span className={dashboardStyles.user}>{name}</span>
          <button type="button" onClick={handleLogout} className={dashboardStyles.logoutBtn}>Sign out</button>
        </nav>
      </header>
      <main className={styles.main}>
        <div className={styles.contentFill}>
          <AdminTimeSheets membersFetcher={() => teamApi.listMembers()} fullPage />
        </div>
      </main>
    </div>
  );
}

