(() => {
  const button = document.getElementById("exploreMenuButton");
  const view = document.getElementById("exploreView");
  const appGrid = document.querySelector(".app-grid");
  const grid = document.getElementById("exploreGrid");
  const scroll = document.getElementById("exploreScroll");
  const sentinel = document.getElementById("exploreSentinel");
  const loading = document.getElementById("exploreLoading");
  const cue = document.getElementById("exploreScrollCue");
  const count = document.getElementById("exploreResultCount");
  const media = document.getElementById("exploreMedia");
  const region = document.getElementById("exploreRegion");
  const year = document.getElementById("exploreYear");
  const genre = document.getElementById("exploreGenre");
  const sort = document.getElementById("exploreSort");
  const rating = document.getElementById("exploreRating");
  const modal = document.getElementById("exploreModal");
  const modalClose = document.getElementById("exploreDetailClose");
  const detailArt = document.getElementById("exploreDetailArt");
  const detailType = document.getElementById("exploreDetailType");
  const detailTitle = document.getElementById("exploreDetailTitle");
  const detailMeta = document.getElementById("exploreDetailMeta");
  const detailDescription = document.getElementById("exploreDetailDescription");
  const watchNow = document.getElementById("exploreWatchNow");

  if (!button || !view || !appGrid) return;

  const TMDB_TOKEN = window.MEMETV_CONFIG?.tmdbReadToken || "";
  const TMDB_IMAGE = "https://image.tmdb.org/t/p/w342";
  const TMDB_BACKDROP = "https://image.tmdb.org/t/p/w780";
  const genres = {
    movie: [
      [28,"Action"],[12,"Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],
      [99,"Documentary"],[18,"Drama"],[10751,"Family"],[14,"Fantasy"],[36,"History"],
      [27,"Horror"],[10402,"Music"],[9648,"Mystery"],[10749,"Romance"],[878,"Science Fiction"],
      [53,"Thriller"],[10752,"War"],[37,"Western"]
    ],
    tv: [
      [10759,"Action & Adventure"],[16,"Animation"],[35,"Comedy"],[80,"Crime"],
      [99,"Documentary"],[18,"Drama"],[10751,"Family"],[10762,"Kids"],[9648,"Mystery"],
      [10763,"News"],[10764,"Reality"],[10765,"Sci-Fi & Fantasy"],[10766,"Soap"],
      [10767,"Talk"],[10768,"War & Politics"],[37,"Western"]
    ],
    anime: ["Action","Adventure","Comedy","Drama","Ecchi","Fantasy","Horror","Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"]
  };

  let page = 1;
  let hasMore = true;
  let isLoading = false;
  let requestVersion = 0;
  let selectedItem = null;

  const currentYear = new Date().getFullYear();
  for (let value = currentYear + 1; value >= 1900; value -= 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    year.appendChild(option);
  }

  function setGenres() {
    region.options[0].textContent = media.value === "anime" ? "All origins" : "All regions";
    genre.innerHTML = '<option value="">All genres</option>';
    for (const entry of genres[media.value]) {
      const option = document.createElement("option");
      if (Array.isArray(entry)) {
        option.value = String(entry[0]);
        option.textContent = entry[1];
      } else {
        option.value = entry;
        option.textContent = entry;
      }
      genre.appendChild(option);
    }
  }

  function showExplore() {
    appGrid.hidden = true;
    view.hidden = false;
    document.querySelectorAll(".main-menu .menu-button").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    if (!grid.children.length) resetCatalogue();
  }

  function showPlayer(modeValue) {
    view.hidden = true;
    appGrid.hidden = false;
    button.classList.remove("active");
    document.querySelector(`.menu-button[data-mode="${modeValue}"]`)?.click();
  }

  function tmdbSort() {
    const prefix = media.value === "movie" ? "primary_release_date" : "first_air_date";
    return {
      popular: "popularity.desc",
      newest: `${prefix}.desc`,
      oldest: `${prefix}.asc`,
      rating: "vote_average.desc",
      trending: "popularity.desc"
    }[sort.value];
  }

  async function fetchTmdb() {
    if (!TMDB_TOKEN) throw new Error("TMDB token is missing from config.js.");
    const params = new URLSearchParams({
      language: "en-US",
      page: String(page),
      include_adult: "false",
      sort_by: tmdbSort(),
      "vote_count.gte": sort.value === "rating" ? "100" : "10"
    });
    if (region.value) params.set("with_origin_country", region.value);
    if (year.value) params.set(media.value === "movie" ? "primary_release_year" : "first_air_date_year", year.value);
    if (genre.value) params.set("with_genres", genre.value);
    if (rating.value) params.set("vote_average.gte", rating.value);

    const response = await fetch(`https://api.themoviedb.org/3/discover/${media.value}?${params}`, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}`, Accept: "application/json" }
    });
    if (!response.ok) throw new Error("TMDB catalogue request failed.");
    const data = await response.json();
    return {
      hasMore: page < Number(data.total_pages || 1),
      items: (data.results || []).map(item => ({
        id: item.id,
        kind: media.value,
        title: item.title || item.name || item.original_title || item.original_name,
        description: item.overview || "No description is currently available.",
        poster: item.poster_path ? `${TMDB_IMAGE}${item.poster_path}` : "",
        backdrop: item.backdrop_path ? `${TMDB_BACKDROP}${item.backdrop_path}` : "",
        year: String(item.release_date || item.first_air_date || "").slice(0, 4),
        score: Number(item.vote_average || 0)
      }))
    };
  }

  function animeSort() {
    return {
      popular: "POPULARITY_DESC",
      newest: "START_DATE_DESC",
      oldest: "START_DATE",
      rating: "SCORE_DESC",
      trending: "TRENDING_DESC"
    }[sort.value];
  }

  async function fetchAnime() {
    // AniList rejects comparisons against null (for example,
    // averageScore_greater: null). Build only the filters the user selected.
    const definitions = ["$page: Int", "$sort: [MediaSort]"];
    const argumentsList = ["type: ANIME", "sort: $sort", "isAdult: false"];
    const variables = { page, sort: [animeSort()] };

    if (year.value) {
      definitions.push("$year: Int");
      argumentsList.push("seasonYear: $year");
      variables.year = Number(year.value);
    }
    if (region.value) {
      definitions.push("$country: CountryCode");
      argumentsList.push("countryOfOrigin: $country");
      variables.country = region.value;
    }
    if (genre.value) {
      definitions.push("$genre: String");
      argumentsList.push("genre: $genre");
      variables.genre = genre.value;
    }
    if (rating.value) {
      definitions.push("$score: Int");
      argumentsList.push("averageScore_greater: $score");
      variables.score = Number(rating.value) * 10;
    }

    const query = `
      query (${definitions.join(", ")}) {
        Page(page: $page, perPage: 20) {
          pageInfo { hasNextPage }
          media(${argumentsList.join(", ")}) {
            id status episodes format seasonYear averageScore description(asHtml: false)
            title { english romaji native }
            coverImage { large extraLarge }
            bannerImage
          }
        }
      }`;
    const response = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables })
    });
    if (!response.ok) throw new Error("AniList catalogue request failed.");
    const data = await response.json();
    return {
      hasMore: Boolean(data?.data?.Page?.pageInfo?.hasNextPage),
      items: (data?.data?.Page?.media || []).map(item => ({
        id: item.id,
        kind: "anime",
        title: item.title?.english || item.title?.romaji || item.title?.native || "Anime",
        description: item.description || "No description is currently available.",
        poster: item.coverImage?.extraLarge || item.coverImage?.large || "",
        backdrop: item.bannerImage || item.coverImage?.extraLarge || "",
        year: item.seasonYear || "",
        score: Number(item.averageScore || 0) / 10,
        episodes: item.episodes,
        format: item.format
      }))
    };
  }

  function createCard(item) {
    const card = document.createElement("button");
    card.className = "explore-card";
    card.type = "button";
    const image = document.createElement("img");
    image.className = "explore-poster";
    image.src = item.poster || "";
    image.alt = "";
    image.loading = "lazy";
    const copy = document.createElement("span");
    copy.className = "explore-card-copy";
    const title = document.createElement("span");
    title.className = "explore-card-title";
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.className = "explore-card-meta";
    meta.textContent = [item.year, item.kind === "anime" ? "Anime" : item.kind === "tv" ? "TV Show" : "Movie"].filter(Boolean).join(" • ");
    copy.append(title, meta);
    card.append(image, copy);
    if (item.score > 0) {
      const scoreBadge = document.createElement("span");
      scoreBadge.className = "explore-score";
      scoreBadge.textContent = `★ ${item.score.toFixed(1)}`;
      card.appendChild(scoreBadge);
    }
    card.addEventListener("click", () => openDetails(item));
    return card;
  }

  function openDetails(item) {
    selectedItem = item;
    detailArt.style.backgroundImage = item.backdrop || item.poster ? `linear-gradient(to top, rgba(5,12,23,.5), transparent), url("${item.backdrop || item.poster}")` : "";
    detailType.textContent = item.kind === "anime" ? "Anime" : item.kind === "tv" ? "TV Show" : "Movie";
    detailTitle.textContent = item.title;
    detailMeta.textContent = [item.year, item.score ? `★ ${item.score.toFixed(1)}` : "", item.episodes ? `${item.episodes} episodes` : ""].filter(Boolean).join(" • ");
    detailDescription.textContent = item.description;
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeDetails() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  async function loadMore() {
    if (isLoading || !hasMore || view.hidden) return;
    isLoading = true;
    loading.hidden = false;
    const version = requestVersion;
    try {
      const result = media.value === "anime" ? await fetchAnime() : await fetchTmdb();
      if (version !== requestVersion) return;
      result.items.forEach(item => grid.appendChild(createCard(item)));
      hasMore = result.hasMore;
      page += 1;
      count.textContent = `${grid.children.length} titles loaded`;
      cue.classList.toggle("is-hidden", !hasMore);
      if (!grid.children.length) grid.innerHTML = '<div class="explore-empty">No titles matched these filters.</div>';
    } catch (error) {
      if (version === requestVersion && !grid.children.length) {
        const message = document.createElement("div");
        message.className = "explore-error";
        message.textContent = error.message || "The catalogue could not be loaded.";
        grid.appendChild(message);
      }
      hasMore = false;
      cue.classList.add("is-hidden");
    } finally {
      if (version === requestVersion) {
        isLoading = false;
        loading.hidden = true;
      }
    }
  }

  function resetCatalogue() {
    requestVersion += 1;
    page = 1;
    hasMore = true;
    isLoading = false;
    grid.innerHTML = "";
    scroll.scrollTop = 0;
    cue.classList.remove("is-hidden");
    count.textContent = "Popular picks";
    loadMore();
  }

  button.addEventListener("click", showExplore);
  document.querySelectorAll(".menu-button[data-mode]").forEach(item => item.addEventListener("click", () => {
    view.hidden = true;
    appGrid.hidden = false;
    button.classList.remove("active");
  }));

  media.addEventListener("change", () => { setGenres(); resetCatalogue(); });
  [region, year, genre, sort, rating].forEach(control => control.addEventListener("change", resetCatalogue));
  cue.addEventListener("click", () => scroll.scrollBy({ top: Math.max(320, scroll.clientHeight * .72), behavior: "smooth" }));
  scroll.addEventListener("scroll", () => cue.classList.toggle("is-hidden", !hasMore || scroll.scrollTop > 80));
  modalClose.addEventListener("click", closeDetails);
  modal.addEventListener("click", event => { if (event.target === modal) closeDetails(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !modal.hidden) closeDetails(); });

  watchNow.addEventListener("click", async () => {
    if (!selectedItem || !window.MemeTVApp) return;
    watchNow.disabled = true;
    watchNow.textContent = "Loading…";
    try {
      closeDetails();
      showPlayer(selectedItem.kind);
      if (selectedItem.kind === "anime") await window.MemeTVApp.watchAnime(selectedItem.id);
      else if (selectedItem.kind === "tv") await window.MemeTVApp.watchTv(selectedItem.id);
      else await window.MemeTVApp.watchMovie(selectedItem.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      window.alert(error?.message || "This title could not be loaded.");
    } finally {
      watchNow.disabled = false;
      watchNow.textContent = "Watch Now";
    }
  });

  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadMore();
  }, { root: scroll, rootMargin: "500px 0px" });
  observer.observe(sentinel);
  setGenres();
})();
