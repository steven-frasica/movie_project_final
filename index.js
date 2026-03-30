let movies = [];
let detailedMovies = [];
let searchDebounceTimer;
let latestSearchId = 0;

function mapOmdbErrorMessage(errorMessage) {
  if (!errorMessage) return "No matches found.";

  const normalized = errorMessage.toLowerCase();

  if (normalized.includes("request limit reached")) {
    return "OMDB request limit reached. Try again tomorrow or use a new API key.";
  }

  if (normalized.includes("invalid api key")) {
    return "Invalid OMDB API key. Update your API key and try again.";
  }

  if (normalized.includes("too many results")) {
    return "Too many matches. Please type a more specific title.";
  }

  if (normalized.includes("movie not found")) {
    return "No matches found.";
  }

  return errorMessage;
}

function setLoading(isLoading, message = "Loading movies...") {
  const movieListEl = document.querySelector(".movie-list");
  const filterEl = document.querySelector("#filter");

  if (isLoading) {
    movieListEl.innerHTML = `
      <div class="movie-list__loading" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <p>${message}</p>
      </div>
    `;
  }

  if (filterEl) filterEl.disabled = isLoading;
}

async function renderMovies(movies, message = "No movies found.") {
  const movieListEl = document.querySelector(".movie-list");
  
  if (!movies.length) {
    movieListEl.innerHTML = `<p class="movie-list__message">${message}</p>`;
    return;
  }

  movieListEl.innerHTML = movies.map((movie) => showMovieInfo(movie)).join("");
}

async function onSearchChange(event) {
  const query = event.target.value.trim();
  const searchId = ++latestSearchId;

  clearTimeout(searchDebounceTimer);

  if (!query) {
    movies = [];
    detailedMovies = [];
    renderMovies([], "Use the search bar to find movies");
    return;
  }

  searchDebounceTimer = setTimeout(() => {
    runSearch(query, searchId);
  }, 350);
}

async function runSearch(query, searchId) {
  if (searchId === latestSearchId) {
    setLoading(true, "Searching movies...");
  }

  try {
    const response = await fetch(
      `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=92fb2c25`,
    );
    const data = await response.json();

    // Ignore stale responses from older searches.
    if (searchId !== latestSearchId) return;

    if (data.Response === "False") {
      movies = [];
      detailedMovies = [];
      renderMovies([], mapOmdbErrorMessage(data.Error));
      return;
    }

    movies = data.Search ?? [];

    if (movies.length === 0) {
      detailedMovies = [];
      renderMovies([], "No matches found.");
      return;
    }

    const detailPromises = movies.slice(0, 6).map(async (movie) => {
      try {
      const res = await fetch(
        `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=92fb2c25`,
      );
      const data = await res.json();

      if (data.Response === "False") {
        return movie;
      }

      return data;
    } catch {
      return movie;
    }
    });
    const allMovies = await Promise.all(detailPromises);
    detailedMovies = allMovies;

    const filterEl = document.querySelector("#filter");

    if (filterEl && filterEl.value) {
      filterMovies(filterEl.value);
    } else {
      renderMovies(detailedMovies);
    }
  } catch (error) {
    if (searchId !== latestSearchId) return;
    detailedMovies = [];
    renderMovies([], "Search failed. Check your network and API key.");
  } finally {
    if (searchId === latestSearchId) {
      setLoading(false);
    }
  }
}

function filterMovies(filterValue) {
  if (!detailedMovies.length) return;

  setLoading(true, "Sorting...");

  requestAnimationFrame(() => {
    let sortedMovies;
    if (filterValue === "NEW_TO_OLD") {
      sortedMovies = [...detailedMovies].sort((a, b) => {
        const releasedA = new Date(a.Released).getTime() || 0;
        const releasedB = new Date(b.Released).getTime() || 0;
        return releasedB - releasedA;
      });
    } else if (filterValue === "OLD_TO_NEW") {
      sortedMovies = [...detailedMovies].sort((a, b) => {
        const releasedA = new Date(a.Released).getTime() || 0;
        const releasedB = new Date(b.Released).getTime() || 0;
        return releasedA - releasedB;
      });
    } else if (filterValue === "RATING_LOW_TO_HIGH") {
      sortedMovies = [...detailedMovies].sort((a, b) => {
        const ratingA = Number(a.imdbRating) || 0;
        const ratingB = Number(b.imdbRating) || 0;
        return ratingA - ratingB;
      });
    } else if (filterValue === "RATING_HIGH_TO_LOW") {
      sortedMovies = [...detailedMovies].sort((a, b) => {
        const ratingA = Number(a.imdbRating) || 0;
        const ratingB = Number(b.imdbRating) || 0;
        return ratingB - ratingA;
      });
    } else {
      sortedMovies = [...detailedMovies];
    }

    renderMovies(sortedMovies);
    setLoading(false);
  });
}

function showMovieInfo(movie) {
  const movieType =
    movie.Type && movie.Type !== "N/A"
      ? movie.Type.charAt(0).toUpperCase() + movie.Type.slice(1)
      : "Unknown";

  return `<div class="movie">
          <div class="movie-card--poster" onclick="openPlotModal('${movie.imdbID}')">
             <div class="movie-card__container">
              <figure>
                <img src="${movie.Poster}" alt="${movie.Title}">
              </figure>
              </div>
              </div>
              <div class="movie-card--info" onclick="openPlotModal('${movie.imdbID}')">
              <h3>${movie.Title}</h3>
              <p><b>Director: ${movie.Director}</b></p>
              <p><b>Actors: ${movie.Actors}</b></p>
              <p><b>Released:${movie.Released}</b></p>
              <p><b>Genre(s): ${movie.Genre}</b></p>
              <p><b>imdb Rating: ${movie.imdbRating}</b></p>
              <p><b>Type: ${movieType}</b></p>
              </div>
          </div>`;
}

function openPlotModal(imdbID) {
  const movie = detailedMovies.find((item) => item.imdbID === imdbID);
  if (!movie) return;
  
  const modal = document.querySelector("#plot-modal");
  const poster = document.querySelector("#plot-modal-poster");
  const title = document.querySelector("#plot-modal-title");
  const meta = document.querySelector("#plot-modal-meta");
  const text = document.querySelector("#plot-modal-text");

  const posterSrc =
    movie.Poster && movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/400x600?text=No+Poster";

  poster.src = posterSrc;
  poster.alt = `${movie.Title || "Movie"} poster`;

  title.textContent = movie.Title || "Untitled";
  meta.textContent = `${movie.Released || "Unknown"} - ${movie.Genre || "Unknown Genre"}`;
  text.textContent = movie.Plot && movie.Plot !== "N/A" ? movie.Plot : "Plot description unavailable.";

  modal.classList.add("plot-modal--open");
  modal.setAttribute("aria-hidden", "false");
}

function closePlotModal() {
  const modal = document.querySelector("#plot-modal");
  modal.classList.remove("plot-modal--open");
  modal.setAttribute("aria-hidden", "true");
}

document.addEventListener("click", (event) => {
  const modal = document.querySelector("#plot-modal");
  if (event.target === modal) closePlotModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePlotModal();
});




  
renderMovies([], "Use the search bar to find movies");
