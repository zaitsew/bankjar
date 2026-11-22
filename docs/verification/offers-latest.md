# Offer verification, latest weekly run

Written by `scripts/verify-weekly.sh`. History is the git log of this file. A found number is evidence for a person; this file never renews `verified_on`.

**Run 2026-11-22.** 66 offers.

| ok | mismatch | unverifiable | blocked | stale (>21 d) | expiring (<=7 d or past) |
|---|---|---|---|---|---|
| 40 | 8 | 13 | 5 | 5 | 5 |

Stale, verified_on older than 21 days:

- `ing-account-cuenta-nomina` verified_on 2026-10-22
- `ing-account-nocuenta` verified_on 2026-10-22
- `kutxabank-salary-trae-tu-nomina` verified_on 2026-10-22
- `revolut-account-standard` verified_on 2026-10-22
- `sabadell-savings-cuenta-online` verified_on 2026-10-22

valid_until within 7 days or past:

- `ing-salary-cuenta-nomina-ing400` valid_until 2026-11-20 (past)
- `kutxabank-savings-cuenta-remunerada` valid_until 2026-11-22
- `openbank-savings-cuenta-remunerada` valid_until 2026-11-16 (past)
- `openbank-welcome-200-recibos` valid_until 2026-11-16 (past)
- `sabadell-savings-cuenta-online` valid_until 2026-11-12 (past)

# Offer verifier report

Generated 2026-11-22T06:00:14.857Z. 66 offers.

> This check proves only that a number from the YAML appears on the source page. A missing number means a person must read the page: value_eur can be a derived figure (net, first-year) the page never prints. It never edits data/ and never renews verified_on.

| ok | mismatch | unverifiable | blocked |
|---|---|---|---|
| 40 | 8 | 13 | 5 |

## Mismatch: a person reads these pages (8)

- `bbva-salary-cuenta-online` (BBVA) https://www.kelisto.es/cuentas-nomina/bancos/bbva/cuenta-nomina — not found on the page: reward.value_eur=760
- `caixabank-salary-cuenta-online` (CaixaBank) https://www.caixabank.es/particular/domiciliar-nomina.html — not found on the page: commitment_months=48
- `ing-salary-cuenta-nomina-ing400` (ING) https://www.ing.es/sobre-ing/pdf/bases-legales-promo-ING400-2026-09.pdf — not found on the page: reward.value_eur=400, commitment_months=12, requirements.min_monthly_income_eur=700
- `myinvestor-deposit-premium-12-meses` (MyInvestor) https://myinvestor.es/depositos/ — not found on the page: fees.monthly_eur=7.99
- `n26-savings-cuenta-ahorro` (N26) https://n26.com/es-es/cuenta-ahorro — not found on the page: rate_tae=0.5
- `openbank-salary-trae-tu-nomina-300` (Openbank) https://www.openbank.es/assets/static/pdf/promociones/BBLL_300EUR_1_Cashback_Fondos_1026.pdf — not found on the page: reward.value_eur=300, requirements.min_monthly_income_eur=900
- `openbank-welcome-200-recibos` (Openbank) https://www.openbank.es/assets/static/pdf/promociones/Cuenta_Remunerada_Openbank.pdf — not found on the page: reward.value_eur=200, commitment_months=10
- `sabadell-savings-cuenta-online` (Banco Sabadell) https://assets.bancsabadell.com/is/content/grupbancsabadell/BBLL_BA_COS_12_meses_10_2026_INGpdf — not found on the page: rate_tae=2.75

## Blocked: no verification happened (5)

- `ing-savings-cuenta-naranja` (ING) https://www.helpmycash.com/cuentas/ing/cuenta-naranja/ — page text too short (0 characters)
- `ing-savings-cuenta-naranja-con-nomina` (ING) https://www.helpmycash.com/cuentas/ing/cuenta-naranja/ — page text too short (0 characters)
- `kutxabank-salary-trae-tu-nomina` (Kutxabank) https://portal.kutxabank.es/cs/Satellite/kb/es/particulares/trae-tu-nomina-1/pys?c=PyS&cid=1306596275876&d=Touch&hizkuntza=es&localizador=1298547039252&pagename=PortalBBK%2FPortalKutxabank%2FPyS%2FPK_PyS&sitio=PortalBBK%2FPortalKutxabank — HTTP 404
- `revolut-account-standard` (Revolut) https://www.revolut.com/es-ES/our-pricing-plans/ — HTTP 403
- `revolut-savings-cuenta-remunerada` (Revolut) https://www.revolut.com/es-ES/instant-access-savings/ — HTTP 403

## Unverifiable: the page loaded, nothing was checkable (13)

