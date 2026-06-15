// ms_accounting.js - Logica contabile Masotto V46
// Non modifica, non rigenera e non sovrascrive le prenotazioni.
(function(){
  const MS_ACC = {};
  const DAY = 86400000;
  function n(v){ return Number(v || 0) || 0; }
  function round2(v){ return Math.round((n(v)+Number.EPSILON)*100)/100; }
  function parseDate(v){ if(!v) return null; const d = new Date(v + (String(v).length===10 ? 'T00:00:00' : '')); return isNaN(d) ? null : d; }
  function iso(d){ return d ? d.toISOString().slice(0,10) : ''; }
  function addDays(dateStr, days){ const d=parseDate(dateStr); if(!d) return ''; d.setDate(d.getDate()+Number(days||0)); return iso(d); }
  function fiscalYear(dateStr){ const d=parseDate(dateStr); return d ? d.getFullYear() : new Date().getFullYear(); }
  MS_ACC.getCleaningFee = function(nights){ return Number(nights||0) > 14 ? 80 : 45; };
  MS_ACC.bookingTaxableBase = function(b){
    const nights = Number(b.nights||1);
    const cleaning = n(b.cleaning_fee_eur ?? b.cleaning_eur ?? b.clean ?? 0) || MS_ACC.getCleaningFee(nights);
    const cityTax = n(b.city_tax_eur ?? b.tax ?? 0);
    const gross = n(b.gross_eur ?? b.gross_collected_eur ?? b.taxable_gross_eur ?? b.price ?? 0);
    const room = n(b.room_amount_eur ?? b.room ?? 0) || Math.max(0, gross - cityTax - cleaning);
    return round2(room + cleaning);
  };
  MS_ACC.normalizeStatus = function(tx, today=new Date()){
    const desc = String(tx.description || tx.desc || '').toLowerCase();
    const cat = String(tx.category || tx.cat || '').toLowerCase();
    const type = String(tx.type || '').toLowerCase();
    const d = parseDate(tx.date);
    if (desc.includes('accantonamento cedolare') || (type === 'accrual')) return 'pending';
    if ((cat.includes('utenze') || cat.includes('pulizie') || cat.includes('manutenzione') || cat.includes('straordinaria') || cat.includes('ordinaria')) && d && d <= today) return 'paid';
    if (type === 'income' && d && d <= today) return 'paid';
    if (type === 'expense' && d && d <= today && String(tx.status||'').toLowerCase() === 'accantonato') return 'paid';
    const st = String(tx.status || '').toLowerCase();
    if (['pagata','pagato','eseguito','paid'].includes(st)) return 'paid';
    if (['accantonato','pending','aperto','previsto','da pagare'].includes(st)) return 'pending';
    return tx.status || 'pending';
  };
  MS_ACC.getPaymentAccount = function(tx){
    const date = parseDate(tx.date);
    const desc = String(tx.description || tx.desc || '').toLowerCase();
    const cat = String(tx.category || tx.cat || '').toLowerCase();
    if (desc.includes('accantonamento cedolare')) return 'Fondo fiscale';
    if (!date) return tx.payment_account || tx.account || 'Da verificare';
    if (date <= parseDate('2025-12-31')) {
      if (desc.includes('imu') || desc.includes('tari')) return 'Da verificare';
      return 'Wise';
    }
    if (cat.includes('utenze')) {
      if (desc.includes('luce') || desc.includes('electricity') || desc.includes('gas')) return 'Fineco';
      if (desc.includes('internet') || desc.includes('fastweb')) return 'Wise';
    }
    if (cat.includes('assicur')) return 'Wise';
    if (cat.includes('pulizie')) return 'Wise';
    if (cat.includes('manutenzione') || cat.includes('straordinaria')) return 'Wise';
    if (cat.includes('consumabili') || desc.includes('gestione ordinaria')) return 'Wise';
    if (cat.includes('ordinaria') || cat.includes('condominio')) {
      if (desc.includes('prima rata 2026/27') || desc.includes('1 rata 2026/27') || desc.includes('rata fp n. 1')) return 'Wise';
      return 'Fineco';
    }
    return tx.payment_account || tx.account || 'Da verificare';
  };
  MS_ACC.normalizeFinanceRow = function(f){
    const row = Object.assign({}, f);
    row.description = row.description || row.desc || '';
    row.category = row.category || row.cat || 'Altro';
    row.amount_eur = round2(row.amount_eur !== undefined ? row.amount_eur : (row.amount || row.expense || row.income || 0));
    row.type = row.type || (row.category === 'Entrata Extra' ? 'income' : 'expense');
    row.status = MS_ACC.normalizeStatus(row);
    row.payment_account = row.payment_account || row.account || MS_ACC.getPaymentAccount(row);
    if (!row.fiscal_year && row.date) row.fiscal_year = fiscalYear(row.date);
    return row;
  };
  MS_ACC.normalizeBooking = function(b){
    const row = Object.assign({}, b);
    row.check_in = row.check_in || row.checkin || row.checkIn;
    row.nights = Number(row.nights || 1);
    row.cleaning_eur = n(row.cleaning_eur ?? row.cleaning_fee_eur ?? row.clean ?? 0) || MS_ACC.getCleaningFee(row.nights);
    row.city_tax_eur = n(row.city_tax_eur ?? row.tax ?? 0);
    row.gross_eur = n(row.gross_eur ?? row.gross_collected_eur ?? row.price ?? 0);
    row.taxable_base_eur = MS_ACC.bookingTaxableBase(row);
    row.check_out = row.check_out || row.checkout || addDays(row.check_in, row.nights);
    return row;
  };
  MS_ACC.createBookingTransactions = function(booking){
    const b = MS_ACC.normalizeBooking(booking);
    const guest = b.guest || 'Ospite';
    const fy = fiscalYear(b.check_out || b.check_in);
    const taxable = MS_ACC.bookingTaxableBase(b);
    const cedolare = round2(taxable * 0.21);
    return [
      { id:`AUTO-PUL-${b.id}`, date:b.check_out, booking_id:b.id, description:`Pulizie: ${guest}`, category:'Pulizie', type:'expense', amount_eur:b.cleaning_eur, status:'paid', payment_account:'Wise', fiscal_year:fy, is_auto_generated:true },
      { id:`AUTO-CED-${b.id}`, date:b.check_out, booking_id:b.id, description:`Accantonamento Cedolare Secca: ${guest} / ${fy}`, category:'Tasse', type:'accrual', amount_eur:cedolare, status:'pending', payment_account:'Fondo fiscale', fiscal_year:fy, is_auto_generated:true },
      ...(b.city_tax_eur>0 ? [{ id:`AUTO-TAX-${b.id}`, date:b.check_out, booking_id:b.id, description:`Tassa soggiorno da versare: ${guest}`, category:'Partite di giro', type:'expense', amount_eur:b.city_tax_eur, status:'pending', payment_account:'Wise', fiscal_year:fy, is_auto_generated:true }] : [])
    ];
  };
  MS_ACC.mergeBookingTransactions = function(finances, bookings){
    const out = (finances || []).map(MS_ACC.normalizeFinanceRow).filter(f => !String(f.id||'').startsWith('AUTO-PUL-') && !String(f.id||'').startsWith('AUTO-CED-') && !String(f.id||'').startsWith('AUTO-TAX-') && !String(f.description||'').startsWith('Pulizie:') && !String(f.description||'').startsWith('Accantonamento Cedolare Secca:'));
    const ids = new Set(out.map(f => String(f.id)));
    (bookings || []).forEach(b => MS_ACC.createBookingTransactions(b).forEach(tx => { if(!ids.has(String(tx.id))) { out.push(tx); ids.add(String(tx.id)); } }));
    return out.map(MS_ACC.normalizeFinanceRow);
  };
  MS_ACC.cedolareAccantonata = function(finances, fiscalYear){
    return (finances || []).filter(f => String(f.fiscal_year||'')===String(fiscalYear) && String(f.description||'').toLowerCase().includes('accantonamento cedolare') && f.status !== 'paid').reduce((s,f)=>s+n(f.amount_eur),0);
  };
  window.MS_ACCOUNTING = MS_ACC;
})();
