import { api } from '../api.js';
import { html, $, $$, para, saat, tarih, durumRozet, sureMetni, bildir } from '../ui.js';
import { planlaPenceresi, kurAl, dovizCeviriciHtml, dovizCeviriciBagla } from '../bilesen.js';

const selam = () => { const s = new Date().getHours(); return s < 6 ? 'İyi geceler' : s < 12 ? 'Günaydın' : s < 18 ? 'İyi günler' : 'İyi akşamlar'; };
const kurFmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const kart = (baslik, icerik, { sag = '', sayi } = {}) => html`<div class="kart"><div class="kart-ust"><h3>${baslik}</h3>
  ${sayi !== undefined ? html`<span class="sayi-rozet">${sayi}</span>` : ''}${sag}</div><div class="kart-govde sifir">${icerik}</div></div>`;
const bos = (m) => html`<div class="mini-bos">${m}</div>`;

function isListesi(liste, bosMetin) {
  if (!liste.length) return bos(bosMetin);
  return html`<ul class="mini-liste">${liste.map((i) => html`<li class="tikla" data-git="is/${i.id}">
    <span class="saat">${saat(i.plan_baslangic)}</span>
    <div class="ana-metin"><b>${i.baslik}</b><small><span class="nokta" style="background:${i.ekip_renk || '#999'}"></span>${i.ekip_ad || ''}${i.cari_unvan ? ' · ' + i.cari_unvan : ''}</small></div>
    ${durumRozet(i.durum)}</li>`)}</ul>`;
}

