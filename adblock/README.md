# reklam siken 🛡️

Spotify için reklam engelleme eklentisi. Ses, banner, leaderboard ve sponsorlu içerik reklamlarını devre dışı bırakır.

![reklam siken](buraksakin.png)

## Özellikler

- 🔇 **Ses reklamlarını engeller** — Şarkılar arasındaki reklam seslerini kapatır
- 🚫 **Banner reklamları gizler** — Arayüzdeki görsel reklamları kaldırır
- 🎯 **Sponsorlu içerikleri kaldırır** — Sponsorlu çalma listelerini ve önerileri engeller
- 💎 **Premium özellik taklidi** — Mini player, akıllı karıştırma gibi özellikleri açar
- ⚡ **Otomatik güncelleme** — Reklam slot ayarlarını periyodik olarak yeniler

## Kurulum

### Spicetify CLI ile (Manuel)

1. `reklam-siken.js` dosyasını indirin
2. Dosyayı Spicetify Extensions klasörüne kopyalayın:
   ```
   %appdata%\spicetify\Extensions\
   ```
3. Terminalde çalıştırın:
   ```powershell
   spicetify config extensions reklam-siken.js
   spicetify apply
   ```

## Kaldırma

```powershell
spicetify config extensions reklam-siken.js-
spicetify apply
```

## Uyumluluk

- Spotify Desktop `1.2.82+`
- Spicetify CLI `2.x`

## Uyarı

⚠️ Bu eklenti Spotify'ın Hizmet Şartlarını ihlal edebilir. Kendi riskinizle kullanın.

## Lisans

MIT
