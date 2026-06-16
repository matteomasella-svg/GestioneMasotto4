# V56 - Cassa disponibile, accantonamenti e Jessika

Correzioni applicate:

- Rimosse le righe spurie `bookings airbnb` e `bookings diretta` dai movimenti finanziari.
- Eliminata la logica di `saldo lordo` come valore operativo.
- Il 2026 parte dal **fondo cassa disponibile 2025**, cioè saldo al netto della cedolare accantonata.
- Gli accantonamenti cedolare restano un contatore/debito fiscale e non sono trattati come spese pagate.
- La dashboard mostra `Fondo cassa disponibile` e non usa più il saldo prima degli accantonamenti come cassa disponibile.
- Jessika de Miranda aggiornata:
  - base cedolare: 1.320,00 euro;
  - pulizie incluse: 80,00 euro;
  - city tax separata: 133,00 euro;
  - cedolare: 277,20 euro;
  - 1.100,00 euro incassati direttamente da Riccardo;
  - impatto cassa Wise sulla base cedolare: 220,00 euro.
- Report fine anno corretto: accantonamenti e IMU/TARI non falsano la cassa operativa.

Nota operativa: dopo il deploy premere **Sincronizza tutto** per rigenerare i dati locali dal nuovo `masotto_db.js`.
