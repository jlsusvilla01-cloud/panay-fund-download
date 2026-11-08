# Panay Fund

The Panay Fund lending management app for Windows (64-bit).

## Download

**[Download Panay Fund for Windows](https://github.com/jlsusvilla01-cloud/panay-fund-download/releases/latest/download/Panay-Fund-Setup-1.8.0.exe)** (about 85 MB)

## Install

1. Open the downloaded file.
2. If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**. The installer isn't digitally signed yet, so Windows shows this warning.
3. Open **Panay Fund** from your Desktop.
4. Sign in with your Panay Fund email and password, or click **Create an account**. The owner approves new staff accounts before they can see any records.

The app needs internet to sign in and load records. It updates itself when a new version is released.

## For maintainers

Every push to `main` that changes `desktop/` makes GitHub Actions build the installer and publish it as a release (`.github/workflows/release.yml`). The build pulls the latest Panay Fund screens from the database.
