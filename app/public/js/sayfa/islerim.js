import { api } from '../api.js';
import { html, ham, $, saat, tarih, bugunStr, durumRozet, pencere, bildir, sureMetni, secici, vurgula } from '../ui.js';

// Teknisyen iş ekler: havuza düşer ya da "bu işi ben yapıyorum" ile bugün kendi ekibine planlanır
// Teknisyen için cari seçimi: ad / telefonla arama, yoksa "Yeni cari" (ünvan zorunlu, telefon isteğe bağlı)
function teknisyenCariSecici(input, sec) {
  return secici(input, {
    getir: (q) => api.get('/cariler/ara', { q }),
    goster: (c, q) => html`<div class="secici-satir"><div class="ss-ana"><b>${ham(vurgula(c.unvan, q))}</b>
      <small>${[c.telefon, [c.ilce, c.il].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}</small></div></div>`,
    sec,
    bosMetin: 'Cari bulunamadı',
    sonKullanilan: 'cari-tek',
    yeni: (q) => pencere({
      baslik: 'Yeni cari',
      icerik: html`<label class="alan"><span>Ünvan / ad soyad *</span><input name="unvan" value="${q || ''}" required></label>
        <label class="alan"><span>Telefon</span><input name="telefon" type="tel" inputmode="tel"></label>
        <label class="alan"><span>Adres</span><textarea name="adres" rows="2"></textarea></label>`,
      kaydetMetin: 'Cariyi aç',
      kaydet: (v) => { if (!String(v.unvan || '').trim()) throw new Error('Ünvan yazın.'); return api.post('/cariler/hizli', v); },
    }),
    yeniMetin: 'Yeni cari',
  });
}

export async function teknisyenIsEkle(ctx) {
  let cari = null;
  const r = await pencere({
    baslik: 'İş ekle',
    icerik: html`<label class="alan"><span>Cari (müşteri) *</span><input id="tek-cari" placeholder="Müşteri ara: ad, telefon…" autocomplete="off"></label>
      <label class="alan"><span>Ne istendi? *</span><textarea name="mesaj" rows="4" placeholder="Örn: toner istedi, yazıcı kağıt sıkıştırıyor"></textarea></label>
      <p class="soluk" style="font-size:.82rem;margin:-.3rem 0 .6rem">Müşteri listede yoksa aramada "Yeni cari" ile açın.</p>
      <label class="alan"><span>Öncelik</span><select name="oncelik"><option value="2">Normal</option><option value="1">Acil</option><option value="3">Düşük</option></select></label>
      <label class="kutu-sec"><input type="checkbox" name="ben"> <span><b>Bu işi ben yapıyorum</b> — bugün ekibime planlansın</span></label>`,
    kaydetMetin: 'Ekle',
    acildi: (d) => {
      const inp = $('#tek-cari', d);
      teknisyenCariSecici(inp, (c) => { cari = c; inp.value = c.unvan; inp.classList.add('secili'); });
      inp.addEventListener('input', () => { if (cari && inp.value !== cari.unvan) { cari = null; inp.classList.remove('secili'); } });
    },
    kaydet: async (v) => {
      if (!String(v.mesaj || '').trim()) throw new Error('Ne istendiğini yazın.');
      // Cari seçilmediyse sunucu mesajdaki telefon / ünvandan bulmayı dener; bulamazsa "Cari seçin" der
      return api.post('/isler/teknisyen', { mesaj: v.mesaj, oncelik: Number(v.oncelik), ben: !!v.ben, cari_id: cari?.id || null });
    },
  });
  if (!r) return false;
  bildir(r.ben ? 'İş eklendi ve size planlandı.' : 'İş havuza eklendi.', 'basari', 4500);
  if (r.ben) ctx.git(`saha/${r.id}`);
  return true;
}

