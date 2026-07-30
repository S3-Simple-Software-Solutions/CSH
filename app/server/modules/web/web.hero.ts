import { readWebData, WEB_DEFAULTS } from './web.repository';

// La hidratacion de Next.js pisa los cambios estaticos, por eso los overrides
// del hero se aplican con un observer que los re-inserta. Los guards (comparar
// antes de asignar) evitan que el propio apply dispare el MutationObserver en bucle.
export function heroOverrideScript(): string {
  const cfg = readWebData();
  const overrides = {
    kicker: cfg.kicker,
    title: cfg.title,
    number: cfg.number,
    sub: cfg.sub,
    image: cfg.imageVersion ? `/site-assets/hero?v=${cfg.imageVersion}` : null,
  };
  if (!overrides.kicker && !overrides.title && !overrides.number && !overrides.sub && !overrides.image) return '';
  const payload = JSON.stringify(overrides).replace(/</g, '\\u003c');
  return `<script id="csh-hero-script">(function(){var cfg=${payload};function apply(){var hs=document.querySelectorAll('h1');for(var i=0;i<hs.length;i++){var h=hs[i];var sp=h.querySelectorAll('span');if(sp.length<2)continue;if(sp[0].textContent!=='${WEB_DEFAULTS.title}'&&!sp[0].hasAttribute('data-csh'))continue;sp[0].setAttribute('data-csh','1');if(cfg.title&&sp[0].textContent!==cfg.title)sp[0].textContent=cfg.title;if(cfg.number&&sp[1].textContent!==cfg.number)sp[1].textContent=cfg.number;var eye=h.previousElementSibling;if(cfg.kicker&&eye){var t=eye.lastChild;if(t&&t.nodeType===3){if(t.nodeValue!==cfg.kicker)t.nodeValue=cfg.kicker;}else{eye.appendChild(document.createTextNode(cfg.kicker));}}var wrap=h.nextElementSibling;var p=wrap&&wrap.querySelector('p');if(cfg.sub&&p&&p.textContent!==cfg.sub)p.textContent=cfg.sub;if(cfg.image){var sec=h.closest('section')||h.parentElement;var img=(sec&&sec.querySelector('img[data-nimg]'))||document.querySelector('img[data-nimg=\\u0022fill\\u0022]');if(img&&img.getAttribute('src')!==cfg.image){img.removeAttribute('srcSet');img.removeAttribute('srcset');img.setAttribute('sizes','100vw');img.src=cfg.image;}}break;}}var t;new MutationObserver(function(){clearTimeout(t);t=setTimeout(apply,150);}).observe(document.documentElement,{childList:true,subtree:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();})();</script>`;
}
