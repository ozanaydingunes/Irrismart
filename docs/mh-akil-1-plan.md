
## 12. Uygulama notları (MH-AKIL-1 PR'ı)

- **Modüller:** `www/js/assess.js` (değerlendirme), `www/js/assess-view.js` (Sonuç ekranı kartları).
  Sonuç, Hidrolik, PDF ve Excel aynı çağrıyı kullanır: `IrriAssess.forProject(proje, sonuç)`.
- **Kodlar:** Plandaki listeye ek olarak motorun mevcut uyarıları için `W-KAP-03` (shift debisi >
  kaynak), `W-LAT-02` (lateral ΔH), `W-MAN-01` (manifold basınç değişimi), `W-PN-03` (manifold PN),
  `W-POM-03` (hidrant basıncı az farkla yetersiz), `W-FLT-01`, `W-VAN-01` kodları verildi. Eşikler
  motorun ve MH-1 panelinin eşikleridir.
- **Çözüm durumu `varsayimla-yetersiz`** (“Bu varsayımlarla yetersiz”) sulama aralığı için eklendi
  (§6.3 kural 2). Varsayımlar her seçeneğin altında yazılır.
- **Seviye uyumu:** Hidrolik paneldeki her uyarı kontrolü Sonuç ekranında aynı kod ve seviyede
  görünür (temsili pompa ve eksik filtre kaydı her iki yerde “uyarı”).
- **“Hesaplandı – uygun”** yalnız motorun hesapladığı shift ve ana hat çapı alternatiflerinde
  kullanılır ve her zaman “Kontrol edilenler: …” kapsam notuyla (ekran, PDF ve Excel) birlikte yazılır;
  su darbesi bu alternatifler için ayrıca hesaplanmadığı belirtilir.
- **Kullanıcı kararı:** Kullanıcı kararı yok / İnceleniyor / Bilinerek kabul edildi / Çözülmesi
  gerekiyor. `proje.akil.onay[kod]` alanında saklanır; uyarının seviyesini değiştirmez.
- **Planlama oranı:** Veriler → Proje ayarları; `proje.akil.planOrani` (motor girdisi `inp` dışında).
- **Yedekleme:** Uygulamanın JSON yedekleme/geri yükleme mantığı davranış değişmeden
  `IrriStore.backupPayload / readBackup / mergeBackup` fonksiyonlarına taşındı; testler bu
  fonksiyonları kullanır.
- **Altın kayıt:** Excel'e “Uyarılar” sayfası eklendiği için kayıt yenilendi. Motor sonuçları ve
  diğer çıktılar MH-0 ile aynı; ayrıntı `docs/hesap-degisiklik-kaydi.md`.
