// Sunucu ile konuşma
export class ApiHatasi extends Error {
  constructor(mesaj, durum, kod) { super(mesaj); this.durum = durum; this.kod = kod; }
}

async function istek(yontem, yol, govde) {
  let r;
  try {
    r = await fetch('/api' + yol, {
      method: yontem,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-istek': '1' },
      body: govde === undefined ? undefined : JSON.stringify(govde),
    });
  } catch {
    throw new ApiHatasi('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.', 0);
  }
  let veri = null;
  try { veri = await r.json(); } catch { /* */ }
  if (!r.ok) {
    if (r.status === 401 && !yol.startsWith('/giris') && !yol.startsWith('/durum')) {
      window.dispatchEvent(new CustomEvent('oturum-bitti'));
    }
    throw new ApiHatasi(veri?.hata || `Hata (${r.status})`, r.status, veri?.kod);
  }
  // Veri değişti: diğer sekmeler gösterildiklerinde kendini yeniler
  if (yontem !== 'GET' && !/^\/(giris|cikis|durum|efatura\/oku|kdv\/|sil\/onizleme)/.test(yol)) window.dispatchEvent(new Event('veri-degisti'));
  return veri;
}

const qs = (o) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o || {})) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
};

export const api = {
  get: (yol, sorgu) => istek('GET', yol + qs(sorgu)),
  post: (yol, govde = {}) => istek('POST', yol, govde),
  put: (yol, govde = {}) => istek('PUT', yol, govde),
  del: (yol) => istek('DELETE', yol),
};
