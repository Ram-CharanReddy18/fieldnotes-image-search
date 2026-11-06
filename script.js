// Fieldnotes — Part 2: fetch and render image search results
const form = document.querySelector(".search-form");
const input = document.getElementById("visual-query");
const searchButton = document.getElementById("search-button");
const results = document.getElementById("results");
const emptyState = document.querySelector(".empty-state");
const resultCount = document.querySelector(".result-count");
const resultsHeading = document.getElementById("results-heading");

// A small live status message keeps users informed while searches run.
const status = document.createElement("p");
status.className = "results-status";
status.setAttribute("role", "status");
status.setAttribute("aria-live", "polite");
results.parentElement.insertBefore(status, results);

form.addEventListener("submit", async (event) => {
  // Keep the browser on this page instead of submitting/reloading the form.
  event.preventDefault();

  const query = input.value.trim();

  // Ignore blank searches and explain what the user should do.
  if (!query) {
    status.textContent = "Please enter a topic before searching.";
    input.focus();
    return;
  }

  await searchImages(query);
});

async function searchImages(query) {
  // Remove cards from the previous search before rendering new results.
  results.innerHTML = "";
  emptyState.hidden = true;
  searchButton.disabled = true;
  resultCount.textContent = "SEARCHING…";
  resultsHeading.textContent = `Results for “${query}”`;
  status.textContent = `Searching Wikimedia Commons for “${query}”…`;

  // encodeURIComponent safely handles spaces and special characters.
  const url =
    "https://commons.wikimedia.org/w/api.php" +
    "?action=query" +
    "&generator=search" +
    "&gsrnamespace=6" +
    "&gsrlimit=24" +
    "&prop=imageinfo" +
    "&iiprop=url" +
    "&iiurlwidth=700" +
    "&format=json" +
    "&origin=*" +
    `&gsrsearch=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url);

    // Do not try to parse an unsuccessful HTTP response.
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const pages = Object.values(data.query?.pages ?? {}).sort(
      (a, b) => (a.index ?? 0) - (b.index ?? 0)
    );

    const imagePages = pages.filter((page) => {
      const image = page.imageinfo?.[0];
      return image?.thumburl || image?.url;
    });

    if (imagePages.length === 0) {
      resultCount.textContent = "0 RESULTS";
      status.textContent = `No images found for “${query}”. Try another search.`;
      return;
    }

    // Create an image-and-title card for each result and add it to the grid.
    imagePages.forEach((page) => {
      const imageInfo = page.imageinfo[0];
      const card = document.createElement("article");
      card.className = "image-result-card";
      card.style.cssText =
        "overflow:hidden;background:#fbfaf6;border:1px solid #d9d9ce;";

      const image = document.createElement("img");
      image.src = imageInfo.thumburl || imageInfo.url;
      image.alt = page.title.replace(/^File:/, "");
      image.loading = "lazy";
      image.style.cssText =
        "display:block;width:100%;aspect-ratio:4/3;object-fit:cover;";

      const title = document.createElement("h3");
      title.textContent = page.title.replace(/^File:/, "");
      title.style.cssText =
        "margin:12px;font:500 13px/1.5 'DM Sans',Arial,sans-serif;overflow-wrap:anywhere;";

      card.appendChild(image);
      card.appendChild(title);
      results.appendChild(card);
    });

    resultCount.textContent = `${imagePages.length} IMAGES · WIKIMEDIA COMMONS`;
    status.textContent = `Showing ${imagePages.length} images for “${query}”.`;
  } catch (error) {
    console.error("Image search failed:", error);
    resultCount.textContent = "SEARCH FAILED";
    status.textContent =
      "Images could not be loaded. Check your connection and try again.";
  } finally {
    searchButton.disabled = false;
  }
}

// Suggested topics fill the search box and use the same submit workflow.
document.querySelectorAll(".topic-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.textContent.replace("↗", "").trim();
    form.requestSubmit();
  });
});
