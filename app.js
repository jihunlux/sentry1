(() => {
  "use strict";
  const STORAGE_KEY = "sentry-reagents-v1";
  const slides = [
    { title: '시약의 보관 환경을<br><span>더 체계적으로</span> 관리하다', description: '시약별 보관 조건과 센서 정보를 한곳에서 확인하고, 필요한 관리 항목을 놓치지 않도록 도와줍니다.' },
    { title: '시약마다 다른 조건을<br><span>맞춤형으로</span> 확인하다', description: '입력한 시약 정보를 바탕으로 확인해야 할 항목과 추가 센서 후보를 살펴보세요.' },
    { title: '센서 정보를 연결해<br><span>더 안전한 관리로</span>', description: '기본 환경 정보와 선택형 센서 모듈을 구분해 관리할 수 있도록 설계했습니다.' }
  ];
  let slideIndex = 0, slideTimer = null, toastTimer = null;
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[ch]));
  function showToast(message) {
    const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }
  function setSlide(index) {
    slideIndex = (index + slides.length) % slides.length;
    $("heroTitle").innerHTML = slides[slideIndex].title;
    $("heroDescription").textContent = slides[slideIndex].description;
    document.querySelectorAll(".dot").forEach((dot, i) => dot.classList.toggle("active", i === slideIndex));
    const foot = document.querySelector(".visual-foot span:last-child");
    if (foot) foot.textContent = `0${slideIndex + 1} / 0${slides.length}`;
    restartSlideTimer();
  }
  function restartSlideTimer() { clearInterval(slideTimer); slideTimer = setInterval(() => setSlide(slideIndex + 1), 5000); }
  $("prevSlide").addEventListener("click", () => setSlide(slideIndex - 1));
  $("nextSlide").addEventListener("click", () => setSlide(slideIndex + 1));
  document.querySelectorAll(".dot").forEach(dot => dot.addEventListener("click", () => setSlide(Number(dot.dataset.slide))));
  const visual = document.querySelector(".hero-visual"); let touchX = null;
  visual.addEventListener("touchstart", e => { touchX = e.changedTouches[0].clientX; }, { passive:true });
  visual.addEventListener("touchend", e => { if (touchX === null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 45) setSlide(slideIndex + (dx < 0 ? 1 : -1)); touchX = null; }, { passive:true });
  $("mobileMenu").addEventListener("click", () => $("topNav").classList.toggle("open"));
  // Add a stable id for the navigation lookup without requiring framework code.
  const nav = document.querySelector(".top-nav"); nav.id = "topNav";
  nav.querySelectorAll("a").forEach(a => a.addEventListener("click", () => nav.classList.remove("open")));

  function loadReagents() {
    try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }
  function saveReagents(items) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); return true; }
    catch { showToast("브라우저 저장에 실패했습니다. 저장 공간 또는 브라우저 설정을 확인해 주세요."); return false; }
  }
  function getReviewReasons(item) {
    const reasons = [];
    if (!item.formula.trim()) reasons.push("분자식 또는 화학식이 입력되지 않았습니다.");
    if (!item.formType || item.formType === "unknown") reasons.push("물질 형태를 확인해야 합니다.");
    if (!item.storage.trim()) reasons.push("실제 보관 조건을 라벨 또는 SDS로 확인해야 합니다.");
    if (item.formType === "gas") reasons.push("기체 시약은 용기와 취급 절차의 적합성을 별도로 확인해야 합니다.");
    return reasons;
  }
  function getSensorAdvice(item) {
    const advice = [];
    const text = `${item.name} ${item.formula} ${item.notes}`.toLowerCase();
    if (/빛|광분해|감광|photosens|light|peroxide|과산화수소|질산은|agno3/.test(text)) {
      advice.push({ name:"광학 센서", reason:"빛 노출 관리가 관련될 가능성이 있습니다. 실제 광민감성과 필요한 파장·노출 기준을 SDS에서 확인하세요." });
    }
    if (/휘발|기체|가스|증기|volatile|gas|nh3|hcl|cl2|so2|h2s/.test(text) || item.formType === "gas") {
      advice.push({ name:"전용 가스 센서", reason:"휘발성 또는 기체 관련 위험을 확인할 필요가 있을 수 있습니다. 대상 기체에 맞는 전용 센서인지 확인해야 합니다." });
    }
    if (/산패|식품|기름|오일|산화|rancid|oil|food/.test(text)) {
      advice.push({ name:"검증된 산화 지표 센서", reason:"식품 산패 확장을 고려할 수 있습니다. 산패 지표에 대한 직접 측정과 기준 시료 비교가 필요합니다." });
    }
    if (/전기화학|전극|이온|ph|산화환원|electrochem/.test(text)) {
      advice.push({ name:"전기화학 센서", reason:"전기화학적 측정이 적합할 가능성이 있습니다. 대상 물질, 매질, 농도 범위와 간섭을 검증해야 합니다." });
    }
    if (advice.length === 0) advice.push({ name:"추가 센서 보류", reason:"현재 입력 정보만으로 특정 추가 센서를 권장하기 어렵습니다. SDS와 목표 측정 항목을 확인한 뒤 선택하세요." });
    return advice;
  }
  function renderDashboard() {
    const items = loadReagents();
    $("totalReagents").textContent = items.length;
    const needs = items.filter(item => getReviewReasons(item).length > 0);
    $("needsReview").textContent = needs.length;
    if (!items.length) {
      $("reagentList").innerHTML = '<div class="empty-state"><span>⌕</span><b>등록된 시약이 없습니다</b><p>시약 등록 메뉴에서 첫 시약을 추가해 보세요.</p></div>';
    } else {
      $("reagentList").innerHTML = items.slice().reverse().map(item => `<div class="reagent-item"><div><b>${esc(item.name)}</b><small>${esc(item.formula || "화학식 미입력")} · ${esc({solid:"고체",liquid:"액체·용액",gas:"기체",unknown:"형태 미확인","":"형태 미선택"}[item.formType] ?? "형태 미선택")}</small></div><span class="reagent-badge">${getReviewReasons(item).length ? "확인 필요" : "정보 입력됨"}</span></div>`).join("");
    }
    if (!needs.length) {
      $("reviewList").innerHTML = '<div class="empty-state compact"><span>✓</span><b>확인할 항목이 없습니다</b><p>미입력된 기본 정보가 없습니다. 실제 보관 조건은 별도로 검증하세요.</p></div>';
    } else {
      $("reviewList").innerHTML = needs.slice(0, 5).map(item => `<div class="review-item"><span class="review-dot"></span><div><b>${esc(item.name)}</b><p>${esc(getReviewReasons(item)[0])}</p></div></div>`).join("");
    }
  }
  function renderAnalysis(item) {
    const reasons = getReviewReasons(item), advice = getSensorAdvice(item);
    const formLabel = {solid:"고체",liquid:"액체·용액",gas:"기체",unknown:"모름","":"미선택"}[item.formType] ?? "미선택";
    $("analysisPanel").innerHTML = `<div class="analysis-heading"><span class="analysis-symbol">✳</span><div><p class="eyebrow">SENTRY ANALYSIS</p><h3>입력 정보 기반 검토</h3></div></div>
      <div class="analysis-result"><h4>${esc(item.name)} ${item.formula ? `<span class="muted">· ${esc(item.formula)}</span>` : ""}</h4>
      <p>형태: ${esc(formLabel)} · 농도·순도: ${esc(item.concentration || "미입력")}</p>
      <div class="result-warning">이 결과는 입력한 텍스트를 기준으로 한 규칙 기반 안내이며, 외부 화학 데이터베이스 조회나 화학적 안정성 판정이 아닙니다.</div>
      <h4 style="margin-top:17px">확인 항목</h4>${reasons.length ? `<ul>${reasons.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>` : `<p>필수 입력 항목이 채워졌습니다. 보관 조건과 위험 정보는 제품 라벨 및 최신 SDS로 검증하세요.</p>`}
      <h4 style="margin-top:17px">추가 센서 후보</h4>${advice.map(a=>`<div style="margin:10px 0"><span class="recommendation-chip">${esc(a.name)}</span><p>${esc(a.reason)}</p></div>`).join("")}
      <h4 style="margin-top:17px">입력한 보관 조건</h4><p>${esc(item.storage || "입력되지 않음 — 라벨 또는 SDS 확인 필요")}</p>
      </div>`;
  }
  $("reagentForm").addEventListener("submit", event => {
    event.preventDefault();
    const item = {
      id: (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()),
      name: $("reagentName").value.trim(), formula: $("formula").value.trim(),
      formType: $("formType").value, concentration: $("concentration").value.trim(),
      storage: $("storage").value.trim(), notes: $("notes").value.trim(),
      createdAt: new Date().toISOString(), lastOpened: null
    };
    if (!item.name) { showToast("시약 이름을 입력해 주세요."); return; }
    const items = loadReagents(); items.push(item);
    if (!saveReagents(items)) return;
    renderDashboard(); renderAnalysis(item);
    event.target.reset();
    showToast("시약이 등록되었습니다. 분석 결과는 입력 정보 기반의 참고 안내입니다.");
  });
  renderDashboard();
  restartSlideTimer();
})();