// https://www.omdbapi.com/?i=tt3896198&apikey=8ad7256b

async function renderMovies(movies) {
  // replace batman with event.target.value from the onchange of the input search bar
  const detailPromises = movies.map(async (movie) => {
    console.log("movie", movie);
    const res = await fetch(
      `https://www.omdbapi.com/?i=${movie.imdbID}&apikey=8ad7256b`,
    );
    return await res.json();
  });

  console.log("detailPromises", detailPromises);
  const allMovies = (await Promise.all(detailPromises)).slice(0, 6);
  const movieListEl = document.querySelector(".movie-list");
  movieListEl.innerHTML = allMovies
    .map((movie) => showMovieInfo(movie))
    .join("");
}

async function onSearchChange(event) {
  console.log(event.target.value);
  const response = await fetch(
    `https://www.omdbapi.com/?s=${event.target.value}&apikey=8ad7256b`,
  );
  const movies = await response.json();
  console.log("movies in onSearchChange", movies.Search);
  renderMovies(movies.Search);
}

function showMovieInfo(movies) {
  return `<div class="movie">
          <div class="movie-card--poster">
            <div class="movie-card__container">
              <figure>
                <img src="${movies.Poster}" alt="">
                
              </figure>
              </div>
              </div>
              <div class="movie-card--info">
              <h3>Title: ${movies.Title}</h3>
              <p><b>Director: ${movies.Director}</b></p>
              <p><b>Actors: ${movies.Actors}</b></p>
              <p><b>Released:${movies.Released}</b></p>
              <p><b>Genre(s): ${movies.Genre}</b></p>
              <p><b>imdb Rating: ${movies.imdbRating}</b></p>
              <p><b>Type: ${movies.Type.charAt(0).toUpperCase() + movies.Type.slice(1)}</b></p>
              </div>
          </div>`;
}

renderMovies();
