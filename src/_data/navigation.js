const getMetadata = require("./metadata.js");

function firstTruthy(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== "") return v;
  return undefined;
}

function normalizePath(p) {
  if (!p) return "/";
  let s = String(p);
  s = s.replace(/%5C/gi, "/");
  s = s.replace(/\\/g, "/");
  // collapse duplicate slashes (but our strings are paths, not full URLs)
  s = s.replace(/\/\/+/, "/");
  if (!s.startsWith("/")) s = "/" + s;
  return s;
}

let __navCache = null;
let __navKey = null;

module.exports = function() {
  const meta = getMetadata();
  const entries = Object.entries(meta);
  const key = entries.length;
  if (__navCache && __navKey === key) {
    return __navCache;
  }
  const planes = new Map();
  
  // Define which planes should be merged together into combined columns
  // Key = display name, Value = array of plane names to merge
  const planeMerges = {
    "Other Realms": ["Feywild", "Misc"]
  };
  
  // Create reverse lookup: plane name -> merged name
  const planeToMerged = {};
  for (const [mergedName, planeList] of Object.entries(planeMerges)) {
    for (const p of planeList) {
      planeToMerged[p] = mergedName;
    }
  }

  for (const [title, data] of entries) {
    let planeName = firstTruthy(data.plane, data["Plane"], data["plane"], "Misc");
    
    // Check if this plane should be merged with others
    const displayPlaneName = planeToMerged[planeName] || planeName;
    
    const continentName = firstTruthy(data.continent, data["Continent"], data["eleventyNavigation"] && data["eleventyNavigation"].parent, "General");
    const typeName = firstTruthy(data.type, data["Type"], "Article");
    const pathStr = normalizePath(data.path || data.permalink || "/");
    const banner = data.banner || data.image || null;
    const hc0 = Number(firstTruthy(data.herocolor0, (data.herocolor && data.herocolor[0]), 120));
    const hc1 = Number(firstTruthy(data.herocolor1, (data.herocolor && data.herocolor[1]), 160));
    const hc2 = Number(firstTruthy(data.herocolor2, (data.herocolor && data.herocolor[2]), 220));

    if (!planes.has(displayPlaneName)) {
      planes.set(displayPlaneName, {
        title: displayPlaneName,
        banner: null,
        hc0: 120, hc1: 160, hc2: 220,
        continents: new Map(),
      });
    }
    const plane = planes.get(displayPlaneName);
    if (title === planeName || title === displayPlaneName) {
      if (banner) plane.banner = banner;
      plane.hc0 = isFinite(hc0) ? hc0 : plane.hc0;
      plane.hc1 = isFinite(hc1) ? hc1 : plane.hc1;
      plane.hc2 = isFinite(hc2) ? hc2 : plane.hc2;
    }
    
    // For merged planes, use the original plane name as a sub-category prefix for the continent
    let effectiveContinentName = continentName;
    if (planeToMerged[planeName]) {
      effectiveContinentName = planeName;
    }
    
    if (!plane.continents.has(effectiveContinentName)) {
      plane.continents.set(effectiveContinentName, {
        title: effectiveContinentName,
        banner: null,
        hc0: plane.hc0, hc1: plane.hc1, hc2: plane.hc2,
        types: new Map(),
      });
    }
    const continent = plane.continents.get(effectiveContinentName);
    if (title === continentName || title === effectiveContinentName) {
      if (banner) continent.banner = banner;
      continent.hc0 = isFinite(hc0) ? hc0 : continent.hc0;
      continent.hc1 = isFinite(hc1) ? hc1 : continent.hc1;
      continent.hc2 = isFinite(hc2) ? hc2 : continent.hc2;
    }
    if (!continent.types.has(typeName)) {
      continent.types.set(typeName, []);
    }
    continent.types.get(typeName).push({ title, path: pathStr, banner, hc0, hc1, hc2 });
  }

  // Convert Maps to plain arrays for templates
  const planesArr = Array.from(planes.values()).map((plane) => ({
    ...plane,
    continents: Array.from(plane.continents.values()).map((cont) => ({
      ...cont,
      types: Array.from(cont.types.entries()).map(([type, items]) => ({ type, items }))
    }))
  }));

  // Custom sort order: put "Other Realms" (merged Feywild+Misc) at the end
  const sortLast = ["Other Realms"];
  planesArr.sort((a, b) => {
    const aLast = sortLast.includes(a.title);
    const bLast = sortLast.includes(b.title);
    if (aLast && !bLast) return 1;
    if (!aLast && bLast) return -1;
    return a.title.localeCompare(b.title);
  });
  for (const p of planesArr) {
    p.continents.sort((a, b) => a.title.localeCompare(b.title));
    for (const c of p.continents) {
      c.types.sort((a, b) => a.type.localeCompare(b.type));
      for (const t of c.types) t.items.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  __navCache = { planes: planesArr };
  __navKey = key;
  return __navCache;
};

