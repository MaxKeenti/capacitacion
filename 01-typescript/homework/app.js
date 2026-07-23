const API_BASE = "https://pokeapi.co/api/v2";
const ROSTER_CACHE_KEY = "trainer-terminal:pokemon-species:v1";

const elements = {
  list: document.querySelector("#pokemon-list"),
  search: document.querySelector("#pokemon-search"),
  rosterCount: document.querySelector("#roster-count"),
  rosterSummary: document.querySelector("#roster-summary"),
  detail: document.querySelector("#pokemon-detail"),
  detailNumber: document.querySelector("#detail-number"),
};

const state = {
  allPokemon: [],
  filteredPokemon: [],
  selectedName: "",
  detailCache: new Map(),
  detailRequest: null,
};

function getIdFromUrl(url) {
  const match = url.match(/\/(\d+)\/?$/);
  return match ? Number(match[1]) : 0;
}

function formatNumber(id) {
  return id ? `#${String(id).padStart(4, "0")}` : "#----";
}

function formatName(name) {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readCachedRoster() {
  try {
    const cached = sessionStorage.getItem(ROSTER_CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function cacheRoster(roster) {
  try {
    sessionStorage.setItem(ROSTER_CACHE_KEY, JSON.stringify(roster));
  } catch {
    // The Pokédex works normally if browser storage is unavailable.
  }
}

async function fetchRoster() {
  const cachedRoster = readCachedRoster();
  if (cachedRoster) return cachedRoster;

  const firstPageResponse = await fetch(`${API_BASE}/pokemon-species?limit=1`);
  if (!firstPageResponse.ok) throw new Error("The national index did not respond.");

  const { count } = await firstPageResponse.json();
  const rosterResponse = await fetch(`${API_BASE}/pokemon-species?limit=${count}`);
  if (!rosterResponse.ok) throw new Error("The full national index could not be retrieved.");

  const { results } = await rosterResponse.json();
  const roster = results.map((pokemon) => ({
    ...pokemon,
    id: getIdFromUrl(pokemon.url),
  }));

  cacheRoster(roster);
  return roster;
}

function renderRoster() {
  const fragment = document.createDocumentFragment();

  if (!state.filteredPokemon.length) {
    const message = document.createElement("p");
    message.className = "roster-message";
    message.textContent = "NO SPECIMENS MATCH THIS SEARCH.";
    fragment.append(message);
  } else {
    state.filteredPokemon.forEach((pokemon) => {
      const button = document.createElement("button");
      const selected = pokemon.name === state.selectedName;

      button.type = "button";
      button.className = "pokemon-entry";
      button.dataset.pokemonName = pokemon.name;
      button.setAttribute("aria-current", String(selected));
      button.setAttribute("aria-label", `${formatNumber(pokemon.id)} ${formatName(pokemon.name)}`);
      button.innerHTML = `
        <span class="entry-number">${formatNumber(pokemon.id)}</span>
        <span class="entry-name">${escapeHtml(formatName(pokemon.name))}</span>
      `;
      fragment.append(button);
    });
  }

  elements.list.replaceChildren(fragment);
  elements.list.setAttribute("aria-busy", "false");
  elements.rosterCount.textContent = `${state.allPokemon.length} FOUND`;
  elements.rosterSummary.textContent = `${state.filteredPokemon.length} OF ${state.allPokemon.length} DISPLAYED`;
}

function showRosterError() {
  elements.list.setAttribute("aria-busy", "false");
  elements.list.innerHTML = `
    <div class="detail-error roster-message">
      <p>DATABASE LINK FAILED.</p>
      <p>CHECK YOUR CONNECTION, THEN TRY AGAIN.</p>
      <button class="retry-button" type="button" data-action="retry-roster">RETRY LINK</button>
    </div>
  `;
  elements.rosterCount.textContent = "OFFLINE";
  elements.rosterSummary.textContent = "NO INDEX DATA";
}

function showDetailMessage(message) {
  elements.detail.setAttribute("aria-busy", "true");
  elements.detail.innerHTML = `
    <div class="screen-message">
      <span class="screen-cursor" aria-hidden="true">&gt;</span>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function getSprite(pokemon) {
  const blackWhiteSprite = pokemon.sprites?.versions?.["generation-v"]?.["black-white"]?.front_default;
  return blackWhiteSprite || pokemon.sprites?.front_default || pokemon.sprites?.other?.["official-artwork"]?.front_default || "";
}

function renderPokemon(pokemon) {
  const sprite = getSprite(pokemon);
  const name = formatName(pokemon.name);
  const types = [...pokemon.types].sort((a, b) => a.slot - b.slot);

  elements.detail.setAttribute("aria-busy", "false");
  elements.detailNumber.textContent = formatNumber(pokemon.id);
  elements.detail.innerHTML = `
    <article class="pokemon-record" aria-label="${escapeHtml(name)} record">
      <div class="sprite-well">
        ${sprite ? `<img src="${escapeHtml(sprite)}" alt="${escapeHtml(name)} pixel sprite">` : "<p>SPRITE UNAVAILABLE</p>"}
      </div>
      <div class="record-data">
        <p class="record-label">REGISTERED NAME</p>
        <h3 class="record-name">${escapeHtml(name)}</h3>
        <p class="type-label">ELEMENTAL TYPE</p>
        <div class="type-list">
          ${types
            .map(({ type }) => `<span class="type-badge" data-type="${escapeHtml(type.name)}">${escapeHtml(type.name)}</span>`)
            .join("")}
        </div>
      </div>
    </article>
  `;

  const image = elements.detail.querySelector("img");
  if (image && pokemon.sprites?.front_default && image.src !== pokemon.sprites.front_default) {
    image.addEventListener(
      "error",
      () => {
        image.src = pokemon.sprites.front_default;
      },
      { once: true },
    );
  }
}

function showDetailError() {
  elements.detail.setAttribute("aria-busy", "false");
  elements.detail.innerHTML = `
    <div class="detail-error">
      <p>SPECIMEN RECORD UNAVAILABLE.</p>
      <p>THE DATABASE LINK WAS INTERRUPTED.</p>
      <button class="retry-button" type="button" data-action="retry-detail">RETRY RECORD</button>
    </div>
  `;
}

function markSelectedRosterEntry() {
  elements.list.querySelectorAll(".pokemon-entry").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.pokemonName === state.selectedName));
  });
}

async function selectPokemon(name, { focus = false } = {}) {
  if (!name) return;

  state.selectedName = name;
  markSelectedRosterEntry();
  const rosterEntry = state.allPokemon.find((pokemon) => pokemon.name === name);
  elements.detailNumber.textContent = formatNumber(rosterEntry?.id ?? 0);

  if (focus) {
    const activeButton = elements.list.querySelector(`[data-pokemon-name="${CSS.escape(name)}"]`);
    activeButton?.focus();
  }

  if (state.detailCache.has(name)) {
    renderPokemon(state.detailCache.get(name));
    return;
  }

  state.detailRequest?.abort();
  state.detailRequest = new AbortController();
  showDetailMessage(`RETRIEVING ${formatName(name).toUpperCase()}`);

  try {
    const response = await fetch(`${API_BASE}/pokemon/${encodeURIComponent(name)}`, {
      signal: state.detailRequest.signal,
    });
    if (!response.ok) throw new Error("The selected record did not respond.");

    const pokemon = await response.json();
    state.detailCache.set(name, pokemon);
    if (state.selectedName === name) renderPokemon(pokemon);
  } catch (error) {
    if (error.name !== "AbortError" && state.selectedName === name) showDetailError();
  }
}

function filterRoster(query) {
  const normalizedQuery = query.trim().toLowerCase().replace(/^#/, "");
  state.filteredPokemon = state.allPokemon.filter((pokemon) => {
    const formattedName = formatName(pokemon.name).toLowerCase();
    return pokemon.name.includes(normalizedQuery) || formattedName.includes(normalizedQuery) || String(pokemon.id).startsWith(normalizedQuery);
  });
  renderRoster();
}

async function loadPokedex() {
  elements.list.setAttribute("aria-busy", "true");
  elements.list.innerHTML = '<p class="roster-message">RETRIEVING NATIONAL INDEX<span class="loading-dots" aria-hidden="true">...</span></p>';
  elements.search.disabled = true;
  showDetailMessage("SYNCHRONIZING DATABASE");

  try {
    state.allPokemon = await fetchRoster();
    state.filteredPokemon = state.allPokemon;
    elements.search.disabled = false;
    renderRoster();
    await selectPokemon("bulbasaur");
  } catch {
    showRosterError();
    showDetailError();
  }
}

elements.search.addEventListener("input", (event) => filterRoster(event.target.value));

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pokemon-name]");
  if (button) selectPokemon(button.dataset.pokemonName, { focus: true });
  if (event.target.closest('[data-action="retry-roster"]')) loadPokedex();
});

elements.list.addEventListener("keydown", (event) => {
  const currentButton = event.target.closest("[data-pokemon-name]");
  if (!currentButton || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

  const currentIndex = state.filteredPokemon.findIndex((pokemon) => pokemon.name === currentButton.dataset.pokemonName);
  const lastIndex = state.filteredPokemon.length - 1;
  const nextIndex = {
    ArrowDown: Math.min(currentIndex + 1, lastIndex),
    ArrowUp: Math.max(currentIndex - 1, 0),
    Home: 0,
    End: lastIndex,
  }[event.key];

  event.preventDefault();
  selectPokemon(state.filteredPokemon[nextIndex]?.name, { focus: true });
});

elements.detail.addEventListener("click", (event) => {
  if (event.target.closest('[data-action="retry-detail"]')) selectPokemon(state.selectedName);
});

loadPokedex();
