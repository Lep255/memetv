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
  const releaseStatus = document.getElementById("exploreReleaseStatus");
  const genre = document.getElementById("exploreGenre");
  const sort = document.getElementById("exploreSort");
  const searchInput = document.getElementById("exploreSearch");
  const searchClear = document.getElementById("exploreSearchClear");
  const modal = document.getElementById("exploreModal");
  const modalClose = document.getElementById("exploreDetailClose");
  const detailArt = document.getElementById("exploreDetailArt");
  const detailType = document.getElementById("exploreDetailType");
  const detailTitle = document.getElementById("exploreDetailTitle");
  const detailMeta = document.getElementById("exploreDetailMeta");
  const detailDescription = document.getElementById("exploreDetailDescription");
  const watchNow = document.getElementById("exploreWatchNow");

  if (!button || !view || !appGrid) return;
  searchInput.title = "Use ! to include explicit content, or !!! to show explicit content only.";

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
  let searchTimer = null;

  const currentYear = new Date().getFullYear();
  for (let value = currentYear + 1; value >= 1900; value -= 1) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    year.appendChild(option);
  }

  function setGenres() {
    region.options[0].textContent = media.value === "anime" ? "All origins" : "All regions";
    searchInput.placeholder = media.value === "anime"
      ? "Search anime titles…"
      : media.value === "tv"
        ? "Search TV show titles…"
        : "Search movie titles…";
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
      trending: "popularity.desc"
    }[sort.value];
  }

  function parsedSearch() {
    const raw = searchInput.value.trim();
    const adultOnly = raw.startsWith("!!!");
    const includeExplicit = raw.startsWith("!");
    const prefixLength = adultOnly ? 3 : includeExplicit ? 1 : 0;
    const text = prefixLength ? raw.slice(prefixLength).trim() : raw;
    return {
      text,
      includeExplicit,
      adultOnly
    };
  }

  function isoToday(offsetDays = 0) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().slice(0, 10);
  }

  function releaseDateFor(item) {
    return item.release_date || item.first_air_date || "";
  }

  function matchesReleaseStatus(item) {
    if (releaseStatus.value === "all") return true;
    const date = releaseDateFor(item);
    if (!date) return false;
    return releaseStatus.value === "unreleased" ? date > isoToday() : date <= isoToday();
  }

  function tvEpisodeProgress(details) {
    const latest = details?.last_episode_to_air;
    const total = Number(details?.number_of_episodes || 0);
    if (!latest) return { episodesOut: 0, totalEpisodes: total, latestLabel: "" };

    const currentSeason = Number(latest.season_number || 1);
    const previousEpisodes = (details.seasons || [])
      .filter(season => Number(season.season_number) > 0 && Number(season.season_number) < currentSeason)
      .reduce((sum, season) => sum + Number(season.episode_count || 0), 0);

    return {
      episodesOut: previousEpisodes + Number(latest.episode_number || 0),
      totalEpisodes: total,
      latestLabel: `S${currentSeason} E${Number(latest.episode_number || 1)}`
    };
  }

  async function enrichTvItems(items) {
    if (media.value !== "tv") return items;
    const enriched = [];
    for (let offset = 0; offset < items.length; offset += 5) {
      const batch = items.slice(offset, offset + 5);
      const settled = await Promise.allSettled(batch.map(async item => {
        const response = await fetch(`https://api.themoviedb.org/3/tv/${item.id}?language=en-US`, {
          headers: { Authorization: `Bearer ${TMDB_TOKEN}`, Accept: "application/json" }
        });
        if (!response.ok) return item;
        return Object.assign(item, tvEpisodeProgress(await response.json()));
      }));
      enriched.push(...settled.map((result, index) => result.status === "fulfilled" ? result.value : batch[index]));
    }
    return enriched;
  }

  async function fetchTmdb() {
    if (!TMDB_TOKEN) throw new Error("TMDB token is missing from config.js.");
    let scanPage = page;
    let totalPages = page;
    const search = parsedSearch();
    const searchText = search.text;
    const matched = [];
    let scans = 0;

    do {
      const params = new URLSearchParams({
        language: "en-US",
        page: String(scanPage),
        include_adult: String(search.includeExplicit)
      });
      let endpoint = `discover/${media.value}`;
      if (searchText) {
        endpoint = `search/${media.value}`;
        params.set("query", searchText);
      } else {
        const dateField = media.value === "movie" ? "primary_release_date" : "first_air_date";
        // TMDB has no adult-only discover filter. Its popularity ordering can
        // bury every adult result hundreds of pages deep, while date ordering
        // exposes candidates consistently. Reorder the retained matches below.
        params.set("sort_by", search.adultOnly
          ? `${dateField}.${sort.value === "oldest" ? "asc" : "desc"}`
          : tmdbSort());
        if (releaseStatus.value === "released") params.set(`${dateField}.lte`, isoToday());
        if (releaseStatus.value === "unreleased") params.set(`${dateField}.gte`, isoToday(1));
        if (region.value) params.set("with_origin_country", region.value);
        if (year.value) params.set(media.value === "movie" ? "primary_release_year" : "first_air_date_year", year.value);
        if (genre.value) params.set("with_genres", genre.value);
      }

      const response = await fetch(`https://api.themoviedb.org/3/${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${TMDB_TOKEN}`, Accept: "application/json" }
      });
      if (!response.ok) throw new Error("TMDB catalogue request failed.");
      const data = await response.json();
      totalPages = Math.min(Number(data.total_pages || 1), 500);
      let results = data.results || [];
      if (searchText) {
        results = results.filter(matchesReleaseStatus);
        if (region.value) results = results.filter(item => (item.origin_country || []).includes(region.value));
        if (year.value) results = results.filter(item => String(item.release_date || item.first_air_date || "").startsWith(year.value));
        if (genre.value) results = results.filter(item => (item.genre_ids || []).includes(Number(genre.value)));
      }
      if (search.adultOnly) results = results.filter(item => item.adult === true);
      matched.push(...results);
      scanPage += 1;
      scans += 1;
    } while (search.adultOnly && matched.length < 20 && scanPage <= totalPages && scans < 25);

    if (search.adultOnly && !searchText) {
      matched.sort((a, b) => {
        const aDate = releaseDateFor(a);
        const bDate = releaseDateFor(b);
        if (sort.value === "oldest") return aDate.localeCompare(bDate);
        if (sort.value === "newest") return bDate.localeCompare(aDate);
        return Number(b.popularity || 0) - Number(a.popularity || 0);
      });
    }

    const items = matched.map(item => ({
      id: item.id,
      kind: media.value,
      title: item.title || item.name || item.original_title || item.original_name,
      description: item.overview || "No description is currently available.",
      poster: item.poster_path ? `${TMDB_IMAGE}${item.poster_path}` : "",
      backdrop: item.backdrop_path ? `${TMDB_BACKDROP}${item.backdrop_path}` : "",
      year: String(item.release_date || item.first_air_date || "").slice(0, 4),
      score: Number(item.vote_average || 0)
    }));

    return {
      hasMore: scanPage <= totalPages,
      nextPage: scanPage,
      items: await enrichTvItems(items)
    };
  }

  function animeSort() {
    return {
      popular: "POPULARITY_DESC",
      newest: "START_DATE_DESC",
      oldest: "START_DATE",
      trending: "TRENDING_DESC"
    }[sort.value];
  }

  function animeEpisodesOut(item) {
    const nextEpisode = Number(item?.nextAiringEpisode?.episode || 0);
    const total = Number(item?.episodes || 0);
    if (nextEpisode > 1) return nextEpisode - 1;
    if (item?.status === "FINISHED" && total > 0) return total;
    if (item?.status === "FINISHED") return 1;
    if (item?.status === "RELEASING" || item?.status === "HIATUS") return 1;
    if (item?.status === "NOT_YET_RELEASED") return 0;
    return 0;
  }

  async function fetchAnime() {
    // AniList rejects comparisons against null (for example,
    // averageScore_greater: null). Build only the filters the user selected.
    const search = parsedSearch();
    const definitions = ["$page: Int", "$perPage: Int", "$sort: [MediaSort]", "$adult: Boolean"];
    const argumentsList = ["type: ANIME", "sort: $sort", "isAdult: $adult"];
    const variables = { page, perPage: search.includeExplicit && !search.adultOnly ? 10 : 20, sort: [animeSort()] };

    if (releaseStatus.value === "released") {
      definitions.push("$before: FuzzyDateInt");
      argumentsList.push("startDate_lesser: $before", "status_in: [RELEASING, FINISHED, HIATUS]");
      variables.before = Number(isoToday(1).replaceAll("-", ""));
    } else if (releaseStatus.value === "unreleased") {
      argumentsList.push("status: NOT_YET_RELEASED");
    }

    if (search.text) {
      definitions.push("$search: String");
      argumentsList.push("search: $search");
      variables.search = search.text;
    }

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

    const query = `
      query (${definitions.join(", ")}) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage }
          media(${argumentsList.join(", ")}) {
            id status episodes format seasonYear averageScore description(asHtml: false)
            startDate { year month day }
            nextAiringEpisode { episode airingAt }
            title { english romaji native }
            coverImage { large extraLarge }
            bannerImage
          }
        }
      }`;
    async function requestAdultGroup(adult) {
      const response = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables: { ...variables, adult } })
      });
      if (!response.ok) throw new Error("AniList catalogue request failed.");
      return response.json();
    }

    const adultGroups = search.includeExplicit && !search.adultOnly
      ? await Promise.all([requestAdultGroup(false), requestAdultGroup(true)])
      : [await requestAdultGroup(search.adultOnly)];
    const mediaGroups = adultGroups.map(data => data?.data?.Page?.media || []);
    const combinedMedia = mediaGroups.length === 2
      ? mediaGroups[0].flatMap((item, index) => [item, mediaGroups[1][index]].filter(Boolean))
      : mediaGroups[0];

    let items = combinedMedia.map(item => ({
      id: item.id,
      kind: "anime",
      title: item.title?.english || item.title?.romaji || item.title?.native || "Anime",
      description: item.description || "No description is currently available.",
      poster: item.coverImage?.extraLarge || item.coverImage?.large || "",
      backdrop: item.bannerImage || item.coverImage?.extraLarge || "",
      year: item.seasonYear || "",
      score: Number(item.averageScore || 0) / 10,
      episodes: item.episodes,
      episodesOut: animeEpisodesOut(item),
      status: item.status,
      format: item.format
    }));
    if (releaseStatus.value === "released") items = items.filter(item => item.episodesOut > 0);

    return {
      hasMore: adultGroups.some(data => Boolean(data?.data?.Page?.pageInfo?.hasNextPage)),
      items
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
    const episodeMeta = item.kind === "anime"
      ? `${item.episodesOut || 0}${item.episodes ? ` / ${item.episodes}` : ""} episodes out`
      : item.kind === "tv" && item.totalEpisodes
        ? `${item.episodesOut || 0} / ${item.totalEpisodes} episodes out`
        : "";
    meta.textContent = [item.year, item.kind === "anime" ? "Anime" : item.kind === "tv" ? "TV Show" : "Movie", episodeMeta].filter(Boolean).join(" • ");
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
    const episodeMeta = item.kind === "anime"
      ? `${item.episodesOut || 0}${item.episodes ? ` / ${item.episodes}` : ""} episodes out`
      : item.kind === "tv" && item.totalEpisodes
        ? `${item.episodesOut || 0} / ${item.totalEpisodes} episodes out${item.latestLabel ? ` • Latest ${item.latestLabel}` : ""}`
        : "";
    detailMeta.textContent = [item.year, item.score ? `★ ${item.score.toFixed(1)}` : "", episodeMeta].filter(Boolean).join(" • ");
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
      grid.querySelector(".explore-empty")?.remove();
      result.items.forEach(item => grid.appendChild(createCard(item)));
      hasMore = result.hasMore;
      page = Number(result.nextPage || (page + 1));
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
    const search = parsedSearch();
    count.textContent = search.text
      ? "Search results"
      : search.adultOnly
        ? "Explicit content only"
        : search.includeExplicit
          ? "Explicit content enabled"
        : "Popular picks";
    loadMore();
  }

  button.addEventListener("click", showExplore);
  document.querySelectorAll(".menu-button[data-mode]").forEach(item => item.addEventListener("click", () => {
    view.hidden = true;
    appGrid.hidden = false;
    button.classList.remove("active");
  }));

  media.addEventListener("change", () => { setGenres(); resetCatalogue(); });
  [region, year, releaseStatus, genre, sort].forEach(control => control.addEventListener("change", resetCatalogue));
  searchInput.addEventListener("input", () => {
    searchClear.hidden = !searchInput.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(resetCatalogue, 380);
  });
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      clearTimeout(searchTimer);
      resetCatalogue();
    }
  });
  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.hidden = true;
    searchInput.focus();
    resetCatalogue();
  });
  cue.addEventListener("click", () => {
    loadMore();
    scroll.scrollBy({ top: Math.max(320, scroll.clientHeight * .72), behavior: "smooth" });
  });
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
