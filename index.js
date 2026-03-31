// App state shared across handlers:
// - movies: lightweight search results from OMDB `s=` endpoint
// - detailedMovies: enriched movie objects from OMDB `i=` endpoint
let movies = [];
let detailedMovies = [];
let searchDebounceTimer;
let latestSearchId = 0;

// Converts raw OMDB error messages into friendlier UI text.
// Keeps API wording separate from user-facing wording.
function mapOmdbErrorMessage(errorMessage) {
  if (!errorMessage) return "No matches found.";
  const normalized = errorMessage.toLowerCase();
  if (normalized.includes("request limit reached"))
    return "OMDB request limit reached. Try again tomorrow or use a new API key.";
  if (normalized.includes("invalid api key"))
    return "Invalid OMDB API key. Update your API key and try again.";
  if (normalized.includes("too many results"))
    return "Too many matches. Please type a more specific title.";
  if (normalized.includes("movie not found")) return "No matches found.";
  return errorMessage;
}

// Shows or hides the loading spinner/message in the movie grid.
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
  // Disable sorting while loading to avoid conflicting re-sorts.
  if (filterEl) filterEl.disabled = isLoading;
}

// Renders the movie grid or an empty-state message.
async function renderMovies(movies, message = "No movies found.") {
  const movieListEl = document.querySelector(".movie-list");
  if (!movies.length) {
    movieListEl.innerHTML = `
      <p class="movie-list__message" role="status" aria-live="polite">
        <span class="movie-list__message-body">
          <span class="movie-list__message-icon" aria-hidden="true">i</span>
          <span class="movie-list__message-text">${message}</span>
        </span>
      </p>
    `;
    return;
  }
  movieListEl.innerHTML = movies.map(showMovieInfo).join("");
}

async function onSearchChange(event) {
  const query = event.target.value.trim();
  // Each keystroke gets a unique id so we can ignore stale responses later.
  const searchId = ++latestSearchId;

  // Debounce prevents firing API requests on every single key press.
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
    // Fetch a list of matching titles.
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
    if (!movies.length) {
      detailedMovies = [];
      renderMovies([], "No matches found.");
      return;
    }

    // Fetch full details for each movie card (up to 6).
    // Each request is isolated so one failure doesn't break the batch.
    const detailPromises = movies.slice(0, 6).map(async (movie) => {
      try {
        const res = await fetch(
          `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=92fb2c25`,
        );
        const data = await res.json();
        return data.Response === "False" ? movie : data;
      } catch {
        // Fallback to the lightweight movie object if details fail.
        return movie;
      }
    });
    detailedMovies = await Promise.all(detailPromises);

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

  // requestAnimationFrame allows the loading state to paint before sort work runs.
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

// Renders a single movie card for the grid.
function showMovieInfo(movie) {
  // Defensive formatting for missing OMDB fields.
  const posterSrc =
    movie.Poster && movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/400x600?text=No+Poster";
  return `<div class="movie">
    <div class="movie-card--poster" onclick="openPlotModal('${movie.imdbID}')">
      <div class="movie-card__container">
        <figure>
          <img src="${posterSrc}" alt="${movie.Title || 'Movie'}">
        </figure>
      </div>
    </div>
    <div class="movie-card--info" onclick="openPlotModal('${movie.imdbID}')">
      <h3>${movie.Title || 'Untitled'}</h3>
      <p><b>Released: ${movie.Released || 'Unknown'}</b></p>
      <p><b>Runtime: ${movie.Runtime && movie.Runtime !== 'N/A' ? movie.Runtime : 'Unknown'}</b></p>
      <p><b>Genre: ${movie.Genre || 'Unknown'}</b></p>
      <p><b>imdb Rating: ${movie.imdbRating || 'N/A'}</b></p>
    </div>
  </div>`;
}

// Opens the modal with detailed info for the selected movie.
function openPlotModal(imdbID) {
  const movie = detailedMovies.find((item) => item.imdbID === imdbID);
  if (!movie) return;
  const modal = document.querySelector("#plot-modal");
  const poster = document.querySelector("#plot-modal-poster");
  const title = document.querySelector("#plot-modal-title");
  const meta = document.querySelector("#plot-modal-meta");
  const runtime = document.querySelector("#plot-modal-runtime");
  const cast = document.querySelector("#plot-modal-cast");
  const text = document.querySelector("#plot-modal-text");
  // Fallback poster avoids broken image icons for N/A values.
  const posterSrc =
    movie.Poster && movie.Poster !== "N/A"
      ? movie.Poster
      : "https://via.placeholder.com/400x600?text=No+Poster";
  poster.src = posterSrc;
  poster.alt = `${movie.Title || "Movie"} poster`;
  title.textContent = movie.Title || "Untitled";
  // Style each field on its own line in the modal
  const type = movie.Type && movie.Type !== "N/A" ? movie.Type.charAt(0).toUpperCase() + movie.Type.slice(1) : "Unknown";
  meta.innerHTML = `<div><b>Released:</b> ${movie.Released || "Unknown"}</div><div><b>Genre:</b> ${movie.Genre || "Unknown Genre"}</div><div><b>Type:</b> ${type}</div>`;
  runtime.innerHTML = `<div><b>Runtime:</b> ${movie.Runtime && movie.Runtime !== "N/A" ? movie.Runtime : "Unknown runtime"}</div>`;
  cast.innerHTML = `<div><b>Director:</b> ${movie.Director || "Unknown"}</div><div><b>Cast:</b> ${movie.Actors && movie.Actors !== "N/A" ? movie.Actors : "Unknown cast"}</div>`;
  text.innerHTML = `<div class="plot-modal__container"><b>Plot:</b><p class="plot-modal__para"> ${movie.Plot && movie.Plot !== "N/A" ? movie.Plot : "Plot description unavailable."}</p></div>`;
  // Toggle modal visibility state and accessibility attribute together.
  modal.classList.add("plot-modal--open");
  modal.setAttribute("aria-hidden", "false");
}

// Closes the modal dialog.
function closePlotModal() {
  const modal = document.querySelector("#plot-modal");
  modal.classList.remove("plot-modal--open");
  modal.setAttribute("aria-hidden", "true");
}

// Close modal when clicking the backdrop or pressing Escape.
document.addEventListener("click", (event) => {
  const modal = document.querySelector("#plot-modal");
  if (event.target === modal) closePlotModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePlotModal();
});

// Initial empty state.
renderMovies([], "Use the search bar to find movies");
