import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, LogOut, TrendingUp, Users } from 'lucide-react';
import { api } from '../utils/api.js';

function money(crc) {
  return new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 }).format(crc || 0);
}

function display(value) {
  const text = String(value ?? '').trim();
  return text || '—';
}

function DetailItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <b>{display(value)}</b>
    </div>
  );
}

export default function PerfilPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api('/api/me').then((data) => {
      if (!alive) return;
      if (!data.ok || !data.user) {
        location.href = '/login?next=/mi-cuenta';
        return;
      }
      setUser(data.user);
      setLoading(false);
    }).catch(() => {
      if (!alive) return;
      setError('No se pudo cargar el perfil.');
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  async function logout() {
    await api('/admin/logout', { method: 'POST', body: '{}' });
    location.href = '/';
  }

  if (loading) {
    return <main className="page profile-page"><p>Cargando perfil...</p></main>;
  }

  if (error || !user) {
    return (
      <main className="page profile-page">
        <p className="error">{error || 'Perfil no disponible.'}</p>
        <Link className="btn ghost" to="/">Volver al inicio</Link>
      </main>
    );
  }

  const p = user.profile;
  const metricas = p?.metricas;

  return (
    <main className="page profile-page">
      <div className="profile-card">
        <p className="eyebrow">Mi cuenta</p>
        <div className="user-detail-head">
          <h1>{user.name}</h1>
          <span className={`pill ${user.status.toLowerCase()}`}>{user.status}</span>
          <span className="pill">{user.role}</span>
          <span className="muted">{user.area}</span>
        </div>

        {!p ? (
          <p className="muted">Esta cuenta no tiene perfil ampliado.</p>
        ) : (
          <>
            <h3 className="detail-section"><Users size={15} />Informacion personal</h3>
            <div className="detail-grid">
              <DetailItem label="Telefono" value={p.personal?.telefono} />
              <DetailItem label="Cedula" value={p.personal?.cedula} />
              <DetailItem label="Nacimiento" value={p.personal?.nacimiento} />
              <DetailItem label="Provincia" value={p.personal?.provincia} />
              <DetailItem label="Genero" value={p.personal?.genero} />
            </div>

            <h3 className="detail-section"><Activity size={15} />Cuenta</h3>
            <div className="detail-grid">
              <DetailItem label="Correo" value={user.email} />
              <DetailItem label="Usuario" value={user.username} />
              <DetailItem label="Registrado" value={p.app?.registrado} />
              <DetailItem label="Ultimo acceso" value={p.app?.ultimoAcceso} />
              <DetailItem label="Plataforma" value={p.app?.plataforma} />
              <DetailItem label="Notificaciones" value={p.app?.notificaciones ? 'Activas' : 'Inactivas'} />
              <DetailItem label="Sesiones (30d)" value={p.app?.sesiones30d} />
            </div>

            {p.category === 'socio' && metricas && (
              <>
                <h3 className="detail-section"><Users size={15} />Membresia</h3>
                <div className="detail-grid">
                  <DetailItem label="No. miembro" value={metricas.numeroMiembro} />
                  <DetailItem label="Membresia" value={metricas.membresia} />
                </div>
              </>
            )}

            {metricas && (
              <>
                <h3 className="detail-section">
                  <TrendingUp size={15} />
                  Metricas {p.category === 'socio' ? 'del socio' : 'del aficionado'}
                </h3>
                <div className="user-stats">
                  <div><span>Partidos</span><b>{metricas.partidosAsistidos}</b></div>
                  <div><span>Asistencia</span><b>{metricas.asistenciaPct}%</b></div>
                  <div><span>Entradas</span><b>{metricas.entradasCompradas}</b></div>
                  <div><span>Gasto total</span><b>{money(metricas.gastoTotalCrc)}</b></div>
                  <div><span>Cupones</span><b>{metricas.cuponesUsados}</b></div>
                  <div><span>Parqueo</span><b>{metricas.reservasParqueo}</b></div>
                  <div><span>Puntos</span><b>{metricas.puntosFidelidad.toLocaleString('es-CR')}</b></div>
                  <div><span>Antiguedad</span><b>{metricas.antiguedadMeses}m</b></div>
                </div>
              </>
            )}
          </>
        )}

        <div className="profile-actions">
          <Link className="btn ghost" to="/">Volver al inicio</Link>
          <button className="btn ghost" type="button" onClick={logout}>
            <LogOut size={16} />
            Cerrar sesion
          </button>
        </div>
      </div>
    </main>
  );
}
