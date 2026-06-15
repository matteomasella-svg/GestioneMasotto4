# GestioneMasotto4 V46 - Patch contabile senza sovrascrivere prenotazioni

## Vincolo assoluto
Le prenotazioni del repository sono considerate fonte autorevole. Questa patch NON modifica:
- `masotto_bookings_patch.json`
- le righe `bookings` già presenti nel database, salvo lettura/normalizzazione runtime in memoria
- date, ospiti, notti e importi booking del repo

## Logica implementata
- Ricevuta al check-in: imponibile cedolare = soggiorno + pulizie; tassa soggiorno separata.
- Check-out: genera movimenti automatici contabili collegati al booking:
  - pulizie come uscita eseguita su Wise;
  - accantonamento cedolare per singola prenotazione su Fondo fiscale;
  - tassa soggiorno come partita di giro separata, quando presente.
- Bollette/utenze scadute: normalizzate a `paid` / Eseguito.
- Accantonamento: usato solo per cedolare/fondi futuri, non per bollette scadute.
- Nuovo campo `payment_account`: Wise / Fineco / Fondo fiscale / Da verificare.
- Regole conto:
  - fino al 31/12/2025 default Wise, esclusi IMU/TARI = Da verificare;
  - dal 2026 luce/gas = Fineco;
  - internet, assicurazione, pulizie, manutenzione, consumabili = Wise;
  - condominio dal 2026 = Fineco, eccetto prima rata 2026/27 = Wise.

## File modificati
- `ms_accounting.js` nuovo motore contabile V46
- `finanze.html` usa il motore V46 e aggiunge selettore conto
- `index.html` usa la normalizzazione V46 per KPI dashboard
- `masotto_db.js` e `database_unificato.js` normalizzati per stati/conti finanziari

## Deploy
Caricare tutti i file del pacchetto nella root del repository GitHub, sovrascrivendo i file omonimi. Non caricare lo zip come file.
