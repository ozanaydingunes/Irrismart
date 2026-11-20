# IrriGrow Privacy Policy

> **Publishing note (not part of the published page):** before publishing, fill in only the three bracketed fields:
> `[DEVELOPER NAME]`, `[CONTACT E-MAIL]`, `[EFFECTIVE DATE]`. If the map or elevation provider changes (K-7 §4), update
> section 4. This text reflects the actual behaviour of IrriGrow 1.0.0. A legal review is recommended.
> Turkish version: `docs/gizlilik-politikasi.md`.

**Effective date:** [EFFECTIVE DATE]
**Developer:** [DEVELOPER NAME]
**Contact:** [CONTACT E-MAIL]

This policy explains what information the IrriGrow Android app and the IrriGrow web app (together, the "App") process
and how.

## 1. Summary
- No account is required. We do not ask for your name, e-mail address or phone number.
- The App contains **no** advertising, usage analytics, crash reporting or tracking tools.
- Your projects are stored **on your device** and are not sent to the developer. There is no cloud sync.
- With an internet connection, requests are made to only two external services: **Esri** for satellite imagery and
  **Open-Meteo** for elevation (see section 4).

## 2. Information stored on your device
The App keeps the following only in your device's local storage (Android app data or the browser's local storage):
- projects: project name, inputs (crop, flow rate, soil, etc.), parcel boundary coordinates, source/station points,
  pipe and shift selections, and data needed for the calculations;
- price settings, language and theme preferences;
- an equipment catalogue you may optionally load.

This information is not sent to the developer or to third parties.

**Android system backup:** if Android backup with your Google account is turned on, the Android operating system may
back up app data (including projects) to Google's backup service by itself. This is an Android feature; the developer
cannot access these backups. You can turn it off in your phone's backup settings (on most devices **Settings → System → Backup** or **Google → Backup**).

**Web app:** projects stay in your browser's local storage. Clearing browser data also deletes them.

## 3. Location
- The App (Android and web) requests and uses location permission **only when you tap the "◎" (my location) button** on the map.
- Your location is used on the device only to move the map to where you are; it is not sent to the developer, not
  stored, and never collected in the background.
- When the map moves to that area, the satellite imagery is requested from Esri as described in section 4.

## 4. Third-party services
These requests are made only with an internet connection and only when you use the related function. Connections are
encrypted with HTTPS. These services are subject to their own privacy policies.

| Service | When | Information sent | Purpose |
|---|---|---|---|
| **Esri** (World Imagery satellite tiles) | While the map screen is open | Map tile coordinates of the displayed area; as with any internet request, IP address and browser/WebView information | Showing satellite imagery on the map |
| **Open-Meteo** (Elevation API) | When you press **Apply** on a parcel | Latitude and longitude of sample points on and inside the parcel boundary (at most about 80 points); IP address and browser/WebView information | Calculating elevation and slope |

Project names, crops, flow rates, prices, costs and other project information are **not** sent to these services.

## 5. Files and sharing
- KML/KMZ and JSON backup files you open are files you choose; they are read on the device and not sent anywhere.
- PDF, Excel and DXF reports are saved on your device (on Android, in Documents/IrriGrow). Sharing a report by e-mail
  or a messaging app is entirely your choice and subject to that app's terms.

## 6. Retention and deletion
- You can delete a project in the App, or delete all data from the device by uninstalling the App.
- The developer holds no data about you on any server, so no separate deletion request is needed.
- Before deleting, you can export a JSON backup with **Projects → Back up**.

## 7. Children
The App is intended for professional users (irrigation design). It is not directed at children under 13 and does not
knowingly collect information from children.

## 8. Security
All requests to external services are encrypted with HTTPS. Protection of data on your device depends on your device's
lock-screen and encryption settings.

## 9. Your rights
For questions about your personal data or requests under the GDPR or Turkish data protection law (KVKK, Law No. 6698),
write to [CONTACT E-MAIL]. Because the developer does not store data about you, most requests concern data on your
device and can be handled within the App.

## 10. Changes
If this policy changes, the current version is published at the same address and the effective date is updated.
Significant changes are also mentioned in the App's update notes.
