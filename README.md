# Pannello Admin — Notte delle Maschere

Sito separato dal sito degli ospiti: nessun link tra i due. Usa lo stesso database
Supabase, quindi quello che fai qui si vede subito anche sul sito principale.

## 1) Database (una volta sola)

Nel progetto Supabase, SQL Editor:
1. Assicurati di aver già eseguito il file `supabase.sql` del sito principale.
2. Esegui **admin-supabase.sql** (in questa cartella). Aggiunge il PIN e le funzioni
   di gestione. Il PIN è protetto: nessuno può leggerlo aprendo il sito, nemmeno
   guardando il codice, perché il controllo avviene dentro il database.
3. Nello stesso file trovi la riga per cambiare il PIN:
   `update public.contest_settings set admin_pin = 'Zucca-4817' where id = true;`
   Cambia `'Zucca-4817'` con il PIN che vuoi usare (5-20 caratteri) e riesegui solo
   quella riga quando vuoi aggiornarlo.

## 2) Pubblicazione (sito separato da quello degli ospiti)

Su netlify.com crea un **nuovo sito** (non aggiungere questi file a quello esistente)
trascinando questa cartella. Netlify propone un nome a caso: cambialo in uno diverso
da quello del sito principale, ad esempio `notte-delle-maschere-admin`, dalla
scheda Site configuration > Change site name.

Il file `config.js` è già copiato da quello del sito principale, quindi punta allo
stesso progetto Supabase: non serve modificarlo.

## 3) Uso

Apri il sito admin, inserisci il PIN. Da lì puoi:
- vedere la classifica in diretta con foto;
- eliminare un'iscrizione di prova ("Elimina");
- azzerare i voti di un costume senza eliminarlo ("Azzera voti");
- chiudere il voto subito, riaprirlo, o impostare un orario di chiusura automatica
  (lo stesso meccanismo descritto nel README del sito principale).

Il PIN resta salvato solo nel tuo browser per la sessione corrente; se lo chiudi
del tutto o cambi dispositivo dovrai reinserirlo.

## Nota di sicurezza

Non condividere il link di questo sito né il PIN al di fuori degli organizzatori:
chiunque conosca entrambi può eliminare iscrizioni e chiudere il voto.
