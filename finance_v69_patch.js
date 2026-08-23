/* Masotto Finance UI V69: incasso manuale, forecast separato, Airbnb platform tax handling */
(function(){
  'use strict';
  function n(v){ var x=Number(v); return Number.isFinite(x)?x:0; }
  function lower(v){ return String(v||'').toLowerCase(); }
  function status(v){
    var s=lower(v);
    if(['paid','pagata','pagato','done','executed','eseguito'].includes(s)) return 'paid';
    if(['accrued','accantonato'].includes(s)) return 'accrued';
    if(['pending','open','aperto'].includes(s)) return 'pending';
    return 'planned';
  }
  function readRows(){ try{return JSON.parse(localStorage.getItem('masotto_finance_db')||'[]')||[];}catch(e){return [];} }
  function readBookings(){ try{return JSON.parse(localStorage.getItem('masotto_booking_db')||'[]')||[];}catch(e){return [];} }
  function writeRows(rows){ localStorage.setItem('masotto_finance_db',JSON.stringify(rows)); }
  function uiRows(filterYear){
    return readRows().filter(function(f){
      var fy=String(f.fiscal_year||f.related_year||(f.date||'').slice(0,4));
      return filterYear==='ALL'||fy===String(filterYear);
    }).map(function(f){
      var type=lower(f.type||'expense');
      var amount=Math.abs(n(f.amount_eur!=null?f.amount_eur:(f.income!=null?f.income:f.expense)));
      return Object.assign({},f,{type:type,amount:amount,status:status(f.status),description:f.description||f.desc||'',category:f.category||f.cat||'Altro'});
    }).sort(function(a,b){return new Date(b.date||'1900-01-01')-new Date(a.date||'1900-01-01');});
  }
  function markStatus(id,next){
    var rows=readRows();
    var idx=rows.findIndex(function(x){return String(x.id)===String(id);});
    if(idx<0) return false;
    rows[idx]=Object.assign({},rows[idx],{status:next,user_confirmed_status:true,status_changed_at:new Date().toISOString()});
    var saved=rows[idx];
    writeRows(rows);
    if(window.MS_MASTER_SYNC&&typeof window.MS_MASTER_SYNC.save==='function'){
      window.MS_MASTER_SYNC.save('finance.upsert',saved);
    }
    return true;
  }
  function confirmIncome(e,id){
    if(e) e.stopPropagation();
    if(!window.MS_ACCOUNTING||typeof window.MS_ACCOUNTING.confirmBookingCollection!=='function'){
      alert('Motore incassi non disponibile.'); return;
    }
    var result=window.MS_ACCOUNTING.confirmBookingCollection(id);
    if(!result||!result.ok){ alert((result&&result.error)||'Impossibile confermare incasso.'); return; }
    if(typeof window.loadDB==='function') window.loadDB(); else location.reload();
  }
  function togglePaid(e,id){
    if(e) e.stopPropagation();
    var row=readRows().find(function(x){return String(x.id)===String(id);});
    if(!row) return;
    var next=status(row.status)==='paid'?'pending':'paid';
    markStatus(id,next);
    if(typeof window.loadDB==='function') window.loadDB(); else location.reload();
  }
  function unified(filterYear){
    return uiRows(filterYear).map(function(f){
      var isIncome=f.type==='income'||n(f.income)>0;
      var isMemo=f.type==='memo';
      var isAccrual=f.type==='accrual'||lower(f.description).includes('accantonamento cedolare');
      return {
        type:isIncome?'income':(isMemo?'memo':(isAccrual?'accrual':'expense')),
        id:f.id,date:f.date,desc:f.description,cat:f.category,
        inc:isIncome?f.amount:0,out:(!isIncome&&!isMemo)?f.amount:0,memo_amount:isMemo?f.amount:0,
        status:f.status,related_year:f.related_year,payment_account:f.payment_account,
        booking_id:f.booking_id,forecast_only:!!f.forecast_only,platform_handled:!!f.platform_handled,
        exclude_from_pnl:!!f.exclude_from_pnl,exclude_from_cash:!!f.exclude_from_cash,
        user_confirmed_status:!!f.user_confirmed_status
      };
    });
  }
  function render(){
    var yf=document.getElementById('yearFilter');
    var filterYear=yf?yf.value:'ALL';
    var grid=document.getElementById('fin-grid');
    if(!grid) return;
    var txs=unified(filterYear);
    grid.innerHTML='';
    var actualIn=0,actualOut=0,actualPnlCost=0,reserve=0,forecastIn=0,forecastOut=0;
    if(!txs.length) grid.innerHTML='<div class="exp-card"><div><div class="font-bold text-white">Nessun movimento caricato</div></div></div>';
    txs.forEach(function(t){
      var paid=t.status==='paid',planned=t.status==='planned',accrued=t.status==='accrued';
      var dateFormatted=t.date?String(t.date).split('-').reverse().join('/'):'N/D';
      var catStyle=typeof window.getCatStyle==='function'?window.getCatStyle(t.cat):'badge-cat';
      var safeId=JSON.stringify(t.id);
      if(t.type==='income'){
        if(paid) actualIn+=t.inc; else forecastIn+=t.inc;
        var cardClass=paid?'exp-income':'exp-pending';
        var amountClass=paid?'text-emerald-400':'text-amber-300';
        var button=paid
          ? '<span class="btn-status" style="border-color:#10b981;color:#34d399;background:rgba(16,185,129,.1)">Incassata</span>'
          : '<button onclick="confirmBookingIncomeV69(event,'+safeId+')" class="btn-status btn-pay">Incassata</button>';
        var sub=paid?'Movimento reale':'Importo previsto - non entra nella cassa';
        grid.innerHTML+='<div class="exp-card '+cardClass+'"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="'+catStyle+'">'+t.cat+'</span><span class="text-xs text-gray-400 font-mono">'+dateFormatted+'</span></div><div class="font-bold text-white text-lg">'+t.desc+'</div><div class="text-[10px] text-gray-400 mt-1">'+sub+'</div></div><div class="flex flex-col items-end gap-2"><div class="font-mono font-bold text-xl '+amountClass+'">+ € '+t.inc.toFixed(2)+'</div>'+button+'</div></div>';
        return;
      }
      if(t.type==='memo'){
        var label='Informativo';
        if(t.platform_handled&&lower(t.desc).includes('cedolare')) label='Trattenuta Airbnb';
        else if(t.platform_handled&&lower(t.desc).includes('tassa soggiorno')) label='Gestita Airbnb';
        grid.innerHTML+='<div class="exp-card"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="'+catStyle+'">'+t.cat+'</span><span class="text-xs text-gray-400 font-mono">'+dateFormatted+'</span></div><div class="font-bold text-white text-lg">'+t.desc+'</div></div><div class="flex flex-col items-end gap-2"><div class="font-mono font-bold text-xl text-blue-300">€ '+Number(t.memo_amount||0).toFixed(2)+'</div><span class="text-[10px] text-blue-300">'+label+'</span></div></div>';
        return;
      }
      if(t.type==='accrual'){
        if(accrued) reserve+=t.out; else forecastOut+=t.out;
        var alabel=accrued?'Accantonato':'Preventivo';
        grid.innerHTML+='<div class="exp-card exp-pending"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="'+catStyle+'">'+t.cat+'</span><span class="text-xs text-gray-400 font-mono">'+dateFormatted+'</span></div><div class="font-bold text-white text-lg">'+t.desc+'</div></div><div class="flex flex-col items-end gap-2"><div class="font-mono font-bold text-xl text-yellow-400">€ '+t.out.toFixed(2)+'</div><span class="btn-status btn-pay">'+alabel+'</span></div></div>';
        return;
      }
      var noContoTax=t.cat==='Tasse'&&(lower(t.desc).includes('imu')||lower(t.desc).includes('tari'));
      if(paid){ actualOut+=t.out; if(!t.exclude_from_pnl&&!noContoTax) actualPnlCost+=t.out; }
      else forecastOut+=t.out;
      var eCard=paid?'exp-paid':'exp-pending';
      var eButton=paid
        ? '<button onclick="toggleFinanceStatusV69(event,'+safeId+')" class="btn-status btn-paid">Pagato</button>'
        : (planned?'<span class="btn-status btn-pay">Preventivo</span>':'<button onclick="toggleFinanceStatusV69(event,'+safeId+')" class="btn-status btn-pay">Da pagare</button>');
      var esub=paid?'Uscita reale':(planned?'Solo previsione':'Obbligo attivato, non ancora pagato');
      grid.innerHTML+='<div class="exp-card '+eCard+'"><div class="flex-1"><div class="flex items-center gap-2 mb-1"><span class="'+catStyle+'">'+t.cat+'</span><span class="text-xs text-gray-400 font-mono">'+dateFormatted+'</span></div><div class="font-bold text-white text-lg">'+t.desc+'</div><div class="text-[10px] text-gray-400 mt-1">'+esub+'</div></div><div class="flex flex-col items-end gap-2"><div class="font-mono font-bold text-xl text-red-400">- € '+t.out.toFixed(2)+'</div>'+eButton+'</div></div>';
    });
    var elIn=document.getElementById('kpi-in'),elOut=document.getElementById('kpi-out'),elPending=document.getElementById('kpi-pending'),elPl=document.getElementById('kpi-pl');
    if(elIn) elIn.innerText='€ '+actualIn.toLocaleString('it-IT',{minimumFractionDigits:0});
    if(elOut) elOut.innerText='€ '+actualOut.toLocaleString('it-IT',{minimumFractionDigits:0});
    if(elPending) elPending.innerText='€ '+(reserve+forecastOut+forecastIn).toLocaleString('it-IT',{minimumFractionDigits:0});
    var pnl=actualIn-actualPnlCost;
    if(elPl){ elPl.innerText='€ '+pnl.toLocaleString('it-IT',{minimumFractionDigits:0}); elPl.className='text-2xl font-bold font-mono '+(pnl>=0?'text-white':'text-red-400'); }
    var startBal=0;
    if(filterYear!=='ALL'&&typeof window.getOpeningBalance==='function') startBal=n(window.getOpeningBalance(filterYear));
    var saldo=startBal+actualIn-actualOut-reserve;
    var saldoEl=document.getElementById('box-saldo-conto'); if(saldoEl) saldoEl.innerText='€ '+saldo.toLocaleString('it-IT',{minimumFractionDigits:2});
    var summary=document.getElementById('bank-summary-content');
    if(summary){
      summary.innerHTML=filterYear==='ALL'?'<div class="text-sm text-gray-400">Seleziona un anno specifico per il saldo.</div>':'<div class="bank-data-row"><span class="bank-lbl text-emerald-400">Incassi reali (+)</span><span class="bank-val text-emerald-400">+ € '+actualIn.toFixed(2)+'</span></div><div class="bank-data-row"><span class="bank-lbl text-red-400">Uscite reali (-)</span><span class="bank-val text-red-400">- € '+actualOut.toFixed(2)+'</span></div><div class="bank-data-row"><span class="bank-lbl text-yellow-400">Cedolare locale accantonata</span><span class="bank-val text-yellow-400">€ '+reserve.toFixed(2)+'</span></div><div class="bank-data-row"><span class="bank-lbl text-amber-300">Previsioni non realizzate</span><span class="bank-val text-amber-300">€ '+(forecastIn+forecastOut).toFixed(2)+'</span></div><div class="bank-data-row"><span class="bank-lbl text-blue-300">Liquidità disponibile</span><span class="bank-val text-blue-300">€ '+saldo.toFixed(2)+'</span></div>';
    }
    try{ if(typeof window.renderCharts==='function') window.renderCharts(txs.filter(function(t){return t.type==='expense'&&t.status==='paid'&&!t.exclude_from_pnl;})); }catch(e){}
    try{ if(window.lucide) window.lucide.createIcons(); }catch(e){}
  }
  function install(){
    if(!document.getElementById('fin-grid')||window.__MASOTTO_FINANCE_UI_V69__) return;
    window.__MASOTTO_FINANCE_UI_V69__=true;
    window.confirmBookingIncomeV69=confirmIncome;
    window.toggleFinanceStatusV69=togglePaid;
    window.getUnifiedMovements=unified;
    window.renderBoard=render;
    var bookings=readBookings();
    var changed=false;
    bookings=bookings.map(function(b){
      if(lower(b.status)==='in_house' && b.payment_confirmed==null && !b.collection_status){ changed=true; return Object.assign({},b,{payment_confirmed:false,collection_status:'pending'}); }
      return b;
    });
    if(changed){ localStorage.setItem('masotto_booking_db',JSON.stringify(bookings)); }
    if(window.MS_ACCOUNTING&&typeof window.MS_ACCOUNTING.normalizeFinanceRows==='function'){
      var normalized=window.MS_ACCOUNTING.normalizeFinanceRows(readRows(),bookings,new Date());
      writeRows(normalized);
    }
    setTimeout(render,50);
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(install,80);});
  if(document.readyState!=='loading') setTimeout(install,80);
})();
