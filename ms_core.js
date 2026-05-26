/* Masotto Core-AI: DB sync, Sidebar Unificata e Automazioni */
(function(){
  const PAGES = [
    ["index.html", "Dashboard", "layout-dashboard"],
    ["anagrafica.html", "Anagrafica", "id-card"],
    ["asset.html", "Asset", "boxes"],
    ["audit.html", "Audit", "clipboard-check"],
    ["manutenzione.html", "Manutenzione", "wrench"],
    ["prenotazioni.html", "Prenotazioni", "calendar"],
    ["finanze.html", "Finanze", "pie-chart"],
    ["conto.html", "Conto", "wallet"],
    ["consuntivo_25.html", "Consuntivo 2025", "file-text"],
    ["sicurezza.html", "Sicurezza", "shield"]
  ];

  async function ensureMasterDB(force=false){
    let master = null;
    try {
      if (window.MASOTTO_DB) master = window.MASOTTO_DB;
      if (!master) {
        const res = await fetch(`masotto_complete_database.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('fetch failed');
        master = await res.json();
      }

      const map = {
        masotto_prop_data: 'property_master',
        masotto_assets_mobile_db: 'assets_mobile',
        masotto_structural_assets_db: 'structural_assets',
        masotto_finance_db: 'finances',
        masotto_booking_db: 'bookings',
        masotto_maint_db: 'tickets',
        masotto_insurance_db: 'insurance',
        masotto_utilities_db: 'utilities',
        masotto_contacts_db: 'contacts',
        masotto_maintenance_presets_db: 'maintenance_presets',
        masotto_supply_presets_db: 'supply_presets'
      };

      for (const [lsKey, section] of Object.entries(map)) {
        const existing = localStorage.getItem(lsKey);
        const isEmpty = !existing || existing === 'null' || existing === '[]' || existing === '{}';
        if (force || isEmpty) {
          localStorage.setItem(lsKey, JSON.stringify(master[section] ?? []));
        }
      }
      return true;
    } catch (e) {
      console.warn('DB sync failed', e);
      return false;
    }
  }

  function mountSidebar(){
    if (document.getElementById('msSidebar')) return;
    try { document.querySelectorAll('aside.sidebar, div.sidebar, #sidebar, [data-legacy-sidebar="1"], .ms-sidebar').forEach(el => el.remove()); } catch(e) {}

    const path = (location.pathname.split('/').pop() || 'index.html');
    const nav = PAGES.map(([href,label,icon]) => {
      const active = (href.toLowerCase() === path.toLowerCase()) ? 'active' : '';
      return `<a class="${active}" href="${href}"><i data-lucide="${icon}" class="w-4 h-4"></i><span>${label}</span></a>`;
    }).join('');

    const sidebar = document.createElement('aside');
    sidebar.className = 'ms-sidebar';
    sidebar.id = 'msSidebar';
    sidebar.innerHTML = `
      <div class="flex items-center gap-3 mb-6">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg" style="background:linear-gradient(135deg,#004D54,#10b981)">2M</div>
        <div><div class="text-white font-bold leading-tight">Masotto Terrace</div><div class="ms-chip">single-property mode</div></div>
      </div>
      <nav class="ms-nav space-y-1">${nav}</nav>
      <div class="mt-6 p-3 rounded-xl" style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);">
        <button id="msSyncBtn" class="w-full text-xs font-bold px-3 py-2 rounded-lg" style="background:rgba(45,212,191,.15);border:1px solid rgba(45,212,191,.35);color:#a7f3d0;">Sincronizza Dati</button>
      </div>`;

    const mainWrap = document.createElement('div');
    mainWrap.className = 'ms-main';
    while (document.body.firstChild) mainWrap.appendChild(document.body.firstChild);
    document.body.appendChild(sidebar);
    document.body.appendChild(mainWrap);

    const topbar = document.createElement('div');
    topbar.className = 'ms-topbar p-3 flex items-center justify-between lg:hidden';
    topbar.innerHTML = `<button id="msToggle" class="px-3 py-2 rounded-lg text-white text-xs font-bold" style="background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);">☰ Menu</button><div class="text-white font-bold text-sm">Masotto Terrace</div><div style="width:64px"></div>`;
    mainWrap.prepend(topbar);
    topbar.querySelector('#msToggle').addEventListener('click', () => sidebar.classList.toggle('open'));

    sidebar.querySelector('#msSyncBtn').addEventListener('click', async () => {
      sidebar.querySelector('#msSyncBtn').textContent = 'Syncing…';
      await ensureMasterDB(true);
      location.reload();
    });

    try { if (window.lucide) window.lucide.createIcons(); } catch(e) {}
  }

  window.msReady = async function(force=false){
    await ensureMasterDB(force);
    mountSidebar();
    return true;
  };
})();