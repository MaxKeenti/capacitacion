export const POKE_API_BASE_URL = "https://pokeapi.co/api/v2";
export var PokeApiResource;
(function (PokeApiResource) {
    PokeApiResource["Pokemon"] = "pokemon";
    PokeApiResource["PokemonSpecies"] = "pokemon-species";
})(PokeApiResource || (PokeApiResource = {}));
export function buildApiUrl(resource, identifier, query) {
    const url = new URL(`${POKE_API_BASE_URL}/${resource}/`);
    if (identifier !== undefined) {
        url.pathname += `${encodeURIComponent(String(identifier))}/`;
    }
    Object.entries(query ?? {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    return url.toString();
}
export function getIdFromUrl(url) {
    const match = url.match(/\/(\d+)\/?$/);
    return match ? Number(match[1]) : 0;
}
export function formatNumber(id) {
    return id ? `#${String(id).padStart(4, "0")}` : "#----";
}
export function formatName(name) {
    return name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}
export function toRosterEntries(resources) {
    return resources.map((pokemon) => ({
        ...pokemon,
        id: getIdFromUrl(pokemon.url),
    }));
}
export function filterRoster(entries, query) {
    const normalizedQuery = query.trim().toLowerCase().replace(/^#/, "");
    return entries.filter((pokemon) => {
        const formattedName = formatName(pokemon.name).toLowerCase();
        return (pokemon.name.includes(normalizedQuery) ||
            formattedName.includes(normalizedQuery) ||
            String(pokemon.id).startsWith(normalizedQuery));
    });
}
export function getSprite(pokemon) {
    const blackWhiteSprite = pokemon.sprites.versions?.["generation-v"]?.["black-white"]?.front_default;
    return blackWhiteSprite || pokemon.sprites.front_default || pokemon.sprites.other?.["official-artwork"]?.front_default || "";
}
