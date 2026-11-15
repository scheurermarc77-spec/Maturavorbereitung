# Automatischer täglicher Icon-Zähler

Die Web-App läuft auf GitHub Pages; die Push-API und der Zeitplan laufen auf Cloudflare Workers (kostenloser Tarif bei kleinem Gebrauch).

## Was umgesetzt ist
- Browser fragt die Push-Erlaubnis nach einem Klick an.
- Der Service Worker aktualisiert die Zahl auf dem Icon und zeigt eine Erinnerung an.
- Ein Cloudflare Worker speichert eine Push-Subscription pro Gerät.
- Cron läuft um 22:01 und 23:01 UTC und sendet nur, wenn es in Europe/Zurich 00:01 ist (Sommer-/Winterzeit).
- Jeder nicht bearbeitete Tag addiert 1. Nach der Korrektur eines Tagessatzes wird die Zahl 0.
- Voraussetzung: iPhone mit iOS 16.4+, Web-App auf dem Home-Bildschirm, Mitteilungen erlaubt.

## Cloudflare einmalig einrichten
1. Kostenloses Cloudflare-Konto unter https://dash.cloudflare.com/ anlegen.
2. Auf einem Computer Node.js installieren und dieses Repository herunterladen.
3. Im Unterordner push ausführen: `npm install` und `npx wrangler login`.
4. Erzeuge das VAPID-P-256-Schlüsselpaar lokal mit `node generate-keys.mjs`. Trage den **öffentlichen** Key in `wrangler.jsonc` bei `VAPID_PUBLIC_KEY` ein. Den privaten Key niemals in GitHub speichern.
5. In `wrangler.jsonc` `VAPID_SUBJECT` auf `mailto:deine-adresse@example.com` ändern.
6. Datenbank erzeugen: `npx wrangler d1 create matura-push`. Die zurückgegebene `database_id` in `wrangler.jsonc` eintragen.
7. Tabellen anlegen: `npx wrangler d1 execute matura-push --remote --file=./schema.sql`.
8. Worker veröffentlichen: `npx wrangler deploy`. Danach den privaten Schlüssel als Secret hinterlegen: `npx wrangler secret put VAPID_PRIVATE_KEY` und den generierten privaten Schlüssel einfügen. Der Worker muss die öffentlichen und privaten Schlüssel aus demselben Schlüsselpaar verwenden.
9. In der Datei `push-config.js` im Repository `apiBase` auf die echte Worker-Adresse (https://...workers.dev) setzen. Der öffentliche VAPID-Key wird beim Registrieren vom Worker abgerufen.
10. GitHub Pages für Branch main, root aktivieren. App auf dem iPhone öffnen, «Zum Home-Bildschirm» wählen und danach über das neue Icon «Push-Erinnerungen aktivieren» anklicken.

## Hinweise
- Der Worker wird erst aktiv, nachdem Cloudflare-Konto, D1 und VAPID-Schlüssel eingerichtet und er deployed wurde. GitHub allein kann keine nächtlichen Web-Pushs versenden.
- Push-Zustellung ist nicht auf die Sekunde garantiert. Die Benachrichtigung kann nach 00:01 erscheinen.
- Der Worker ist für eine kleine private Nutzerzahl gedacht.
- Mitteilungen und das App-Icon können unter iOS Einstellungen > Mitteilungen konfiguriert werden.
- Die VAPID-Private-Key-Datei bzw. der Schlüssel gehört niemals in ein öffentliches Repository.
