// Excel gibi kalem tablosu: yön tuşlarıyla hücreler arası gezinme.
// Hücre = satırdaki (tr[data-i]) [data-k] alanı. Sayfa yeniden çizildiğinde odak { i, k } ile geri yüklenir.
//
//   ↑ ↓            üst / alt satırda aynı sütun
//   ← →            önceki / sonraki hücre (düzenleme modunda imleç hareket eder)
//   Enter, Tab     sonraki hücre; son hücrede yeni satır
//   Shift+Enter    önceki hücre
//   F2             hücreyi düzenleme moduna al (imleç sona)
//   Esc            hücreyi girişteki değerine döndür
//   Ctrl+Delete    satırı sil       Ctrl+Insert  araya satır ekle
//   Diğer kısayollar (F4, Ctrl+S…) sayfa tarafından `kisayollar` ile verilir.

const DUZENLENEBILIR = 'input:not([type=checkbox]):not([readonly]), select, textarea';

export function izgaraBagla(kok, { yeniSatir, satirSil, satirEkle, kisayollar = {} } = {}) {
  let duzenleme = false; // true: ← → imleci gezdirir
  let ilkDeger = null;
  let fareyle = false;

  const satirlar = () => [...kok.querySelectorAll('tr[data-i]')];
  const hucreler = (tr) => [...tr.querySelectorAll('[data-k]')].filter((x) => x.matches(DUZENLENEBILIR) && !x.disabled && x.offsetParent !== null);

  function odakla(h, { sec = true } = {}) {
    if (!h) return false;
    fareyle = false;
    h.focus();
    if (sec && h.select) { try { h.select(); } catch { /* select desteklemeyen tür */ } }
    h.closest('tr')?.scrollIntoView({ block: 'nearest' });
    return true;
  }
  function git(h, yon) {
    const tr = h.closest('tr[data-i]'); if (!tr) return false;
    const rs = satirlar(); const ri = rs.indexOf(tr);
    const hs = hucreler(tr); const ci = hs.indexOf(h);
    if (yon === 'sag' || yon === 'sol') {
      const d = yon === 'sag' ? 1 : -1;
      if (hs[ci + d]) return odakla(hs[ci + d]);
      const komsu = rs[ri + d]; if (!komsu) return false;
      const kh = hucreler(komsu); return odakla(d > 0 ? kh[0] : kh.at(-1));
    }
    const komsu = rs[ri + (yon === 'alt' ? 1 : -1)]; if (!komsu) return false;
    const kh = hucreler(komsu);
    return odakla(kh.find((x) => x.dataset.k === h.dataset.k) || kh[Math.min(ci, kh.length - 1)]);
  }
  async function sonrakiVeyaYeni(h) {
    if (git(h, 'sag')) return;
    if (!yeniSatir) return;
    if (await yeniSatir() === false) return; // yeni satır kapalı (ör. "Enter ile yeni satır aç" işaretsiz): hücrede kal
    const son = satirlar().at(-1);
    if (son) odakla(hucreler(son)[0]);
  }

  kok.addEventListener('focusin', (e) => {
    const h = e.target;
    if (!h.matches?.('[data-k]')) return;
    duzenleme = fareyle; ilkDeger = h.value;
    h.closest('tr')?.classList.add('aktif-satir');
  });
  kok.addEventListener('focusout', (e) => { e.target.closest?.('tr')?.classList.remove('aktif-satir'); });
  kok.addEventListener('mousedown', (e) => { if (e.target.matches?.('[data-k]')) { fareyle = true; duzenleme = true; } });

  kok.addEventListener('keydown', async (e) => {
    // Sayfa kısayolları (her yerde)
    const ad = [e.ctrlKey || e.metaKey ? 'Ctrl+' : '', e.shiftKey && e.key.length > 1 ? 'Shift+' : '', e.key.length === 1 ? e.key.toUpperCase() : e.key].join('');
    if (kisayollar[ad]) { e.preventDefault(); kisayollar[ad](e); return; }

    const h = e.target;
    if (!h.matches?.('[data-k]') || e.defaultPrevented) return;
    const tr = h.closest('tr[data-i]'); if (!tr) return;
    const i = Number(tr.dataset.i);
    const metin = h.tagName === 'INPUT';
    const imlecBasta = !metin || (h.selectionStart === 0 && h.selectionEnd === 0);
    const imlecSonda = !metin || (h.selectionStart === h.value.length && h.selectionEnd === h.value.length);
    const tumuSecili = metin && h.selectionStart === 0 && h.selectionEnd === h.value.length;

    if ((e.ctrlKey || e.metaKey) && e.key === 'Delete' && satirSil) { e.preventDefault(); const k = h.dataset.k; await satirSil(i); const rs = satirlar(); const hedef = rs[Math.min(i, rs.length - 1)]; if (hedef) odakla(hucreler(hedef).find((x) => x.dataset.k === k) || hucreler(hedef)[0]); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Insert' && satirEkle) { e.preventDefault(); await satirEkle(i); const hedef = satirlar()[i]; if (hedef) odakla(hucreler(hedef)[0]); return; }
    if (e.key === 'F2') { e.preventDefault(); duzenleme = true; if (metin) { const n = h.value.length; h.setSelectionRange(n, n); } return; }
    if (e.key === 'Escape' && ilkDeger !== null && h.value !== ilkDeger) {
      e.preventDefault(); h.value = ilkDeger; h.dispatchEvent(new Event('input', { bubbles: true })); if (metin) h.select(); duzenleme = false; return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (h.tagName === 'SELECT' && e.altKey) return; // açılır listeyi aç
      e.preventDefault(); git(h, e.key === 'ArrowDown' ? 'alt' : 'ust'); return;
    }
    if (e.key === 'ArrowRight' && (!duzenleme || tumuSecili || imlecSonda)) { if (git(h, 'sag')) e.preventDefault(); return; }
    if (e.key === 'ArrowLeft' && (!duzenleme || tumuSecili || imlecBasta)) { if (git(h, 'sol')) e.preventDefault(); return; }
    if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) git(h, 'sol'); else await sonrakiVeyaYeni(h); return; }
    if (e.key === 'Tab') {
      // Tablo içinde Tab da hücreden hücreye gider; tablonun ucunda normal Tab davranışı
      if (e.shiftKey) { if (git(h, 'sol')) e.preventDefault(); return; }
      const sonHucre = hucreler(tr).at(-1) === h && tr === satirlar().at(-1);
      if (!sonHucre || yeniSatir) { e.preventDefault(); await sonrakiVeyaYeni(h); }
      return;
    }
    // Yazmaya başlayınca düzenleme moduna geç (seçili değerin üzerine yazılır)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) duzenleme = true;
  });

  return {
    // Yeniden çizimden önce/sonra odak korunur
    odakNe() { const a = document.activeElement; const tr = a?.closest?.('tr[data-i]'); return tr && kok.contains(a) && a.dataset.k ? { i: Number(tr.dataset.i), k: a.dataset.k } : null; },
    odakla(o, sec = true) {
      if (!o) return false;
      const tr = kok.querySelector(`tr[data-i="${o.i}"]`); if (!tr) return false;
      const hs = hucreler(tr);
      return odakla(hs.find((x) => x.dataset.k === o.k) || hs[0], { sec });
    },
    ilkHucre(i) { const tr = kok.querySelector(`tr[data-i="${i}"]`); return tr ? odakla(hucreler(tr)[0]) : false; },
  };
}

export const KISAYOL_YARDIM = '↑↓←→ hücreler · Enter/Tab sonraki · F2 düzenle · Esc geri al · Ctrl+Ins satır ekle · Ctrl+Del satır sil · F4 stok listesi · Ctrl+B barkod · Ctrl+S kaydet';
