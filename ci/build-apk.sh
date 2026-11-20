#!/usr/bin/env bash
# IrriGrow — Android debug APK derleme betiği (GitLab CI 'apk' işi bunu çalıştırır).
# Yerelde de çalışır: Android SDK yoksa indirir. Gereken: node 22, JDK 21, unzip, curl.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

: "${ANDROID_HOME:=$ROOT/.android-sdk}"
export ANDROID_HOME ANDROID_SDK_ROOT="$ANDROID_HOME"
CMDLINE_TOOLS="${CMDLINE_TOOLS:-commandlinetools-linux-11076708_latest.zip}"
OUT="${APK_OUT:-$ROOT/IrriGrow-AI-debug.apk}"

if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v javac)")")")"
  export JAVA_HOME
fi
echo "JAVA_HOME=$JAVA_HOME"; java -version 2>&1 | head -1

SDKM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ ! -x "$SDKM" ]; then
  echo "Android cmdline-tools indiriliyor…"
  mkdir -p "$ANDROID_HOME/cmdline-tools"
  curl -fsSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/$CMDLINE_TOOLS"
  rm -rf "$ANDROID_HOME/cmdline-tools/latest" "$ANDROID_HOME/cmdline-tools/cmdline-tools"
  unzip -q /tmp/cmdline-tools.zip -d "$ANDROID_HOME/cmdline-tools"
  mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
fi

# Lisans onayı: 'yes' SIGPIPE ile kapanır; pipefail'i bu satır için kapat
set +o pipefail
yes | "$SDKM" --licenses > /dev/null
set -o pipefail
"$SDKM" --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" > /dev/null

npm ci
npm test
npx cap sync android

cd android
chmod +x gradlew
# Varsayılan: debug APK. K-7 AAB iş akışı GOREV=bundleRelease, CIKTI=<aab yolu> ve GRADLE_EK=<-P...> verir.
GOREV="${GOREV:-assembleDebug}"
CIKTI="${CIKTI:-app/build/outputs/apk/debug/app-debug.apk}"
# shellcheck disable=SC2086
./gradlew "$GOREV" ${GRADLE_EK:-} --no-daemon --stacktrace
test -s "$CIKTI" || { echo "HATA: $CIKTI üretilmedi"; exit 1; }
cp "$CIKTI" "$OUT"
echo "Çıktı hazır: $OUT ($(du -h "$OUT" | cut -f1))"
