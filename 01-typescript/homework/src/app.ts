import {
  buildApiUrl,
  filterRoster,
  formatName,
  formatNumber,
  getSprite,
  PokeApiResource,
  toRosterEntries,
  type ApiListResponse,
  type NamedApiResource,
  type PokemonRecord,
  type PokemonRosterEntry,
} from "./pokedex.js";

const ROSTER_CACHE_KEY = "trainer-terminal:pokemon-species:v1";

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required interface element not found: ${selector}`);
  return element;
}

const elements = {
  list: getElement<HTMLDivElement>("#pokemon-list"),
  search: getElement<HTMLInputElement>("#pokemon-search"),
  rosterCount: getElement<HTMLParagraphElement>("#roster-count"),
  rosterSummary: getElement<HTMLParagraphElement>("#roster-summary"),
  detail: getElement<HTMLDivElement>("#pokemon-detail"),
  detailNumber: getElement<HTMLParagraphElement>("#detail-number"),
};

interface PokedexState {
  allPokemon: PokemonRosterEntry[];
  filteredPokemon: PokemonRosterEntry[];
  selectedName: string;
  detailCache: Map<string, PokemonRecord>;
  detailRequest?: AbortController;
}

const state: PokedexState = {
  allPokemon: [],
  filteredPokemon: [],
  selectedName: "",
  detailCache: new Map(),
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readCachedRoster(): PokemonRosterEntry[] | null {
  try {
    const cached = sessionStorage.getItem(ROSTER_CACHE_KEY);
    if (!cached) return null;

    const parsed: unknown = JSON.parse(cached);
    return Array.isArray(parsed) ? (parsed as PokemonRosterEntry[]) : null;
  } catch {
    return null;
  }
}

function cacheRoster(roster: PokemonRosterEntry[]): void {
  try {
    sessionStorage.setItem(ROSTER_CACHE_KEY, JSON.stringify(roster));
  } catch {
    // The Pokédex works normally if browser storage is unavailable.
  }
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`The database returned ${response.status}.`);
  return (await response.json()) as T;
}

async function fetchRoster(): Promise<PokemonRosterEntry[]> {
  const cachedRoster = readCachedRoster();
  if (cachedRoster) return cachedRoster;

  const firstPage = await getJson<ApiListResponse<NamedApiResource>>(
    buildApiUrl(PokeApiResource.PokemonSpecies, undefined, { limit: 1 }),
  );
  const completeList = await getJson<ApiListResponse<NamedApiResource>>(
    buildApiUrl(PokeApiResource.PokemonSpecies, undefined, { limit: firstPage.count }),
  );
  const roster = toRosterEntries(completeList.results);

  cacheRoster(roster);
  return roster;
}

function renderRoster(): void {
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

function showRosterError(): void {
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

function showDetailMessage(message: string): void {
  elements.detail.setAttribute("aria-busy", "true");
  elements.detail.innerHTML = `
    <div class="screen-message">
      <span class="screen-cursor" aria-hidden="true">&gt;</span>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function renderPokemon(pokemon: PokemonRecord): void {
  const sprite = getSprite(pokemon);
  const name = formatName(pokemon.name);
  const types = [...pokemon.types].sort((first, second) => first.slot - second.slot);

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

  const image = elements.detail.querySelector<HTMLImageElement>("img");
  if (image && pokemon.sprites.front_default && image.src !== pokemon.sprites.front_default) {
    image.addEventListener(
      "error",
      () => {
        image.src = pokemon.sprites.front_default as string;
      },
      { once: true },
    );
  }
}

function showDetailError(): void {
  elements.detail.setAttribute("aria-busy", "false");
  elements.detail.innerHTML = `
    <div class="detail-error">
      <p>SPECIMEN RECORD UNAVAILABLE.</p>
      <p>THE DATABASE LINK WAS INTERRUPTED.</p>
      <button class="retry-button" type="button" data-action="retry-detail">RETRY RECORD</button>
    </div>
  `;
}

function markSelectedRosterEntry(): void {
  elements.list.querySelectorAll<HTMLButtonElement>(".pokemon-entry").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.pokemonName === state.selectedName));
  });
}

function focusSelectedEntry(name: string): void {
  const activeButton = [...elements.list.querySelectorAll<HTMLButtonElement>(".pokemon-entry")].find(
    (button) => button.dataset.pokemonName === name,
  );
  activeButton?.focus();
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

async function selectPokemon(name: string, { focus = false }: { focus?: boolean } = {}): Promise<void> {
  if (!name) return;

  state.selectedName = name;
  markSelectedRosterEntry();
  const rosterEntry = state.allPokemon.find((pokemon) => pokemon.name === name);
  elements.detailNumber.textContent = formatNumber(rosterEntry?.id ?? 0);

  if (focus) focusSelectedEntry(name);

  const cachedRecord = state.detailCache.get(name);
  if (cachedRecord) {
    renderPokemon(cachedRecord);
    return;
  }

  state.detailRequest?.abort();
  const request = new AbortController();
  state.detailRequest = request;
  showDetailMessage(`RETRIEVING ${formatName(name).toUpperCase()}`);

  try {
    const pokemon = await getJson<PokemonRecord>(buildApiUrl(PokeApiResource.Pokemon, name), {
      signal: request.signal,
    });
    state.detailCache.set(name, pokemon);
    if (state.selectedName === name) renderPokemon(pokemon);
  } catch (error: unknown) {
    if (!isAbortError(error) && state.selectedName === name) showDetailError();
  } finally {
    if (state.detailRequest === request) state.detailRequest = undefined;
  }
}

function updateRosterFilter(query: string): void {
  state.filteredPokemon = filterRoster(state.allPokemon, query);
  renderRoster();
}

async function loadPokedex(): Promise<void> {
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

function getTargetElement(event: Event): Element | null {
  return event.target instanceof Element ? event.target : null;
}

elements.search.addEventListener("input", (event) => {
  const target = event.currentTarget;
  if (target instanceof HTMLInputElement) updateRosterFilter(target.value);
});

elements.list.addEventListener("click", (event) => {
  const target = getTargetElement(event);
  const button = target?.closest<HTMLButtonElement>("[data-pokemon-name]");
  if (button?.dataset.pokemonName) void selectPokemon(button.dataset.pokemonName, { focus: true });
  if (target?.closest('[data-action="retry-roster"]')) void loadPokedex();
});

elements.list.addEventListener("keydown", (event) => {
  const target = getTargetElement(event);
  const currentButton = target?.closest<HTMLButtonElement>("[data-pokemon-name]");
  if (!currentButton || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

  const currentIndex = state.filteredPokemon.findIndex((pokemon) => pokemon.name === currentButton.dataset.pokemonName);
  if (currentIndex < 0) return;

  const lastIndex = state.filteredPokemon.length - 1;
  let nextIndex = currentIndex;
  switch (event.key) {
    case "ArrowDown":
      nextIndex = Math.min(currentIndex + 1, lastIndex);
      break;
    case "ArrowUp":
      nextIndex = Math.max(currentIndex - 1, 0);
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = lastIndex;
      break;
  }
  const nextPokemon = state.filteredPokemon[nextIndex];

  event.preventDefault();
  if (nextPokemon) void selectPokemon(nextPokemon.name, { focus: true });
});

elements.detail.addEventListener("click", (event) => {
  const target = getTargetElement(event);
  if (target?.closest('[data-action="retry-detail"]')) void selectPokemon(state.selectedName);
});

void loadPokedex();
