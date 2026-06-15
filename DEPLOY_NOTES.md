# GestioneMasotto4 - aggiornamento online 2026-06-15

Questo pacchetto parte dallo snapshot GitHub caricato dall'utente: `01-GestioneMasotto4-main-5-1-.zip`.

## Modifica principale

- `masotto_db.js` ora espone correttamente `window.MASOTTO_DB`.
- Sono preservate le sezioni gia presenti nel repo: `property_master`, `assets_mobile`, `supply_presets`, `finances`, `bookings`, `tickets`, `structural_assets`, `maintenance_presets`.
- Sono aggiunti/aggiornati i blocchi da 2M DB V43:
  - `utility_bills`
  - `maintenance_tickets_v43`
  - `revenue_bookings_v43`
  - righe `finances` V43 per utenze, manutenzioni e ricavi

## Deploy

Caricare/sostituire l'intero contenuto della cartella nel repository:

`https://github.com/matteomasella-svg/GestioneMasotto4.git`

Branch GitHub Pages: quello attualmente pubblicato dal repo.

Commit consigliato:

`Update Masotto online database 2026-06-15`
