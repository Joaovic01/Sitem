/* Simulador de Empréstimo — JS (sem libs)
   - Máscara BR simples (R$ e %)
   - Validação robusta
   - Cálculo de parcela fixa (PMT) com taxa mensal
   - Saída formatada em pt-BR
*/

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const form = $("#loan-form");
  const principalEl = $("#principal");
  const rateEl = $("#rate");
  const monthsEl = $("#months");
  const startEl = $("#start-date");

  const resultBox = $("#result");
  const metrics = $(".metrics");
  const placeholder = $(".placeholder");
  const errorsBox = $("#errors");

  const outInstallment = $("#out-installment");
  const outTotal = $("#out-total");
  const outInterest = $("#out-interest");

  const btnReset = $("#btn-reset");
  const yearEl = $("#year");

  // ---------- Utils ----------
  const brMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  const brNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

  function setYear() {
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  function clearErrors() {
    errorsBox.innerHTML = "";
    principalEl.removeAttribute("aria-invalid");
    rateEl.removeAttribute("aria-invalid");
    monthsEl.removeAttribute("aria-invalid");
  }

  function showErrors(items) {
    errorsBox.innerHTML = items.map((t) => `<p>${escapeHtml(t)}</p>`).join("");
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // Converte string BR (10.000,50) -> number 10000.50
  function parseBRDecimal(input) {
    const raw = String(input ?? "").trim();
    if (!raw) return NaN;

    // mantém dígitos, vírgula e ponto; remove qualquer outro caractere
    const cleaned = raw.replace(/[^\d.,-]/g, "");

    // se tiver vírgula, assume vírgula como decimal e remove pontos (milhar)
    if (cleaned.includes(",")) {
      const noThousands = cleaned.replaceAll(".", "");
      const normalized = noThousands.replace(",", ".");
      return Number(normalized);
    }

    // sem vírgula: se tiver ponto, pode ser decimal (ou milhar). assume decimal.
    return Number(cleaned);
  }

  // Formata input de moeda BR enquanto digita
  function formatCurrencyInput(el) {
    const n = parseBRDecimal(el.value);
    if (!Number.isFinite(n)) return;

    // Evita valores absurdos por erro de digitação
    const safe = clamp(n, 0, 1e12);

    el.value = brNumber.format(safe);
  }

  // Formata input de % (mantém 2 casas no máximo)
  function formatPercentInput(el) {
    const n = parseBRDecimal(el.value);
    if (!Number.isFinite(n)) return;

    const safe = clamp(n, 0, 1000);
    el.value = brNumber.format(safe);
  }

  // Cálculo PMT: parcela fixa para empréstimo amortizado com taxa periódica
  // PMT = P * i / (1 - (1+i)^-n)
  function calcInstallment(principal, monthlyRate, months) {
    if (months <= 0) return NaN;

    // taxa 0: parcela = principal / meses
    if (monthlyRate === 0) return principal / months;

    const i = monthlyRate;
    const denom = 1 - Math.pow(1 + i, -months);
    if (denom === 0) return NaN;
    return principal * (i / denom);
  }

  function showResult({ installment, totalPaid, totalInterest }) {
    placeholder.hidden = true;
    metrics.hidden = false;

    outInstallment.textContent = brMoney.format(installment);
    outTotal.textContent = brMoney.format(totalPaid);
    outInterest.textContent = brMoney.format(totalInterest);

    // move foco para resultado para leitura por leitor de tela (sem scroll agressivo)
    resultBox.focus?.();
  }

  function resetResult() {
    metrics.hidden = true;
    placeholder.hidden = false;

    outInstallment.textContent = "—";
    outTotal.textContent = "—";
    outInterest.textContent = "—";
  }

  // ---------- Validação ----------
  function validateInputs() {
    clearErrors();
    const errs = [];

    const principal = parseBRDecimal(principalEl.value);
    const ratePercent = parseBRDecimal(rateEl.value);
    const months = Number(monthsEl.value);

    if (!Number.isFinite(principal) || principal <= 0) {
      errs.push("Informe um valor de empréstimo válido (maior que zero).");
      principalEl.setAttribute("aria-invalid", "true");
    } else if (principal > 1e9) {
      errs.push("O valor do empréstimo está muito alto. Revise o número informado.");
      principalEl.setAttribute("aria-invalid", "true");
    }

    if (!Number.isFinite(ratePercent) || ratePercent < 0) {
      errs.push("Informe uma taxa de juros mensal válida (0 ou maior).");
      rateEl.setAttribute("aria-invalid", "true");
    } else if (ratePercent > 200) {
      errs.push("A taxa ao mês parece muito alta. Confirme se você informou a taxa mensal (a.m.).");
      rateEl.setAttribute("aria-invalid", "true");
    }

    if (!Number.isFinite(months) || months <= 0 || !Number.isInteger(months)) {
      errs.push("Informe um número de parcelas válido (inteiro, maior que zero).");
      monthsEl.setAttribute("aria-invalid", "true");
    } else if (months > 480) {
      errs.push("O número de parcelas está muito alto. Confirme o prazo do contrato.");
      monthsEl.setAttribute("aria-invalid", "true");
    }

    if (errs.length) {
      showErrors(errs);
      resetResult();
      return { ok: false };
    }

    return {
      ok: true,
      principal,
      ratePercent,
      months
    };
  }

  // ---------- Eventos ----------
  function bindFormatting() {
    // moeda: formata ao sair do campo (menos agressivo que em cada tecla)
    principalEl.addEventListener("blur", () => formatCurrencyInput(principalEl));

    // %: formata ao sair do campo
    rateEl.addEventListener("blur", () => formatPercentInput(rateEl));

    // acessibilidade: Enter no campo months também submete, padrão do form
    monthsEl.addEventListener("input", () => {
      // bloqueia valores negativos enquanto digita
      if (monthsEl.value && Number(monthsEl.value) < 0) monthsEl.value = "0";
    });
  }

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();

    const v = validateInputs();
    if (!v.ok) return;

    const monthlyRate = v.ratePercent / 100;
    const installment = calcInstallment(v.principal, monthlyRate, v.months);

    if (!Number.isFinite(installment) || installment <= 0) {
      showErrors(["Não foi possível calcular com os valores informados. Revise taxa e parcelas."]);
      resetResult();
      return;
    }

    const totalPaid = installment * v.months;
    const totalInterest = totalPaid - v.principal;

    clearErrors();
    showResult({
      installment,
      totalPaid,
      totalInterest
    });
  });

  btnReset.addEventListener("click", () => {
    form.reset();
    clearErrors();
    resetResult();
    principalEl.focus();
  });

  // Se quiser usar a data de início no futuro (cronograma), já valida formato aqui.
  startEl?.addEventListener("change", () => {
    // mantido simples por enquanto; campo é opcional
  });

  // ---------- Init ----------
  // garante que o box de resultado possa receber foco, sem mudar HTML
  if (resultBox && !resultBox.hasAttribute("tabindex")) {
    resultBox.setAttribute("tabindex", "-1");
  }

  resetResult();
  bindFormatting();
  setYear();
})();
