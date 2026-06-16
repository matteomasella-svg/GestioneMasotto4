# V49 - Fix ricevute e contabilità per booking

Correzioni:
- Ricevuta con data emissione = check-in.
- Ricevuta: prezzo soggiorno + pulizie = imponibile cedolare.
- Tassa soggiorno separata, fuori imponibile.
- Finanze: righe automatiche per ogni booking senza duplicati:
  - Ricevuta soggiorno al check-in.
  - Pulizie al check-out.
  - Accantonamento cedolare per singola prenotazione al check-out.
  - Tassa soggiorno riscossa come partita di giro.
- Rimosso il vecchio accantonamento cedolare annuale aggregato che falsava i dati.
- Prenotazioni preservate.
