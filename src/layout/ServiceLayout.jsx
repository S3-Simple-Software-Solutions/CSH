import React from 'react';
import { Outlet } from 'react-router-dom';
import SiteHeader from './SiteHeader.jsx';

// Layout de los módulos funcionales (parqueo, cuponera, entradas): header unificado, sin footer.
export default function ServiceLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
    </>
  );
}
