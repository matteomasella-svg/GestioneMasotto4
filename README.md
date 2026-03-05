# 🚀 2M Apartments - Property Management System (PMS)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Status](https://img.shields.io/badge/status-Production_Ready-success.svg)
![Tech Stack](https://img.shields.io/badge/tech-HTML5%20%7C%20TailwindCSS%20%7C%20Vanilla%20JS-teal.svg)

Un'infrastruttura gestionale **bespoke (su misura)** sviluppata per l'amministrazione avanzata, finanziaria e operativa di immobili a reddito per locazioni brevi turistiche. 

Progettato originariamente per l'asset **"Masotto Terrace View"**, questo sistema supera i limiti dei tradizionali software commerciali offrendo un controllo totale su cash-flow, manutenzioni, fiscalità italiana e reportistica direzionale.

---

## ✨ Caratteristiche Principali

Il PMS è diviso in moduli interconnessi che comunicano tra loro scambiandosi dati in tempo reale:

### 📊 1. CFO Dashboard (Cruscotto Direzionale)
- **Live KPI:** Calcolo dinamico di Occupazione, ADR (Average Daily Rate) e RevPAR basato sugli effettivi giorni operativi.
- **Capital Gain Tracker:** Algoritmo che calcola in tempo reale la rivalutazione dell'immobile (+4.5% annuo) sommando i costi dei CAPEX (lavori straordinari) per restituire la Plusvalenza Netta.
- **AI Consumi Energetici:** Analisi intelligente dell'ultima bolletta caricata incrociata con l'inventario degli elettrodomestici (es. induzione, lavasciuga) con suggerimento automatico di apertura ticket (es. "pulizia filtri").
- **Generatore Ricevute Turistiche:** Motore nativo di stampa PDF che emette ricevute conformi all'Art. 10 DPR 633/72 (fuori campo IVA), scorporando in automatico la Tassa di Soggiorno di Milano (con cap a 14 giorni) e applicando la firma autografa del locatore.

### 💰 2. Modulo Finanze & P&L Fiscale
- Separazione netta tra Contabilità di Cassa (saldo reale su conto corrente) e Contabilità di Competenza (P&L aziendale).
- **Accantonamento Fiscale Automatico:** Calcola e isola la Cedolare Secca (21%) sull'imponibile di ogni singola prenotazione inserita.
- **Report PDF Manageriale:** Generazione nativa di un bilancio consuntivo formattato per la presentazione al cliente, con analisi testuale generata in base all'andamento dell'esercizio (utile vs perdita da costi di startup).

### 🔧 3. Facility & Asset Management
- **Ticketing System:** Gestione interventi di manutenzione ordinaria e straordinaria (costo lavoro vs materiali).
- **Inventory & Scorte:** Tracciamento dell'usura degli attrezzi riutilizzabili (pennelli, rulli, ecc.) con countdown degli utilizzi rimanenti.
- **Registro Asset:** Database elettrodomestici e arredi con numeri di serie, costi storici e tracciamento garanzie.

### 🗄️ 4. Vault Anagrafico & Sicurezza
- Interfaccia UI "Neon Card" per la consultazione rapida di dati catastali, POD/PDR utenze, polizze assicurative (con riepilogo coperture) e scorporo spese condominiali.
- Sezione dedicata alla conformità normativa e antincendio.

---

## 🛠️ Architettura Tecnica

Questo software è stato ingegnerizzato con un'architettura **Serverless / Client-Side**, progettata per essere ultra-veloce, sicura (i dati finanziari non lasciano mai il dispositivo) e a costo zero di hosting.

* **Frontend:** HTML5, Tailwind CSS (via CDN) per un design moderno e responsive, [Lucide Icons](https://lucide.dev/) per l'iconografia.
* **Grafici:** [Chart.js](https://www.chartjs.org/) per il rendering delle distribuzioni dei costi.
* **Motore Stampa:** Algoritmo ibrido per la generazione di report e ricevute tramite finestra di stampa nativa del browser (per massima fedeltà e bypass dei blocchi CORS sui canvas).
* **Database (JSON/JS Engine):** I dati risiedono nel file `masotto_db.js`. L'applicazione legge questo file, gestisce le operazioni CRUD (Create, Read, Update, Delete) in `localStorage` per una responsività immediata.
* **Sincronizzazione (Universal Sidebar):** Una Super-Sidebar globale permette da qualsiasi pagina di esportare il `localStorage` aggiornato in un nuovo file `.js` o di ripristinare il database allo stato pulito originale.

---

## 🚀 Installazione e Utilizzo

Nessun server Node.js, nessun database SQL da configurare. L'app è pronta all'uso in ambiente locale:

1. Clona la repository:
   ```bash
   git clone [https://github.com/TUO-USERNAME/2m-apartments-pms.git](https://github.com/TUO-USERNAME/2m-apartments-pms.git)
