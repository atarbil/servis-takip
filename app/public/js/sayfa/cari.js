import { api } from '../api.js';
import { html, $, $$, para, paraSade, tarih, bakiyeHucre, bakiyeAciklama, durumRozet, telLink, csvIndir, pencere, bildir, sayiCoz, bugunStr } from '../ui.js';
import { cariFormu, finansPenceresi, yeniIsPenceresi, silOnay } from '../bilesen.js';
import { ekstreYazdir, BELGE } from '../belgeler.js';
import { resmiTablo, resmiDetay, elleKayit } from '../resmi.js';

export default async function (el, [id], ctx) {
  const c = await api.get(`/cariler/${id}`);
  ctx.baslik(c.unvan);
  const yil = new Date().getFullYear();
  let sekme = ctx.sorgu.sekme || 'ekstre';
  let resmiYil = '';
  let resmiTip = 'tum';
  const aralik = { bas: `${yil}-01-01`, bit: bugunStr() };

  el.innerHTML = String(html`
    <div class="detay-ust">
      <div style="flex:1;min-width:240px"><a href="#/cariler" class="btn-metin">← Cariler</a>
        <h2>${c.unvan}</h2>
        <div class="soluk">${[c.kod, c.yetkili, c.telefon && telLink(c.telefon), [c.ilce, c.il].filter(Boolean).join(' / ')].filter(Boolean).map((x, i) => html`${i ? ' · ' : ''}${x}`)}</div></div>
      <div class="kart" style="margin:0;min-width:220px"><div class="kart-govde" style="padding:.7rem 1rem">
        <small>${bakiyeAciklama(c.bakiye)}</small><div style="font-size:1.5rem;font-weight:800">${bakiyeHucre(c.bakiye)}</div>
        ${c.vadesi_gecen ? html`<small style="color:var(--kirmizi)">Vadesi geçen: ${para(c.vadesi_gecen.gecikmis_tutar)} (${c.vadesi_gecen.gecikme_gun} gün)</small>` : ''}
      </div></div>
    </div>
    <div class="btn-grup" style="margin-bottom:1rem">
      ${c.tip !== 'tedarikci' ? html`<button class="btn birincil" data-a="tahsilat">💰 Tahsilat al</button>` : ''}
      ${c.tip !== 'musteri' ? html`<button class="btn birincil" data-a="odeme">Ödeme yap</button>` : ''}
      ${c.tip !== 'tedarikci' ? html`<button class="btn ikincil" data-a="is">+ Yeni iş</button><button class="btn ikincil" data-a="fis">+ Satış fişi</button>` : ''}
      ${c.tip !== 'musteri' ? html`<a class="btn ikincil" href="#/alis/yeni?cari=${c.id}">+ Alış faturası</a>` : ''}
      ${c.tip !== 'tedarikci' ? html`<button class="btn ikincil" data-a="teklif">+ Teklif</button><button class="btn ikincil" data-a="proforma">+ Proforma</button>` : ''}
      <button class="btn ikincil" data-a="devir">Devir / düzeltme</button>
      <button class="btn ikincil" data-a="duzenle">Düzenle</button>
      <button class="btn tehlike-cizgi" data-a="sil" title="Cari ve tüm hareketleri silinir (30 gün geri alınabilir)">🗑 Sil</button>
    </div>
    <div class="sekmeler">${[['ekstre', 'Ekstre'], ['isler', `İşler (${c.isler.length})`], ['envanter', 'Envanter'], ['disservis', 'Dış servis'], ['fisler', 'Satış fişleri'], ['resmi', 'Resmi faturalar'], ['yillik', 'Yıllık özet'], ['bilgi', 'Bilgiler']]
      .map(([k, a]) => html`<button data-sekme="${k}">${a}</button>`)}</div>
    <div id="icerik"></div>`);

  async function ciz() {
    $$('[data-sekme]', el).forEach((b) => b.classList.toggle('aktif', b.dataset.sekme === sekme));
    const k = $('#icerik', el);
    if (sekme === 'ekstre') {
      const e = await api.get(`/cariler/${c.id}/ekstre`, aralik);
      const tb = e.satirlar.reduce((a, s) => a + Number(s.borc), 0);
      const ta = e.satirlar.reduce((a, s) => a + Number(s.alacak), 0);
      k.innerHTML = String(html`<div class="filtre">
        <label>Başlangıç <input type="date" id="e-bas" value="${aralik.bas}"></label><label>Bitiş <input type="date" id="e-bit" value="${aralik.bit}"></label>
        <button class="btn ikincil kucuk" data-ar="bu-yil">Bu yıl</button><button class="btn ikincil kucuk" data-ar="gecen-yil">Geçen yıl</button><button class="btn ikincil kucuk" data-ar="tumu">Tümü</button>
        <span class="bosluk"></span><button class="btn ikincil" id="e-yazdir">🖨 Yazdır / PDF</button><button class="btn ikincil" id="e-csv">Excel</button></div>
        <div class="kart"><div class="tablo-kap"><table class="tablo"><thead><tr><th>Tarih</th><th>Belge</th><th>Açıklama</th><th>Vade</th><th class="sayi">Borç</th><th class="sayi">Alacak</th><th class="sayi">Bakiye</th></tr></thead>
        <tbody>${e.satirlar.map((s) => html`<tr class="${s.belge_tip === 'satis_fisi' || s.belge_tip === 'alis_faturasi' ? 'tikla' : ''}" data-belge="${s.belge_tip}" data-no="${s.belge_no || ''}">
          <td class="nowrap">${tarih(s.tarih)}</td><td class="nowrap">${BELGE[s.belge_tip] || s.belge_tip}<div class="alt-satir">${s.belge_no || ''}</div></td>
          <td>${s.aciklama || ''}</td><td class="nowrap">${s.vade ? tarih(s.vade) : ''}</td>
          <td class="sayi">${s.borc ? paraSade(s.borc) : ''}</td><td class="sayi">${s.alacak ? paraSade(s.alacak) : ''}</td><td class="sayi">${bakiyeHucre(s.bakiye)}</td></tr>`)}</tbody>
        <tfoot><tr><td colspan="4">Dönem toplamı</td><td class="sayi">${paraSade(tb)}</td><td class="sayi">${paraSade(ta)}</td><td class="sayi">${bakiyeHucre(e.satirlar.at(-1)?.bakiye || 0)}</td></tr></tfoot></table></div></div>`);
      const yenidenAralik = () => { aralik.bas = $('#e-bas', k).value; aralik.bit = $('#e-bit', k).value; ciz(); };
      $('#e-bas', k).onchange = yenidenAralik; $('#e-bit', k).onchange = yenidenAralik;
      k.onclick = async (ev) => {
        const ar = ev.target.closest('[data-ar]')?.dataset.ar;
        if (ar) {
          if (ar === 'bu-yil') Object.assign(aralik, { bas: `${yil}-01-01`, bit: `${yil}-12-31` });
          if (ar === 'gecen-yil') Object.assign(aralik, { bas: `${yil - 1}-01-01`, bit: `${yil - 1}-12-31` });
          if (ar === 'tumu') Object.assign(aralik, { bas: '2000-01-01', bit: `${yil + 1}-12-31` });
          return ciz();
        }
        const satir = ev.target.closest('[data-belge]');
        if (satir?.dataset.no && satir.dataset.belge === 'satis_fisi') {
          const f = (await api.get('/fisler', { q: satir.dataset.no })).find((x) => x.fis_no === satir.dataset.no);
          if (f) ctx.git(`fis/${f.id}`);
        }
      };
      $('#e-yazdir', k).onclick = () => ekstreYazdir(ctx, e);
      $('#e-csv', k).onclick = () => csvIndir(`ekstre-${c.unvan}`, ['Tarih', 'Belge', 'Belge no', 'Açıklama', 'Vade', 'Borç', 'Alacak', 'Bakiye'],
        e.satirlar.map((s) => [tarih(s.tarih), BELGE[s.belge_tip] || s.belge_tip, s.belge_no, s.aciklama, s.vade ? tarih(s.vade) : '', Number(s.borc), Number(s.alacak), Number(s.bakiye)]));
    } else if (sekme === 'isler') {
      k.innerHTML = String(html`<div class="kart"><div class="tablo-kap"><table class="tablo mobil-kart"><thead><tr><th>No</th><th>İş</th><th>Durum</th><th>Tarih</th><th class="sayi">Satış</th><th class="sayi">Kâr</th></tr></thead><tbody>
        ${c.isler.length ? c.isler.map((i) => html`<tr class="tikla" data-git="is/${i.id}"><td data-et="No">#${i.id}</td><td class="ana-hucre" data-et="">${i.baslik}</td><td data-et="Durum">${durumRozet(i.durum)}</td>
          <td data-et="Tarih">${tarih(i.plan_baslangic || i.olusturma)}</td><td data-et="Satış" class="sayi">${i.satis_kdv_haric != null ? para(i.satis_kdv_haric) : ''}</td>
          <td data-et="Kâr" class="sayi">${i.kar != null && i.satis_kdv_haric != null ? para(i.kar) : ''}</td></tr>`) : html`<tr><td colspan="6" class="bos-durum">İş yok</td></tr>`}</tbody></table></div></div>`);
    } else if (sekme === 'envanter') {
      const { envanterTablosu, envanterFormu } = await import('./envanter.js');
      const liste = await api.get('/envanter', { cari_id: c.id, tumu: '1' });
      k.innerHTML = String(html`<div class="sayfa-ust"><span class="soluk">${liste.length} cihaz kayıtlı</span><span class="bosluk"></span>
        <button class="btn birincil" id="env-yeni">+ Cihaz ekle</button></div>
        <div class="kart"><div class="tablo-kap">${envanterTablosu(liste, { bosMetin: 'Bu kurum için kayıtlı cihaz yok.' })}</div></div>`);
      $('#env-yeni', k).onclick = async () => { if (await envanterFormu(null, { cari: c })) { bildir('Cihaz eklendi.', 'basari'); ciz(); } };
      k.onclick = async (ev) => { const t = ev.target.closest('[data-env]'); if (t && await envanterFormu({ id: Number(t.dataset.env) }, { cari: c })) ciz(); };
    } else if (sekme === 'disservis') {
      const { disServisTablosu, disServisFormu } = await import('./disservis.js');
      const liste = await api.get('/dis-servis', { cari_id: c.id });
      k.innerHTML = String(html`<div class="sayfa-ust"><span class="soluk">${liste.length} kayıt</span><span class="bosluk"></span>
        <button class="btn birincil" id="ds-yeni">+ Dış servise gönder</button></div>
        <div class="kart"><div class="tablo-kap">${disServisTablosu(liste)}</div></div>`);
      $('#ds-yeni', k).onclick = async () => { if (await disServisFormu(null, { cari: c, ctx })) ciz(); };
      k.onclick = async (ev) => { const t = ev.target.closest('[data-ds]'); if (t && await disServisFormu({ id: Number(t.dataset.ds) }, { cari: c, ctx })) ciz(); };
    } else if (sekme === 'fisler') {
      const fl = await api.get(`/cariler/${c.id}/fisler`);
      k.innerHTML = String(html`<div class="kart"><div class="tablo-kap"><table class="tablo mobil-kart"><thead><tr><th>Fiş no</th><th>Tarih</th><th>Durum</th><th class="sayi">Tutar</th><th class="sayi">Kâr</th></tr></thead><tbody>
        ${fl.length ? fl.map((f) => html`<tr class="tikla ${f.durum === 'iptal' ? 'iptal' : ''}" data-git="fis/${f.id}"><td class="ana-hucre" data-et="">${f.fis_no}</td><td data-et="Tarih">${tarih(f.tarih)}</td>
          <td data-et="Durum">${durumRozet(f.durum)}</td><td class="sayi" data-et="Tutar">${para(f.genel_toplam)}</td><td class="sayi" data-et="Kâr">${para(f.ara_toplam - f.maliyet_toplam)}</td></tr>`)
          : html`<tr><td colspan="5" class="bos-durum">Fiş yok</td></tr>`}</tbody></table></div></div>`);
    } else if (sekme === 'resmi') {
      const yil = resmiYil || String(new Date().getFullYear());
      const hepsi = await api.get(`/resmi/cari/${c.id}`, { yil: yil === 'tum' ? undefined : yil });
      const liste = resmiTip === 'tum' ? hepsi : hepsi.filter((x) => (resmiTip === 'satis' ? x.tur === 'satis' : x.tur !== 'satis'));
      const yillar = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
      const top = liste.reduce((t, x) => { t.m += x.matrah; t.k += x.kdv; t.t += x.toplam; return t; }, { m: 0, k: 0, t: 0 });
      const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
      const TIP = { satis: 'Satış faturası', stoklu: 'Alış faturası', gider: 'Alış faturası' };
      k.innerHTML = String(html`<div class="rf-cari-ust">
          <label>İşlem tipi <select id="rf-tip"><option value="tum" ${resmiTip === 'tum' ? 'selected' : ''}>Tümü</option><option value="alis" ${resmiTip === 'alis' ? 'selected' : ''}>Alış faturası</option><option value="satis" ${resmiTip === 'satis' ? 'selected' : ''}>Satış faturası</option></select></label>
          <label>Yıl <select id="rf-yil">${yillar.map((y) => html`<option ${y === yil ? 'selected' : ''}>${y}</option>`)}<option value="tum" ${yil === 'tum' ? 'selected' : ''}>Tüm yıllar</option></select></label>
          <span class="rf-renk"><i class="stoklu"></i>Stoklu <i class="gider"></i>Stoksuz / gider</span>
          <span class="bosluk"></span><a class="btn ikincil kucuk" href="#/resmi-yukle">📄 XML yükle</a><button class="btn ikincil kucuk" data-resmi-elle>+ Elle kayıt</button></div>
        <div class="kart"><div class="tablo-kap"><table class="tablo rf-tablo rf-cari-tablo"><thead><tr><th>Tarih</th><th>Fatura no</th><th>İşlem tipi</th><th class="sayi">Fatura tutarı</th><th class="sayi">KDV tutarı</th><th class="sayi">Toplam tutar</th></tr></thead>
          <tbody>${liste.map((x) => html`<tr class="tikla ${x.tur === 'gider' ? 'rf-satir-gider' : x.tur === 'stoklu' ? 'rf-satir-stoklu' : ''}" ${x.tur === 'stoklu' ? html`data-git="alis/${x.id}"` : html`data-resmi="${x.id}"`}>
              <td>${tarih(x.tarih)}</td>
              <td>${x.belge_no || '—'}${x.kaynak === 'elle' ? html` <span class="rozet">elle</span>` : ''}${x.tip && x.tip !== 'SATIS' ? html` <span class="rozet">${x.tip}</span>` : ''}</td>
              <td><b>${TIP[x.tur]}</b>${x.tur === 'stoklu' ? html`<small class="rf-vkn-yazi">stoklu${x.durum ? ` · ${x.durum === 'onaylandi' ? 'onaylı' : x.durum}` : ''}</small>` : x.tur === 'gider' ? html`<small class="rf-vkn-yazi">gider${x.gider_turu ? ` · ${x.gider_turu}` : ''}</small>` : ''}</td>
              <td class="sayi">${para(x.matrah)}</td><td class="sayi">${para(x.kdv)}</td><td class="sayi"><b>${para(x.toplam)}</b></td></tr>`)}
            ${!liste.length ? html`<tr><td colspan="6" class="bos-durum">Bu seçimde resmi fatura yok.</td></tr>` : ''}</tbody>
          <tfoot><tr><td colspan="3"><b>${liste.length} fatura</b></td><td class="sayi"><b>${para(r2(top.m))}</b></td><td class="sayi"><b>${para(r2(top.k))}</b></td><td class="sayi"><b>${para(r2(top.t))}</b></td></tr></tfoot></table></div></div>
        <p class="soluk" style="font-size:.8rem">Resmi faturalar bilgi amaçlıdır; ekstreyi ve cari bakiyesini etkilemez.</p>`);
      $('#rf-yil', k).onchange = (e) => { resmiYil = e.target.value; ciz(); };
      $('#rf-tip', k).onchange = (e) => { resmiTip = e.target.value; ciz(); };
    } else if (sekme === 'yillik') {
      k.innerHTML = String(html`<div class="kart"><div class="tablo-kap"><table class="tablo mobil-kart"><thead><tr><th>Yıl</th><th class="sayi">İş</th><th class="sayi">Ciro (KDV hariç)</th><th class="sayi">Maliyet</th><th class="sayi">Kâr</th><th class="sayi">Tahsilat</th><th class="sayi">Yıl sonu bakiye</th></tr></thead><tbody>
        ${c.yillik.length ? c.yillik.map((y) => html`<tr><td class="ana-hucre" data-et="">${y.yil}</td><td class="sayi" data-et="İş">${y.is_sayisi}</td><td class="sayi" data-et="Ciro">${para(y.ciro_kdv_haric)}</td>
          <td class="sayi" data-et="Maliyet">${para(y.maliyet)}</td><td class="sayi" data-et="Kâr">${para(y.kar)}</td><td class="sayi" data-et="Tahsilat">${para(y.tahsilat)}</td><td class="sayi" data-et="Bakiye">${bakiyeHucre(y.yil_sonu_bakiye)}</td></tr>`)
          : html`<tr><td colspan="7" class="bos-durum">Henüz satış yok</td></tr>`}</tbody></table></div></div>`);
    } else {
      k.innerHTML = String(html`<div class="kart"><div class="kart-govde"><dl class="bilgi-liste">
        <dt>Ünvan</dt><dd>${c.unvan}</dd><dt>Tür</dt><dd>${{ musteri: 'Müşteri', tedarikci: 'Tedarikçi', her_ikisi: 'Müşteri + Tedarikçi' }[c.tip]}</dd>
        <dt>Yetkili</dt><dd>${c.yetkili || '-'}</dd><dt>Telefon</dt><dd>${telLink(c.telefon) || '-'} ${c.telefon2 ? html` · ${telLink(c.telefon2)}` : ''}</dd>
        <dt>E-posta</dt><dd>${c.eposta || '-'}</dd><dt>Adres</dt><dd>${c.adres || '-'} ${[c.ilce, c.il].filter(Boolean).join(' / ')}</dd>
        <dt>Vergi</dt><dd>${[c.vergi_dairesi, c.vergi_no].filter(Boolean).join(' · ') || '-'}</dd><dt>Notlar</dt><dd style="white-space:pre-wrap">${c.notlar || '-'}</dd>
        <dt>Toplam borç</dt><dd>${para(c.toplam_borc)}</dd><dt>Toplam alacak</dt><dd>${para(c.toplam_alacak)}</dd>
        <dt>Son tahsilat</dt><dd>${c.son_tahsilat ? tarih(c.son_tahsilat) : '-'}</dd></dl></div></div>`);
    }
  }

  el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-sekme]');
    if (s) { sekme = s.dataset.sekme; return ciz(); }
    const rs = e.target.closest('[data-resmi]');
    if (rs) { if (await resmiDetay(Number(rs.dataset.resmi))) ciz(); return; }
    if (e.target.closest('[data-resmi-elle]')) { if (await elleKayit({ yon: 'satis', cari: c })) { bildir('Kaydedildi.', 'basari'); ciz(); } return; }
    const g = e.target.closest('[data-git]');
    if (g) return ctx.git(g.dataset.git);
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    try {
      if (a === 'tahsilat' || a === 'odeme') { if (await finansPenceresi(a, { cari: c })) ctx.yenile(); }
      else if (a === 'duzenle') { if (await cariFormu(c)) ctx.yenile(); }
      else if (a === 'sil') { if (await silOnay('cari', c.id)) ctx.kapatVeGit('cariler'); }
      else if (a === 'is') { const r = await yeniIsPenceresi(ctx, { cari: c, havuza: true }); if (r) ctx.git(`is/${r.id}`); }
      else if (a === 'fis') { const r = await api.post('/fisler', { cari_id: c.id }); ctx.git(`fis/${r.id}`); }
      else if (a === 'teklif' || a === 'proforma') { const { yeniBelge } = await import('./teklifler.js'); yeniBelge(ctx, a, c); }
      else if (a === 'devir') {
        const r = await pencere({
          baslik: 'Devir / bakiye düzeltme',
          icerik: html`<div class="bilgi-kutu">Eski programdan açılış bakiyesi veya bakiye düzeltmesi için. <b>+</b> tutar: cari size borçlanır, <b>−</b> tutar: cari alacaklanır.</div>
            <div class="satir2"><label class="alan"><span>Tutar</span><input name="tutar" inputmode="decimal" placeholder="Örn: 1.500 veya -250" required></label>
            <label class="alan"><span>Tarih</span><input type="date" name="tarih" value="${bugunStr()}"></label></div>
            <label class="alan"><span>Açıklama</span><input name="aciklama" value="Devir bakiyesi"></label>`,
          kaydet: async (v) => { const t = sayiCoz(v.tutar); if (!t) throw new Error('Tutar girin.'); await api.post(`/cariler/${c.id}/devir`, { ...v, tutar: t }); },
        });
        if (r) { bildir('Kaydedildi.', 'basari'); ctx.yenile(); }
      }
    } catch (err) { bildir(err.message, 'hata'); }
  });
  await ciz();
}
