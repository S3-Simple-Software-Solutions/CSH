export function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `hace ${mo} mes${mo > 1 ? 'es' : ''}`;
  return `hace ${Math.floor(mo / 12)} año${Math.floor(mo / 12) > 1 ? 's' : ''}`;
}
