#!/usr/bin/env bash
# CI: Playwright Chromium ve sistem bağımlılıklarını kurar. Ağ/paket sunucusu kesintisine karşı en çok 3 deneme.
# Testleri atlamaz veya başarılı göstermez: 3 denemede de kurulamazsa çıkış kodu 1 olur ve iş kırmızı biter.
set -u
# apt paket indirmelerinde yeniden deneme (security.ubuntu.com 503 / zaman aşımı)
echo 'Acquire::Retries "5";' | sudo tee /etc/apt/apt.conf.d/80-irrigrow-retries >/dev/null
for i in 1 2 3; do
  if npx playwright install --with-deps chromium; then
    echo "Chromium kuruldu (deneme $i/3)"; exit 0
  fi
  echo "::warning::Chromium kurulumu başarısız (deneme $i/3)"
  if [ "$i" -lt 3 ]; then sleep $((i * 45)); fi
done
echo "::error::Chromium kurulumu 3 denemede de başarısız; arayüz testleri çalıştırılamadı"
exit 1
