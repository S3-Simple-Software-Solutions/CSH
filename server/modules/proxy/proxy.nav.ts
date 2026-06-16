import { heroOverrideScript } from '../web/web.hero';

export const NAV_LINKS =
  '<a class="csh-entradas-link" href="/entradas">Entradas</a><a class="csh-cuponera-link" href="/cuponera">Cuponera</a><a class="csh-parqueo-link" href="/parqueo">Parqueo</a><a class="csh-admin-signin" href="/admin">Sign in</a>';

export const NAV_STYLE =
  '<style id="csh-nav-style">.csh-admin-signin,.csh-parqueo-link,.csh-cuponera-link,.csh-entradas-link{font-family:Oswald,sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#f7f1df;text-decoration:none;margin-left:12px}.csh-admin-signin{background:#d62828;padding:10px 14px;border-radius:2px}</style>';

// El sitio es Next.js: al hidratar, React reconstruye el nav y elimina los enlaces
// inyectados en el HTML estatico, por eso el observer los re-inserta.
export const NAV_SCRIPT = `<script id="csh-nav-script">(function(){var html=${JSON.stringify(NAV_LINKS)};function ensure(){if(document.querySelector('.csh-admin-signin'))return;var nav=document.querySelector('.csh-nav-desktop')||document.querySelector('nav');if(nav)nav.insertAdjacentHTML('beforeend',html);}var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(ensure,120);}).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure);else ensure();})();</script>`;

export function decorateSiteHtml(s: string): string {
  s = s.replace(/<a class="csh-(?:entradas-link|cuponera-link|parqueo-link|admin-signin)"[^>]*>[^<]*<\/a>/g, '');
  if (!s.includes('csh-nav-style')) s = s.replace('</head>', `${NAV_STYLE}${NAV_SCRIPT}</head>`);
  const hero = heroOverrideScript();
  if (hero && !s.includes('csh-hero-script')) s = s.replace('</head>', `${hero}</head>`);
  s = s.replace('</nav>', `${NAV_LINKS}</nav>`);
  return s;
}