export default async function (el, _p, ctx) {
  ctx.baslik('İşlerim');
  let ekipId = ctx.yonetici ? (ctx.sorgu.ekip || '') : '';
  const ekipler = ctx.yonetici ? await ctx.ekipler() : [];
  // Teknisyen: İşlerim / Havuz bölümleri
  let bolum = !ctx.yonetici && ctx.sorgu.b === 'havuz' ? 'havuz' : 'islerim';
  const bolumHtml = (havuzSayi) => (ctx.yonetici ? '' : html`<div class="mk-bolumler tek-bolum" role="tablist">
      <button type="button" role="tab" data-bolum="islerim" class="${bolum === 'islerim' ? 'secili' : ''}">İşlerim</button>
      <button type="button" role="tab" data-bolum="havuz" class="${bolum === 'havuz' ? 'secili' : ''}">Havuz${havuzSayi ? html` <b class="bolum-sayi">${havuzSayi}</b>` : ''}</button></div>`);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bolum]');
    if (!b || b.dataset.bolum === bolum) return;
    bolum = b.dataset.bolum;
    history.replaceState(history.state, '', bolum === 'havuz' ? '#/islerim?b=havuz' : '#/islerim');
    ciz();
  });

  async function havuzCiz() {
    const liste = await api.get('/havuz');
    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>İş havuzu</h2><span class="alt">${liste.length} iş bekliyor</span><span class="bosluk"></span>
        ${ctx.mobil ? '' : html`<button class="btn birincil kucuk" id="tek-is-ekle">+ İş ekle</button>`}<button class="btn ikincil kucuk" id="yenile">↻ Yenile</button></div>
      ${bolumHtml(liste.length)}
      <p class="soluk" style="margin:.2rem 0 .8rem">Henüz kimseye planlanmamış işler. Bir işi yapacaksanız açıp <b>"Bu işi ben alıyorum"</b>a dokunun.</p>
      ${liste.length ? liste.map((i) => html`<a class="is-kart oncelik-${i.oncelik}" href="#/saha/${i.id}">
          <div class="is-ust"><div class="is-baslik">${i.baslik}</div>${i.oncelik === 1 ? html`<span class="rozet kirmizi">Acil</span>` : ''}</div>
          <div class="is-bilgi">${i.unvan || i.iletisim_ad ? html`<span>👤 ${i.unvan || i.iletisim_ad}</span>` : ''}<span>⏳ ${sureMetni(i.bekleme_sn)} bekliyor</span></div>
          ${i.adres ? html`<div class="is-bilgi">📍 ${i.adres}</div>` : ''}</a>`)
        : html`<div class="bos-durum"><b>Havuz boş</b>Bekleyen iş yok.</div>`}`);
    $('#yenile', el).onclick = ciz;
    const te = $('#tek-is-ekle', el); if (te) te.onclick = async () => { if (await teknisyenIsEkle(ctx)) ciz(); };
  }

  async function ciz() {
    if (bolum === 'havuz') return havuzCiz();
    const [liste, havuzSayi] = await Promise.all([api.get('/islerim', { ekip_id: ekipId || undefined }),
      ctx.yonetici ? 0 : api.get('/havuz').then((h) => h.length).catch(() => 0)]);
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
        ${ctx.yonetici || ctx.mobil ? '' : html`<button class="btn birincil kucuk" id="tek-is-ekle">+ İş ekle</button>`}
        <button class="btn ikincil kucuk" id="yenile">↻ Yenile</button></div>
      ${bolumHtml(havuzSayi)}
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
    const te = $('#tek-is-ekle', el); if (te) te.onclick = async () => { if (await teknisyenIsEkle(ctx)) ciz(); };
    const s = $('#ekip', el);
    if (s) s.onchange = () => { ekipId = s.value; ciz(); };
  }
  await ciz();
  // Sayfa açıkken dakikada bir yenile (yeni atanan işler gelsin)
  const zmn = setInterval(() => { if (el.kapandi) return clearInterval(zmn); if (!el.isConnected) return; if (!document.hidden && !document.querySelector('dialog[open], .tam-ekran')) ciz().catch(() => {}); }, 60000);
}
