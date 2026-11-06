// Fieldnotes — Wikimedia Commons image search
const form = document.getElementById("search-form");
const input = document.getElementById("visual-query");
const searchButton = document.getElementById("search-button");
const clearButton = document.getElementById("clear-button");
const results = document.getElementById("results");
const status = document.getElementById("results-status");
const resultCount = document.getElementById("result-count");
const emptyState = document.getElementById("empty-state");

let activeSearch = null;
let searchSequence = 0;

// Catch both button clicks and Enter-key submissions.
form.addEventListener("submit", (event) => {
  event.preventDefault();

  const query = input.value.trim();

  // Do not make an API request for an empty search.
  if (!query) {
    status.textContent = "Enter a topic to search for images.";
    input.focus();
    return;
  }

  searchImages(query);
});

clearButton.addEventListener("click", () => {
  searchSequence += 1;
  if (activeSearch) activeSearch.abort();
  activeSearch = null;

  form.reset();
  results.innerHTML = "";
  resultCount.textContent = "0 NOTES · READY WHEN YOU ARE";
  status.textContent = "Choose a topic or enter a search to begin.";
  emptyState.hidden = false;
  searchButton.disabled = false;
  input.focus();
});

// The suggested topic chips use the same search function as the form.
document.querySelectorAll(".topic-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.dataset.query;
    searchImages(input.value.trim());
  });
});

async function searchImages(query) {
  if (activeSearch) activeSearch.abort();

  const controller = new AbortController();
  activeSearch = controller;
  const currentSearch = ++searchSequence;

  // Clear the previous search before displaying new results.
  results.innerHTML = "";
  emptyState.hidden = true;
  searchButton.disabled = true;
  resultCount.textContent = "SEARCHING…";
  status.textContent = `Looking for “${query}” on Wikimedia Commons…`;

  // encodeURIComponent keeps multi-word and special-character searches valid.
  const url =
    "https://commons.wikimedia.org/w/api.php" +
    "?action=query" +
    "&generator=search" +
    "&gsrnamespace=6" +
    "&gsrlimit=24" +
    "&prop=info%7Cimageinfo" +
    "&inprop=url" +
    "&iiprop=url%7Cextmetadata" +
    "&iiurlwidth=900" +
    "&format=json" +
    "&origin=*" +
    `&gsrsearch=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, { signal: controller.signal });

    // Check the HTTP response before parsing or rendering anything.
    if (!response.ok) {
      throw new Error(`Image search failed: HTTP ${response.status}`);
    }

    const data = await response.json();
    if (currentSearch !== searchSequence) return;

    const pages = Object.values(data.query?.pages ?? {}).sort(
      (first, second) => (first.index ?? 0) - (second.index ?? 0)
    );

    const imageResults = pages.filter((page) => {
      const imageInfo = page.imageinfo?.[0];
      return imageInfo?.thumburl || imageInfo?.url;
    });

    if (imageResults.length === 0) {
      resultCount.textContent = "0 NOTES · TRY ANOTHER SEARCH";
      status.textContent = `No images found for “${query}”. Try a broader topic.`;
      return;
    }

    // Build and append one image card for every returned image.
    imageResults.forEach((page) => {
      const card = createImageCard(page);
      results.appendChild(card);
    });

    resultCount.textContent =
      `${imageResults.length} ${imageResults.length === 1 ? "NOTE" : "NOTES"} · WIKIMEDIA COMMONS`;
    status.textContent =
      `Showing ${imageResults.length} images for “${query}”. Select an image to view its source and license details.`;
  } catch (error) {
    if (error.name === "AbortError" || currentSearch !== searchSequence) return;

    resultCount.textContent = "SEARCH UNAVAILABLE";
    status.textContent = "Images could not be loaded. Check your connection and try again.";
  } finally {
    if (currentSearch === searchSequence) {
      searchButton.disabled = false;
      activeSearch = null;
    }
  }
}

function createImageCard(page) {
  const imageInfo = page.imageinfo[0];
  const metadata = imageInfo.extmetadata ?? {};
  const title = page.title.replace(/^File:/, "");
  const sourceUrl =
    page.fullurl ||
    `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}`;
  const imageUrl = imageInfo.thumburl || imageInfo.url;

  const card = document.createElement("article");
  card.className = "image-card";

  const link = document.createElement("a");
  link.className = "image-card-link";
  link.href = sourceUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute(
    "aria-label",
    `View source and license for ${title} on Wikimedia Commons`
  );

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

  metadataRow.appendChild(source);
  metadataRow.appendChild(license);
  copy.appendChild(heading);
  copy.appendChild(metadataRow);
  link.appendChild(image);
  link.appendChild(copy);
  card.appendChild(link);

  return card;
}
