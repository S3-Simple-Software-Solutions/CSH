import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import './site.css';

import { PublicParking, PublicCoupons, PublicEntradas, AdminApp, applyTheme, THEME_KEY } from './app-modules.jsx';
import PublicLayout from './layout/PublicLayout.jsx';
import ServiceLayout from './layout/ServiceLayout.jsx';

import Home from './pages/Home.jsx';
import Historia from './pages/Historia.jsx';
import Plantilla from './pages/Plantilla.jsx';
import Calendario from './pages/Calendario.jsx';
import Noticias from './pages/Noticias.jsx';
import Socios from './pages/Socios.jsx';
import Contacto from './pages/Contacto.jsx';

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/historia', element: <Historia /> },
      { path: '/plantilla', element: <Plantilla /> },
      { path: '/calendario', element: <Calendario /> },
      { path: '/noticias', element: <Noticias /> },
      { path: '/socios', element: <Socios /> },
      { path: '/contacto', element: <Contacto /> },
    ],
  },
  {
    element: <ServiceLayout />,
    children: [
      { path: '/parqueo', element: <PublicParking /> },
      { path: '/cuponera', element: <PublicCoupons /> },
      { path: '/entradas/*', element: <PublicEntradas /> },
    ],
  },
  { path: '/admin/*', element: <AdminApp /> },
]);

applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
