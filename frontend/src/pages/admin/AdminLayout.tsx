import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/ThemeToggle';
import styles from './Admin.module.css';

export default function AdminLayout() {
  const { user } = useAuth();

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <h2 className={styles.sidebarTitle}>Admin</h2>
        <nav className={styles.sidebarNav}>
          <NavLink to="/admin" end className={({ isActive }) => (isActive ? styles.sidebarNavActive : undefined)}>Time sheets</NavLink>
          <NavLink to="/admin/rankings" className={({ isActive }) => (isActive ? styles.sidebarNavActive : undefined)}>Rankings</NavLink>
        </nav>
        <div className={styles.sidebarFooter}>
          <ThemeToggle />
          <NavLink to="/dashboard" className={styles.backLink}>← Back to Portal</NavLink>
        </div>
      </aside>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
