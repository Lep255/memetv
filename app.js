(() => {
      const player = document.getElementById("player");
      const empty = document.getElementById("empty");
      const videoTitle = document.getElementById("videoTitle");
      const meta = document.getElementById("meta");

      const mediaMode = document.getElementById("mediaMode");
      const mediaModeCustom = document.getElementById("mediaModeCustom");
      const mediaModeButton = document.getElementById("mediaModeButton");

      const loadBtn = document.getElementById("loadBtn");
      const prevBtn = document.getElementById("prevBtn");
      const nextBtn = document.getElementById("nextBtn");
      const clearHistoryBtn = document.getElementById("clearHistoryBtn");
      const contentColumn = document.getElementById("contentColumn");
      const sidebarPanel = document.querySelector(".side");
      const serverPanel = document.getElementById("serverPanel");
      const serverButtons = Array.from(document.querySelectorAll(".server-button"));
      const todoWrap = document.getElementById("todoWrap");
      const todoButton = document.getElementById("todoButton");
      const todoList = document.getElementById("todoList");

      const animeSearchBox = document.getElementById("animeSearchBox");
      const animeSearch = document.getElementById("animeSearch");
      const searchResults = document.getElementById("searchResults");

      const movieSearchBox = document.getElementById("movieSearchBox");
      const movieSearch = document.getElementById("movieSearch");
      const movieResults = document.getElementById("movieResults");
      const selectedMovieCard = document.getElementById("selectedMovieCard");
      const selectedMovieImage = document.getElementById("selectedMovieImage");
      const selectedMovieName = document.getElementById("selectedMovieName");
      const selectedMovieMeta = document.getElementById("selectedMovieMeta");
      const clearSelectedMovie = document.getElementById("clearSelectedMovie");

      const tvSearchBox = document.getElementById("tvSearchBox");
      const tvSearch = document.getElementById("tvSearch");
      const tvResults = document.getElementById("tvResults");
      const selectedTvCard = document.getElementById("selectedTvCard");
      const selectedTvImage = document.getElementById("selectedTvImage");
      const selectedTvName = document.getElementById("selectedTvName");
      const selectedTvMeta = document.getElementById("selectedTvMeta");
      const clearSelectedTv = document.getElementById("clearSelectedTv");

      const selectedAnimeCard = document.getElementById("selectedAnimeCard");
      const selectedAnimeImage = document.getElementById("selectedAnimeImage");
      const selectedAnimeName = document.getElementById("selectedAnimeName");
      const selectedAnimeMeta = document.getElementById("selectedAnimeMeta");
      const clearSelectedAnime = document.getElementById("clearSelectedAnime");

      const animeId = document.getElementById("animeId");
      const animeEpisode = document.getElementById("animeEpisode");
      const animeType = document.getElementById("animeType");

      const animepaheId = document.getElementById("animepaheId");
      const animepaheEpisode = document.getElementById("animepaheEpisode");
      const animepaheType = document.getElementById("animepaheType");

      const movieId = document.getElementById("movieId");

      const tvId = document.getElementById("tvId");
      const tvSeason = document.getElementById("tvSeason");
      const tvEpisode = document.getElementById("tvEpisode");

      let mode = "anime";
      let activeServer = "vidnest";

      const SERVER_OPTIONS = {
        anime: ["vidnest", "videasy"],
        movie: ["vidnest", "vidcore", "vidgod", "vidfast", "videasy"],
        tv: ["vidnest", "vidcore", "vidgod", "vidfast", "videasy"]
      };
      let searchTimer = null;
      let lastSearchText = "";
      let movieSearchTimer = null;
      let lastMovieSearchText = "";
      let tvSearchTimer = null;
      let lastTvSearchText = "";

      const TMDB_TOKEN = window.MEMETV_CONFIG?.tmdbReadToken || "";
      const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w92";

      const titleCache = {};
      const animeMetaCache = {};
      const movieMetaCache = {};
      const tvMetaCache = {};

      function cleanNum(value) {
        return String(value || "").replace(/[^\d]/g, "");
      }

      function cleanMinOne(value) {
        return String(Math.max(1, Number(cleanNum(value) || "1")));
      }

      function getAvailableEpisodes(anime) {
        const finishedTotal = Number(anime?.episodes || 0);
        const nextEpisode = Number(anime?.nextAiringEpisode?.episode || 0);

        if (finishedTotal > 0) return finishedTotal;
        if (nextEpisode > 1) return nextEpisode - 1;

        return 1;
      }

      function populateSeasonDropdown(select, totalSeasons, selectedSeason = "1") {
        const total = Math.max(1, Number(cleanNum(totalSeasons) || selectedSeason || "1"));
        const selected = Math.min(total, Math.max(1, Number(cleanNum(selectedSeason) || "1")));

        select.innerHTML = "";

        for (let i = 1; i <= total; i++) {
          const option = document.createElement("option");
          option.value = String(i);
          option.textContent = `Season ${i}`;
          if (i === selected) option.selected = true;
          select.appendChild(option);
        }
      }

      function populateEpisodeDropdown(select, totalEpisodes, selectedEpisode = "1") {
        const total = Math.max(1, Number(cleanNum(totalEpisodes) || selectedEpisode || "1"));
        const selected = Math.min(total, Math.max(1, Number(cleanNum(selectedEpisode) || "1")));

        select.innerHTML = "";

        for (let i = 1; i <= total; i++) {
          const option = document.createElement("option");
          option.value = String(i);
          option.textContent = `Episode ${i}`;
          if (i === selected) option.selected = true;
          select.appendChild(option);
        }

        select.dataset.totalEpisodes = String(total);
      }

      function requireValue(input, label) {
        let value = cleanNum(input.value);

        if (!value) {
          alert(label.includes("search") ? "Please search and select an anime first." : `Please enter ${label}.`);
          input.focus();
          return "";
        }

        if (/episode|season/i.test(label)) value = cleanMinOne(value);

        input.value = value;
        return value;
      }

      async function aniListRequest(query, variables) {
        const response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ query, variables })
        });

        if (!response.ok) throw new Error("AniList request failed");
        return response.json();
      }

      async function getAniListTitle(id) {
        if (!id) return "";
        if (titleCache[id]) return titleCache[id];

        const query = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              title { english romaji native }
            }
          }
        `;

        try {
          const json = await aniListRequest(query, { id: Number(id) });
          const title = json?.data?.Media?.title;
          const name = title?.english || title?.romaji || title?.native || "";
          if (name) titleCache[id] = name;
          return name;
        } catch {
          return "";
        }
      }

      async function getAniListAnimeById(id) {
        if (!id) return null;

        const query = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              id
              episodes
              format
              seasonYear
              nextAiringEpisode { episode }
              coverImage { medium }
              title { english romaji native }
            }
          }
        `;

        try {
          const json = await aniListRequest(query, { id: Number(id) });
          return json?.data?.Media || null;
        } catch {
          return null;
        }
      }

      async function refreshAnimeInfoForHistory(item) {
        const id = item.mode === "anime" ? item.animeId : item.animepaheId;
        if (!id) return;

        const anime = await getAniListAnimeById(id);
        if (!anime) return;

        const name = animeDisplayName(anime);
        const totalEpisodes = getAvailableEpisodes(anime);
        const subline = animeSubline(anime);

        titleCache[id] = name;
        animeMetaCache[id] = {
          name,
          image: anime.coverImage?.medium || "",
          subline,
          totalEpisodes
        };

        const selectedEpisode = item.mode === "anime"
          ? (item.animeEpisode || "1")
          : (item.animepaheEpisode || "1");

        if (item.mode === "anime") {
          populateEpisodeDropdown(animeEpisode, totalEpisodes, selectedEpisode);
          item.animeName = name;
          item.animeTotalEpisodes = String(totalEpisodes);
        } else {
          populateEpisodeDropdown(animepaheEpisode, totalEpisodes, selectedEpisode);
          item.animeName = name;
          item.animepaheTotalEpisodes = String(totalEpisodes);
        }

        item.label = `${name} • Episode ${selectedEpisode} • ${
          item.mode === "anime"
            ? (item.animeType || "sub").toUpperCase()
            : (item.animepaheType || "sub").toUpperCase()
        }`;
      }

      function animeDisplayName(anime) {
        return anime.title?.english || anime.title?.romaji || anime.title?.native || `Anime ${anime.id}`;
      }

      function animeSubline(anime) {
        const count = getAvailableEpisodes(anime);

        return [
          anime.seasonYear || "",
          anime.format || "",
          count ? `${count} Episodes` : ""
        ].filter(Boolean).join(" • ");
      }

      function tmdbImage(path) {
        return path ? `${TMDB_IMAGE_BASE}${path}` : "";
      }

      function yearFromDate(date) {
        return date ? String(date).slice(0, 4) : "";
      }

      async function tmdbRequest(path) {
        const response = await fetch(`https://api.themoviedb.org/3${path}`, {
          headers: {
            "Authorization": `Bearer ${TMDB_TOKEN}`,
            "Accept": "application/json"
          }
        });

        if (!response.ok) throw new Error("TMDB request failed");
        return response.json();
      }

      async function ensureMovieInfo(id) {
        if (!id) return null;
        if (movieMetaCache[id]?.name) return movieMetaCache[id];

        try {
          const movie = await tmdbRequest(`/movie/${id}?language=en-US`);
          const info = {
            name: movieDisplayName(movie),
            image: tmdbImage(movie.poster_path),
            subline: [
              yearFromDate(movie.release_date),
              movie.runtime ? `${movie.runtime} min` : ""
            ].filter(Boolean).join(" • ")
          };
          movieMetaCache[id] = info;
          return info;
        } catch {
          return null;
        }
      }

      async function ensureTvInfo(id) {
        if (!id) return null;
        if (tvMetaCache[id]?.name) return tvMetaCache[id];

        try {
          const show = await tmdbRequest(`/tv/${id}?language=en-US`);
          const info = {
            name: tvDisplayName(show),
            image: tmdbImage(show.poster_path),
            subline: tvSubline(show),
            seasons: show.seasons || []
          };
          tvMetaCache[id] = info;
          return info;
        } catch {
          return null;
        }
      }

      function movieDisplayName(movie) {
        return movie.title || movie.original_title || `Movie ${movie.id}`;
      }

      function tvDisplayName(show) {
        return show.name || show.original_name || `TV Show ${show.id}`;
      }

      function movieSubline(movie) {
        return [
          yearFromDate(movie.release_date),
          movie.vote_average ? `★ ${Number(movie.vote_average).toFixed(1)}` : ""
        ].filter(Boolean).join(" • ");
      }

      function tvSubline(show) {
        return [
          yearFromDate(show.first_air_date),
          show.number_of_seasons ? `${show.number_of_seasons} Seasons` : "",
          show.number_of_episodes ? `${show.number_of_episodes} Episodes` : ""
        ].filter(Boolean).join(" • ");
      }

      async function searchTmdb(kind) {
        const input = kind === "movie" ? movieSearch : tvSearch;
        const resultsBox = kind === "movie" ? movieResults : tvResults;
        const text = input.value.trim();

        if (!text) {
          resultsBox.innerHTML = "";
          resultsBox.classList.remove("open");
          return;
        }

        if (text.length < 3) {
          resultsBox.innerHTML = '<div style="color:#aaa;">Type at least 3 letters, or paste a TMDB ID.</div>';
          resultsBox.classList.add("open");
          return;
        }

        resultsBox.innerHTML = '<div style="color:#aaa;">Searching...</div>';
        resultsBox.classList.add("open");

        const isIdSearch = /^\d+$/.test(text);

        try {
          let results = [];

          if (kind === "movie") {
            if (isIdSearch) {
              const movie = await tmdbRequest(`/movie/${Number(text)}?language=en-US`);
              results = movie?.id ? [movie] : [];
            } else {
              const json = await tmdbRequest(`/search/movie?query=${encodeURIComponent(text)}&include_adult=false&language=en-US&page=1`);
              results = (json.results || []).slice(0, 10);
            }
          } else {
            if (isIdSearch) {
              const show = await tmdbRequest(`/tv/${Number(text)}?language=en-US`);
              results = show?.id ? [show] : [];
            } else {
              const json = await tmdbRequest(`/search/tv?query=${encodeURIComponent(text)}&include_adult=false&language=en-US&page=1`);
              results = (json.results || []).slice(0, 10);
            }
          }

          renderTmdbResults(kind, results);
        } catch {
          resultsBox.innerHTML = '<div style="color:#ffb3b3;">Search failed. Try again.</div>';
          resultsBox.classList.add("open");
        }
      }

      function renderTmdbResults(kind, results) {
        const resultsBox = kind === "movie" ? movieResults : tvResults;
        resultsBox.innerHTML = "";
        resultsBox.classList.add("open");

        if (!results.length) {
          resultsBox.innerHTML = '<div style="color:#aaa;">No results found.</div>';
          return;
        }

        for (const item of results) {
          const name = kind === "movie" ? movieDisplayName(item) : tvDisplayName(item);
          const sub = kind === "movie" ? movieSubline(item) : tvSubline(item);
          const img = tmdbImage(item.poster_path);

          const btn = document.createElement("button");
          btn.className = "result-card";
          btn.innerHTML = `
            <img src="${img}" alt="">
            <div>
              <div class="result-title"></div>
              <div class="result-meta"></div>
            </div>
          `;

          btn.querySelector(".result-title").textContent = name;
          btn.querySelector(".result-meta").textContent = sub;

          btn.addEventListener("click", async () => {
            if (kind === "movie") {
              await selectMovie(item, true);
            } else {
              await selectTvShow(item, true);
            }
          });

          resultsBox.appendChild(btn);
        }
      }

      async function selectMovie(movie, autoplay) {
        const details = movie.runtime ? movie : await tmdbRequest(`/movie/${movie.id}?language=en-US`);
        const name = movieDisplayName(details);

        movieId.value = details.id;
        movieMetaCache[details.id] = {
          name,
          image: tmdbImage(details.poster_path),
          subline: [
            yearFromDate(details.release_date),
            details.runtime ? `${details.runtime} min` : ""
          ].filter(Boolean).join(" • ")
        };

        updateSelectedMovieCard(details.id);
        movieSearch.value = name;
        movieResults.innerHTML = "";
        movieResults.classList.remove("open");
        saveValues();

        if (autoplay) loadMedia();
      }

      async function selectTvShow(show, autoplay) {
        const details = show.seasons ? show : await tmdbRequest(`/tv/${show.id}?language=en-US`);
        const name = tvDisplayName(details);

        tvId.value = details.id;
        tvMetaCache[details.id] = {
          name,
          image: tmdbImage(details.poster_path),
          subline: tvSubline(details),
          seasons: details.seasons || [],
          lastEpisodeToAir: details.last_episode_to_air || null
        };

        // A newly selected show always starts at Season 1 / Episode 1.
        populateTvSeasons(details, "1");
        await populateTvEpisodes(details.id, tvSeason.value, "1");

        updateSelectedTvCard(details.id);
        tvSearch.value = name;
        tvResults.innerHTML = "";
        tvResults.classList.remove("open");

        localStorage.setItem("lastTvSeason", "1");
        localStorage.setItem("lastTvEpisode", "1");
        saveValues();

        if (autoplay) loadMedia();
      }

      function populateTvSeasons(details, selectedSeason = "1") {
        const seasons = (details.seasons || [])
          .filter(season => Number(season.season_number) > 0)
          .sort((a, b) => Number(a.season_number) - Number(b.season_number));

        tvSeason.innerHTML = "";

        if (!seasons.length) {
          const option = document.createElement("option");
          option.value = "1";
          option.textContent = "Season 1";
          tvSeason.appendChild(option);
          return;
        }

        const hasSelected = seasons.some(season => String(season.season_number) === String(selectedSeason));

        for (const season of seasons) {
          const option = document.createElement("option");
          option.value = String(season.season_number);
          option.textContent = season.name || `Season ${season.season_number}`;
          if (String(season.season_number) === String(hasSelected ? selectedSeason : seasons[0].season_number)) {
            option.selected = true;
          }
          tvSeason.appendChild(option);
        }
      }

      function latestReleasedSeasonAndEpisode(show) {
        const last = show?.last_episode_to_air;
        if (!last) return null;

        const seasonNumber = Number(last.season_number || 1);
        const episodeNumber = Number(last.episode_number || 1);

        return {
          seasonNumber: Math.max(1, seasonNumber),
          episodeNumber: Math.max(1, episodeNumber)
        };
      }

      async function populateTvEpisodes(tvShowId, seasonNumber, selectedEpisode = "1") {
        tvEpisode.innerHTML = '<option value="1">Episode 1</option>';

        if (!tvShowId || !seasonNumber) return;

        try {
          const season = await tmdbRequest(`/tv/${tvShowId}/season/${seasonNumber}?language=en-US`);
          const today = new Date();
          today.setHours(23, 59, 59, 999);

          const episodes = (season.episodes || []).filter(ep => {
            if (!ep.air_date) return false;
            const airDate = new Date(`${ep.air_date}T00:00:00`);
            return !Number.isNaN(airDate.getTime()) && airDate <= today;
          });

          tvEpisode.innerHTML = "";

          if (!episodes.length) {
            const option = document.createElement("option");
            option.value = "1";
            option.textContent = "Episode 1";
            tvEpisode.appendChild(option);
            return;
          }

          const hasSelected = episodes.some(ep => String(ep.episode_number) === String(selectedEpisode));
          const selected = hasSelected ? String(selectedEpisode) : String(episodes[0].episode_number);

          for (const ep of episodes) {
            const option = document.createElement("option");
            option.value = String(ep.episode_number);
            option.textContent = `Episode ${ep.episode_number}`;
            if (String(ep.episode_number) === selected) option.selected = true;
            tvEpisode.appendChild(option);
          }
        } catch {
          tvEpisode.innerHTML = '<option value="1">Episode 1</option>';
        }
      }

      function updateSelectedMovieCard(id) {
        const info = movieMetaCache[id];

        if (!id || !info) {
          selectedMovieCard.classList.remove("show");
          return;
        }

        selectedMovieImage.src = info.image || "";
        selectedMovieName.textContent = info.name;
        selectedMovieMeta.textContent = info.subline || "";
        selectedMovieCard.classList.add("show");
      }

      function updateSelectedTvCard(id) {
        const info = tvMetaCache[id];

        if (!id || !info) {
          selectedTvCard.classList.remove("show");
          return;
        }

        selectedTvImage.src = info.image || "";
        selectedTvName.textContent = info.name;
        selectedTvMeta.textContent = info.subline || "";
        selectedTvCard.classList.add("show");
      }

      function queueTmdbSearch(kind) {
        const input = kind === "movie" ? movieSearch : tvSearch;
        const resultsBox = kind === "movie" ? movieResults : tvResults;
        const text = input.value.trim();

        if (kind === "movie") clearTimeout(movieSearchTimer);
        else clearTimeout(tvSearchTimer);

        if (!text) {
          resultsBox.innerHTML = "";
          resultsBox.classList.remove("open");
          if (kind === "movie") lastMovieSearchText = "";
          else lastTvSearchText = "";
          return;
        }

        if (text.length < 3) {
          resultsBox.innerHTML = '<div style="color:#aaa;">Type at least 3 letters, or paste a TMDB ID.</div>';
          resultsBox.classList.add("open");
          if (kind === "movie") lastMovieSearchText = "";
          else lastTvSearchText = "";
          return;
        }

        resultsBox.innerHTML = '<div style="color:#aaa;">Searching...</div>';
        resultsBox.classList.add("open");

        const timer = setTimeout(() => {
          if (kind === "movie") {
            if (text === lastMovieSearchText) return;
            lastMovieSearchText = text;
            searchTmdb("movie");
          } else {
            if (text === lastTvSearchText) return;
            lastTvSearchText = text;
            searchTmdb("tv");
          }
        }, 550);

        if (kind === "movie") movieSearchTimer = timer;
        else tvSearchTimer = timer;
      }

      async function searchAniList() {
        const text = animeSearch.value.trim();

        if (!text) {
          searchResults.innerHTML = "";
          searchResults.classList.remove("open");
          return;
        }

        if (text.length < 3) {
          searchResults.innerHTML = '<div style="color:#aaa;">Type at least 3 letters, or paste an AniList ID.</div>';
          searchResults.classList.add("open");
          return;
        }

        searchResults.innerHTML = '<div style="color:#aaa;">Searching...</div>';
        searchResults.classList.add("open");

        const isIdSearch = /^\d+$/.test(text);

        const query = isIdSearch ? `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              id
              episodes
              format
              seasonYear
              nextAiringEpisode { episode }
              coverImage { medium }
              title { english romaji native }
            }
          }
        ` : `
          query ($search: String) {
            Page(page: 1, perPage: 10) {
              media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
                id
                episodes
                format
                seasonYear
                nextAiringEpisode { episode }
                coverImage { medium }
                title { english romaji native }
              }
            }
          }
        `;

        try {
          const json = await aniListRequest(query, isIdSearch ? { id: Number(text) } : { search: text });
          const results = isIdSearch
            ? (json?.data?.Media ? [json.data.Media] : [])
            : (json?.data?.Page?.media || []);

          renderSearchResults(results);
        } catch {
          searchResults.innerHTML = '<div style="color:#ffb3b3;">Search failed. Try again.</div>';
          searchResults.classList.add("open");
        }
      }

      function renderSearchResults(results) {
        searchResults.innerHTML = "";
        searchResults.classList.add("open");

        if (!results.length) {
          searchResults.innerHTML = '<div style="color:#aaa;">No results found.</div>';
          return;
        }

        for (const anime of results) {
          const name = animeDisplayName(anime);
          const sub = animeSubline(anime);

          const btn = document.createElement("button");
          btn.className = "result-card";
          btn.innerHTML = `
            <img src="${anime.coverImage?.medium || ""}" alt="">
            <div>
              <div class="result-title"></div>
              <div class="result-meta"></div>
            </div>
          `;

          btn.querySelector(".result-title").textContent = name;
          btn.querySelector(".result-meta").textContent = sub;
          btn.addEventListener("click", () => selectAnime(anime, true));

          searchResults.appendChild(btn);
        }
      }

      function selectAnime(anime, autoplay) {
        const name = animeDisplayName(anime);
        const totalEpisodes = getAvailableEpisodes(anime);

        titleCache[anime.id] = name;
        animeMetaCache[anime.id] = {
          name,
          image: anime.coverImage?.medium || "",
          subline: animeSubline(anime),
          totalEpisodes
        };

        setMode("anime");
        animeId.value = anime.id;
        populateEpisodeDropdown(animeEpisode, totalEpisodes, "1");

        updateSelectedAnimeCard(anime.id);
        saveValues();

        animeSearch.value = name;
        searchResults.innerHTML = "";
        searchResults.classList.remove("open");

        if (autoplay) loadMedia();
      }

      function updateSelectedAnimeCard(id) {
        const info = animeMetaCache[id];

        if (!id || !info) {
          selectedAnimeCard.classList.remove("show");
          return;
        }

        selectedAnimeImage.src = info.image || "";
        selectedAnimeName.textContent = info.name;
        selectedAnimeMeta.textContent = info.subline || "";
        selectedAnimeCard.classList.add("show");
      }

      function queueAnimeSearch() {
        clearTimeout(searchTimer);
        const text = animeSearch.value.trim();

        if (!text) {
          searchResults.innerHTML = "";
          searchResults.classList.remove("open");
          lastSearchText = "";
          return;
        }

        if (text.length < 3) {
          searchResults.innerHTML = '<div style="color:#aaa;">Type at least 3 letters, or paste an AniList ID.</div>';
          searchResults.classList.add("open");
          lastSearchText = "";
          return;
        }

        searchResults.innerHTML = '<div style="color:#aaa;">Searching...</div>';
        searchResults.classList.add("open");

        searchTimer = setTimeout(() => {
          if (text === lastSearchText) return;
          lastSearchText = text;
          searchAniList();
        }, 550);
      }

      function allowedServersForMode(currentMode = mode) {
        if (currentMode === "anime") return SERVER_OPTIONS.anime;
        if (currentMode === "movie") return SERVER_OPTIONS.movie;
        if (currentMode === "tv") return SERVER_OPTIONS.tv;
        return [];
      }

      function serverStorageKey(currentMode = mode) {
        return currentMode === "anime"
          ? "memetvVideoServer_anime"
          : "memetvVideoServer_movies_tv";
      }

      function ensureValidServerForMode() {
        const allowed = allowedServersForMode();
        const remembered = localStorage.getItem(serverStorageKey());
        const candidate = remembered || activeServer || "vidnest";
        activeServer = allowed.includes(candidate) ? candidate : (allowed[0] || "vidnest");
      }

      function buildUrl(serverOverride = activeServer) {
        if (mode === "anime") {
          const id = requireValue(animeId, "an anime from search");
          if (!id) return "";

          const ep = requireValue(animeEpisode, "Episode Number");
          if (!ep) return "";

          if (serverOverride === "videasy") {
            return `https://player.videasy.net/anime/${id}/${ep}`;
          }

          return `https://vidnest.fun/anime/${id}/${ep}/${animeType.value || "sub"}`;
        }

        // Kept only for backwards compatibility with old saved history.
        if (mode === "animepahe") {
          const id = requireValue(animepaheId, "an anime from search");
          if (!id) return "";

          const ep = requireValue(animepaheEpisode, "Episode Number");
          if (!ep) return "";

          return `https://vidnest.fun/animepahe/${id}/${ep}/${animepaheType.value || "sub"}`;
        }

        if (mode === "movie") {
          const id = requireValue(movieId, "Movie ID");
          if (!id) return "";

          switch (serverOverride) {
            case "vidcore":
              return `https://vidcore.net/movie/${id}`;
            case "vidgod":
              return `https://vidgod.net/movie/${id}`;
            case "vidfast":
              return `https://vidfast.vc/movie/${id}?autoPlay=true`;
            case "videasy":
              return `https://player.videasy.net/movie/${id}`;
            case "vidnest":
            default:
              return `https://vidnest.fun/movie/${id}`;
          }
        }

        const id = requireValue(tvId, "TV Show ID");
        if (!id) return "";

        const season = requireValue(tvSeason, "Season");
        if (!season) return "";

        const ep = requireValue(tvEpisode, "Episode");
        if (!ep) return "";

        switch (serverOverride) {
          case "vidcore":
            return `https://vidcore.net/tv/${id}/${season}/${ep}`;
          case "vidgod":
            return `https://vidgod.net/tv/${id}/${season}/${ep}`;
          case "vidfast":
            return `https://vidfast.vc/tv/${id}/${season}/${ep}?autoPlay=true`;
          case "videasy":
            return `https://player.videasy.net/tv/${id}/${season}/${ep}`;
          case "vidnest":
          default:
            return `https://vidnest.fun/tv/${id}/${season}/${ep}`;
        }
      }

      function visibleServerLabel(server) {
        if (mode === "anime") {
          return server === "vidnest" ? "Srv1" : "Srv2";
        }

        const labels = {
          vidnest: "Srv1",
          vidcore: "Srv2",
          vidgod: "Srv3",
          vidfast: "Srv4",
          videasy: "Srv5"
        };

        return labels[server] || server;
      }

      function updateServerPanel() {
        const allowed = allowedServersForMode();
        serverPanel.hidden = allowed.length === 0;

        serverButtons.forEach(button => {
          const isAllowed = allowed.includes(button.dataset.server);
          const selected = isAllowed && button.dataset.server === activeServer;

          button.hidden = !isAllowed;
          button.textContent = visibleServerLabel(button.dataset.server);
          button.classList.toggle("active", selected);
          button.setAttribute("aria-pressed", String(selected));
        });

        requestAnimationFrame(syncSidebarHeight);
      }

      function setActiveServer(server, reload = true) {
        const allowed = allowedServersForMode();
        if (!allowed.includes(server)) return;

        activeServer = server;
        localStorage.setItem(serverStorageKey(), activeServer);
        updateServerPanel();

        // Always rebuild the target URL from the currently selected title/ID,
        // season, and episode. This prevents a server switch from reverting
        // to values from a previous movie or show.
        if (reload && empty.classList.contains("hidden")) {
          const nextUrl = buildUrl(activeServer);
          if (nextUrl) {
            player.src = nextUrl;
            saveValues();
          }
        }
      }

      function saveValues() {
        localStorage.setItem("lastMode", mode);

        localStorage.setItem("lastAnimeId", animeId.value);
        localStorage.setItem("lastAnimeEpisode", animeEpisode.value || "1");
        localStorage.setItem("lastAnimeTotalEpisodes", animeEpisode.dataset.totalEpisodes || "1");
        localStorage.setItem("lastAnimeType", animeType.value);

        localStorage.setItem("lastAnimepaheId", animepaheId.value);
        localStorage.setItem("lastAnimepaheEpisode", animepaheEpisode.value || "1");
        localStorage.setItem("lastAnimepaheTotalEpisodes", animepaheEpisode.dataset.totalEpisodes || "1");
        localStorage.setItem("lastAnimepaheType", animepaheType.value);

        localStorage.setItem("lastMovieId", movieId.value);
        localStorage.setItem("lastMovieSearch", movieSearch.value || "");

        localStorage.setItem("lastTvId", tvId.value);
        localStorage.setItem("lastTvSearch", tvSearch.value || "");
        localStorage.setItem("lastTvSeason", tvSeason.value || "1");
        localStorage.setItem("lastTvEpisode", tvEpisode.value || "1");
      }

      function loadSavedValues() {
        mode = localStorage.getItem("lastMode") || "anime";

        // Start each page load clean. History is preserved, but no title,
        // season, episode, or previous iframe request is restored automatically.
        animeId.value = "";
        populateEpisodeDropdown(animeEpisode, "1", "1");
        animeType.value = "sub";
        animeSearch.value = "";
        selectedAnimeCard.classList.remove("show");

        animepaheId.value = "";
        populateEpisodeDropdown(animepaheEpisode, "1", "1");
        animepaheType.value = "sub";

        movieId.value = "";
        movieSearch.value = "";
        selectedMovieCard.classList.remove("show");

        tvId.value = "";
        tvSearch.value = "";
        populateSeasonDropdown(tvSeason, "1", "1");
        populateEpisodeDropdown(tvEpisode, "1", "1");
        selectedTvCard.classList.remove("show");

        player.removeAttribute("src");
        empty.classList.remove("hidden");
        videoTitle.textContent = "MemeTV";
        meta.textContent = mode === "movie"
          ? "Search and select a movie."
          : mode === "tv"
            ? "Search and select a TV show, then choose season and episode."
            : "Search and select an anime, then choose episode/sub or dub.";
      }

      function setMode(nextMode) {
        mode = nextMode;
        mediaMode.value = mode;

        const selectedOption = document.querySelector(`.custom-option[data-value="${mode}"]`);
        mediaModeButton.textContent = selectedOption ? selectedOption.textContent : "Anime";

        document.querySelectorAll(".custom-option").forEach(option => {
          option.classList.toggle("active", option.dataset.value === mode);
        });

        document.querySelectorAll(".form-section").forEach(section => section.classList.remove("active"));
        document.getElementById(`${mode}Form`).classList.add("active");

        const showAnimeSearch = mode === "anime" || mode === "animepahe";
        animeSearchBox.style.display = showAnimeSearch ? "block" : "none";
        movieSearchBox.style.display = mode === "movie" ? "block" : "none";
        tvSearchBox.style.display = mode === "tv" ? "block" : "none";

        if (!showAnimeSearch) {
          searchResults.innerHTML = "";
          searchResults.classList.remove("open");
          selectedAnimeCard.classList.remove("show");
        }

        if (mode !== "movie") {
          movieResults.innerHTML = "";
          movieResults.classList.remove("open");
        }

        if (mode !== "tv") {
          tvResults.innerHTML = "";
          tvResults.classList.remove("open");
        }

        loadBtn.textContent = "Refresh/Retry";

        if (mode === "movie") {
          prevBtn.style.display = "none";
          nextBtn.style.display = "none";
          videoTitle.textContent = "MemeTV";
          meta.textContent = "Search and select a movie.";
          updateSelectedMovieCard(movieId.value);
        } else if (mode === "tv") {
          prevBtn.style.display = "";
          nextBtn.style.display = "";
          videoTitle.textContent = "MemeTV";
          meta.textContent = "Search and select a TV show, then choose season and episode.";
          updateSelectedTvCard(tvId.value);
        } else {
          prevBtn.style.display = "";
          nextBtn.style.display = "";
          videoTitle.textContent = "MemeTV";
          meta.textContent = "Search and select an anime, then choose episode/sub or dub.";
          updateSelectedAnimeCard(mode === "animepahe" ? animepaheId.value : animeId.value);
        }

        ensureValidServerForMode();
        updateServerPanel();
        localStorage.setItem("lastMode", mode);
      }

      async function currentHistoryItem(url) {
        if (mode === "anime") {
          const animeName = await getAniListTitle(animeId.value);

          return {
            mode,
            url,
            label: `${animeName || "Anime"} • Episode ${animeEpisode.value} • ${animeType.value.toUpperCase()}`,
            animeId: animeId.value,
            animeEpisode: animeEpisode.value,
            animeTotalEpisodes: animeEpisode.dataset.totalEpisodes || "1",
            animeType: animeType.value,
            animeName
          };
        }

        if (mode === "animepahe") {
          const animeName = await getAniListTitle(animepaheId.value);

          return {
            mode,
            url,
            label: `${animeName || "AnimePahe"} • Episode ${animepaheEpisode.value} • ${animepaheType.value.toUpperCase()}`,
            animepaheId: animepaheId.value,
            animepaheEpisode: animepaheEpisode.value,
            animepaheTotalEpisodes: animepaheEpisode.dataset.totalEpisodes || "1",
            animepaheType: animepaheType.value,
            animeName
          };
        }

        if (mode === "movie") {
          const info = movieMetaCache[movieId.value] || {};
          return {
            mode,
            url,
            label: `${info.name || "Movie"}`,
            movieId: movieId.value,
            movieName: info.name || movieSearch.value || "",
            movieImage: info.image || "",
            movieSubline: info.subline || ""
          };
        }

        const info = tvMetaCache[tvId.value] || {};
        return {
          mode,
          url,
          label: `${info.name || tvSearch.value || "TV Show"} • S${tvSeason.value}E${tvEpisode.value}`,
          tvId: tvId.value,
          tvSeason: tvSeason.value,
          tvEpisode: tvEpisode.value,
          tvName: info.name || tvSearch.value || "",
          tvImage: info.image || "",
          tvSubline: info.subline || ""
        };
      }

      function addHistory(item) {
        let items = [];

        try {
          items = JSON.parse(localStorage.getItem("vidnestHistory") || "[]");
        } catch {}

        items = items.filter(existing => existing.url !== item.url);
        items.unshift(item);
        items = items.slice(0, 30);

        localStorage.setItem("vidnestHistory", JSON.stringify(items));
        renderHistory();
      }

      async function applyHistoryItem(item) {
        if (!item || !item.mode || !item.url) return;

        setMode(item.mode);
if (item.mode === "anime") {
          animeId.value = item.animeId || "";
          animeType.value = item.animeType || "sub";

          populateEpisodeDropdown(
            animeEpisode,
            item.animeTotalEpisodes || item.animeEpisode || "1",
            item.animeEpisode || "1"
          );

          await refreshAnimeInfoForHistory(item);

          animeSearch.value = item.animeName || "";
          updateSelectedAnimeCard(item.animeId);
        } else if (item.mode === "animepahe") {
          animepaheId.value = item.animepaheId || "";
          animepaheType.value = item.animepaheType || "sub";

          populateEpisodeDropdown(
            animepaheEpisode,
            item.animepaheTotalEpisodes || item.animepaheEpisode || "1",
            item.animepaheEpisode || "1"
          );

          await refreshAnimeInfoForHistory(item);

          animeSearch.value = item.animeName || "";
          updateSelectedAnimeCard(item.animepaheId);
        } else if (item.mode === "movie") {
          movieId.value = item.movieId || "";

          try {
            const movie = await tmdbRequest(`/movie/${item.movieId}?language=en-US`);
            movieSearch.value = movieDisplayName(movie);
            movieMetaCache[item.movieId] = {
              name: movieDisplayName(movie),
              image: tmdbImage(movie.poster_path),
              subline: [
                yearFromDate(movie.release_date),
                movie.runtime ? `${movie.runtime} min` : ""
              ].filter(Boolean).join(" • ")
            };
            updateSelectedMovieCard(item.movieId);
            item.movieName = movieMetaCache[item.movieId].name;
            item.movieImage = movieMetaCache[item.movieId].image;
            item.movieSubline = movieMetaCache[item.movieId].subline;
            item.label = item.movieName || movieDisplayName(movie);
          } catch {
            movieSearch.value = item.movieName || "";
            movieMetaCache[item.movieId] = {
              name: item.movieName || `Movie ${item.movieId}`,
              image: item.movieImage || "",
              subline: item.movieSubline || ""
            };
            updateSelectedMovieCard(item.movieId);
          }
        } else if (item.mode === "tv") {
          tvId.value = item.tvId || "";

          try {
            const show = await tmdbRequest(`/tv/${item.tvId}?language=en-US`);
            tvSearch.value = tvDisplayName(show);
            tvMetaCache[item.tvId] = {
              name: tvDisplayName(show),
              image: tmdbImage(show.poster_path),
              subline: tvSubline(show),
              seasons: show.seasons || []
            };
            populateTvSeasons(show, item.tvSeason || "1");
            await populateTvEpisodes(item.tvId, tvSeason.value, item.tvEpisode || "1");
            updateSelectedTvCard(item.tvId);
            item.tvName = tvMetaCache[item.tvId].name;
            item.tvImage = tvMetaCache[item.tvId].image;
            item.tvSubline = tvMetaCache[item.tvId].subline;
            item.label = `${item.tvName || tvDisplayName(show)} • S${tvSeason.value}E${tvEpisode.value}`;
          } catch {
            tvSearch.value = item.tvName || "";
            tvMetaCache[item.tvId] = {
              name: item.tvName || `TV Show ${item.tvId}`,
              image: item.tvImage || "",
              subline: item.tvSubline || ""
            };
            populateEpisodeDropdown(tvSeason, item.tvSeason || "1", item.tvSeason || "1");
            populateEpisodeDropdown(tvEpisode, item.tvEpisode || "1", item.tvEpisode || "1");
            updateSelectedTvCard(item.tvId);
          }
        }

        const refreshedUrl = buildUrl() || item.url;
        player.src = refreshedUrl;
        empty.classList.add("hidden");

        videoTitle.textContent = item.label?.split(" • ")[0] || "MemeTV";
        meta.textContent = item.label || "Loaded from history";

        item.url = refreshedUrl;
        saveValues();
        addHistory(item);
      }

      function renderHistory() {
        const box = document.getElementById("historyList");
        box.innerHTML = "";

        let items = [];

        try {
          items = JSON.parse(localStorage.getItem("vidnestHistory") || "[]");
        } catch {}

        if (!items.length) {
          box.innerHTML = '<div style="color:#aaa;">No history yet.</div>';
          return;
        }

        items.forEach(item => {
          const b = document.createElement("button");
          b.innerHTML = `<span>${item.label || item.url}</span><span style="color:#94a3b8;font-size:15px;">ⓘ</span>`;
          b.onclick = () => applyHistoryItem(item);
          box.appendChild(b);
        });

        requestAnimationFrame(syncSidebarHeight);
      }

      async function loadMedia() {
        const url = buildUrl();
        if (!url) {
          player.removeAttribute("src");
          empty.classList.remove("hidden");
          videoTitle.textContent = "MemeTV";
          meta.textContent = mode === "movie"
            ? "Search and select a movie."
            : mode === "tv"
              ? "Search and select a TV show, then choose season and episode."
              : "Search and select an anime, then choose episode/sub or dub.";
          return;
        }

        player.src = url;
        empty.classList.add("hidden");
        saveValues();

        let item;

        if (mode === "anime") {
          meta.textContent = `Loading title... • Episode ${animeEpisode.value} • ${animeType.value.toUpperCase()}`;
          item = await currentHistoryItem(url);
          videoTitle.textContent = item.animeName || "MemeTV";
          meta.textContent = item.label;
        } else if (mode === "animepahe") {
          meta.textContent = `Loading title... • Episode ${animepaheEpisode.value} • ${animepaheType.value.toUpperCase()}`;
          item = await currentHistoryItem(url);
          videoTitle.textContent = item.animeName || "MemeTV";
          meta.textContent = item.label;
        } else if (mode === "movie") {
          const refreshedInfo = await ensureMovieInfo(movieId.value);
          const info = refreshedInfo || movieMetaCache[movieId.value] || {};
          const movieName = info.name || movieSearch.value || "Movie";

          videoTitle.textContent = movieName;
          meta.textContent = movieName;

          if (movieName && movieName !== "Movie") {
            movieSearch.value = movieName;
            updateSelectedMovieCard(movieId.value);
          }

          item = await currentHistoryItem(url);
        } else {
          const refreshedInfo = await ensureTvInfo(tvId.value);
          const info = refreshedInfo || tvMetaCache[tvId.value] || {};
          const showName = info.name || tvSearch.value || "TV Show";

          videoTitle.textContent = showName;
          meta.textContent = `${showName} • Season ${tvSeason.value} • Episode ${tvEpisode.value}`;

          if (showName && showName !== "TV Show") {
            tvSearch.value = showName;
            updateSelectedTvCard(tvId.value);
          }

          item = await currentHistoryItem(url);
        }

        addHistory(item);
      }

      function changeEpisode(amount) {
        if (mode === "anime") {
          const current = Number(cleanMinOne(animeEpisode.value));
          const total = Number(animeEpisode.dataset.totalEpisodes || "1");
          animeEpisode.value = String(Math.min(total, Math.max(1, current + amount)));
          loadMedia();
          return;
        }

        if (mode === "animepahe") {
          const current = Number(cleanMinOne(animepaheEpisode.value));
          const total = Number(animepaheEpisode.dataset.totalEpisodes || "1");
          animepaheEpisode.value = String(Math.min(total, Math.max(1, current + amount)));
          loadMedia();
          return;
        }

        if (mode === "tv") {
          const options = Array.from(tvEpisode.options).map(option => Number(option.value));
          const current = Number(cleanMinOne(tvEpisode.value));
          const min = options.length ? Math.min(...options) : 1;
          const max = options.length ? Math.max(...options) : Math.max(1, current + amount);
          tvEpisode.value = String(Math.min(max, Math.max(min, current + amount)));
          loadMedia();
        }
      }

      
      async function loadTodoList() {
        try {
          const response = await fetch("todo.json", { cache: "no-store" });
          if (!response.ok) throw new Error("Could not load todo.json");
          const data = await response.json();
          const items = Array.isArray(data) ? data : (Array.isArray(data.items) ? data.items : []);
          todoList.innerHTML = "";
          if (!items.length) {
            todoList.innerHTML = '<div class="todo-empty">No pending items.</div>';
            return;
          }
          items.forEach(item => {
            const text = typeof item === "string" ? item : (item.text || item.title || "");
            if (!text) return;
            const div = document.createElement("div");
            div.className = "todo-item";
            div.textContent = text;
            todoList.appendChild(div);
          });
          if (!todoList.children.length) todoList.innerHTML = '<div class="todo-empty">No pending items.</div>';
        } catch {
          if (location.protocol === "file:") {
            todoList.innerHTML = `
              <div class="todo-empty">
                todo.json cannot load when opening index.html directly from your PC.<br><br>
                Host the folder through your mini server, GitHub Pages, or a local server so todo.json can be fetched.
              </div>
            `;
          } else {
            todoList.innerHTML = '<div class="todo-empty">Could not load todo.json. Make sure todo.json is in the same folder as index.html.</div>';
          }
        }
      }

      todoButton.addEventListener("click", event => {
        event.stopPropagation();
        todoWrap.classList.toggle("open");
        if (todoWrap.classList.contains("open")) loadTodoList();
      });

      mediaModeButton.addEventListener("click", event => {
        event.stopPropagation();
        mediaModeCustom.classList.toggle("open");
      });

      document.querySelectorAll(".custom-option").forEach(option => {
        option.addEventListener("click", event => {
          event.stopPropagation();
          setMode(option.dataset.value);
          mediaModeCustom.classList.remove("open");
        });
      });

      animeSearch.addEventListener("input", queueAnimeSearch);
      animeSearch.addEventListener("keydown", event => {
        if (event.key === "Enter") searchAniList();
      });
      animeSearch.addEventListener("focus", () => {
        if (searchResults.innerHTML.trim()) searchResults.classList.add("open");
      });

      movieSearch.addEventListener("input", () => queueTmdbSearch("movie"));
      movieSearch.addEventListener("keydown", event => {
        if (event.key === "Enter") searchTmdb("movie");
      });
      movieSearch.addEventListener("focus", () => {
        if (movieResults.innerHTML.trim()) movieResults.classList.add("open");
      });

      tvSearch.addEventListener("input", () => queueTmdbSearch("tv"));
      tvSearch.addEventListener("keydown", event => {
        if (event.key === "Enter") searchTmdb("tv");
      });
      tvSearch.addEventListener("focus", () => {
        if (tvResults.innerHTML.trim()) tvResults.classList.add("open");
      });

      clearSelectedMovie.addEventListener("click", () => {
        movieId.value = "";
        movieSearch.value = "";
        selectedMovieCard.classList.remove("show");
        movieResults.innerHTML = "";
        movieResults.classList.remove("open");
      });

      clearSelectedTv.addEventListener("click", () => {
        tvId.value = "";
        tvSearch.value = "";
        selectedTvCard.classList.remove("show");
        tvResults.innerHTML = "";
        tvResults.classList.remove("open");
        populateSeasonDropdown(tvSeason, "1", "1");
        populateEpisodeDropdown(tvEpisode, "1", "1");
      });

      tvSeason.addEventListener("change", async () => {
        if (tvId.value) {
          await populateTvEpisodes(tvId.value, tvSeason.value, "1");
          tvEpisode.value = "1";
          saveValues();
          if (empty.classList.contains("hidden")) loadMedia();
        }
      });

      tvEpisode.addEventListener("change", () => {
        saveValues();
        if (empty.classList.contains("hidden")) loadMedia();
      });

      clearSelectedAnime.addEventListener("click", () => {
        animeId.value = "";
        animepaheId.value = "";
        animeSearch.value = "";
        selectedAnimeCard.classList.remove("show");
        searchResults.innerHTML = "";
        searchResults.classList.remove("open");
      });

      loadBtn.addEventListener("click", loadMedia);

      [animeEpisode, animeType, animepaheEpisode, animepaheType].forEach(control => {
        control.addEventListener("change", () => {
          if (empty.classList.contains("hidden")) loadMedia();
        });
      });

      prevBtn.addEventListener("click", () => changeEpisode(-1));
      nextBtn.addEventListener("click", () => changeEpisode(1));

      document.querySelectorAll("input, select").forEach(input => {
        input.addEventListener("keydown", event => {
          if (event.key === "Enter" && input !== animeSearch) loadMedia();
        });
      });

      document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener("input", () => {
          if (Number(input.value) < 1) input.value = "1";
        });

        input.addEventListener("blur", () => {
          input.value = cleanMinOne(input.value);
        });
      });

      clearHistoryBtn.addEventListener("click", () => {
        localStorage.removeItem("vidnestHistory");
        renderHistory();
      });

      document.addEventListener("click", event => {
        if (!animeSearchBox.contains(event.target)) searchResults.classList.remove("open");
        if (!movieSearchBox.contains(event.target)) movieResults.classList.remove("open");
        if (!tvSearchBox.contains(event.target)) tvResults.classList.remove("open");
        if (!mediaModeCustom.contains(event.target)) mediaModeCustom.classList.remove("open");
        if (!todoWrap.contains(event.target)) todoWrap.classList.remove("open");
      });

      serverButtons.forEach(button => {
        button.addEventListener("click", () => {
          setActiveServer(button.dataset.server);
        });
      });


      function syncSidebarHeight() {
        if (!contentColumn || !sidebarPanel) return;

        if (window.matchMedia("(max-width: 1050px)").matches) {
          sidebarPanel.style.height = "";
          return;
        }

        const height = Math.ceil(contentColumn.getBoundingClientRect().height);
        sidebarPanel.style.height = `${height}px`;
      }

      const sidebarResizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(syncSidebarHeight);
      });

      if (contentColumn) {
        sidebarResizeObserver.observe(contentColumn);
      }

      window.addEventListener("resize", () => {
        requestAnimationFrame(syncSidebarHeight);
      });

      loadSavedValues();
      setMode(mode);
      ensureValidServerForMode();
      updateServerPanel();
      renderHistory();
      requestAnimationFrame(syncSidebarHeight);
    })();

(function(){
  const block = document.getElementById('filterCode');
  const copy = document.getElementById('filterCopy');
  const text = 'https://raw.githubusercontent.com/Lep255/memetv/refs/heads/main/memetv-filter.txt';

  if (!block || !copy) return;

  block.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      copy.textContent = '✓ Copied!';
      setTimeout(() => copy.textContent = '📋 Copy', 1800);
    } catch (e) {
      copy.textContent = 'Copy failed';
      setTimeout(() => copy.textContent = '📋 Copy', 1800);
    }
  });
})();
