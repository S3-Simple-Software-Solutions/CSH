import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

/**
 * Tabla del admin con columnas configurables: ordenar por columna (click en el
 * encabezado), mostrar/ocultar y mover columnas desde el menú «Columnas».
 * Las preferencias se guardan por `id` en localStorage del navegador.
 *
 * columns: [{
 *   key,          // única y estable (se usa para persistir preferencias)
 *   label,        // texto del <th>
 *   render(row),  // contenido de la celda (default: row[key])
 *   sortValue(row), // valor comparable para ordenar (default: row[key])
 *   sortable,     // false para columnas de acciones
 *   menuLabel,    // nombre en el menú cuando label está vacío
 *   tdProps(row), // props extra del <td> (ej. onClick stopPropagation)
 * }]
 * rowProps(row): props del <tr> (className, onClick…).
 * sortable=false desactiva el orden en toda la tabla (ej. filas con drag propio).
 * renderBody(cols, rows): reemplaza el <tbody> (tablas con dnd de filas).
 */
export default function DataTable({
  id,
  columns,
  rows,
  rowKey = (row) => row.id,
  rowProps = null,
  empty = null,
  sortable = true,
  renderBody = null,
}) {
  const storageKey = `csh_table_${id}`;
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved && Array.isArray(saved.order)) return saved;
    } catch { /* preferencias corruptas: se ignoran */ }
    return { order: [], hidden: [], sort: null };
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  function savePrefs(next) {
    setPrefs(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* sin espacio: no persiste */ }
  }

  // Reconcilia el orden guardado con las columnas actuales (columnas nuevas al final).
  const orderedCols = useMemo(() => {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const kept = prefs.order.filter((k) => byKey.has(k));
    const missing = columns.map((c) => c.key).filter((k) => !kept.includes(k));
    return [...kept, ...missing].map((k) => byKey.get(k));
  }, [columns, prefs.order]);

  const visibleCols = orderedCols.filter((c) => !prefs.hidden.includes(c.key));

  const sort = sortable ? prefs.sort : null;
  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const value = (row) => (col.sortValue ? col.sortValue(row) : row[col.key]);
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' }) * dir;
    });
  }, [rows, sort, columns]);

  function toggleSort(col) {
    if (!sortable || col.sortable === false) return;
    const cur = prefs.sort;
    let next = { key: col.key, dir: 'asc' };
    if (cur?.key === col.key) next = cur.dir === 'asc' ? { key: col.key, dir: 'desc' } : null;
    savePrefs({ ...prefs, sort: next });
  }

  function toggleHidden(key) {
    const hidden = prefs.hidden.includes(key)
      ? prefs.hidden.filter((k) => k !== key)
      : [...prefs.hidden, key];
    // Nunca ocultar todas las columnas.
    if (hidden.length >= columns.length) return;
    savePrefs({ ...prefs, hidden });
  }

  function moveCol(key, delta) {
    const keys = orderedCols.map((c) => c.key);
    const i = keys.indexOf(key);
    const j = i + delta;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j], keys[i]];
    savePrefs({ ...prefs, order: keys });
  }

  const customized = prefs.order.length > 0 || prefs.hidden.length > 0 || prefs.sort;
  const menuName = (c) => c.menuLabel || c.label || 'Acciones';

  return (
    <div className="table dt">
      <div className="dt-toolbar" ref={menuRef}>
        <button
          type="button"
          className={`dt-cols-btn${menuOpen ? ' active' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          title="Configurar columnas"
        >
          <Settings2 size={13} /> Columnas
        </button>
        {menuOpen && (
          <div className="dt-menu" role="menu">
            {orderedCols.map((c, i) => (
              <div key={c.key} className="dt-menu-row">
                <label>
                  <input
                    type="checkbox"
                    checked={!prefs.hidden.includes(c.key)}
                    onChange={() => toggleHidden(c.key)}
                  />
                  {menuName(c)}
                </label>
                <span className="dt-menu-move">
                  <button type="button" onClick={() => moveCol(c.key, -1)} disabled={i === 0} aria-label={`Mover ${menuName(c)} a la izquierda`}><ChevronUp size={13} /></button>
                  <button type="button" onClick={() => moveCol(c.key, 1)} disabled={i === orderedCols.length - 1} aria-label={`Mover ${menuName(c)} a la derecha`}><ChevronDown size={13} /></button>
                </span>
              </div>
            ))}
            {customized && (
              <button type="button" className="dt-menu-reset" onClick={() => savePrefs({ order: [], hidden: [], sort: null })}>
                Restablecer
              </button>
            )}
          </div>
        )}
      </div>
      <table>
        <thead>
          <tr>
            {visibleCols.map((c) => {
              const canSort = sortable && c.sortable !== false;
              const active = sort?.key === c.key;
              return (
                <th
                  key={c.key}
                  onClick={canSort ? () => toggleSort(c) : undefined}
                  className={canSort ? `dt-sortable${active ? ' dt-sorted' : ''}` : undefined}
                  aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.label}
                  {active && (sort.dir === 'asc' ? <ArrowUp size={11} className="dt-sort-icon" /> : <ArrowDown size={11} className="dt-sort-icon" />)}
                </th>
              );
            })}
          </tr>
        </thead>
        {renderBody ? renderBody(visibleCols, sortedRows) : (
          <tbody>
            {sortedRows.map((row) => (
              <tr key={rowKey(row)} {...(rowProps ? rowProps(row) : {})}>
                {visibleCols.map((c) => (
                  <td key={c.key} {...(c.tdProps ? c.tdProps(row) : {})}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
            {sortedRows.length === 0 && empty && (
              <tr><td colSpan={visibleCols.length} className="muted">{empty}</td></tr>
            )}
          </tbody>
        )}
      </table>
    </div>
  );
}
