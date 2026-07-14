// Identidad y datos de contacto del Club Sport Herediano.

export const club = {
  nombre: 'Club Sport Herediano',
  apodo: 'El Team',
  fundacion: '12 de junio de 1921',
  ciudad: 'Heredia, Costa Rica',
  lema: 'Nuestra pasión es eterna',
  campeonatos: 32,
  logo: '/brand/logo-shield.png',
};

export const contacto = {
  general: {
    email: 'servicioalcliente@herediano.com',
    whatsapp: '+506 6052 2845',
    horario: 'Lun–Vie, 8:00–17:00',
    ubicacion: 'Heredia centro, Costa Rica',
  },
  socios: {
    email: 'socios@herediano.com',
    whatsapp: '+506 2261 8489',
    horario: 'L–V, 8am–1pm, 2pm–5pm',
  },
  comercial: {
    whatsapp: '+506 8629 1661',
  },
};

// Redes sociales reales del club (verificadas en el footer del sitio oficial).
export const social = [
  { red: 'Instagram', url: 'https://www.instagram.com/csherediano1921/', icon: 'instagram' },
  { red: 'Facebook', url: 'https://www.facebook.com/csherediano/', icon: 'facebook' },
  { red: 'YouTube', url: 'https://www.youtube.com/@ClubSportHerediano', icon: 'youtube' },
  { red: 'TikTok', url: 'https://www.tiktok.com/@csherediano1921', icon: 'tiktok' },
  { red: 'WhatsApp', url: 'https://api.whatsapp.com/send/?phone=%2B50660522845', icon: 'whatsapp' },
];

// Enlaces externos (transaccionales) que el sitio oficial delega a terceros.
export const externalLinks = {
  tienda: 'https://solocrackscr.com/categoria-producto/productossolocracks/productos-oficiales/',
  entradas: 'https://www.passline.com/sitio/11954967-herediano',
  citaSocios: 'https://clubsportherediano.setmore.com',
};

// Navegación principal unificada. Los `to` internos usan react-router.
// "Inicio" se omite: el logo de la marca ya enlaza a "/".
export const navMain = [
  { label: 'Historia', to: '/historia' },
  { label: 'Plantilla', to: '/plantilla' },
  { label: 'Calendario', to: '/calendario' },
  { label: 'Noticias', to: '/noticias' },
  { label: 'Socios', to: '/socios' },
  { label: 'Contacto', to: '/contacto' },
];

// Módulos funcionales. `primary: true` → chip CTA destacado.
export const navModules = [
  { label: 'Entradas', to: '/entradas', primary: true },
  { label: 'Comida', to: '/comida' },
  { label: 'Cuponera', to: '/cuponera' },
  { label: 'Parqueo', to: '/parqueo' },
];

export const footerLinks = [
  { label: 'Historia', to: '/historia' },
  { label: 'Plantilla', to: '/plantilla' },
  { label: 'Calendario', to: '/calendario' },
  { label: 'Hacete socio', to: '/socios' },
  { label: 'Noticias', to: '/noticias' },
  { label: 'Contacto', to: '/contacto' },
];
