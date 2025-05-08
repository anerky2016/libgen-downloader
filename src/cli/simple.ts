import fs from "fs";
import { getDocument } from "../api/data/document";
import { Entry } from "../api/models/Entry";
import { constructSearchURL, parseEntries, constructMD5SearchUrl } from "../api/data/search";
import { findDownloadUrlFromMirror } from "../api/data/url";
import { attempt } from "../utils";
import { useBoundStore } from "../tui/store/index";

interface Config {
  mirror: string;
  searchReqPattern: string;
  searchByMD5Pattern: string;
  columnFilterQueryParamKey: string;
  columnFilterQueryParamValues: Record<string, string>;
}

const defaultConfig: Config = {
  mirror: "http://libgen.rs",
  searchReqPattern: "search.php?req={query}&open=0&res={pageSize}&view=simple",
  searchByMD5Pattern: "book/index.php?md5={md5}",
  columnFilterQueryParamKey: "column",
  columnFilterQueryParamValues: {}
};

export async function simpleSearch(query: string, limit = 0, output?: string, exitAfterFirstPage = false, dumpPath?: string) {
  let config = defaultConfig;
  
  try {
    // Initialize store in CLI mode
    const store = useBoundStore.getState();
    store.setCLIMode(true);
    await store.fetchConfig();
    
    if (store.mirror && store.searchReqPattern) {
      config = {
        mirror: store.mirror,
        searchReqPattern: store.searchReqPattern,
        searchByMD5Pattern: store.searchByMD5Pattern || defaultConfig.searchByMD5Pattern,
        columnFilterQueryParamKey: store.columnFilterQueryParamKey || defaultConfig.columnFilterQueryParamKey,
        columnFilterQueryParamValues: store.columnFilterQueryParamValues || defaultConfig.columnFilterQueryParamValues
      };
    }
  } catch (err) {
    console.error("Failed to fetch config, using defaults:", err);
  }

  console.error(`Searching for "${query}"...`);
  const allEntries: Entry[] = [];
  let pageNumber = 1;
  let hasMore = true;
  let totalFetched = 0;

  console.error(`Fetching page ${pageNumber}...`);
  const searchUrl = constructSearchURL({
    query,
    pageNumber,
    pageSize: 100, // LibGen typically shows 100 results per page
    mirror: config.mirror,
    searchReqPattern: config.searchReqPattern,
    columnFilterQueryParamKey: config.columnFilterQueryParamKey,
    columnFilterQueryParamValue: config.columnFilterQueryParamValues 
      ? Object.values(config.columnFilterQueryParamValues).join(',') 
      : null
  });

  let searchPageDocument;
  try {
    searchPageDocument = await attempt(() => getDocument(searchUrl));
    if (!searchPageDocument) {
      console.error("Failed to get search results from URL:", searchUrl);
      return;
    }
  } catch (err) {
    console.error("Search failed with error:", err);
    console.error("Attempted URL:", searchUrl);
    return;
  }

  const entries = parseEntries(searchPageDocument);
  if (!entries || entries.length === 0) {
    console.error("No results found");
    return;
  }

  allEntries.push(...entries);
  totalFetched = entries.length;

  console.error(`Fetched ${totalFetched} results from first page`);
  const finalResults = limit > 0 ? allEntries.slice(0, limit) : allEntries;

  if (output) {
    fs.writeFileSync(output, JSON.stringify(finalResults, null, 2));
    console.log(`Saved ${finalResults.length} results to ${output}`);
    return;
  }

  if (exitAfterFirstPage) {
    return;
  }
  console.log(JSON.stringify(finalResults, null, 2));
}

export async function simpleDownload(md5: string) {
  const md5SearchUrl = constructMD5SearchUrl(
    defaultConfig.searchByMD5Pattern,
    defaultConfig.mirror,
    md5
  );

  const searchPageDocument = await attempt(() => getDocument(md5SearchUrl));
  if (!searchPageDocument) {
    console.error("Failed to get document");
    return;
  }

  const entry = parseEntries(searchPageDocument)?.[0];
  if (!entry) {
    console.error("Failed to parse entry");
    return;
  }

  const mirrorPageDocument = await attempt(() => getDocument(entry.mirror));
  if (!mirrorPageDocument) {
    console.error("Failed to get mirror page");
    return;
  }

  const downloadUrl = findDownloadUrlFromMirror(mirrorPageDocument);
  if (!downloadUrl) {
    console.error("Failed to find download URL");
    return;
  }

  console.log("Download URL:", downloadUrl);
}
