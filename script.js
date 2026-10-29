const form = document.querySelector("#search-form");
const input = document.querySelector("#visual-query");
const searchButton = document.querySelector("#search-button");
const clearButton = document.querySelector("#clear-button");
const results = document.querySelector("#results");
const status = document.querySelector("#results-status");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");

let activeSearch = null;
let searchSequence = 0;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();

  if (!query) {
    status.textContent = "Enter a topic to search for images.";
    input.focus();
    return;
  }

  searchImages(query);
});

clearButton.addEventListener("click", () => {
  searchSequence += 1;
  activeSearch?.abort();
  activeSearch = null;
  form.reset();
  results.replaceChildren();
  resultCount.textContent = "0 NOTES · READY WHEN YOU ARE";
  status.textContent = "Choose a topic or enter a search to begin.";
  emptyState.hidden = false;
  searchButton.disabled = false;
  input.focus();
});

document.querySelectorAll(".topic-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.dataset.query;
    searchImages(input.value);
  });
});

async function searchImages(query) {
  activeSearch?.abort();
  const controller = new AbortController();
  activeSearch = controller;
  const sequence = ++searchSequence;

  results.replaceChildren();
  emptyState.hidden = true;
  searchButton.disabled = true;
  resultCount.textContent = "SEARCHING…";
  status.textContent = `Looking for “${query}” on Wikimedia Commons…`;

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "24",
    prop: "info|imageinfo",
    inprop: "url",
    iiprop: "url|extmetadata",
    iiurlwidth: "900",
    format: "json",
    origin: "*",
  });

  try {
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("The image service returned an error.");

    const data = await response.json();
    if (sequence !== searchSequence) return;

    const pages = Object.values(data.query?.pages ?? {})
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const images = pages.filter((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url);

    if (images.length === 0) {
      resultCount.textContent = "0 NOTES · TRY ANOTHER SEARCH";
      status.textContent = `No images found for “${query}”. Try a broader topic.`;
      return;
    }

    const cards = images.map(createImageCard);
    results.replaceChildren(...cards);
    resultCount.textContent = `${images.length} ${images.length === 1 ? "NOTE" : "NOTES"} · WIKIMEDIA COMMONS`;
    status.textContent = `Showing ${images.length} images for “${query}”. Select an image to view its source and license details.`;
  } catch (error) {
    if (error.name === "AbortError" || sequence !== searchSequence) return;
    resultCount.textContent = "SEARCH UNAVAILABLE";
    status.textContent = "Images could not be loaded. Check your connection and try again.";
  } finally {
    if (sequence === searchSequence) {
      searchButton.disabled = false;
      activeSearch = null;
    }
  }
}

function createImageCard(page) {
  const imageInfo = page.imageinfo[0];
  const metadata = imageInfo.extmetadata ?? {};
  const sourceUrl = page.fullurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
  const imageUrl = imageInfo.thumburl ?? imageInfo.url;
  const title = page.title.replace(/^File:/, "");

  const article = document.createElement("article");
  article.className = "image-card";

  const link = document.createElement("a");
  link.className = "image-card-link";
  link.href = sourceUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", `View source and license for ${title} on Wikimedia Commons`);

  const image = document.createElement("img");
  image.src = imageUrl;
  image.alt = title;
  image.loading = "lazy";
  image.decoding = "async";

  const copy = document.createElement("div");
  copy.className = "image-card-copy";

  const heading = document.createElement("h3");
  heading.className = "image-card-title";
  heading.textContent = title;

  const metadataRow = document.createElement("div");
  metadataRow.className = "image-card-meta";

  const source = document.createElement("span");
  source.className = "image-source";
  source.textContent = "Wikimedia Commons";

  const license = document.createElement("span");
  const licenseName = metadata.LicenseShortName?.value;
  license.textContent = licenseName ? `License: ${licenseName}` : "View license ↗";

  metadataRow.append(source, license);
  copy.append(heading, metadataRow);
  link.append(image, copy);
  article.append(link);
  return article;
}
