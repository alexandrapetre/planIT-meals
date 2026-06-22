# Scenarii de test — planIT Meals (Anexa C)

Protocol de evaluare experimentală pentru raportul `RAPORT_SEMESTRUL_3.md`, secțiunea 6.2.

**Înainte de predare:** completați tabelele cu **N participanți**, timpi, scor SUS și feedback — nu lăsați secțiunea de rezultate goală sau la viitor.

## Pregătire mediu

- [ ] Backend pornit (`npm run dev:clean` în `backend/`)
- [ ] Frontend pornit (`npm start` în `frontend/`)
- [ ] Node >= 18 (`nvm use`)
- [ ] Health check: `GET /api/health` → 200

---

## Autentificare (T1, T9, T10)

| # | Acțiune | Rezultat așteptat | OK |
|---|---------|-------------------|-----|
| 1 | Register cu date valide | 201, token, redirect `/` | |
| 2 | Register email duplicat | 400, mesaj clar | |
| 3 | Login credențiale greșite | 401 | |
| 4 | Refresh pagină cu token valid | Sesiune păstrată | |
| 5 | Request fără token la `/api/meal-plans` | 401 | |

---

## Profil (T2)

| # | Acțiune | Rezultat așteptat | OK |
|---|---------|-------------------|-----|
| 1 | Setează vegan + alergie ouă | Salvare reușită | |
| 2 | Regenerare plan | Nicio rețetă cu ou/carne/lactate (filtru hard) | |
| 3 | Obiectiv 1500 kcal | Planul tinde spre ~1500 kcal/zi (sumă sloturi) | |

---

## Plan alimentar (T3, T4)

| # | Acțiune | Rezultat așteptat | OK |
|---|---------|-------------------|-----|
| 1 | Generate 7 zile | 201, plan cu 7 zile | |
| 2 | Fiecare zi are breakfast/lunch/dinner | 3 mese/zi (când pool suficient) | |
| 3 | Deschide shopping list | Items cu missing > 0 | |
| 4 | Șterge plan | Plan dispare din listă | |
| 5 | Generate fără rețete în DB | 400 mesaj „No recipes match…” | |

---

## Frigider (T5)

| # | Acțiune | Rezultat așteptat | OK |
|---|---------|-------------------|-----|
| 1 | Adaugă 3 produse | Apar în listă | |
| 2 | Adaugă același produs din nou | Cantitate incrementată | |
| 3 | Get suggestions | Listă sortată după match % | |
| 4 | Suggestions fără produse | Buton dezactivat / listă goală | |

---

## Tracking (T6)

| # | Acțiune | Rezultat așteptat | OK |
|---|---------|-------------------|-----|
| 1 | Adaugă masă din rețetă | Log creat, calorii în total | |
| 2 | Schimbă ziua (±) | Logs pentru data selectată | |
| 3 | Șterge log | Total actualizat | |

---

## Rețete (T7)

| # | Acțiune | Rezultat așteptat | OK |
|---|---------|-------------------|-----|
| 1 | Creează rețetă proprie | Apare cu source user | |
| 2 | Editează rețetă proprie | Modificări salvate | |
| 3 | Încearcă ștergere rețetă seed | 403 sau indisponibil în UI | |
| 4 | Filtru categorie | Doar rețete din categorie | |
| 5 | Căutare titlu | Rezultate filtrate | |

---

## i18n (T8)

| # | Acțiune | Rezultat așteptat | OK |
|---|---------|-------------------|-----|
| 1 | Comută RO → EN | Etichete în engleză | |
| 2 | Comută EN → RO | Etichete în română | |

---

## Task-uri usability (participanți)

**U1 — Onboarding** (~3 min)  
*„Creează cont și setează 1800 kcal.”*  
Timp: _____ | Erori: _____ | Notă 1–5: _____

**U2 — Plan** (~2 min)  
*„Generează plan 5 zile.”*  
Timp: _____ | Succes Da/Nu: _____

**U3 — Frigider** (~4 min)  
*„Adaugă 3 ingrediente și găsește o rețetă potrivită.”*  
Timp: _____ | Notă 1–5: _____

**U4 — Tracking** (~2 min)  
*„Înregistrează prânzul de azi.”*  
Timp: _____ | Succes Da/Nu: _____

### SUS (System Usability Scale) — 10 itemi standard

După task-uri, participantul completează chestionarul SUS (tradus RO dacă e cazul). Scor 0–100: medie × 2.5.

---

## Raportare bug

Pentru fiecare eșec, notați:
- URL / endpoint
- Pași de reproducere
- Mesaj eroare (Network → Response)
- Captură ecran (opțional)