export default async function (el, _p, ctx) {
  ctx.baslik('Panel');
  const [o, ds, dsSay] = await Promise.all([api.get('/ozet'), api.get('/dis-servis', { durum: 'acik', limit: 5 }), api.get('/dis-servis/sayilar')]);
  const dsAcik = dsSay.dis_serviste + dsSay.geldi;
  const gun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const k = await kurAl(ctx);

  // ---------- Kartlar (her biri id'siyle; düzen kullanıcıya özel) ----------
  const KART = {
    sayilar: { ad: 'Özet sayılar', tam: true, html: () => html`<div class="istatistik genis">
      <a class="ist vurgu" href="#/havuz"><small>Havuzda bekleyen</small><b>${o.havuz}</b></a>
      <a class="ist" href="#/takvim"><small>Bugün planlı</small><b>${o.bugun}</b><span class="ist-alt">yarın ${o.yarin_isler.length}</span></a>
      <a class="ist uyari" href="#/isler?durum=sahada"><small>Şu an sahada</small><b>${o.sahada}</b></a>
      <a class="ist ${o.fis_bekleyen ? 'tehlike' : ''}" href="#/fiyatlandirma"><small>Fiyatlandırma bekleyen</small><b>${o.fis_bekleyen}</b></a>
      <a class="ist" href="#/raporlar/cari-bakiye"><small>Toplam alacak</small><b>${para(o.toplam_alacak)}</b></a>
      <a class="ist ${o.vadesi_gecen > 0 ? 'tehlike' : ''}" href="#/raporlar/vadesi-gecen"><small>Vadesi geçen</small><b>${para(o.vadesi_gecen)}</b></a>
      <a class="ist" href="#/raporlar/aylik"><small>Bu ay satış</small><b>${para(o.bu_ay.ciro)}</b><span class="ist-alt">${o.bu_ay.fis} fiş · KDV hariç</span></a>
      <a class="ist kar-bilgi" href="#/raporlar/is-karlilik"><small>Bu ay kâr</small><b class="${o.bu_ay.kar >= 0 ? 'pozitif' : 'negatif'}">${para(o.bu_ay.kar)}</b></a>
    </div>` },
    bugun: { ad: 'Bugünkü işler', html: () => kart('Bugünkü işler', isListesi(o.bugun_isler, 'Bugün için planlanmış iş yok.'), { sayi: o.bugun_isler.length, sag: html`<a href="#/takvim" class="btn ikincil kucuk">Takvim</a>` }) },
    yarin: { ad: 'Yarın', html: () => kart('Yarın', isListesi(o.yarin_isler, 'Yarın için planlanmış iş yok.'), { sayi: o.yarin_isler.length }) },
    sahada: { ad: 'Şu an sahada', html: () => kart('Şu an sahada', o.sahada_isler.length ? html`<ul class="mini-liste">${o.sahada_isler.map((i) => html`<li class="tikla" data-git="is/${i.id}">
        <span class="nokta" style="background:${i.ekip_renk || '#999'}"></span>
        <div class="ana-metin"><b>${i.baslik}</b><small>${i.ekip_ad || ''}${i.cari_unvan ? ' · ' + i.cari_unvan : ''}</small></div>
        <small class="sag-deger">${saat(i.baslama_zamani)}'den beri</small></li>`)}</ul>` : bos('Sahada iş yok.')) },
    havuz: { ad: 'Havuzda bekleyenler', html: () => kart('Havuzda bekleyenler', o.havuz_isler.length ? html`<ul class="mini-liste">${o.havuz_isler.map((i) => html`<li>
        <div class="ana-metin" data-git="is/${i.id}" style="cursor:pointer"><b>${i.oncelik === 1 ? '🔴 ' : ''}${i.baslik}</b><small>${i.unvan || 'Cari bağlı değil'} · ${sureMetni(i.bekleme_sn)} önce</small></div>
        <div class="btn-grup" style="flex-wrap:nowrap"><button class="btn ikincil kucuk" data-planla="${i.id}">📅 Planla</button>
          <button class="btn ikincil kucuk" data-teslim="${i.id}" title="Teslim et / Tamamla">✓</button></div></li>`)}</ul>
        ${o.havuz > o.havuz_isler.length ? html`<div class="mini-bos"><a href="#/havuz">Tümünü gör (${o.havuz}) →</a></div>` : ''}` : bos('Havuz boş. 👍'),
      { sayi: o.havuz, sag: html`<a href="#/havuz" class="btn ikincil kucuk">Havuz</a>` }) },
    dis_servis: { ad: 'Dış servis', html: () => kart('🔧 Dış servis', ds.length ? html`<ul class="mini-liste">${ds.map((d) => html`<li class="tikla" data-git="dis-servis/${d.id}">
        <div class="ana-metin"><b>${d.cihaz}${d.marka_model ? ' · ' + d.marka_model : ''}</b><small>${d.unvan} → ${d.servis_yeri}</small></div>
        <div class="sag-deger">${d.durum === 'geldi'
          ? html`<span class="rozet yesil" title="Dış servisten geldi, müşteriye teslim bekliyor">Geldi</span><br><small>${d.bekleyen_gun} gündür bizde</small>`
          : html`<b class="${d.dis_gun > 14 ? 'negatif' : ''}">${d.dis_gun} gün</b><br><small>dışarıda</small>`}</div></li>`)}</ul>
        ${dsAcik > ds.length ? html`<div class="mini-bos"><a href="#/dis-servis">Tümünü gör (${dsAcik}) →</a></div>` : ''}` : bos('Dış serviste cihaz yok.'),
      { sayi: dsAcik, sag: html`<a href="#/dis-servis?yeni=1" class="btn ikincil kucuk">+ Gönder</a>` }) },
    fiyat: { ad: 'Fiyatlandırma bekleyen işler', html: () => kart('Fiyatlandırma bekleyen işler', o.fiyat_bekleyen.length ? html`<ul class="mini-liste">${o.fiyat_bekleyen.map((i) => html`<li class="tikla" data-fiyat="${i.id}" data-fis="${i.taslak_fis_id || ''}">
        <div class="ana-metin"><b>${i.baslik}</b><small>${i.unvan || 'Cari bağlı değil'} · bitti ${tarih(i.bitis_zamani)}</small></div>
        <div class="sag-deger kar-bilgi"><small>maliyet</small><br><b>${para(i.malzeme_maliyeti)}</b></div></li>`)}</ul>
        ${o.fis_bekleyen > o.fiyat_bekleyen.length ? html`<div class="mini-bos"><a href="#/fiyatlandirma">Tümünü gör (${o.fis_bekleyen}) →</a></div>` : ''}` : bos('Fiyatlandırılmayı bekleyen iş yok.'),
      { sayi: o.fis_bekleyen, sag: html`<a href="#/fiyatlandirma" class="btn ikincil kucuk">Tümü</a>` }) },
    doviz: { ad: 'Döviz çevirici', html: () => (k && (k.usd || k.eur) ? html`<div class="kart kur-kart"><div class="kart-ust"><h3>💱 Döviz</h3><span class="bosluk"></span>
        ${k.usd ? html`<span class="kur-cip"><small>USD</small> <b>${kurFmt.format(k.usd.satis)}</b></span>` : ''}${k.eur ? html`<span class="kur-cip"><small>EUR</small> <b>${kurFmt.format(k.eur.satis)}</b></span>` : ''}</div>
      <div class="kart-govde">${dovizCeviriciHtml(k)}</div></div>` : kart('💱 Döviz', bos('Kur bilgisi alınamadı.'))) },
    kasa: { ad: 'Kasa / Banka', html: () => kart('Kasa / Banka', html`<ul class="mini-liste">${o.hesaplar.map((h) => html`<li class="tikla" data-git="kasa"><div class="ana-metin"><span>${h.ad}</span></div>
        <b class="sag-deger ${h.bakiye < 0 ? 'negatif' : ''}">${para(h.bakiye)}</b></li>`)}
        <li><div class="ana-metin"><small>Tedarikçilere borç</small></div><b class="sag-deger">${para(o.toplam_borc)}</b></li></ul>`,
      { sag: html`<button class="btn ikincil kucuk" data-tahsilat>💰 Tahsilat</button>` }) },
    tahsilat: { ad: 'Son tahsilatlar', html: () => kart('Son tahsilatlar', o.son_tahsilatlar.length ? html`<ul class="mini-liste">${o.son_tahsilatlar.map((t) => html`<li class="tikla" data-git="cari/${t.cari_id}">
        <div class="ana-metin"><b>${t.unvan}</b><small>${tarih(t.tarih)} · ${t.hesap}</small></div><b class="sag-deger pozitif">${para(t.tutar)}</b></li>`)}</ul>` : bos('Henüz tahsilat yok.')) },
    vade: { ad: 'Vadesi geçen alacaklar', html: () => kart('Vadesi geçen alacaklar', o.vadesi_gecenler.length ? html`<ul class="mini-liste">${o.vadesi_gecenler.map((v) => html`<li class="tikla" data-git="cari/${v.cari_id}">
        <div class="ana-metin"><b>${v.unvan}</b><small>${v.gecikme_gun} gün gecikme${v.telefon ? ' · ' + v.telefon : ''}</small></div><b class="sag-deger negatif">${para(v.gecikmis_tutar)}</b></li>`)}</ul>` : bos('Vadesi geçen alacak yok. 👍')) },
  };
  const VARSAYILAN = { sutunlar: [['bugun', 'yarin', 'sahada'], ['havuz', 'dis_servis', 'fiyat'], ['doviz', 'kasa', 'tahsilat', 'vade']], gizli: [] };

  // Kayıtlı düzen + sonradan eklenen kartlar (varsayılan sütununa) birleşir
  const duzenHazirla = (d) => {
    const sutunlar = [0, 1, 2].map((i) => (d?.sutunlar?.[i] || []).filter((x) => KART[x] && !KART[x].tam));
    const gizli = (d?.gizli || []).filter((x) => KART[x]);
    const bilinen = new Set([...sutunlar.flat(), ...gizli]);
    VARSAYILAN.sutunlar.forEach((l, i) => l.forEach((x) => { if (!bilinen.has(x)) sutunlar[i].push(x); }));
    if (!d) return { sutunlar: VARSAYILAN.sutunlar.map((l) => [...l]), gizli: [] };
    return { sutunlar, gizli };
  };
  let duzen = duzenHazirla(await api.get('/ben/panel').catch(() => null));
  let duzenleme = false;
  const kaydet = () => api.put('/ben/panel', duzen).catch((err) => bildir('Düzen kaydedilemedi: ' + err.message, 'hata'));

  const kartSar = (id) => html`<div class="panel-kart ${KART[id].tam ? 'tam' : ''}" data-kart="${id}" draggable="${duzenleme && !KART[id].tam ? 'true' : 'false'}">
    ${duzenleme ? html`<div class="pk-arac"><span class="pk-tut" title="Sürükleyerek taşıyın">⠿ ${KART[id].ad}</span><span class="bosluk"></span>
      <button type="button" class="btn-ikon" data-pk="yukari" title="Yukarı" aria-label="Yukarı">↑</button>
      <button type="button" class="btn-ikon" data-pk="asagi" title="Aşağı" aria-label="Aşağı">↓</button>
      <button type="button" class="btn-ikon" data-pk="gizle" title="Kaldır" aria-label="Kaldır">✕</button></div>` : ''}
    ${KART[id].html()}</div>`;

  function ciz() {
    const ustGizli = duzen.gizli.includes('sayilar');
    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>${selam()}, ${ctx.kullanici.ad_soyad.split(' ')[0]}</h2><span class="alt">${gun}</span><span class="bosluk"></span>
        ${duzenleme ? html`<button class="btn ikincil" id="pk-varsayilan">Varsayılan düzen</button><button class="btn birincil" id="pk-bitti">✓ Bitti</button>`
          : html`<button class="btn ikincil kucuk" id="pk-duzenle" title="Kartları taşı veya kaldır">⚙ Paneli düzenle</button>`}</div>
      ${duzenleme ? html`<div class="pk-bilgi">Kartları başlığından tutup sürükleyin (telefonda ↑ ↓). ✕ ile kaldırdıklarınız aşağıdan geri eklenir.
        ${duzen.gizli.length ? html`<div class="pk-gizli"><b>Gizlenen kartlar:</b>${duzen.gizli.map((x) => html`<button type="button" class="btn ikincil kucuk" data-goster="${x}">+ ${KART[x].ad}</button>`)}</div>` : ''}</div>` : ''}
      ${!ustGizli ? kartSar('sayilar') : ''}
      ${o.geciken ? html`<div class="uyari-kutu">Tarihi geçmiş ama başlanmamış <b>${o.geciken}</b> planlı iş var. <a href="#/isler?durum=planlandi">İşlere git →</a></div>` : ''}
      ${o.onay_bekleyen_urun ? html`<div class="uyari-kutu kar-bilgi">Sahada eklenen <b>${o.onay_bekleyen_urun}</b> ürün maliyet onayı bekliyor. <a href="#/urunler?onay=1">Ürünlere git →</a></div>` : ''}
      ${o.stok_uyari ? html`<div class="uyari-kutu">Kritik seviyede veya eksi stokta <b>${o.stok_uyari}</b> ürün var. <a href="#/raporlar/stok">Stok uyarıları →</a></div>` : ''}
      <div class="izgara uc panel-izgara ${duzenleme ? 'duzenleniyor' : ''}">
        ${duzen.sutunlar.map((l, i) => html`<div class="panel-sutun" data-sutun="${i}">${l.map(kartSar)}${duzenleme && !l.length ? html`<div class="pk-bos">Kartı buraya bırakın</div>` : ''}</div>`)}
      </div>`);
    if ($('[data-cevirici]', el)) dovizCeviriciBagla(el);
    if (duzenleme) suruklemeBagla();
  }

  // Düzende kartın yeri: [sütun, sıra] ('sayilar' sütunsuz)
  const yer = (id) => { for (const [i, l] of duzen.sutunlar.entries()) { const j = l.indexOf(id); if (j >= 0) return [i, j]; } return null; };
  function tasi(id, yon) {
    // Telefonda tek sütun görünür: sütunlar art arda sayılır, sınırda bir sonraki sütuna geçer
    const p = yer(id); if (!p) return;
    const [i, j] = p; const l = duzen.sutunlar[i];
    l.splice(j, 1);
    if (yon < 0) { if (j > 0) l.splice(j - 1, 0, id); else if (i > 0) duzen.sutunlar[i - 1].push(id); else l.unshift(id); }
    else if (j < l.length) l.splice(j + 1, 0, id); else if (i < 2) duzen.sutunlar[i + 1].unshift(id); else l.push(id);
  }
  function suruklemeBagla() {
    let suruklenen = null;
    const isaret = document.createElement('div'); isaret.className = 'pk-yer';
    $$('.panel-kart[draggable=true]', el).forEach((c) => {
      c.addEventListener('dragstart', (e) => { suruklenen = c.dataset.kart; c.classList.add('suruklen'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', suruklenen); });
      c.addEventListener('dragend', () => { c.classList.remove('suruklen'); isaret.remove(); suruklenen = null; });
    });
    $$('.panel-sutun', el).forEach((s) => {
      s.addEventListener('dragover', (e) => {
        if (!suruklenen || suruklenen === 'sayilar') return;
        e.preventDefault();
        const sonraki = $$('.panel-kart:not(.suruklen)', s).find((c) => { const r = c.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
        if (sonraki) s.insertBefore(isaret, sonraki); else s.appendChild(isaret);
      });
      s.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!suruklenen) return;
        const hedef = Number(s.dataset.sutun);
        const onceki = isaret.nextElementSibling?.closest?.('.panel-kart')?.dataset.kart;
        duzen.sutunlar.forEach((l) => { const j = l.indexOf(suruklenen); if (j >= 0) l.splice(j, 1); });
        const l = duzen.sutunlar[hedef]; const j = onceki ? l.indexOf(onceki) : -1;
        if (j >= 0) l.splice(j, 0, suruklenen); else l.push(suruklenen);
        isaret.remove(); kaydet(); ciz();
      });
    });
  }
  ciz();


  el.addEventListener('click', async (e) => {
    // Düzenleme modu
    if (e.target.closest('#pk-duzenle')) { duzenleme = true; return ciz(); }
    if (e.target.closest('#pk-bitti')) { duzenleme = false; return ciz(); }
    if (e.target.closest('#pk-varsayilan')) { duzen = duzenHazirla(null); await api.put('/ben/panel', { sifirla: true }).catch(() => {}); return ciz(); }
    const pk = e.target.closest('[data-pk]');
    if (pk) {
      const id = pk.closest('[data-kart]').dataset.kart;
      if (pk.dataset.pk === 'gizle') { duzen.sutunlar.forEach((l) => { const j = l.indexOf(id); if (j >= 0) l.splice(j, 1); }); if (!duzen.gizli.includes(id)) duzen.gizli.push(id); }
      else if (id !== 'sayilar') tasi(id, pk.dataset.pk === 'yukari' ? -1 : 1);
      kaydet(); return ciz();
    }
    const gs = e.target.closest('[data-goster]');
    if (gs) {
      const id = gs.dataset.goster; duzen.gizli = duzen.gizli.filter((x) => x !== id);
      if (id !== 'sayilar') { const i = VARSAYILAN.sutunlar.findIndex((l) => l.includes(id)); duzen.sutunlar[i < 0 ? 0 : i].unshift(id); }
      kaydet(); return ciz();
    }
    if (duzenleme && e.target.closest('.panel-kart')) { if (e.target.closest('a')) e.preventDefault(); return; }
    const te = e.target.closest('[data-teslim]');
    if (te) { const { teslimEtPenceresi } = await import('./havuz.js'); await teslimEtPenceresi(ctx, { id: Number(te.dataset.teslim) }); return; }
    const p = e.target.closest('[data-planla]');
    if (p) {
      const is = o.havuz_isler.find((x) => x.id === Number(p.dataset.planla));
      if (await planlaPenceresi(ctx, is)) ctx.yenile();
      return;
    }
    if (e.target.closest('[data-tahsilat]')) {
      const { finansPenceresi } = await import('../bilesen.js');
      if (await finansPenceresi('tahsilat')) ctx.yenile();
      return;
    }
    const f = e.target.closest('[data-fiyat]');
    if (f) {
      if (f.dataset.fis) return ctx.git(`fis/${f.dataset.fis}`);
      const { fiyatlandir } = await import('./fiyatlandirma.js');
      return fiyatlandir(ctx, Number(f.dataset.fiyat)).catch((err) => bildir(err.message, 'hata'));
    }
    const g = e.target.closest('[data-git]');
    if (g) ctx.git(g.dataset.git);
  });
}
