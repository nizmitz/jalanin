# Security

Report vulnerabilities privately via GitHub Security Advisories on this repository (Security
tab -> "Report a vulnerability"). Do not open public issues.

Scope: the static PWA bundle, the published container image, and CI workflows. There is no
backend, no accounts, and no user data leaves the browser except geolocation, which the app
never transmits anywhere.

Supply chain: the image is signed with cosign (keyless, GitHub OIDC), scanned with Trivy and
Semgrep, and audited with `npm audit`. All third-party GitHub Actions are pinned to commit SHAs.
