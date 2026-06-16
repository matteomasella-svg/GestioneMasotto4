/* Masotto Core V47: sync unico globale + motore contabile */
(function(){
  const PAGES = [
    ["index.html","Dashboard","layout-dashboard"],["anagrafica.html","Anagrafica","id-card"],["asset.html","Asset","boxes"],["audit.html","Audit","clipboard-check"],["manutenzione.html","Manutenzione","wrench"],["prenotazioni.html","Prenotazioni","calendar"],["finanze.html","Finanze","pie-chart"],["sicurezza.html","Sicurezza","shield"]
  ];
  const LS_MAP = { masotto_prop_data:'property_master', masotto_assets_mobile_db:'assets_mobile', masotto_structural_assets_db:'structural_assets', masotto_finance_db:'finances', masotto_booking_db:'bookings', masotto_maint_db:'tickets', masotto_insurance_db:'insurance', masotto_utilities_db:'utilities', masotto_contacts_db:'contacts', masotto_maintenance_presets_db:'maintenance_presets', masotto_supply_presets_db:'supply_presets' };
  const STATUS = { paid:'Eseguito', pagata:'Eseguito', pagato:'Eseguito', done:'Eseguito', executed:'Eseguito', pending:'Aperto', open:'Aperto', previsto:'Previsto', planned:'Previsto', accantonato:'Accantonato', accrued:'Accantonato' };
  function toISODate(d){ if(!d) return ''; const x=new Date(d); if(isNaN(x)) return ''; return x.toISOString().slice(0,10); }
  function addDays(dateStr, days){ const d=new Date(dateStr+'T00:00:00'); d.setDate(d.getDate()+Number(days||0)); return d.toISOString().slice(0,10); }
  function n(v){ return Number(v||0) || 0; }
  function lower(v){ return String(v||'').toLowerCase(); }
  function defaultCleaningFee(nights){ return Number(nights||0)>14 ? 80 : 45; }
  function normalizeStatusLabel(s){ return STATUS[lower(s)] || s || 'Previsto'; }
  function statusCode(s){ const l=normalizeStatusLabel(s); if(l==='Eseguito') return 'paid'; if(l==='Accantonato') return 'accrued'; if(l==='Aperto') return 'pending'; return 'planned'; }
  function bookingCheckIn(b){ return b.check_in || b.checkin || b.checkIn || ''; }
  function bookingCheckOut(b){ return b.check_out || b.checkout || b.checkOut || addDays(bookingCheckIn(b), b.nights || 1); }
  function bookingCleaning(b){ return n(b.cleaning_fee_eur ?? b.cleaning_eur ?? b.clean ?? b.cleaning) || defaultCleaningFee(b.nights); }
  function bookingRoom(b){ const cleaning=bookingCleaning(b); if(b.room_amount_eur!=null) return n(b.room_amount_eur); if(b.camera_eur!=null) return n(b.camera_eur); if(b.gross_eur!=null) return Math.max(0,n(b.gross_eur)-cleaning); if(b.price!=null) return Math.max(0,n(b.price)-cleaning); return 0; }
  function bookingTaxable(b){ if(b.taxable_gross_eur!=null) return n(b.taxable_gross_eur); if(b.cedolare_base_eur!=null) return n(b.cedolare_base_eur); if(b.receipt_total_display_eur!=null) return n(b.receipt_total_display_eur); if(b.gross_eur!=null) return n(b.gross_eur); if(b.price!=null) return n(b.price); return bookingRoom(b)+bookingCleaning(b); }
  function bookingCityTax(b){ return n(b.city_tax_eur ?? b.tax ?? b.city_tax); }
  function bookingCashIncome(b){
    if(b.wise_movement_eur!=null) return n(b.wise_movement_eur);
    if(b.cash_income_eur!=null) return n(b.cash_income_eur);
    return bookingTaxable(b);
  }
  function getPaymentAccount(tx){
    const date = tx.date || ''; const cat=lower(tx.category||tx.cat); const desc=lower(tx.description||tx.desc); const cutoff='2025-12-31';
    if((cat.includes('tasse')||cat.includes('tax')) && desc.includes('cedolare')) return 'Fondo fiscale';
    if(date && date <= cutoff){ if(desc.includes('imu')||desc.includes('tari')) return 'Da verificare'; return 'Wise'; }
    if(cat.includes('utenze')){ if(desc.includes('luce')||desc.includes('electricity')||desc.includes('gas')) return 'Fineco'; if(desc.includes('internet')||desc.includes('fastweb')) return 'Wise'; }
    if(cat.includes('pulizie')||cat.includes('manutenzione')||cat.includes('straordinaria')||cat.includes('assicurazione')||cat.includes('consumabili')||cat.includes('gestione ordinaria')) return 'Wise';
    if(cat.includes('condominio')||cat.includes('ordinaria')){ if(desc.includes('prima rata 2026/27')||desc.includes('1 rata 2026/27')) return 'Wise'; return 'Fineco'; }
    return tx.payment_account || tx.account || 'Da verificare';
  }
  function normalizeStatus(tx, today=new Date()){
    const date=tx.date||''; const cat=lower(tx.category||tx.cat); const desc=lower(tx.description||tx.desc); const current=normalizeStatusLabel(tx.status);
    // Gli accantonamenti cedolare possono essere segnati come pagati manualmente
    // quando viene versata la cedolare: non forzare sempre Accantonato.
    if(desc.includes('accantonamento cedolare')) return current === 'Eseguito' ? 'Eseguito' : 'Accantonato';
    if(cat.includes('utenze') && date && new Date(date+'T23:59:59') <= today) return 'Eseguito';
    if((tx.type==='expense'||tx.type==='Uscita'||tx.type==='income'||tx.type==='Entrata') && date && new Date(date+'T23:59:59') <= today && current!=='Accantonato') return 'Eseguito';
    return current;
  }
  function stableId(prefix, value){ let h=0; const s=String(value); for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return prefix+'-'+Math.abs(h); }
  function generateBookingRows(bookings){
    const rows=[];
    (bookings||[]).forEach(b=>{ const ci=bookingCheckIn(b); if(!ci) return; const co=bookingCheckOut(b); const guest=b.guest||'Ospite'; const bid=b.id||stableId('BK',guest+ci); const cleaning=bookingCleaning(b); const taxable=bookingTaxable(b); const city=bookingCityTax(b); const room=bookingRoom(b); const fiscalYear=String((co||ci).slice(0,4));
      const cashIncome=bookingCashIncome(b);
      rows.push({ id:`AUTO-INC-${bid}`, date:ci, description:`Ricevuta soggiorno: ${guest}`, category:'Prenotazione', type:'income', amount_eur:cashIncome, income:cashIncome, expense:0, status:'paid', payment_account:'Wise', booking_id:bid, is_auto_generated:true, fiscal_year:ci.slice(0,4), room_amount_eur:room, cleaning_fee_eur:cleaning, taxable_eur:taxable, fiscal_income_eur:taxable, city_tax_eur:city, riccardo_direct_eur:n(b.riccardo_direct_eur), receipt_rule:'imponibile cedolare = lordo/base cedolare già comprensivo delle pulizie; city tax separata; amount_eur = movimento cassa Wise' });
      rows.push({ id:`AUTO-CLEAN-${bid}`, date:co, description:`Pulizie: ${guest}`, category:'Pulizie', type:'expense', amount_eur:cleaning, income:0, expense:cleaning, status:'paid', payment_account:'Wise', booking_id:bid, is_auto_generated:true, fiscal_year:fiscalYear });
      rows.push({ id:`AUTO-CED-${bid}`, date:co, description:`Accantonamento Cedolare Secca: ${guest} / ${fiscalYear}`, category:'Tasse', type:'accrual', amount_eur:Math.round(taxable*0.21*100)/100, income:0, expense:Math.round(taxable*0.21*100)/100, status:'accrued', payment_account:'Fondo fiscale', booking_id:bid, is_auto_generated:true, fiscal_year:fiscalYear });
      if(city>0){ rows.push({ id:`AUTO-CITY-${bid}`, date:ci, description:`Tassa soggiorno riscossa: ${guest}`, category:'Partite di giro', type:'memo', amount_eur:city, income:0, expense:0, status:'paid', payment_account:'Wise', booking_id:bid, is_auto_generated:true, fiscal_year:ci.slice(0,4), city_tax_eur:city }); }
    });
    return rows;
  }
  function monthRange(start, end){ const out=[]; let d=new Date(start+'T00:00:00'); const e=new Date(end+'T00:00:00'); while(d<=e){ out.push(d.toISOString().slice(0,7)); d.setMonth(d.getMonth()+1); } return out; }
  function generateMonthlyDefaults(finances, today=new Date()){
    const rows=[];
    const months=monthRange('2025-01-01', today.toISOString().slice(0,10));
    const exists=(desc, ym)=> (finances||[]).some(f=>lower(f.description||f.desc).includes(desc) && String(f.date||'').startsWith(ym));
    months.forEach(ym=>{
      const date=ym+'-28';
      // Fastweb: importo esatto 27,95 euro/mese, sempre Wise anche nel 2025.
      if(!exists('internet',ym)&&!exists('fastweb',ym)) rows.push({id:'AUTO-INTERNET-'+ym,date,description:'internet Fastweb mensile',category:'Utenze',type:'expense',amount_eur:27.95,income:0,expense:27.95,status:'paid',payment_account:'Wise',is_auto_generated:true,fiscal_year:ym.slice(0,4)});
      // Consumabili: partono dall'apertura attivita, agosto 2025, 30 euro/mese.
      if(ym >= '2025-08' && !exists('consumabili gestione ordinaria',ym)) rows.push({id:'AUTO-CONS-'+ym,date,description:'consumabili gestione ordinaria',category:'Gestione ordinaria',type:'expense',amount_eur:30,income:0,expense:30,status:'paid',payment_account:'Wise',is_auto_generated:true,fiscal_year:ym.slice(0,4)});
    });
    return rows;
  }
  function normalizeFinanceRows(finances, bookings, today=new Date()){
    const existingAutoById = {};
    (finances||[]).forEach(f=>{
      const id=String(f.id||'');
      if(id.startsWith('AUTO-')) existingAutoById[id]=f;
    });
    const manual=(finances||[])
      .filter(f=>!String(f.id||'').startsWith('AUTO-'))
      .filter(f=>!lower(f.description||f.desc).trim().startsWith('bookings '))
      .map(f=>{ const out={...f}; out.description=out.description||out.desc||''; out.category=out.category||out.cat||'Altro'; out.amount_eur=n(out.amount_eur ?? out.amount ?? out.expense ?? out.out); const lt=lower(out.type); out.type= lt==='revenue' ? 'income' : (out.type || (out.category==='Entrata Extra' ? 'income':'expense')); out.status=statusCode(normalizeStatus(out,today)); out.payment_account=getPaymentAccount(out); out.fiscal_year=String(out.related_year || out.fiscal_year || (out.date||'').slice(0,4)); return out; });
    const generated=[...generateBookingRows(bookings), ...generateMonthlyDefaults(manual,today)].map(g=>{
      const old=existingAutoById[String(g.id)];
      if(old){
        g.status = statusCode(normalizeStatus({...g, status: old.status}, today));
        g.payment_account = old.payment_account || g.payment_account;
        g.notes = old.notes || g.notes;
      }
      return g;
    });
    // V58: preserva le righe automatiche di chiusura/riporto cassa.
    // Prima venivano salvate dal pulsante Bilancio ma poi eliminate alla normalizzazione
    // perche non erano righe booking o ricorrenze mensili.
    const generatedIds = new Set(generated.map(g=>String(g.id||'')));
    const preservedAuto = Object.values(existingAutoById)
      .filter(f=>String(f.id||'').startsWith('AUTO-OPENING-') || String(f.id||'').startsWith('AUTO-YEAREND-'))
      .filter(f=>!generatedIds.has(String(f.id||'')))
      .map(f=>{ const out={...f}; out.type=out.type||'memo'; out.amount_eur=n(out.amount_eur ?? out.amount ?? 0); out.status=statusCode(out.status||'paid'); out.payment_account=out.payment_account||'Wise'; return out; });
    return [...manual, ...preservedAuto, ...generated];
  }

  function getYearEndBalance(year, opts={}){
    const master=window.MASOTTO_DB||{};
    const bookings=(opts.bookings||JSON.parse(localStorage.getItem('masotto_booking_db')||'null')||master.bookings||[]).map(b=>({...b}));
    const finances=(opts.finances||JSON.parse(localStorage.getItem('masotto_finance_db')||'null')||master.finances||[]).map(f=>({...f}));
    const rows=normalizeFinanceRows(finances, bookings, opts.today?new Date(opts.today):new Date());
    const y=String(year);
    const yearRows=rows.filter(t=>String(t.fiscal_year || (t.date||'').slice(0,4))===y);
    const bookingRows=generateBookingRows(bookings).filter(t=>String(t.fiscal_year || (t.date||'').slice(0,4))===y);
    const receipts=bookings.filter(b=>String(bookingCheckIn(b)).slice(0,4)===y).map(b=>{
      const taxable=bookingTaxable(b), cleaning=bookingCleaning(b), city=bookingCityTax(b), room=bookingRoom(b);
      return {id:b.id, guest:b.guest||'Ospite', check_in:bookingCheckIn(b), check_out:bookingCheckOut(b), nights:Number(b.nights||0), pax:Number(b.pax||1), soggiorno_eur:room, pulizie_eur:cleaning, imponibile_cedolare_eur:taxable, tassa_soggiorno_eur:city, totale_incassato_eur:Math.round((taxable+city)*100)/100, cedolare_21_eur:Math.round(taxable*21)/100};
    });
    const sum=(arr,fn)=>Math.round(arr.reduce((a,x)=>a+Number(fn(x)||0),0)*100)/100;
    const isOut=t=>{const type=String(t.type||'').toLowerCase(); if(type==='memo'||type==='accrual') return false; return type==='expense'||type==='uscita'||(Number(t.expense||0)>0);};
    const isIn=t=>{const type=String(t.type||'').toLowerCase(); return type==='income'||type==='entrata'||(Number(t.income||0)>0);};
    const categories={};
    yearRows.filter(isOut).forEach(t=>{ const k=t.category||'Altro'; categories[k]=Math.round(((categories[k]||0)+Number(t.amount_eur||t.expense||0))*100)/100; });
    return {
      year:y,
      generated_at:new Date().toISOString(),
      receipts,
      totals:{
        receipts_count:receipts.length,
        imponibile_cedolare:sum(receipts,r=>r.imponibile_cedolare_eur),
        tassa_soggiorno_riscossa:sum(receipts,r=>r.tassa_soggiorno_eur),
        pulizie:sum(receipts,r=>r.pulizie_eur),
        cedolare_accantonata:sum(receipts,r=>r.cedolare_21_eur),
        entrate_reali:sum(yearRows.filter(isIn),t=>t.amount_eur||t.income),
        uscite_reali:sum(yearRows.filter(isOut),t=>t.amount_eur||t.expense)
      },
      categories,
      rows:yearRows,
      generated_booking_rows:bookingRows
    };
  }
  function printAllReceipts(year){
    const report=getYearEndBalance(year);
    const eur=v=>Number(v||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmt=d=>d?String(d).split('-').reverse().join('/'):'N/D';
    const prop=(window.MASOTTO_DB&&window.MASOTTO_DB.property_master&&window.MASOTTO_DB.property_master[0])||{};
    const html=`<!doctype html><html><head><title>Ricevute Masotto ${year}</title><style>body{font-family:Arial,sans-serif;color:#111827;margin:30px}.receipt{page-break-after:always;border:1px solid #ddd;padding:28px;margin-bottom:28px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #004D54;padding-bottom:12px;margin-bottom:20px}h1{color:#004D54;margin:0;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{padding:10px;border-bottom:1px solid #e5e7eb;text-align:left}.val{text-align:right;font-family:monospace}.total{font-weight:bold;background:#f8fafc}.city{color:#6d28d9;background:#faf5ff}.summary{page-break-after:always;border:2px solid #004D54;padding:28px}.small{font-size:12px;color:#64748b}@media print{body{margin:0}.receipt,.summary{border:none}}</style></head><body><div class="summary"><h1>Bilancio fine anno ${year}</h1><p class="small">Generato automaticamente dal gestionale Masotto. Le ricevute usano la regola: imponibile cedolare = lordo/base cedolare già comprensivo delle pulizie; tassa soggiorno separata.</p><table><tr><td>Ricevute generate</td><td class="val">${report.totals.receipts_count}</td></tr><tr><td>Imponibile cedolare</td><td class="val">€ ${eur(report.totals.imponibile_cedolare)}</td></tr><tr><td>Tassa soggiorno riscossa</td><td class="val">€ ${eur(report.totals.tassa_soggiorno_riscossa)}</td></tr><tr><td>Pulizie</td><td class="val">€ ${eur(report.totals.pulizie)}</td></tr><tr><td>Cedolare accantonata 21%</td><td class="val">€ ${eur(report.totals.cedolare_accantonata)}</td></tr><tr><td>Entrate reali</td><td class="val">€ ${eur(report.totals.entrate_reali)}</td></tr><tr><td>Uscite reali</td><td class="val">€ ${eur(report.totals.uscite_reali)}</td></tr></table><h3>Categorie spesa</h3><table>${Object.entries(report.categories).map(([k,v])=>`<tr><td>${k}</td><td class="val">€ ${eur(v)}</td></tr>`).join('')}</table></div>${report.receipts.map(r=>`<div class="receipt"><div class="head"><div><div class="small">Ricevuta Locazione Breve Turistica</div><h1>RICEVUTA DI PAGAMENTO</h1><p>Rif. ${r.id} — Data emissione: ${fmt(r.check_in)}</p></div><div style="text-align:right"><strong>${prop.name||'Masotto Terrace View'}</strong><br>${prop.address||'Via Privata Umberto Masotto 4, Milano'}<br>CIR: ${prop.cir||'015146-LNI-09408'}</div></div><p><strong>Ospite:</strong> ${r.guest}<br><strong>Check-in:</strong> ${fmt(r.check_in)} — <strong>Check-out:</strong> ${fmt(r.check_out)} — <strong>Notti:</strong> ${r.nights}</p><table><tr><td>Soggiorno e servizi accessori inclusa pulizia</td><td class="val">€ ${eur(r.imponibile_cedolare_eur)}</td></tr><tr class="total"><td>IMPONIBILE CEDOLARE SECCA</td><td class="val">€ ${eur(r.imponibile_cedolare_eur)}</td></tr><tr class="city"><td>Tassa di soggiorno riscossa per conto del Comune - fuori imponibile</td><td class="val">€ ${eur(r.tassa_soggiorno_eur)}</td></tr><tr><td><strong>Totale incassato incluso tassa soggiorno</strong></td><td class="val"><strong>€ ${eur(r.totale_incassato_eur)}</strong></td></tr></table><p class="small">Pulizie comprese nella base cedolare: € ${eur(r.pulizie_eur)}. Cedolare accantonata: € ${eur(r.cedolare_21_eur)}.</p></div>`).join('')}<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`;
    const w=window.open('','_blank'); if(!w){ localStorage.setItem('masotto_receipts_html_'+year, html); alert('Popup bloccato: abilita i popup. Ho salvato comunque le ricevute in memoria locale.'); return report; } w.document.write(html); w.document.close(); return report;
  }
  function getOpeningBalanceForYear(year){
    const y=String(year);
    if(y==='2025') return 1300;
    const direct=localStorage.getItem('masotto_opening_balance_'+y);
    if(direct!==null && direct!=='' && !isNaN(Number(direct))) return Number(direct);
    const prev=String(Number(y)-1);
    try{ const reserve=JSON.parse(localStorage.getItem('masotto_accantonamento_'+prev)||'null'); if(reserve){ if(reserve.fondo_cassa_disponibile_eur!==undefined) return Number(reserve.fondo_cassa_disponibile_eur)||0; if(reserve.saldo_disponibile_eur!==undefined) return Number(reserve.saldo_disponibile_eur)||0; } }catch(e){}
    // V58: fallback operativo richiesto per Masotto.
    // Se la chiusura 2025 non e' ancora stata salvata dal browser, il 2026 non deve
    // ripartire dal saldo banca pre-accantonamento ma dal fondo cassa disponibile approvato.
    if(y==='2026') return 587.03;
    return 0;
  }
  function upsertCarryForwardRow(year, amount){
    const y=String(year);
    const id='AUTO-OPENING-'+y;
    let rows=[];
    try{ rows=JSON.parse(localStorage.getItem('masotto_finance_db')||'[]')||[]; }catch(e){ rows=[]; }
    const row={id,date:y+'-01-01',description:'Fondo cassa iniziale '+y+' da chiusura anno precedente',category:'Riporto cassa',type:'memo',amount_eur:Math.round(Number(amount||0)*100)/100,income:0,expense:0,status:'paid',payment_account:'Wise',fiscal_year:y,is_auto_generated:true,notes:'Riporto generato dalla chiusura conto. Non e nuovo incasso: e il fondo cassa disponibile iniziale dell anno.'};
    const idx=rows.findIndex(r=>String(r.id)===id);
    if(idx>=0) rows[idx]={...rows[idx],...row}; else rows.push(row);
    localStorage.setItem('masotto_finance_db',JSON.stringify(rows));
    return row;
  }

  function closeFiscalYear(year){
    const report=getYearEndBalance(year);
    const y=String(year);
    const rows=report.rows||[];
    const openingBalance=getOpeningBalanceForYear(y);
    const isIncome=t=>String(t.type||'').toLowerCase()==='income'||Number(t.income||0)>0;
    const isRealOut=t=>{
      const type=String(t.type||'').toLowerCase();
      if(type==='memo'||type==='accrual') return false;
      if(String(t.status||'').toLowerCase()==='accrued'||normalizeStatusLabel(t.status)==='Accantonato') return false;
      const desc=lower(t.description||t.desc), cat=lower(t.category||t.cat);
      if(cat.includes('tasse') && (desc.includes('imu')||desc.includes('tari'))) return false;
      return type==='expense'||type==='uscita'||Number(t.expense||0)>0;
    };
    const sum=(arr,fn)=>Math.round(arr.reduce((a,x)=>a+Number(fn(x)||0),0)*100)/100;
    const entrate=sum(rows.filter(isIncome),t=>t.amount_eur||t.income);
    const uscite=sum(rows.filter(isRealOut),t=>t.amount_eur||t.expense);
    const accantonamentoCedolare=report.totals.cedolare_accantonata||0;
    const saldoPrimaAccantonamenti=Math.round((openingBalance+entrate-uscite)*100)/100;
    let fondoCassaDisponibile=Math.round((saldoPrimaAccantonamenti-accantonamentoCedolare)*100)/100;
    // V58: chiusura 2025 validata da Matteo: il fondo cassa disponibile da riportare al 2026 e' 587,03.
    // Serve ad evitare che il sistema riparta dal saldo banca prima dell'accantonamento o da calcoli contaminati.
    if(y==='2025') fondoCassaDisponibile = 587.03;
    const nextYear=String(Number(y)+1);
    report.reserve={
      year:y,
      next_year:nextYear,
      type:'cedolare_secca',
      status:'Accantonato',
      amount_eur:accantonamentoCedolare,
      fondo_iniziale_eur:openingBalance,
      entrate_eur:entrate,
      uscite_reali_eur:uscite,
      saldo_banca_prima_accantonamenti_eur:saldoPrimaAccantonamenti,
      fondo_cassa_disponibile_eur:fondoCassaDisponibile,
      saldo_disponibile_eur:fondoCassaDisponibile,
      note:'Chiusura anno: il fondo cassa dell anno successivo parte dal disponibile reale, cioe saldo dopo accantonamenti fiscali aperti.'
    };
    localStorage.setItem('masotto_year_end_'+y,JSON.stringify(report));
    localStorage.setItem('masotto_receipts_'+y,JSON.stringify(report.receipts));
    localStorage.setItem('masotto_accantonamento_'+y,JSON.stringify(report.reserve));
    localStorage.setItem('masotto_opening_balance_'+nextYear,String(fondoCassaDisponibile));
    upsertCarryForwardRow(nextYear,fondoCassaDisponibile);
    return report;
  }

  function getCedolareAccantonata(rows, year){ return (rows||[]).filter(t=>statusCode(t.status)==='accrued' && lower(t.category).includes('tasse') && lower(t.description).includes('cedolare') && String(t.fiscal_year||t.date?.slice(0,4))===String(year)).reduce((a,t)=>a+n(t.amount_eur??t.expense),0); }
  function getExpenseByCategory(rows, year, q){ const qq=lower(q); return (rows||[]).filter(t=>String(t.fiscal_year||t.date?.slice(0,4))===String(year)&&['paid','pending','planned'].includes(statusCode(t.status))&&lower(t.category+' '+t.description).includes(qq)).reduce((a,t)=>a+n(t.amount_eur??t.expense),0); }
  async function ensureMasterDB(force=false){ try{ const master=window.MASOTTO_DB||{}; for(const [lsKey,section] of Object.entries(LS_MAP)){ const existing=localStorage.getItem(lsKey); const empty=!existing||existing==='null'||existing==='[]'||existing==='{}'||existing==='undefined'; if(force||empty) localStorage.setItem(lsKey,JSON.stringify(master[section]??[])); } return true; }catch(e){ console.warn('DB sync failed',e); return false; } }
  function mountSidebar(){ if(document.getElementById('msSidebar')) return; try{ document.querySelectorAll('aside.sidebar,div.sidebar,#sidebar,[data-legacy-sidebar="1"],.ms-sidebar').forEach(el=>el.remove()); }catch(e){}
    const path=(location.pathname.split('/').pop()||'index.html').toLowerCase(); const nav=PAGES.map(([href,label,icon])=>`<a class="${href.toLowerCase()===path?'active':''}" href="${href}"><i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span></a>`).join('');
    const sidebar=document.createElement('aside'); sidebar.className='ms-sidebar'; sidebar.id='msSidebar'; sidebar.innerHTML=`<div class="flex items-center gap-3 mb-6"><div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg" style="background:linear-gradient(135deg,#004D54,#10b981)">2M</div><div><div class="text-white font-bold leading-tight">Masotto Terrace</div><div class="ms-chip">single-property mode</div></div></div><nav class="ms-nav space-y-1">${nav}</nav><div class="mt-6 p-3 rounded-xl" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);"><button id="msSyncBtn" class="w-full text-xs font-bold px-3 py-2 rounded-lg" style="background:rgba(45,212,191,.15);border:1px solid rgba(45,212,191,.35);color:#a7f3d0;">Sincronizza tutto</button><div class="mt-2 text-[10px] text-gray-400 leading-tight">Unico pulsante globale: aggiorna tutte le sezioni dal database.</div></div>`;
    const mainWrap=document.createElement('div'); mainWrap.className='ms-main'; while(document.body.firstChild) mainWrap.appendChild(document.body.firstChild); document.body.appendChild(sidebar); document.body.appendChild(mainWrap);
    const topbar=document.createElement('div'); topbar.className='ms-topbar p-3 flex items-center justify-between lg:hidden'; topbar.innerHTML='<button id="msToggle" class="px-3 py-2 rounded-lg text-white text-xs font-bold" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);">☰ Menu</button><div class="text-white font-bold text-sm">Masotto Terrace</div><div style="width:64px"></div>'; mainWrap.prepend(topbar); topbar.querySelector('#msToggle').addEventListener('click',()=>sidebar.classList.toggle('open'));
    sidebar.querySelector('#msSyncBtn').addEventListener('click',async()=>{ const btn=sidebar.querySelector('#msSyncBtn'); btn.textContent='Sincronizzazione...'; await ensureMasterDB(true); localStorage.setItem('masotto_last_sync',new Date().toISOString()); location.reload(); });
    try{ if(window.lucide) window.lucide.createIcons(); }catch(e){}
  }
  window.MS_ACCOUNTING={defaultCleaningFee, bookingCheckIn, bookingCheckOut, bookingCleaning, bookingTaxable, bookingRoom, bookingCityTax, bookingCashIncome, getPaymentAccount, normalizeStatus, statusCode, normalizeFinanceRows, generateBookingRows, getYearEndBalance, printAllReceipts, closeFiscalYear, getCedolareAccantonata, getExpenseByCategory};
  window.msReady=async function(force=false){ await ensureMasterDB(force); mountSidebar(); return true; };
  document.addEventListener('DOMContentLoaded',()=>{ mountSidebar(); });
})();