- `abanca-account-cuenta-online` (ABANCA) https://www.abanca.com/en/cuentas/cuenta-online/ — no non-zero number to check
- `b100-account-cuenta-b100` (B100) https://b100.es/es/banco/cuentas/cuenta-online/ — no non-zero number to check
- `bankinter-account-cuenta-digital` (Bankinter) https://www.kelisto.es/cuentas-nomina/bancos/bankinter/cuenta-nomina — no non-zero number to check
- `bbva-account-cuenta-online` (BBVA) https://www.kelisto.es/cuentas-nomina/bancos/bbva/cuenta-nomina — no non-zero number to check
- `caixabank-account-cuenta-online` (CaixaBank) https://www.caixabank.es/particular/domiciliar-nomina.html — no non-zero number to check
- `ing-account-nocuenta` (ING) https://www.ing.es/cuentas-ing — no non-zero number to check
- `myinvestor-account-cuenta-corriente` (MyInvestor) https://myinvestor.es/cuentas-tarjetas/tarjetas — no non-zero number to check
- `n26-account-estandar` (N26) https://n26.com/es-es/cuentas — no non-zero number to check
- `openbank-account-cuenta-nomina-open` (Openbank) https://www.openbank.es/cuenta-nomina — no non-zero number to check
- `sabadell-account-cuenta-online` (Banco Sabadell) https://www.kelisto.es/cuentas-nomina/bancos/banc-sabadell/cuenta-online-banco-sabadell — no non-zero number to check
- `santander-account-cuenta-online` (Santander) https://www.bancosantander.es/en/particulares/cuentas-bancarias/cuentas-nomina/ — no non-zero number to check
- `self-bank-welcome-fondos-1-por-ciento` (Self Bank) https://www.selfbank.es/invertir/fondos-de-inversion/promocion-consigue-hasta-5000-euros — no non-zero number to check
- `unicaja-account-cuenta-online` (Unicaja) https://www.unicajabanco.es/en/cuenta-online — no non-zero number to check

## Ok: every checkable number was found (40)

