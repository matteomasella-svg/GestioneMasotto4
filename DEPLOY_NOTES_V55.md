# V55 - Bilancio fine anno e ricevute

- Aggiunto caricamento ms_core.js su tutte le pagine, così i pulsanti Dashboard/Ricevute/Bilancio funzionano.
- La chiusura anno NON considera la cedolare come spesa pagata: crea uno storno interno e un contatore `masotto_accantonamento_YYYY`.
- Saldo disponibile = saldo conto lordo - accantonamento cedolare anno.
- Generazione unica ricevute anno con city tax separata e base cedolare già comprensiva delle pulizie.
- Aggiunti pulsanti in Finanze: `Ricevute anno` e `Bilancio fine anno`.
- Prenotazioni non modificate.
