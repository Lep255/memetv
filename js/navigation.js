
(() => {
  const playbackControls = document.getElementById("playbackControls");
  const playbackFields = document.createElement("div");
  playbackFields.className = "playback-fields";

  ["animeForm", "animepaheForm", "movieForm", "tvForm"].forEach(id => {
    const form = document.getElementById(id);
    if (form) playbackFields.appendChild(form);
  });

  const prevButton = document.getElementById("prevBtn");
  const nextButton = document.getElementById("nextBtn");
  const oldNavRow = prevButton?.closest(".row");
  if (oldNavRow) oldNavRow.classList.add("playback-nav");

  if (playbackControls) {
    playbackControls.appendChild(playbackFields);
    if (oldNavRow) playbackControls.appendChild(oldNavRow);
    const playerCard = document.querySelector(".player-card");
    if (playerCard) playerCard.appendChild(playbackControls);
  }

  const sidebar = document.querySelector(".control-sidebar");
  const adblockBanner = document.querySelector(".adblock-banner");
  if (sidebar && adblockBanner && sidebar.parentElement) {
    const sideColumn = document.createElement("div");
    sideColumn.className = "side-column";
    sidebar.parentElement.insertBefore(sideColumn, sidebar);
    sideColumn.appendChild(sidebar);
    sideColumn.appendChild(adblockBanner);
  }

  const menuButtons = Array.from(document.querySelectorAll(".menu-button[data-mode]"));
  const mediaMode = document.getElementById("mediaMode");
  const sidebarTitle = document.getElementById("sidebarTitle");

  const historyButton = document.getElementById("historyMenuButton");
  const historyModal = document.getElementById("historyModal");
  const closeHistory = document.getElementById("closeHistoryModal");

  const labels = {
    anime: "Anime",
    movie: "Movies",
    tv: "TV Shows"
  };

  function activateMode(mode) {
    if (!labels[mode]) return;

    menuButtons.forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    sidebarTitle.textContent = labels[mode];

    // The original application switches modes through its custom option
    // handler, which also swaps search panels, forms and server choices.
    // Route navbar clicks through that same handler to keep both UIs synced.
    const matchingOption = document.querySelector(`.custom-option[data-value="${mode}"]`);
    if (matchingOption) {
      matchingOption.click();
    } else {
      mediaMode.value = mode;
    }
  }

  menuButtons.forEach(button => {
    button.addEventListener("click", () => activateMode(button.dataset.mode));
  });

  window.addEventListener("memetv:modechange", event => {
    const mode = event.detail?.mode;
    if (!labels[mode]) return;
    if (playbackControls) playbackControls.hidden = mode === "movie";
    menuButtons.forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    sidebarTitle.textContent = labels[mode];
  });

  function openHistory() {
    historyModal.hidden = false;
    document.body.classList.add("modal-open");
    window.refreshMemeTvHistoryMetadata?.();
  }

  function closeHistoryModal() {
    historyModal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  historyButton.addEventListener("click", openHistory);
  closeHistory.addEventListener("click", closeHistoryModal);

  historyModal.addEventListener("click", event => {
    if (event.target === historyModal) closeHistoryModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !historyModal.hidden) closeHistoryModal();
  });

  const stored = localStorage.getItem("lastMode");
  activateMode(labels[stored] ? stored : "anime");
})();