- `abanca-salary-cuenta-online` (ABANCA) https://www.abanca.com/en/cuentas/cuenta-online/ — found: reward.value_eur, commitment_months, requirements.min_monthly_income_eur
- `abanca-savings-cuenta-remunerada` (ABANCA) https://www.abanca.com/en/cuentas/cuenta-remunerada/ — found: rate_tae, requirements.min_monthly_income_eur
- `b100-savings-cuenta-health` (B100) https://b100.es/es/banco/cuentas/cuenta-ahorro-deposito/ — found: rate_tae
- `b100-savings-cuenta-save` (B100) https://b100.es/es/banco/cuentas/cuenta-ahorro-deposito/ — found: rate_tae
- `bankinter-savings-cuenta-digital` (Bankinter) https://www.rankia.com/blog/cuentas-corrientes/7544345-mejores-cuentas-remuneradas-noviembre-2026 — found: rate_tae
- `bluor-bank-deposit-raisin-12m` (BluOr Bank (via Raisin)) https://www.raisin.com/es-es/depositos-a-plazo-fijo/depositos-un-ano/ — found: rate_tae, commitment_months
- `caixabank-deposit-bonificado` (CaixaBank) https://www.caixabank.es/particular/ahorro/fixed-term-deposit.html — found: rate_tae, commitment_months
- `cajamar-account-cuenta-nomina` (Cajamar) https://www.cajamar.es/es/particulares/productos-y-servicios/cuentas/cuenta-nomina/ — found: rate_tae, requirements.min_monthly_income_eur, fees.monthly_eur
- `cajamar-deposit-online-12-meses` (Cajamar) https://www.cajamar.es/es/particulares/productos-y-servicios/ahorro-e-inversion/depositos/deposito-online/ — found: rate_tae, commitment_months
- `cajamar-salary-cuenta-nomina` (Cajamar) https://www.cajamar.es/es/particulares/productos-y-servicios/cuentas/cuenta-nomina/ — found: reward.value_eur, commitment_months, requirements.min_monthly_income_eur
- `cajamar-salary-cuenta-online-nomina-600` (Cajamar) https://www.cajamar.es/es/particulares/productos-y-servicios/cuentas/abrir-cuenta-online/ — found: reward.value_eur, commitment_months, requirements.min_monthly_income_eur
- `cajamar-savings-cuenta-online` (Cajamar) https://www.cajamar.es/es/particulares/productos-y-servicios/cuentas/abrir-cuenta-online/ — found: rate_tae
- `deutsche-bank-deposit-confianza-mas-db` (Deutsche Bank España) https://www.deutsche-bank.es/es/soluciones-db/deposito-confianza-mas.html — found: rate_tae, commitment_months
- `deutsche-bank-salary-cuenta-nomina-mas-db` (Deutsche Bank España) https://www.deutsche-bank.es/es/soluciones-db/cuenta-mas-db.html — found: reward.value_eur, commitment_months, requirements.min_monthly_income_eur
- `deutsche-bank-savings-cuenta-ahorro-mas-db` (Deutsche Bank España) https://www.deutsche-bank.es/es/soluciones-db/cuenta-mas-db.html — found: rate_tae
- `fjord-bank-deposit-raisin-12m` (Fjord Bank (via Raisin)) https://www.raisin.com/es-es/depositos-a-plazo-fijo/depositos-un-ano/ — found: rate_tae, commitment_months
- `ibercaja-salary-cuenta-nomina-vamos` (Ibercaja) https://www.ibercaja.es/particulares/cuentas-tarjetas/cuentas/cuenta-vamos/ — found: rate_tae, requirements.min_monthly_income_eur
- `ing-account-cuenta-nomina` (ING) https://www.ing.es/cuenta-nomina-ing — found: requirements.min_monthly_income_eur
- `ing-deposit-bienvenida-3-meses` (ING) https://www.ing.es/depositos-naranja — found: rate_tae, commitment_months
- `kutxabank-savings-cuenta-remunerada` (Kutxabank) https://www.rankia.com/blog/cuentas-corrientes/7544345-mejores-cuentas-remuneradas-noviembre-2026 — found: rate_tae
- `mediolanum-account-cuenta-unica` (Banco Mediolanum) https://www.bancomediolanum.es/es/w/cuentas-depositos/cuentas-corrientes/cuenta-unica — found: rate_tae, requirements.min_monthly_income_eur, fees.monthly_eur
- `mediolanum-deposit-mix-plus-12m` (Banco Mediolanum) https://www.bancomediolanum.es/es/w/cuentas-depositos/depositos/deposito-banco-mediolanum — found: rate_tae, commitment_months
- `mediolanum-savings-cuenta-freedom` (Banco Mediolanum) https://www.bancomediolanum.es/es/w/cuentas-depositos/cuentas-corrientes/cuenta-freedom — found: rate_tae, fees.monthly_eur
- `myinvestor-deposit-12-meses` (MyInvestor) https://myinvestor.es/depositos/ — found: rate_tae, commitment_months
- `myinvestor-savings-cuenta-remunerada` (MyInvestor) https://myinvestor.es/cuentas-tarjetas/cuentas — found: rate_tae
- `openbank-deposit-open-6-meses` (Openbank) https://www.openbank.es/cuenta-nomina — found: rate_tae, commitment_months, requirements.min_monthly_income_eur
- `openbank-savings-cuenta-remunerada` (Openbank) https://www.openbank.es/cuenta-ahorro — found: rate_tae
- `openbank-welcome-plan-amigo-70` (Openbank) https://www.openbank.es/plan-amigo-hasta-700-euros — found: reward.value_eur, commitment_months
- `pibank-account-cuenta-nomina` (Pibank) https://www.pibank.es/cuenta-nomina/ — found: rate_tae, requirements.min_monthly_income_eur
- `pibank-deposit-12-meses` (Pibank) https://www.pibank.es/deposito-bancario-plazo-fijo/ — found: rate_tae, commitment_months
- `pibank-savings-cuenta-remunerada` (Pibank) https://www.pibank.es/cuenta-remunerada/ — found: rate_tae
- `santander-salary-cuenta-online` (Santander) https://www.bancosantander.es/en/particulares/cuentas-bancarias/cuentas-nomina/ — found: reward.value_eur, requirements.min_monthly_income_eur
- `self-bank-deposit-12-meses` (Self Bank) https://www.selfbank.es/ahorrar/depositos/deposito-12-meses-nuevos-clientes — found: rate_tae, commitment_months
- `self-bank-savings-cuenta-ahorro-self` (Self Bank) https://www.selfbank.es/ahorrar/cuenta-ahorro-self — found: rate_tae
- `sme-bank-deposit-raisin-12m` (SME Bank (via Raisin)) https://www.raisin.com/es-es/depositos-a-plazo-fijo/depositos-un-ano/ — found: rate_tae, commitment_months
- `trade-republic-savings-cuenta-efectivo` (Trade Republic) https://www.rankia.com/blog/cuentas-corrientes/7544513-intereses-trade-republic — found: rate_tae
- `unicaja-salary-cuenta-online` (Unicaja) https://www.unicajabanco.es/en/cuenta-online — found: reward.value_eur, requirements.min_monthly_income_eur
- `unicaja-savings-cuenta-online` (Unicaja) https://www.unicajabanco.es/en/cuenta-online — found: rate_tae
- `wizink-deposit-12m` (WiZink) https://www.wizink.es/public/productos-ahorro/deposito-plazo-fijo — found: rate_tae, commitment_months
- `wizink-savings-cuenta-ahorro` (WiZink) https://www.wizink.es/public/productos-ahorro/cuenta-ahorro — found: rate_tae
