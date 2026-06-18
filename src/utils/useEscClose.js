import { useEffect, useRef } from 'react';

// Cierra un modal al presionar ESC. Se usa en todos los modales del admin para
// un comportamiento de cierre uniforme (ademas de la X arriba y el click afuera).
export function useEscClose(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') ref.current?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
