# V53 - Chiusura anno e ricevute massive

- Aggiunta funzione MS_ACCOUNTING.closeFiscalYear(year).
- Aggiunta funzione MS_ACCOUNTING.printAllReceipts(year): genera/stampa in una volta sola tutte le ricevute dell anno selezionato.
- Aggiunti pulsanti in dashboard: Genera tutte le ricevute e Bilancio fine anno.
- Corretta logica ricevute: gross_eur/taxable_gross_eur e la base cedolare gia comprensiva delle pulizie; city tax separata.
- Jessika de Miranda: 09/02/2026, 21 notti, base cedolare 1320, pulizie incluse 80, city tax 133, cedolare 277,20.
- Prenotazioni non rigenerate: vengono solo lette e normalizzate in memoria.
