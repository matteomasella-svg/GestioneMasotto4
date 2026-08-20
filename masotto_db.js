/* Masotto Live DB Loader V66 - 2026-08-20
   Carica il database storico e applica gli overlay canonici correnti:
   - masotto_bookings_patch.json: prenotazioni + nuove spese/movimenti
   - masotto_assets.json: asset correnti
*/
(function(){
  'use strict';

  function loadText(path){
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', path + '?v=20260820-v66', false);
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300) return xhr.responseText;
      console.error('Masotto V66: errore caricamento', path, xhr.status);
    } catch(e) {
      console.error('Masotto V66: errore caricamento', path, e);
    }
    return null;
  }

  function loadJson(path){
    var txt = loadText(path);
    if(!txt) return null;
    try { return JSON.parse(txt); }
    catch(e){ console.error('Masotto V66: JSON non valido', path, e); return null; }
  }

  /* 1. Database storico completo */
  var baseJs = loadText('database_unificato.js');
  if(baseJs){
    try { (0, eval)(baseJs); }
    catch(e){ console.error('Masotto V66: impossibile inizializzare database storico', e); }
  }
  window.MASOTTO_DB = window.MASOTTO_DB || {};

  /* 2. Prenotazioni e nuove spese canoniche */
  var patch = loadJson('masotto_bookings_patch.json');
  if(patch){
    if(Array.isArray(patch.bookings)){
      window.MASOTTO_DB.bookings = patch.bookings.map(function(b){
        return Object.assign({}, b, { canonical_source: 'masotto_bookings_patch.json' });
      });
    }

    if(Array.isArray(patch.finance_adjustments)){
      var current = Array.isArray(window.MASOTTO_DB.finances) ? window.MASOTTO_DB.finances.slice() : [];
      var byId = {};
      current.forEach(function(f, i){ if(f && f.id != null) byId[String(f.id)] = i; });

      patch.finance_adjustments.forEach(function(f){
        var row = Object.assign({}, f, {
          canonical_source: 'masotto_bookings_patch.json',
          source: f.source || 'canonical_patch_2026_08_20'
        });
        var key = String(row.id);
        if(Object.prototype.hasOwnProperty.call(byId, key)) current[byId[key]] = row;
        else { byId[key] = current.length; current.push(row); }
      });
      window.MASOTTO_DB.finances = current;
    }

    window.MASOTTO_DB.summary_2026 = patch.summary_2026 || window.MASOTTO_DB.summary_2026 || {};
    window.MASOTTO_DB.accounting_rules = patch.accounting_rules || window.MASOTTO_DB.accounting_rules || {};
  }

  /* 3. Asset canonici Masotto */
  var assetPatch = loadJson('masotto_assets.json');
  if(assetPatch && Array.isArray(assetPatch.assets)){
    var movable = [];
    var structural = [];

    assetPatch.assets.forEach(function(a){
      var common = Object.assign({}, a, {
        id: a.id || a.asset_id,
        tipo: a.tipo || a.asset_type,
        marca: a.marca || a.brand || '',
        modello: a.modello || a.model || '',
        sn: a.sn || a.serial || '',
        acquisto: a.acquisto || a.purchase_date || a.acquisition_date || '',
        prezzo_eur: a.prezzo_eur != null ? a.prezzo_eur : a.purchase_cost_eur,
        canonical_source: 'masotto_assets.json'
      });
      if(a.asset_nature === 'STRUCTURAL_OR_PLANT') structural.push(common);
      else movable.push(common);
    });

    if(movable.length) window.MASOTTO_DB.assets_mobile = movable;
    if(structural.length) window.MASOTTO_DB.structural_assets = structural;
    window.MASOTTO_DB.asset_counts = assetPatch.asset_counts || {};
  }

  /* 4. Metadata runtime */
  window.MASOTTO_DB.metadata = Object.assign({}, window.MASOTTO_DB.metadata || {}, {
    live_loader_version: 'v66',
    live_loader_updated_at: '2026-08-20',
    bookings_source: 'masotto_bookings_patch.json',
    expenses_source: 'masotto_bookings_patch.json.finance_adjustments',
    assets_source: 'masotto_assets.json',
    bookings_count: Array.isArray(window.MASOTTO_DB.bookings) ? window.MASOTTO_DB.bookings.length : 0,
    finances_count: Array.isArray(window.MASOTTO_DB.finances) ? window.MASOTTO_DB.finances.length : 0,
    assets_mobile_count: Array.isArray(window.MASOTTO_DB.assets_mobile) ? window.MASOTTO_DB.assets_mobile.length : 0,
    structural_assets_count: Array.isArray(window.MASOTTO_DB.structural_assets) ? window.MASOTTO_DB.structural_assets.length : 0
  });
})();
