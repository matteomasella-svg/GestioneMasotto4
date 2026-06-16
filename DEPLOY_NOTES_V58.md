# V58 - Chiusura conto funzionante

Fix applicati:
- La riga AUTO-OPENING non viene piu eliminata dalla normalizzazione automatica.
- Il movimento di riporto cassa viene mostrato nei movimenti con importo visibile.
- Chiusura 2025 forza il fondo cassa iniziale 2026 a 587,03 EUR, valore approvato.
- Il 2026 usa 587,03 come fallback se il browser non ha ancora salvato la chiusura.
- Accantonamenti cedolare restano fuori dalla cassa disponibile.
