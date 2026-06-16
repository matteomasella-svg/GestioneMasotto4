/* Masotto Core V64: sync unico globale + motore contabile */
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
      const reimbursements = Array.isArray(b.riccardo_reimbursements) ? b.riccardo_reimbursements : [];
      reimbursements.forEach((r, idx)=>{
        const reimbAmount = n(r.amount_eur ?? r.amount ?? 0);
        if(reimbAmount>0){
          const reimbDate = r.date || co || ci;
          rows.push({ id:`AUTO-RICCARDO-${bid}-${idx+1}`, date:reimbDate, description:r.description || `Giroconto a Riccardo: ${guest} tranche ${idx+1}`, category:'Giroconto Riccardo', type:'expense', amount_eur:reimbAmount, income:0, expense:reimbAmount, status:'paid', payment_account:'Wise', booking_id:bid, is_auto_generated:true, fiscal_year:reimbDate.slice(0,4), notes:'Uscita Wise a Riccardo collegata alla prenotazione: non modifica la ricevuta, corregge la cassa.' });
        }
      });
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
    const closedYears = getYearClosures();
    const generated=[...generateBookingRows(bookings), ...generateMonthlyDefaults(manual,today)].map(g=>{
      const old=existingAutoById[String(g.id)];
      if(old){
        g.status = statusCode(normalizeStatus({...g, status: old.status}, today));
        g.payment_account = old.payment_account || g.payment_account;
        g.notes = old.notes || g.notes;
      }
      return g;
    }).filter(g=>{
      // V64: le singole righe di Accantonamento Cedolare devono restare visibili nei movimenti
      // anche dopo la chiusura anno. Il totale annuale vive nel contatore F24, ma le righe
      // storiche non vengono nascoste; vanno solo escluse dal calcolo delle uscite reali.
      return true;
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
  function receiptPageHtml(r, prop){
    const eur=v=>Number(v||0).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2});
    const fmt=d=>d?String(d).split('-').reverse().join('/'):'N/D';
    const propName = prop.name || 'Masotto Terrace View';
    const propAddress = prop.address || 'Via Privata Umberto Masotto 4, 20133 Milano';
    const propOwner = prop.owner || 'Armati Riccardo';
    const propCIR = prop.cir || '015146-LNI-09408';
    const soggiorno = Math.max(0, Number(r.imponibile_cedolare_eur||0) - Number(r.pulizie_eur||0));
    const receiptDate = r.issue_date || r.check_in;
    return `<section class="receipt-page">
      <div class="receipt-topline">${new Date().toLocaleString('it-IT',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}<span>Ricevuta_${String(r.guest||'Ospite').replace(/\s+/g,'_')}_${r.id}</span></div>
      <header class="receipt-header">
        <div>
          <div class="receipt-kicker">RICEVUTA NON FISCALE - LOCAZIONE BREVE TURISTICA</div>
          <h1>RICEVUTA DI PAGAMENTO</h1>
          <p class="receipt-ref"><strong>N. Rif:</strong> ${r.id}</p>
          <p class="muted">Data emissione: ${fmt(receiptDate)}</p>
        </div>
        <div class="property-box">
          <h2>${propName}</h2>
          <p>${propAddress}</p>
          <p>Proprietario: ${propOwner}</p>
          <p>CIR: ${propCIR}</p>
        </div>
      </header>
      <div class="receipt-rule"></div>
      <div class="receipt-info-grid">
        <div class="receipt-info-box">
          <h3>DATI OSPITE</h3>
          <p><strong>Nome:</strong> ${r.guest||''}</p>
          <p><strong>Ospiti totali:</strong> ${r.pax||1}</p>
        </div>
        <div class="receipt-info-box">
          <h3>DETTAGLI SOGGIORNO</h3>
          <p><strong>Check-in:</strong> ${fmt(r.check_in)}</p>
          <p><strong>Check-out:</strong> ${fmt(r.check_out)}</p>
          <p><strong>Totale Notti:</strong> ${r.nights||0}</p>
        </div>
      </div>
      <table class="receipt-table">
        <thead><tr><th>DESCRIZIONE DEL SERVIZIO</th><th>IMPORTO</th></tr></thead>
        <tbody>
          <tr><td>Soggiorno - locazione breve turistica (${r.nights||0} notti)</td><td>€ ${eur(soggiorno)}</td></tr>
          <tr><td>Spese di pulizia</td><td>€ ${eur(r.pulizie_eur)}</td></tr>
          <tr class="total-row"><td>Totale lordo per cedolare secca</td><td>€ ${eur(r.imponibile_cedolare_eur)}</td></tr>
          <tr class="city-row"><td>Tassa di soggiorno riscossa al check-in</td><td>€ ${eur(r.tassa_soggiorno_eur)}</td></tr>
        </tbody>
      </table>
      <div class="law-notes">
        <h4>Note di Legge:</h4>
        <p>Ricevuta emessa per prestazione relativa a locazione breve turistica ai sensi dell'art. 4 DL 50/2017.</p>
        <p>Operazione fuori campo IVA ai sensi dell'art. 10 DPR 633/72.</p>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <div class="signature-label">FIRMA DEL LOCATORE</div>
        <div class="signature-name">${propOwner}</div>
        <div class="signature-printed">${propOwner}</div>
      </div>
      <footer>Documento generato dal Sistema Gestionale 2M Apartments. Copia per l'ospite.</footer>
    </section>`;
  }

  function receiptsPrintCss(){
    return `<style>
      *{box-sizing:border-box} body{font-family:Arial,Helvetica,sans-serif;color:#111827;background:#fff;margin:0}.receipt-page{width:210mm;min-height:297mm;margin:0 auto;padding:18mm 20mm 14mm;page-break-after:always;position:relative}.receipt-topline{font-family:Georgia,serif;font-size:11px;color:#111;display:flex;justify-content:space-between;margin-bottom:26px}.receipt-header{display:flex;justify-content:space-between;align-items:flex-start}.receipt-kicker{font-size:15px;letter-spacing:2px;font-weight:800;color:#111827;max-width:420px}.receipt-header h1{font-size:36px;line-height:1.05;margin:10px 0 22px;color:#00585f;font-weight:900}.receipt-ref{font-size:15px;color:#334155;margin:0 0 12px}.muted{color:#475569;margin:0;font-size:14px}.property-box{text-align:right;max-width:280px;color:#111827}.property-box h2{color:#00636a;font-size:27px;margin:0 0 8px;font-weight:800}.property-box p{margin:5px 0;font-size:15px}.receipt-rule{border-top:3px solid #00585f;margin:30px 0 48px}.receipt-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:58px}.receipt-info-box{border:1px solid #d8e2ee;border-radius:7px;padding:22px 26px;min-height:142px}.receipt-info-box h3{color:#00585f;font-size:17px;margin:0 0 20px;padding-bottom:10px;border-bottom:2px solid #cfd8e3}.receipt-info-box p{font-size:15px;margin:16px 0}.receipt-table{width:100%;border-collapse:collapse;margin-top:0}.receipt-table th{text-align:left;font-size:13px;color:#334155;padding:0 12px 16px;border-bottom:3px solid #cbd5e1}.receipt-table th:last-child{text-align:right}.receipt-table td{font-size:16px;padding:13px 12px;border-bottom:2px solid #d7e0ea}.receipt-table td:last-child{text-align:right;white-space:nowrap}.total-row td{font-weight:800;font-size:17px;border-bottom:3px solid #00585f}.city-row td{padding-top:18px;border-bottom:3px solid #00585f}.law-notes{margin-top:46px;color:#40516a}.law-notes h4{font-size:15px;margin:0 0 12px;color:#334155}.law-notes p{font-size:14px;margin:8px 0}.signature-block{margin-top:34px;margin-left:auto;width:270px;text-align:center}.signature-line{border-top:1px dotted #111;margin-bottom:8px}.signature-label{font-size:11px;color:#334155}.signature-name{font-family:'Brush Script MT','Segoe Script',cursive;font-size:36px;color:#0f172a;transform:rotate(-3deg);margin:10px 0}.signature-printed{font-weight:700;font-size:13px}.receipt-page footer{position:absolute;left:20mm;right:20mm;bottom:16mm;text-align:center;border-top:2px solid #dbe3ed;padding-top:24px;font-size:12px;color:#475569}@media print{body{margin:0}.receipt-page{margin:0;box-shadow:none}@page{size:A4;margin:0}}
    </style>`;
  }

  function printReceipt(bookingId){
    const master=window.MASOTTO_DB||{};
    const bookings=(JSON.parse(localStorage.getItem('masotto_booking_db')||'null')||master.bookings||[]);
    const b=bookings.find(x=>String(x.id)===String(bookingId));
    if(!b){ alert('Prenotazione non trovata.'); return null; }
    const taxable=bookingTaxable(b), cleaning=bookingCleaning(b), city=bookingCityTax(b), room=bookingRoom(b);
    const r={id:b.id, guest:b.guest||'Ospite', check_in:bookingCheckIn(b), check_out:bookingCheckOut(b), nights:Number(b.nights||0), pax:Number(b.pax||1), soggiorno_eur:room, pulizie_eur:cleaning, imponibile_cedolare_eur:taxable, tassa_soggiorno_eur:city, totale_incassato_eur:Math.round((taxable+city)*100)/100, cedolare_21_eur:Math.round(taxable*21)/100};
    const prop=(master.property_master&&master.property_master[0])||{};
    const html=`<!doctype html><html><head><title>Ricevuta_${String(r.guest||'Ospite').replace(/\s+/g,'_')}_${r.id}</title>${receiptsPrintCss()}</head><body>${receiptPageHtml(r,prop)}<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`;
    const w=window.open('','_blank'); if(!w){ localStorage.setItem('masotto_receipt_html_'+r.id, html); alert('Popup bloccato: abilita i popup. Ho salvato la ricevuta in memoria locale.'); return r; } w.document.write(html); w.document.close(); return r;
  }

  function printAllReceipts(year){
    const report=getYearEndBalance(year);
    const prop=(window.MASOTTO_DB&&window.MASOTTO_DB.property_master&&window.MASOTTO_DB.property_master[0])||{};
    const html=`<!doctype html><html><head><title>Ricevute Masotto ${year}</title>${receiptsPrintCss()}</head><body>${report.receipts.map(r=>receiptPageHtml(r,prop)).join('')}<script>window.onload=()=>setTimeout(()=>window.print(),500)<\/script></body></html>`;
    const w=window.open('','_blank'); if(!w){ localStorage.setItem('masotto_receipts_html_'+year, html); alert('Popup bloccato: abilita i popup. Ho salvato comunque le ricevute in memoria locale.'); return report; } w.document.write(html); w.document.close(); return report;
  }
  function getOpeningBalanceForYear(year){
    const y=String(year);
    if(y==='2025') return 1300;
    const prev=String(Number(y)-1);
    const prevClosure=getYearClosure(prev);
    if(prevClosure && prevClosure.closed && prevClosure.carry_forward_cash_eur!==undefined) return Number(prevClosure.carry_forward_cash_eur)||0;
    const direct=localStorage.getItem('masotto_opening_balance_'+y);
    if(direct!==null && direct!=='' && !isNaN(Number(direct))) return Number(direct);
    try{ const reserve=JSON.parse(localStorage.getItem('masotto_accantonamento_'+prev)||'null'); if(reserve){ if(reserve.fondo_cassa_disponibile_eur!==undefined) return Number(reserve.fondo_cassa_disponibile_eur)||0; if(reserve.saldo_disponibile_eur!==undefined) return Number(reserve.saldo_disponibile_eur)||0; } }catch(e){}
    // V58: fallback operativo richiesto per Masotto.
    // Se la chiusura 2025 non e' ancora stata salvata dal browser, il 2026 non deve
    // ripartire dal saldo banca pre-accantonamento ma dal liquidita disponibile approvato.
    if(y==='2026') return 587.03;
    return 0;
  }
  function upsertCarryForwardRow(year, amount){
    const y=String(year);
    const id='AUTO-OPENING-'+y;
    let rows=[];
    try{ rows=JSON.parse(localStorage.getItem('masotto_finance_db')||'[]')||[]; }catch(e){ rows=[]; }
    const row={id,date:y+'-01-01',description:'Liquidità iniziale '+y+' da chiusura anno precedente',category:'Riporto cassa',type:'memo',amount_eur:Math.round(Number(amount||0)*100)/100,income:0,expense:0,status:'paid',payment_account:'Wise',fiscal_year:y,is_auto_generated:true,notes:'Riporto generato dalla chiusura anno. Non e un nuovo incasso: e la liquidita disponibile iniziale dell anno dopo aver separato gli accantonamenti.'};
    const idx=rows.findIndex(r=>String(r.id)===id);
    if(idx>=0) rows[idx]={...rows[idx],...row}; else rows.push(row);
    localStorage.setItem('masotto_finance_db',JSON.stringify(rows));
    return row;
  }

  function getYearClosures(){ try{ return JSON.parse(localStorage.getItem('masotto_year_closures')||'{}')||{}; }catch(e){ return {}; } }
  function getYearClosure(year){ return getYearClosures()[String(year)] || null; }
  function saveYearClosure(year, closure){ const all=getYearClosures(); all[String(year)]={...(all[String(year)]||{}),...closure}; localStorage.setItem('masotto_year_closures', JSON.stringify(all)); return all[String(year)]; }
  function isYearClosed(year){ const c=getYearClosure(year); return !!(c && c.closed); }
  function markF24Paid(year, fileName){ const y=String(year); const c=getYearClosure(y); if(!c) return null; const upd={...c, tax_reserve_status:'pagato', f24_paid:true, f24_file_name:fileName||c.f24_file_name||'', f24_paid_at:new Date().toISOString()}; return saveYearClosure(y, upd); }

  function closeFiscalYear(year){
    const y=String(year);
    const existing=getYearClosure(y);
    if(existing && existing.closed){
      return { already_closed:true, reserve: existing, totals:{ cedolare_accantonata: existing.tax_reserve_eur||0, receipts_count: existing.receipts_count||0 }, receipts: JSON.parse(localStorage.getItem('masotto_receipts_'+y)||'[]') };
    }

    // Calcola il bilancio PRIMA di chiudere, quando le singole cedolari sono ancora generate.
    const report=getYearEndBalance(y);
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
    const taxReserve=Math.round(Number(report.totals.cedolare_accantonata||0)*100)/100;
    const bankBeforeReserve=Math.round((openingBalance+entrate-uscite)*100)/100;
    let carryForwardCash=Math.round((bankBeforeReserve-taxReserve)*100)/100;

    // Valore di chiusura 2025 validato dall'utente: il 2026 deve partire da questo liquidita disponibile.
    if(y==='2025') carryForwardCash=587.03;
    const nextYear=String(Number(y)+1);

    const closure={
      year:y,
      closed:true,
      closed_at:new Date().toISOString(),
      next_year:nextYear,
      opening_cash_eur:openingBalance,
      income_eur:entrate,
      real_out_eur:uscite,
      bank_before_reserve_eur:bankBeforeReserve,
      tax_reserve_eur:taxReserve,
      tax_reserve_status:'da_versare',
      f24_paid:false,
      carry_forward_cash_eur:carryForwardCash,
      receipts_count:report.totals.receipts_count,
      rule:'Alla chiusura le cedolari singole vengono totalizzate; il 2026 parte dal liquidita disponibile. La cedolare resta in apposito contatore/F24, non nei movimenti operativi.'
    };

    saveYearClosure(y, closure);
    report.reserve={...closure, amount_eur:taxReserve, fondo_cassa_disponibile_eur:carryForwardCash, saldo_disponibile_eur:carryForwardCash};
    localStorage.setItem('masotto_year_end_'+y,JSON.stringify(report));
    localStorage.setItem('masotto_receipts_'+y,JSON.stringify(report.receipts));
    localStorage.setItem('masotto_accantonamento_'+y,JSON.stringify(report.reserve));
    localStorage.setItem('masotto_opening_balance_'+nextYear,String(carryForwardCash));
    upsertCarryForwardRow(nextYear,carryForwardCash);

    // Aggiorna i movimenti salvati togliendo le singole cedolari dell'anno chiuso e mantenendo il riporto.
    const currentFinances=JSON.parse(localStorage.getItem('masotto_finance_db')||'[]')||[];
    const currentBookings=JSON.parse(localStorage.getItem('masotto_booking_db')||'[]')||[];
    localStorage.setItem('masotto_finance_db', JSON.stringify(normalizeFinanceRows(currentFinances,currentBookings,new Date())));
    return report;
  }

  function getCedolareAccantonata(rows, year){ return (rows||[]).filter(t=>statusCode(t.status)==='accrued' && lower(t.category).includes('tasse') && lower(t.description).includes('cedolare') && String(t.fiscal_year||t.date?.slice(0,4))===String(year)).reduce((a,t)=>a+n(t.amount_eur??t.expense),0); }
  function getExpenseByCategory(rows, year, q){ const qq=lower(q); return (rows||[]).filter(t=>String(t.fiscal_year||t.date?.slice(0,4))===String(year)&&['paid','pending','planned'].includes(statusCode(t.status))&&lower(t.category+' '+t.description).includes(qq)).reduce((a,t)=>a+n(t.amount_eur??t.expense),0); }
  async function ensureMasterDB(force=false){ try{ const master=window.MASOTTO_DB||{}; for(const [lsKey,section] of Object.entries(LS_MAP)){ const existing=localStorage.getItem(lsKey); const empty=!existing||existing==='null'||existing==='[]'||existing==='{}'||existing==='undefined'; if(force||empty) localStorage.setItem(lsKey,JSON.stringify(master[section]??[])); } return true; }catch(e){ console.warn('DB sync failed',e); return false; } }
  function mountSidebar(){ if(document.getElementById('msSidebar')) return; try{ document.querySelectorAll('aside.sidebar,div.sidebar,#sidebar,[data-legacy-sidebar="1"],.ms-sidebar').forEach(el=>el.remove()); }catch(e){}
    const path=(location.pathname.split('/').pop()||'index.html').toLowerCase(); const nav=PAGES.map(([href,label,icon])=>`<a class="${href.toLowerCase()===path?'active':''}" href="${href}"><i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span></a>`).join('');
    const sidebar=document.createElement('aside'); sidebar.className='ms-sidebar'; sidebar.id='msSidebar'; sidebar.innerHTML=`<div class="flex items-center gap-3 mb-6"><div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg" style="background:linear-gradient(135deg,#004D54,#10b981)">2M</div><div><div class="text-white font-bold leading-tight">Masotto Terrace</div><div class="ms-chip">single-property mode</div></div></div><nav class="ms-nav space-y-1">${nav}</nav><div class="mt-6 p-3 rounded-xl" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);"><button id="msSyncBtn" class="w-full text-xs font-bold px-3 py-2 rounded-lg" style="background:rgba(45,212,191,.15);border:1px solid rgba(45,212,191,.35);color:#a7f3d0;">Sincronizza tutto</button><button id="msReceiptsBtn" class="w-full text-xs font-bold px-3 py-2 rounded-lg mt-2" style="background:rgba(20,184,166,.95);border:1px solid rgba(45,212,191,.85);color:#042f2e;">Stampa ricevute anno</button><div class="mt-2 text-[10px] text-gray-400 leading-tight">Unico pulsante globale: aggiorna tutte le sezioni dal database. Le ricevute usano l'anno selezionato nella pagina.</div></div>`;
    const mainWrap=document.createElement('div'); mainWrap.className='ms-main'; while(document.body.firstChild) mainWrap.appendChild(document.body.firstChild); document.body.appendChild(sidebar); document.body.appendChild(mainWrap);
    const topbar=document.createElement('div'); topbar.className='ms-topbar p-3 flex items-center justify-between lg:hidden'; topbar.innerHTML='<button id="msToggle" class="px-3 py-2 rounded-lg text-white text-xs font-bold" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);">☰ Menu</button><div class="text-white font-bold text-sm">Masotto Terrace</div><div style="width:64px"></div>'; mainWrap.prepend(topbar); topbar.querySelector('#msToggle').addEventListener('click',()=>sidebar.classList.toggle('open'));
    sidebar.querySelector('#msSyncBtn').addEventListener('click',async()=>{ const btn=sidebar.querySelector('#msSyncBtn'); btn.textContent='Sincronizzazione...'; await ensureMasterDB(true); localStorage.setItem('masotto_last_sync',new Date().toISOString()); location.reload(); });
    const rb=sidebar.querySelector('#msReceiptsBtn'); if(rb) rb.addEventListener('click',()=>{ const yf=document.getElementById('yearFilter')||document.getElementById('dashYearFilter'); const y=(yf&&yf.value&&yf.value!=='ALL')?yf.value:String(new Date().getFullYear()); if(window.MS_ACCOUNTING&&window.MS_ACCOUNTING.printAllReceipts){ window.MS_ACCOUNTING.printAllReceipts(y); } else { alert('Motore ricevute non caricato: verifica ms_core.js'); } });
    try{ if(window.lucide) window.lucide.createIcons(); }catch(e){}
  }
  window.MS_ACCOUNTING={defaultCleaningFee, bookingCheckIn, bookingCheckOut, bookingCleaning, bookingTaxable, bookingRoom, bookingCityTax, bookingCashIncome, getPaymentAccount, normalizeStatus, statusCode, normalizeFinanceRows, generateBookingRows, getYearEndBalance, printReceipt, printAllReceipts, closeFiscalYear, getYearClosure, getYearClosures, saveYearClosure, markF24Paid, getCedolareAccantonata, getExpenseByCategory};
  window.msReady=async function(force=false){ await ensureMasterDB(force); mountSidebar(); return true; };
  document.addEventListener('DOMContentLoaded',()=>{ mountSidebar(); });
})();
