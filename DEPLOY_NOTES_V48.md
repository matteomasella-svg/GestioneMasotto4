# V48 - Fix caricamento Finanze

- Corretto caricamento di `finanze.html`: ora `ms_core.js` viene caricato prima del motore finanze.
- Se `localStorage` è vuoto o corrotto, le finanze vengono ripristinate da `masotto_db.js`.
- Le prenotazioni del repo restano immutate: nessuna sovrascrittura.
- Le righe automatiche pulizie/cedolare vengono calcolate in finanze partendo dai booking esistenti.
