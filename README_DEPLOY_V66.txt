GESTIONEMASOTTO4 - NETLIFY UPDATE V66
Data: 20/08/2026

Questo è un PACCHETTO DI AGGIORNAMENTO, non il sito completo.

Contiene i file aggiornati:
- masotto_db.js
- masotto_bookings_patch.json
- masotto_assets.json
- masotto_condominio.json

COME PREPARARE IL DEPLOY COMPLETO:
1. Da GitHub scarica il repository GestioneMasotto4 con Code > Download ZIP.
2. Decomprimi GestioneMasotto4-main.zip.
3. Copia i 4 file di questo pacchetto nella cartella GestioneMasotto4-main.
4. Quando richiesto, scegli SOSTITUISCI i file esistenti.
5. Verifica che index.html sia direttamente nella stessa cartella di masotto_db.js.
6. Su Netlify apri il progetto gestionemasotto4 > Deploys.
7. Trascina la CARTELLA GestioneMasotto4-main nell'area di deploy manuale.
8. Attendi stato Published/Ready.

Il loader V66 legge:
- database_unificato.js come database storico
- masotto_bookings_patch.json per prenotazioni e nuove spese
- masotto_assets.json per gli asset aggiornati

Nota: masotto_condominio.json è aggiornato e incluso nel pacchetto, ma l'interfaccia attuale potrebbe mostrare ancora elementi condominiali hardcoded in anagrafica.html finché quella pagina non viene resa dinamica.
