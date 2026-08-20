/* Masotto Unified Master Loader V67 - 2026-08-20
   UNICA FONTE DATI: masotto_master_export_2026-08-20.json
   I file legacy restano nel repository solo come archivio e non vengono letti a runtime.
*/
(function(){
  'use strict';

  var MASTER_PATH = 'masotto_master_export_2026-08-20.json';
  var MASTER_VERSION = '2026.08.20-v1';
  var CACHE_BUSTER = '20260820-v67';

  function loadText(path){
    try {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', path + '?v=' + CACHE_BUSTER, false);
      xhr.send(null);
      if(xhr.status >= 200 && xhr.status < 300) return xhr.responseText;
      console.error('Masotto V67: errore caricamento', path, xhr.status);
    } catch(e){
      console.error('Masotto V67: errore caricamento', path, e);
    }
    return null;
  }

  function loadJson(path){
    var txt = loadText(path);
    if(!txt) return null;
    try { return JSON.parse(txt); }
    catch(e){ console.error('Masotto V67: JSON master non valido', path, e); return null; }
  }

  function n(v){ var x=Number(v); return Number.isFinite(x)?x:0; }
  function first(){
    for(var i=0;i<arguments.length;i++){
      if(arguments[i] !== undefined && arguments[i] !== null && arguments[i] !== '') return arguments[i];
    }
    return null;
  }
  function clone(v){ return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function defaultCleaning(nights){ return n(nights) > 14 ? 80 : 45; }

  function normalizeBooking(src, year){
    var b = Object.assign({}, src || {});
    var cleaning = first(b.cleaning_fee_eur, b.cleaning_eur);
    if(cleaning == null) cleaning = 0;

    var taxable = first(
      b.taxable_gross_eur,
      b.taxable_base_eur,
      b.cedolare_base_eur,
      b.accommodation_gross_eur,
      b.booking_gross_eur,
      b.gross_eur,
      b.stay_price_eur != null ? n(b.stay_price_eur) + n(cleaning) : null,
      b.cash_received_eur
    );
    taxable = n(taxable);

    var room = first(
      b.room_amount_eur,
      b.base_price_eur,
      b.stay_price_eur,
      taxable ? Math.max(0, taxable - n(cleaning)) : null
    );

    var cityTax = n(first(b.city_tax_eur, b.airbnb_collected_tax_eur, 0));
    var commission = n(first(b.commission_eur, b.ota_commission_eur, b.host_service_fee_eur, 0));
    var cash = first(b.wise_movement_eur, b.cash_received_eur);
    if(cash == null && b.payout_status === 'paid') cash = b.expected_host_payout_eur;

    var out = Object.assign({}, b, {
      id: b.id,
      guest: b.guest || String(b.id || 'Ospite'),
      check_in: b.check_in || '',
      check_out: b.check_out || '',
      nights: n(b.nights) || 1,
      pax: n(b.pax) || 1,
      source: b.source || 'Diretta',
      room_amount_eur: n(room),
      cleaning_fee_eur: n(cleaning),
      cleaning_eur: n(cleaning),
      taxable_gross_eur: taxable,
      cedolare_base_eur: taxable,
      receipt_total_display_eur: taxable,
      city_tax_eur: cityTax,
      gross_collected_eur: n(first(b.gross_collected_eur, b.gross_with_city_tax_eur, taxable + cityTax)),
      commission_eur: commission,
      wise_movement_eur: cash == null ? 0 : n(cash),
      canonical_source: MASTER_PATH,
      canonical_year: String(year || (b.check_in || '').slice(0,4)),
      city_tax_accounting: 'partita_di_giro'
    });

    if(b.data_quality) out.data_quality = b.data_quality;
    if(b.user_override) out.user_override = true;
    if(b.financial_summary_inclusion) out.financial_summary_inclusion = b.financial_summary_inclusion;
    return out;
  }

  function propertyMaster(master){
    var p = master.property || {};
    var acq = master.acquisition || {};
    var legal = master.legal_compliance || {};
    var tr = legal.tourist_rental || {};
    var ape = legal.ape || {};
    var ins = legal.insurance || {};
    var u = master.utilities || {};
    return [{
      property_id: 'MASOTTO4',
      name: p.name || 'Masotto Terrace View',
      address: p.address || 'Via Umberto Masotto 4, 20133 Milano',
      owner: p.owner || 'Riccardo Armati',
      floor: p.floor || 5,
      operating_model: p.operating_model,
      not_cav: !!p.not_cav,
      purchase_date: acq.date || '',
      purchase_price_eur: n(acq.price_eur),
      agency_fee_eur: n(acq.agency_fee_eur),
      cir: tr.cir || '',
      cin: tr.cin || '',
      ape_class: ape.class || '',
      ape_epgl_nren_kwh_m2: n(ape.epgl_nren_kwh_m2),
      ape_validity: ape.valid_until || '',
      insurance_policy: ins.canonical_policy || '',
      insurance_expiry: ins.operational_master_expiry || '',
      insurance_premium_eur: n(ins.annual_premium_eur),
      pod_luce: u.electricity && u.electricity.pod || '',
      fornitura_luce: u.electricity && u.electricity.supply || '',
      pdr_gas: u.gas && u.gas.pdr || '',
      fornitura_gas: u.gas && u.gas.supply || '',
      provider_internet: u.internet && u.internet.provider || '',
      internet_ssid: u.internet && u.internet.ssid || '',
      internet_monthly_cost_eur: n(u.internet && first(u.internet.reconciled_h1_2026_monthly_eur, u.internet.master_2025_monthly_eur)),
      cadastral_total_m2: n(p.areas && p.areas.catastale_total_m2),
      cadastral_ex_uncovered_m2: n(p.areas && p.areas.catastale_ex_uncovered_m2),
      terrace_m2: n(p.areas && first(p.areas.terrace_user_m2, p.areas.terrace_project_m2)),
      cellar_m2: n(p.areas && p.areas.cellar_m2),
      canonical_source: MASTER_PATH
    }];
  }

  function assetSections(master){
    var items = master.assets && Array.isArray(master.assets.items) ? master.assets.items : [];
    var movable=[], structural=[];
    items.forEach(function(a){
      var row = Object.assign({}, a, {
        id: a.id || a.asset_id,
        tipo: a.tipo || a.type || a.asset_type || '',
        marca: a.marca || a.brand || '',
        modello: a.modello || a.model || '',
        sn: a.sn || a.serial || '',
        acquisto: a.acquisto || a.purchase_date || a.acquisition_date || '',
        prezzo_eur: first(a.prezzo_eur, a.purchase_cost_eur),
        asset_nature: a.asset_nature || a.nature || '',
        asset_family: a.asset_family || a.family || '',
        canonical_source: MASTER_PATH
      });
      if(row.asset_nature === 'STRUCTURAL_OR_PLANT') structural.push(row); else movable.push(row);
    });
    return {movable:movable, structural:structural};
  }

  function financeSections(master){
    var rows=[];
    var ledger = master.bookings && master.bookings['2025'] && Array.isArray(master.bookings['2025'].cash_ledger) ? master.bookings['2025'].cash_ledger : [];
    ledger.forEach(function(x, idx){
      if(x.type === 'BOOK' || x.type === 'Tax' || x.type === 'OPEN') return;
      rows.push({
        id:'MASTER-2025-'+idx,
        date:x.date,
        description:x.description || '',
        category:x.type || 'Altro',
        type:n(x.in_eur)>0?'income':'expense',
        amount_eur:n(x.in_eur)>0?n(x.in_eur):n(x.out_eur),
        status:'paid',
        source:'master_2025_cash_ledger',
        canonical_source:MASTER_PATH
      });
    });

    var f26 = master.finance_2026 || {};
    function addPairs(arr, status, prefix, type){
      (arr || []).forEach(function(x, idx){
        var label = Array.isArray(x) ? x[0] : (x.description || x.category || 'Movimento');
        var amount = Array.isArray(x) ? x[1] : first(x.amount_eur, x.eur, 0);
        rows.push({
          id:prefix+'-'+idx,
          date: Array.isArray(x) ? '' : (x.date || x.due_date || ''),
          description:String(label),
          category:Array.isArray(x) ? String(label).split(' ')[0] : (x.category || 'Altro'),
          type:type || 'expense',
          amount_eur:n(amount),
          status:status,
          source:'master_finance_2026',
          canonical_source:MASTER_PATH
        });
      });
    }
    addPairs(f26.paid_or_documented, 'paid', 'MASTER-2026-PAID', 'expense');
    addPairs(f26.estimated, 'planned', 'MASTER-2026-EST', 'expense');
    addPairs(f26.pending, 'pending', 'MASTER-2026-PEND', 'expense');
    (f26.transfers_not_expenses || []).forEach(function(x, idx){
      rows.push({id:'MASTER-2026-TRANSFER-'+idx,date:'',description:String(x[0]),category:'Giroconto',type:'memo',amount_eur:n(x[1]),status:'paid',source:'master_finance_2026',canonical_source:MASTER_PATH});
    });
    return rows;
  }

  function utilitiesSection(master){
    var u=master.utilities || {};
    var out=[];
    if(u.electricity) out.push({property_id:'MASOTTO4',type:'Luce',provider:u.electricity.provider||'',pod:u.electricity.pod||'',fornitura:u.electricity.supply||'',status:'attiva',canonical_source:MASTER_PATH});
    if(u.gas) out.push({property_id:'MASOTTO4',type:'Gas',provider:u.gas.provider||'',pdr:u.gas.pdr||'',fornitura:u.gas.supply||'',status:'attiva',canonical_source:MASTER_PATH});
    if(u.internet) out.push({property_id:'MASOTTO4',type:'Internet',provider:u.internet.provider||'',ssid:u.internet.ssid||'',monthly_cost_eur:n(first(u.internet.reconciled_h1_2026_monthly_eur,u.internet.master_2025_monthly_eur)),status:'attiva',canonical_source:MASTER_PATH});
    return out;
  }

  function buildRuntime(master){
    var b25 = master.bookings && master.bookings['2025'] && Array.isArray(master.bookings['2025'].canonical_unique_bookings) ? master.bookings['2025'].canonical_unique_bookings : [];
    var b26 = master.bookings && master.bookings['2026'] && Array.isArray(master.bookings['2026'].records) ? master.bookings['2026'].records : [];
    var a=assetSections(master);
    return {
      property_master:propertyMaster(master),
      bookings:b25.map(function(x){return normalizeBooking(x,'2025');}).concat(b26.map(function(x){return normalizeBooking(x,'2026');})),
      finances:financeSections(master),
      assets_mobile:a.movable,
      structural_assets:a.structural,
      utilities:utilitiesSection(master),
      tickets:clone(master.tickets || []),
      insurance:clone(master.insurance || master.legal_compliance && master.legal_compliance.insurance || []),
      contacts:clone(master.contacts || []),
      maintenance_presets:clone(master.maintenance_presets || []),
      supply_presets:clone(master.supply_presets || []),
      accounting_rules:clone(master.operations_rules || {}),
      summary_2025:clone(master.bookings && master.bookings['2025'] || {}),
      summary_2026:clone(master.bookings && master.bookings['2026'] || {}),
      condominium:clone(master.condominium || {}),
      acquisition:clone(master.acquisition || {}),
      renovation_2023:clone(master.renovation_2023 || {}),
      fitout_misc:clone(master.fitout_misc || {}),
      valuation_sale_2026:clone(master.valuation_sale_2026 || {}),
      data_quality:clone(master.data_quality || {}),
      metadata:{
        live_loader_version:'v67',
        live_loader_updated_at:'2026-08-20',
        single_source:true,
        master_source:MASTER_PATH,
        master_schema_version:master.metadata && master.metadata.schema_version || MASTER_VERSION,
        master_generated_at:master.metadata && master.metadata.generated_at || '',
        legacy_runtime_files_loaded:false
      }
    };
  }

  function syncLocalStorage(runtime){
    var map={
      masotto_prop_data:'property_master',
      masotto_assets_mobile_db:'assets_mobile',
      masotto_structural_assets_db:'structural_assets',
      masotto_finance_db:'finances',
      masotto_booking_db:'bookings',
      masotto_maint_db:'tickets',
      masotto_insurance_db:'insurance',
      masotto_utilities_db:'utilities',
      masotto_contacts_db:'contacts',
      masotto_maintenance_presets_db:'maintenance_presets',
      masotto_supply_presets_db:'supply_presets'
    };
    try{
      Object.keys(map).forEach(function(key){ localStorage.setItem(key, JSON.stringify(runtime[map[key]] || [])); });
      localStorage.setItem('masotto_master_source', MASTER_PATH);
      localStorage.setItem('masotto_master_schema_version', runtime.metadata.master_schema_version || MASTER_VERSION);
      localStorage.setItem('masotto_last_sync', new Date().toISOString());
    }catch(e){ console.warn('Masotto V67: impossibile aggiornare cache locale', e); }
  }

  var master=loadJson(MASTER_PATH);
  if(!master){
    window.MASOTTO_MASTER_LOAD_ERROR=true;
    window.MASOTTO_MASTER=null;
    window.MASOTTO_DB={metadata:{live_loader_version:'v67',single_source:true,master_source:MASTER_PATH,load_error:true}};
    return;
  }

  window.MASOTTO_MASTER=master;
  window.MASOTTO_DB=buildRuntime(master);
  syncLocalStorage(window.MASOTTO_DB);
})();
