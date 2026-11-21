import { api } from '../api.js';
import { html, $, saat, tarih, bugunStr, durumRozet } from '../ui.js';

export default async function (el, _p, ctx) {
  ctx.baslik('İşlerim');
  let ekipId = ctx.yonetici ? (ctx.sorgu.ekip || '') : '';
  const ekipler = ctx.yonetici ? await ctx.ekipler() : [];

  async function ciz() {
    const liste = await api.get('/islerim', { ekip_id: ekipId || undefined });
    const bugun = bugunStr(); const yarin = bugunStr(new Date(Date.now() + 86400000));
    const gruplar = [
      ['Şu an sahada', liste.filter((i) => i.durum === 'sahada')],
      ['Tarihi geçmiş', liste.filter((i) => i.durum === 'planlandi' && bugunStr(new Date(i.plan_baslangic)) < bugun)],
      ['Bugün', liste.filter((i) => i.durum === 'planlandi' && bugunStr(new Date(i.plan_baslangic)) === bugun)],
      ['Yarın', liste.filter((i) => i.durum === 'planlandi' && bugunStr(new Date(i.plan_baslangic)) === yarin)],
      ['Sonraki günler', liste.filter((i) => i.durum === 'planlandi' && bugunStr(new Date(i.plan_baslangic)) > yarin)],
      ['Bugün tamamlanan', liste.filter((i) => ['tamamlandi', 'fis_kesildi'].includes(i.durum))],
    ].filter(([, l]) => l.length);
    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>İşlerim</h2><span class="alt">${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <span class="bosluk"></span>
        ${ctx.yonetici ? html`<select id="ekip" style="width:auto"><option value="">Tüm ekipler</option>${ekipler.map((e) => html`<option value="${e.id}" ${String(e.id) === String(ekipId) ? 'selected' : ''}>${e.ad}</option>`)}</select>` : ''}
        <button class="btn ikincil kucuk" id="yenile">↻ Yenile</button></div>
      ${!ctx.yonetici && !ctx.kullanici.ekip_id ? html`<div class="uyari-kutu">Hesabınız bir ekibe bağlı değil. Yöneticinizden ekip atamasını isteyin.</div>` : ''}
      ${gruplar.length ? gruplar.map(([ad, l]) => html`<div class="grup-baslik">${ad} (${l.length})</div>
        ${l.map((i) => html`<a class="is-kart ${i.durum === 'sahada' ? 'sahada' : ''} ${['tamamlandi', 'fis_kesildi'].includes(i.durum) ? 'bitti' : ''} oncelik-${i.oncelik}" href="#/saha/${i.id}"
            style="border-left-color:${i.durum === 'planlandi' ? i.ekip_renk : ''}">
          <div class="is-ust"><div class="is-baslik">${i.baslik}</div>${durumRozet(i.durum)}</div>
          <div class="is-bilgi"><span>🕘 ${ad === 'Bugün' || ad === 'Şu an sahada' ? '' : tarih(i.plan_baslangic) + ' '}${saat(i.plan_baslangic)}</span>
            ${i.cari_unvan || i.iletisim_ad ? html`<span>👤 ${i.cari_unvan || i.iletisim_ad}</span>` : ''}
            ${ctx.yonetici ? html`<span>${i.ekip_ad}</span>` : ''}${i.oncelik === 1 ? html`<span class="rozet kirmizi">Acil</span>` : ''}</div>
          ${i.adres ? html`<div class="is-bilgi">📍 ${i.adres}</div>` : ''}</a>`)}`)
        : html`<div class="bos-durum"><b>Planlanmış işiniz yok</b>Yeni iş atandığında burada görünür.</div>`}`);
    $('#yenile', el).onclick = ciz;
    const s = $('#ekip', el);
    if (s) s.onchange = () => { ekipId = s.value; ciz(); };
  }
  await ciz();
  // Sayfa açıkken dakikada bir yenile (yeni atanan işler gelsin)
  const zmn = setInterval(() => { if (!document.body.contains(el)) return clearInterval(zmn); if (!document.hidden && !document.querySelector('dialog[open], .tam-ekran')) ciz().catch(() => {}); }, 60000);
}
