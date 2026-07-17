import React from 'react';

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

export function LoadingBlock({ label = 'Cargando…' }) {
  return (
    <div className="loading-block" role="status">
      <Spinner size={22} />
      <span>{label}</span>
    </div>
  );
}
