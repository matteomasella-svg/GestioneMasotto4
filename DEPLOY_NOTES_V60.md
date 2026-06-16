# V60 - Chiusura anno reale

Correzione strutturale della chiusura anno:

- Il pulsante chiusura anno è eseguibile una sola volta.
- Le cedolari delle singole prenotazioni vengono totalizzate in un record di chiusura annuale.
- Dopo la chiusura, le singole righe di accantonamento cedolare non restano nei movimenti operativi.
- Il fondo cassa dell'anno successivo viene salvato in `masotto_year_closures` e in `masotto_opening_balance_YYYY`.
- Per il caso Masotto 2025, il fondo cassa riportato al 2026 resta 587,03 euro.
- La sezione Finanze mostra la casella accantonamento cedolare annuale con funzione per segnare/caricare F24 pagato.
- Il movimento `AUTO-OPENING-YYYY` non viene cancellato da Sincronizza tutto.
- Dashboard e Finanze usano la stessa funzione `MS_ACCOUNTING.closeFiscalYear()`.

Regola implementata:

Chiusura anno = fondo iniziale + entrate su conto - uscite reali su conto - cedolare annuale totalizzata.

Apertura anno successivo = fondo cassa disponibile salvato dalla chiusura dell'anno precedente.
