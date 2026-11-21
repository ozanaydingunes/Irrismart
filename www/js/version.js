// IrriGrow sürümü — tek kaynak (test/k6.test.js: package.json ve android/app/build.gradle ile aynı olmalı).
// Bu bir sürüm adayıdır; gerçek cihaz testleri bitmeden yayın durumu verilmez (docs/k6-cihaz-test-listesi.md).
(function (g) {
  g.IRRI_SURUM = '1.0.4';
  g.IRRI_SURUM_KODU = 16;
  if (typeof module !== 'undefined' && module.exports) module.exports = { surum: g.IRRI_SURUM, kod: g.IRRI_SURUM_KODU };
})(typeof window !== 'undefined' ? window : globalThis);
