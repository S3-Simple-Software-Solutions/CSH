import React, { createContext, useCallback, useContext, useState } from 'react';
import { useEscClose } from './useEscClose.js';

// Diálogo de confirmación reutilizable (aceptar / cancelar) para cambios de
// estado y acciones importantes. Se consume con el hook `useConfirm`, que
// devuelve una función `confirm(opts) => Promise<boolean>` para usar dentro de
// handlers async: `if (!(await confirm({...}))) return;`.

const ConfirmContext = createContext(null);

function ConfirmDialog({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }) {
  useEscClose(onCancel);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <section className="modal" role="alertdialog" aria-modal="true">
        <div className="modal-head">
          <h3>{title}</h3>
          <button onClick={onCancel} aria-label="Cancelar">×</button>
        </div>
        {message && <p className="muted" style={{ marginTop: 0 }}>{message}</p>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn${danger ? ' danger' : ''}`} onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((opts = {}) => new Promise((resolve) => {
    setDialog({
      title: opts.title || '¿Confirmar acción?',
      message: opts.message || '',
      confirmLabel: opts.confirmLabel || 'Aceptar',
      cancelLabel: opts.cancelLabel || 'Cancelar',
      danger: Boolean(opts.danger),
      resolve,
    });
  }), []);

  const settle = useCallback((value) => {
    setDialog((current) => {
      if (current) current.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <ConfirmDialog
          {...dialog}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// Devuelve `confirm(opts) => Promise<boolean>`. Si no hay provider (contexto
// fuera del admin), no bloquea: resuelve en `true` para no romper la acción.
export function useConfirm() {
  return useContext(ConfirmContext) || (async () => true);
}
