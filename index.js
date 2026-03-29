let movies = [];
let detailedMovies = [];

function renderMovies(movies, message = "No movies found.") {
  const movieListEl = document.querySelector(".movie-list");

  if (!movies.length) {
    movieListEl.innerHTML = `<p class="movie-list__message">${message}</p>`;
    return;
  }

  movieListEl.innerHTML = movies.map((movie) => showMovieInfo(movie)).join("");
}

async function onSearchChange(event) {
  const query = event.target.value.trim();

  if (!query) {
    movies = [];
    detailedMovies = [];
    renderMovies([], "Start typing to search movies.");
    return;
  }
  const response = await fetch(
    `https://www.omdbapi.com/?s=${query}&apikey=8ad7256b`,
  );
  const data = await response.json();

  movies = data.Search ?? [];

  if (movies.length === 0) {
    detailedMovies = [];
    renderMovies([], "No matches found.");
    return;
  }

  const detailPromises = movies.slice(0, 6).map(async (movie) => {
    const res = await fetch(
      `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=8ad7256b`,
    );
    return await res.json();
  });
  const allMovies = await Promise.all(detailPromises);
  detailedMovies = allMovies;

  const filterEl = document.querySelector("#filter");

  if (filterEl && filterEl.value) {
    filterMovies(filterEl.value);
  } else {
    renderMovies(detailedMovies);
  }
}

function filterMovies(filterValue) {
  let sortedMovies;
  if (!detailedMovies.length) return;
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
}

function showMovieInfo(movie) {
  const movieType =
    movie.Type && movie.Type !== "N/A"
      ? movie.Type.charAt(0).toUpperCase() + movie.Type.slice(1)
      : "Unknown";

  return `<div class="movie">
          <div class="movie-card--poster">
            <div class="movie-card__container">
              <figure>
                <img src="${movie.Poster}" alt="">
                
              </figure>
              </div>
              </div>
              <div class="movie-card--info">
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

renderMovies([], "Start typing to search movies.");
