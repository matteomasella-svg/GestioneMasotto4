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
  function bookingTaxable(b){ const cleaning=bookingCleaning(b); if(b.taxable_gross_eur!=null) return n(b.taxable_gross_eur); if(b.receipt_total_display_eur!=null) return n(b.receipt_total_display_eur); if(b.room_amount_eur!=null) return n(b.room_amount_eur)+cleaning; return n(b.gross_eur ?? b.price ?? 0); }
  function bookingRoom(b){ return Math.max(0, bookingTaxable(b) - bookingCleaning(b)); }
  function bookingCityTax(b){ return n(b.city_tax_eur ?? b.tax ?? b.city_tax); }
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
    if(desc.includes('accantonamento cedolare')) return 'Accantonato';
    if(cat.includes('utenze') && date && new Date(date+'T23:59:59') <= today) return 'Eseguito';
    if((tx.type==='expense'||tx.type==='Uscita'||tx.type==='income'||tx.type==='Entrata') && date && new Date(date+'T23:59:59') <= today && current!=='Accantonato') return 'Eseguito';
    return current;
  }
  function stableId(prefix, value){ let h=0; const s=String(value); for(let i=0;i<s.length;i++){ h=((h<<5)-h)+s.charCodeAt(i); h|=0; } return prefix+'-'+Math.abs(h); }
  function generateBookingRows(bookings){
    const rows=[];
    (bookings||[]).forEach(b=>{ const ci=bookingCheckIn(b); if(!ci) return; const co=bookingCheckOut(b); const guest=b.guest||'Ospite'; const bid=b.id||stableId('BK',guest+ci); const cleaning=bookingCleaning(b); const taxable=bookingTaxable(b); const city=bookingCityTax(b); const room=bookingRoom(b); const fiscalYear=String((co||ci).slice(0,4));
      rows.push({ id:`AUTO-INC-${bid}`, date:ci, description:`Ricevuta soggiorno: ${guest}`, category:'Prenotazione', type:'income', amount_eur:taxable, income:taxable, expense:0, status:'paid', payment_account:'Wise', booking_id:bid, is_auto_generated:true, fiscal_year:ci.slice(0,4), room_amount_eur:room, cleaning_fee_eur:cleaning, taxable_eur:taxable, city_tax_eur:city, receipt_rule:'soggiorno + pulizie = imponibile cedolare; city tax separata' });
      rows.push({ id:`AUTO-CLEAN-${bid}`, date:co, description:`Pulizie: ${guest}`, category:'Pulizie', type:'expense', amount_eur:cleaning, income:0, expense:cleaning, status:'paid', payment_account:'Wise', booking_id:bid, is_auto_generated:true, fiscal_year:fiscalYear });
      rows.push({ id:`AUTO-CED-${bid}`, date:co, description:`Accantonamento Cedolare Secca: ${guest} / ${fiscalYear}`, category:'Tasse', type:'accrual', amount_eur:Math.round(taxable*0.21*100)/100, income:0, expense:Math.round(taxable*0.21*100)/100, status:'accrued', payment_account:'Fondo fiscale', booking_id:bid, is_auto_generated:true, fiscal_year:fiscalYear });
      if(city>0){ rows.push({ id:`AUTO-CITY-${bid}`, date:ci, description:`Tassa soggiorno riscossa: ${guest}`, category:'Partite di giro', type:'memo', amount_eur:city, income:0, expense:0, status:'paid', payment_account:'Wise', booking_id:bid, is_auto_generated:true, fiscal_year:ci.slice(0,4), city_tax_eur:city }); }
    });
    return rows;
  }
  function monthRange(start, end){ const out=[]; let d=new Date(start+'T00:00:00'); const e=new Date(end+'T00:00:00'); while(d<=e){ out.push(d.toISOString().slice(0,7)); d.setMonth(d.getMonth()+1); } return out; }
  function generateMonthlyDefaults(finances, today=new Date()){
    const rows=[]; const months=monthRange('2025-01-01', today.toISOString().slice(0,10)); const exists=(desc, ym)=> (finances||[]).some(f=>lower(f.description||f.desc).includes(desc) && String(f.date||'').startsWith(ym));
    months.forEach(ym=>{ const date=ym+'-28'; if(!exists('internet',ym)&&!exists('fastweb',ym)) rows.push({id:'AUTO-INTERNET-'+ym,date,description:'internet Fastweb mensile',category:'Utenze',type:'expense',amount_eur:30,income:0,expense:30,status:'paid',payment_account:'Wise',is_auto_generated:true,fiscal_year:ym.slice(0,4)}); if(!exists('consumabili gestione ordinaria',ym)) rows.push({id:'AUTO-CONS-'+ym,date,description:'consumabili gestione ordinaria',category:'Gestione ordinaria',type:'expense',amount_eur:30,income:0,expense:30,status:'paid',payment_account:'Wise',is_auto_generated:true,fiscal_year:ym.slice(0,4)}); });
    return rows;
  }
  function normalizeFinanceRows(finances, bookings, today=new Date()){
    const manual=(finances||[]).filter(f=>!String(f.id||'').startsWith('AUTO-')).map(f=>{ const out={...f}; out.description=out.description||out.desc||''; out.category=out.category||out.cat||'Altro'; out.amount_eur=n(out.amount_eur ?? out.amount ?? out.expense ?? out.out); out.type=out.type || (out.category==='Entrata Extra' ? 'income':'expense'); out.status=statusCode(normalizeStatus(out,today)); out.payment_account=getPaymentAccount(out); out.fiscal_year=String(out.related_year || out.fiscal_year || (out.date||'').slice(0,4)); return out; });
    const generated=[...generateBookingRows(bookings), ...generateMonthlyDefaults(manual,today)];
    return [...manual, ...generated];
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
  window.MS_ACCOUNTING={defaultCleaningFee, bookingCheckIn, bookingCheckOut, bookingCleaning, bookingTaxable, bookingRoom, bookingCityTax, getPaymentAccount, normalizeStatus, statusCode, normalizeFinanceRows, generateBookingRows, getCedolareAccantonata, getExpenseByCategory};
  window.msReady=async function(force=false){ await ensureMasterDB(force); mountSidebar(); return true; };
  document.addEventListener('DOMContentLoaded',()=>{ mountSidebar(); });
})();
