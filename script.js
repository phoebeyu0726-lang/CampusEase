const locations = window.CAMPUS_NODES;
const routeNodes = window.ROUTE_NODES;
const locationDoors = window.LOCATION_DOORS;
const graph = window.CAMPUS_GRAPH;
const weather = window.WEATHER_DATA.current;
const aqi = window.AQI_DATA;
const bikes = window.YOUBIKE_DATA.stations;
const access = window.ACCESSIBILITY_DATA;

const state = {
  start: "M_DORM",
  end: "FIRST",
  mode: "comfort",
  dataTab: "graph",
  prefs: { time: 30, air: 30, heat: 20, rain: 20 },
  needs: { rain: false, heat: true, bike: false, accessible: false },
  lastPath: [],
  lastMetrics: null,
  lastRouteMeta: null,
  navIndex: 0,
  plannerPick: "start"
};

const modeLabel = {
  fastest: "最近路線",
  comfort: "最舒適路線",
  accessible: "無障礙路線",
  bike: "YouBike 接駁"
};

const typeLabel = {
  dorm: "宿舍",
  activity: "活動中心",
  college: "科館",
  building: "大樓",
  sports: "運動場地",
  outdoor: "戶外場地",
  lab: "館舍",
  library: "圖書館",
  canteen: "餐廳",
  classroom: "教學大樓",
  transit: "捷運",
  bike: "YouBike",
  door: "門口",
  gate: "校門",
  road: "步道"
};

const startSelect = document.querySelector("#startSelect");
const endSelect = document.querySelector("#endSelect");
const accessibleToggle = document.querySelector("#accessibleToggle");
const routeSvg = document.querySelector("#routeSvg");
const nodeLayer = document.querySelector("#nodeLayer");
const plannerRouteSvg = document.querySelector("#plannerRouteSvg");
const plannerNodeLayer = document.querySelector("#plannerNodeLayer");

function init() {
  fillSelects();
  bindEvents();
  enhanceSegmentGuide();
  setupMapZoomControls();
  startSelect.value = state.start;
  endSelect.value = state.end;
  setMode(state.mode);
  calculateAndRender();
  updateEnvironment();
  updatePreferenceLabels();
  renderExploreNodes();
  updateDataView();
}

function fillSelects() {
  Object.entries(locations).forEach(([id, node]) => {
    startSelect.appendChild(new Option(node.name, id));
    endSelect.appendChild(new Option(node.name, id));
  });
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  document.querySelectorAll("[data-view-target]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      showView(button.dataset.viewTarget);
    });
  });

  document.querySelectorAll(".mode-button").forEach((button) => {
    button.addEventListener("click", () => {
      setMode(button.dataset.mode);
      state.needs.accessible = state.mode === "accessible";
      state.needs.bike = state.mode === "bike";
      accessibleToggle.checked = state.needs.accessible;
      syncNeedCheckboxes();
      calculateAndRender({ resetStep: true });
    });
  });

  document.querySelectorAll(".need-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", applyRouteNeeds);
  });

  document.querySelectorAll(".favorite-load").forEach((button) => {
    button.addEventListener("click", () => {
      state.start = button.dataset.start;
      state.end = button.dataset.end;
      startSelect.value = state.start;
      endSelect.value = state.end;
      setMode(button.dataset.modeTarget);
      state.needs.accessible = state.mode === "accessible";
      state.needs.bike = state.mode === "bike";
      accessibleToggle.checked = state.needs.accessible;
      syncNeedCheckboxes();
      calculateAndRender({ resetStep: true });
      showView("result");
    });
  });

  document.querySelectorAll(".data-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.dataTab = button.dataset.tab;
      document.querySelectorAll(".data-tab").forEach((item) => item.classList.toggle("active", item === button));
      updateDataView();
    });
  });

  startSelect.addEventListener("change", () => {
    state.start = startSelect.value;
    state.plannerPick = "end";
    calculateAndRender({ resetStep: true });
  });

  endSelect.addEventListener("change", () => {
    state.end = endSelect.value;
    state.plannerPick = "start";
    calculateAndRender({ resetStep: true });
  });

  accessibleToggle.addEventListener("change", () => {
    state.needs.accessible = accessibleToggle.checked;
    if (accessibleToggle.checked) setMode("accessible");
    syncNeedCheckboxes();
    calculateAndRender({ resetStep: true });
  });

  document.querySelector("#calculateBtn").addEventListener("click", () => {
    calculateAndRender({ resetStep: true });
    showView("result");
  });

  document.querySelector("#saveRouteBtn")?.addEventListener("click", saveCurrentRoute);
  document.querySelector("#refreshLiveBtn")?.addEventListener("click", refreshLiveInfo);
  document.querySelector("#nextStepBtn")?.addEventListener("click", () => moveNavigationStep(1));
  document.querySelector("#prevStepBtn")?.addEventListener("click", () => moveNavigationStep(-1));
  document.querySelector("#routeNextStepBtn")?.addEventListener("click", handleRouteNextStep);
  document.querySelector("#routePrevStepBtn")?.addEventListener("click", () => moveNavigationStep(-1));
  document.querySelector("#showDfdBtn")?.addEventListener("click", () => document.querySelector("#dfdDialog").showModal());
  document.querySelector("#closeDfdBtn")?.addEventListener("click", () => document.querySelector("#dfdDialog").close());
}

function enhanceSegmentGuide() {
  const guide = document.querySelector(".segment-guide");
  const prevButton = document.querySelector("#routePrevStepBtn");
  const nextButton = document.querySelector("#routeNextStepBtn");
  const counter = document.querySelector("#segmentCounter");
  const instruction = document.querySelector("#segmentInstruction");
  const hint = document.querySelector("#segmentTurnHint");
  if (!guide || !prevButton || !nextButton || !counter || !instruction || !hint || guide.dataset.enhanced) return;

  const main = document.createElement("div");
  main.className = "segment-main";

  const statusRow = document.createElement("div");
  statusRow.className = "segment-status-row";

  const liveStatus = document.createElement("span");
  liveStatus.className = "nav-live-status";
  liveStatus.textContent = "即時導航";

  const progress = document.createElement("div");
  progress.className = "segment-progress";
  progress.setAttribute("aria-hidden", "true");

  const progressBar = document.createElement("span");
  progressBar.id = "segmentProgressBar";
  progress.appendChild(progressBar);

  statusRow.append(counter, liveStatus);
  main.append(statusRow, instruction, hint, progress);

  prevButton.classList.add("nav-step-button", "prev");
  nextButton.classList.add("nav-step-button", "next");
  prevButton.innerHTML = '<span class="nav-step-icon" aria-hidden="true"></span><span>上一段</span>';
  nextButton.innerHTML = '<span>下一段</span><span class="nav-step-icon" aria-hidden="true"></span>';

  guide.replaceChildren(prevButton, main, nextButton);
  guide.dataset.enhanced = "true";
}

function setupMapZoomControls() {
  document.querySelectorAll(".map-canvas").forEach((canvas) => {
    canvas.style.setProperty("--map-zoom", "1");
    const controls = document.createElement("div");
    controls.className = "map-zoom-controls";
    controls.innerHTML = `
      <button type="button" data-zoom-out aria-label="縮小地圖">−</button>
      <span>100%</span>
      <button type="button" data-zoom-in aria-label="放大地圖">＋</button>
    `;
    let zoom = 1;
    const label = controls.querySelector("span");
    controls.querySelector("[data-zoom-in]").addEventListener("click", () => {
      zoom = Math.min(1.8, Math.round((zoom + 0.1) * 10) / 10);
      canvas.style.setProperty("--map-zoom", String(zoom));
      label.textContent = `${Math.round(zoom * 100)}%`;
    });
    controls.querySelector("[data-zoom-out]").addEventListener("click", () => {
      zoom = Math.max(1, Math.round((zoom - 0.1) * 10) / 10);
      canvas.style.setProperty("--map-zoom", String(zoom));
      label.textContent = `${Math.round(zoom * 100)}%`;
    });
    canvas.appendChild(controls);
  });
}

function showView(viewName) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === viewName);
  });
  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  if (["result", "compare", "data", "navigation"].includes(viewName)) calculateAndRender();
  if (viewName === "navigation") renderNavigation();
}

function syncNeedCheckboxes() {
  document.querySelectorAll(".need-checkbox").forEach((checkbox) => {
    checkbox.checked = Boolean(state.needs[checkbox.dataset.need]);
  });
}

function applyRouteNeeds() {
  document.querySelectorAll(".need-checkbox").forEach((checkbox) => {
    state.needs[checkbox.dataset.need] = checkbox.checked;
  });
  accessibleToggle.checked = state.needs.accessible;
  state.prefs.rain = state.needs.rain ? 60 : 20;
  state.prefs.heat = state.needs.heat ? 58 : 20;
  if (state.needs.accessible) setMode("accessible");
  else if (state.needs.bike) setMode("bike");
  else if (state.needs.rain || state.needs.heat) setMode("comfort");
  updatePreferenceLabels();
  calculateAndRender({ resetStep: true });
}

function setMode(mode) {
  state.mode = mode;
  state.needs.accessible = mode === "accessible";
  state.needs.bike = mode === "bike";
  accessibleToggle.checked = state.needs.accessible;
  const isBikeMode = mode === "bike";
  document.querySelector(".route-planner")?.classList.toggle("bike-mode", isBikeMode);
  document.querySelector(".planner-map-panel")?.classList.toggle("bike-mode", isBikeMode);
  if (endSelect) {
    endSelect.disabled = isBikeMode;
    endSelect.setAttribute("aria-hidden", String(isBikeMode));
  }
  document.querySelector(".end-field-label")?.setAttribute("aria-hidden", String(isBikeMode));
  document.querySelectorAll(".mode-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
}

function edgeKey(from, to) {
  return [from, to].sort().join("-");
}

function getCandidateDoors(locationId) {
  return locationDoors[locationId] || [locationId];
}

function getBikeStationIds() {
  return Object.keys(bikes).filter((id) => locations[id]);
}

function getEffectiveEndLocation(startLocation, mode) {
  if (mode !== "bike") return state.end;
  let best = { id: state.end, distance: Infinity };
  getBikeStationIds().forEach((stationId) => {
    if (stationId === startLocation) return;
    const route = resolveBestRoute(startLocation, stationId, "fastest");
    const metrics = calculateMetrics(route.path);
    if (metrics.distance && metrics.distance < best.distance) {
      best = { id: stationId, distance: metrics.distance };
    }
  });
  return best.id;
}

function resolveBestRoute(startLocation, endLocation, mode) {
  if (startLocation === endLocation) return { path: [], score: Infinity, startDoor: null, endDoor: null };
  const starts = getCandidateDoors(startLocation);
  const ends = getCandidateDoors(endLocation);
  let best = { path: [], score: Infinity, startDoor: null, endDoor: null };

  starts.forEach((startDoor) => {
    ends.forEach((endDoor) => {
      const result = dijkstraRoute(startDoor, endDoor, mode);
      if (result.path.length && result.score < best.score) {
        best = { ...result, startDoor, endDoor };
      }
    });
  });

  return best;
}

function dijkstraRoute(start, end, mode) {
  const distances = {};
  const previous = {};
  const visited = new Set();
  const forceAccessible = mode === "accessible" || accessibleToggle.checked;

  Object.keys(routeNodes).forEach((id) => {
    distances[id] = Infinity;
    previous[id] = null;
  });
  distances[start] = 0;

  while (visited.size < Object.keys(routeNodes).length) {
    const current = Object.keys(routeNodes)
      .filter((id) => !visited.has(id))
      .sort((a, b) => distances[a] - distances[b])[0];
    if (!current || distances[current] === Infinity) break;
    if (current === end) break;
    visited.add(current);

    graph[current].forEach((edge) => {
      if (isSchoolGateNode(current) || isSchoolGateNode(edge.to)) return;
      if (forceAccessible && (!edge.accessible || edge.hasStairs)) return;
      if (mode !== "fastest" && (!edge.accessible || edge.hasStairs)) return;
      const nextDistance = distances[current] + getEdgeWeight(current, edge, mode);
      if (nextDistance < distances[edge.to]) {
        distances[edge.to] = nextDistance;
        previous[edge.to] = current;
      }
    });
  }

  const path = [];
  let current = end;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }

  return {
    path: path[0] === start ? path : [],
    score: distances[end]
  };
}

function getEdgeWeight(from, edge, mode) {
  const target = routeNodes[edge.to];
  const parentId = target.parent || edge.to;
  const targetLocation = locations[parentId] || target;
  const aqiPenalty = edge.distance * Math.max(0.15, (aqi.nodeMap[parentId] || aqi.current.value) / 100);
  const heatPenalty = edge.distance * Math.max(0.15, (100 - edge.shade + (targetLocation.exposure || 45)) / 180);
  const rainPenalty = edge.distance * Math.max(0.05, (100 - edge.rainCover) / 100);
  const crossingPenalty = edge.crossing ? 38 : 0;
  const stepPenalty = edge.accessible ? 0 : 320;
  const bikeFactor = state.needs.bike && bikes[parentId] ? 0.82 : 1;
  const base = edge.distance * Math.max(0.72, state.prefs.time / 30);
  const shelterFactor = edge.indoor ? 0.48 : edge.kind === "covered" ? 0.68 : 1;
  const modeCost = edge.modeCost?.[mode] || 0;

  if (mode === "fastest") return (edge.distance + crossingPenalty * 0.2 + modeCost) * bikeFactor;
  if (mode === "comfort") return (base * shelterFactor + rainPenalty * 2.35 + heatPenalty * 0.9 + crossingPenalty * 0.75 + stepPenalty + modeCost) * bikeFactor;
  if (mode === "bike") return (edge.distance + crossingPenalty * 0.25 + stepPenalty * 0.45 + modeCost) * bikeFactor;
  if (mode === "aqi") return (base * Math.min(1, shelterFactor + 0.15) + aqiPenalty * 1.8 + heatPenalty * 0.4 + crossingPenalty * 0.5 + stepPenalty * 0.65 + modeCost) * bikeFactor;
  if (mode === "accessible") return (base + (edge.accessible ? 0 : 10000) + edge.slope * 55 + rainPenalty * 0.4 + crossingPenalty * 0.35 + modeCost) * bikeFactor;
  return (base * Math.min(1, shelterFactor + 0.2) + heatPenalty * 0.85 + rainPenalty * 0.75 + aqiPenalty + crossingPenalty * 0.55 + stepPenalty * 0.8 + modeCost) * bikeFactor;
}

function isRoadNode(id) {
  return routeNodes[id]?.type === "road";
}

function isSchoolGateNode(id) {
  return /^GATE_/.test(id);
}

function shouldShowRouteMarker(id, index, path) {
  const node = routeNodes[id];
  if (!node) return false;
  if (index === 0 || index === path.length - 1) return true;
  if (index === state.navIndex || index === state.navIndex + 1) return true;
  return node.type !== "road";
}

function getRouteMarkerDisplayNode(id) {
  const node = routeNodes[id];
  if (!node) return null;
  const parentId = node.parent || id;
  const location = locations[parentId];
  if (location && node.type !== "road") {
    return {
      ...location,
      parentId,
      routeNodeId: id,
      routeType: node.type,
      isLocationCenter: true
    };
  }
  return {
    ...node,
    parentId,
    routeNodeId: id,
    routeType: node.type,
    isLocationCenter: false
  };
}

function getBuildingName(id) {
  return locations[id]?.name || routeNodes[id]?.name || id;
}

function getEdgeInstruction(from, to, edge, index) {
  const fromName = routeNodes[from]?.name || "";
  const toName = routeNodes[to]?.name || "";
  if (!edge) return `往 ${toName} 前進。`;
  if (edge.crossing) {
    return `從 ${fromName} 往 ${toName} 前進，這一段需要過馬路，請走行人穿越線。${edge.note ? ` ${edge.note}` : ""}`;
  }
  if (edge.throughBuilding) {
    return `穿越 ${getBuildingName(edge.throughBuilding)} 的室內通道，往 ${toName} 前進。`;
  }
  if (edge.kind === "indoor") return `沿室內通道往 ${toName} 前進。`;
  if (edge.kind === "covered") return `沿遮蔽步道往 ${toName} 前進。`;
  const turnHint = index > 0 ? `${getTurnHint(index)}，` : "";
  return `${turnHint}沿可行走步道往 ${toName} 前進。`;
}

function getNavigationTitle(from, to, edge, index) {
  if (edge?.crossing) return "前方過馬路";
  if (edge?.throughBuilding) return `穿越 ${getBuildingName(edge.throughBuilding)}`;
  if (index === 0) return "從門口出發";
  return getTurnHint(index);
}

function calculateAndRender(options = {}) {
  const effectiveEnd = getEffectiveEndLocation(state.start, state.mode);
  const route = {
    ...resolveBestRoute(state.start, effectiveEnd, state.mode),
    endLocation: effectiveEnd
  };
  const metrics = calculateMetrics(route.path);
  state.lastPath = route.path;
  state.lastMetrics = metrics;
  state.lastRouteMeta = route;
  if (options.resetStep) {
    state.navIndex = 0;
  } else {
    state.navIndex = Math.max(0, Math.min(state.navIndex, Math.max(0, route.path.length - 2)));
  }
  renderPlannerMap();
  renderMap(route.path);
  renderResult(route.path, metrics, route);
  renderComparison();
  renderNavigation();
  updateDataView();
  showMapPopover(route.path[route.path.length - 1] || route.endDoor || getCandidateDoors(effectiveEnd)[0]);
}

function calculateMetrics(path) {
  if (!path.length) return { distance: 0, avgRainCover: 0, avgAqi: 0, avgShade: 0, indoorRatio: 0, accessGood: false, crossingCount: 0, score: 0 };
  let distance = 0;
  let rainCover = 0;
  let shade = 0;
  let routeAqi = 0;
  let indoorEdges = 0;
  let crossingCount = 0;
  let accessGood = true;
  let edgeCount = 0;

  path.slice(0, -1).forEach((from, index) => {
    const to = path[index + 1];
    const edge = graph[from].find((item) => item.to === to);
    const target = routeNodes[to];
    const parentId = target.parent || to;
    distance += edge.distance;
    rainCover += edge.rainCover;
    shade += edge.shade;
    routeAqi += aqi.nodeMap[parentId] || aqi.current.value;
    indoorEdges += edge.indoor || edge.kind === "covered" ? 1 : 0;
    crossingCount += edge.crossing ? 1 : 0;
    accessGood = accessGood && edge.accessible && !edge.hasStairs;
    edgeCount += 1;
  });

  const avgRainCover = Math.round(rainCover / edgeCount);
  const avgShade = Math.round(shade / edgeCount);
  const avgAqi = Math.round(routeAqi / edgeCount);
  const indoorRatio = Math.round((indoorEdges / edgeCount) * 100);
  const score = Math.max(35, Math.min(99, Math.round(
    90 - distance / 42 + avgShade * 0.18 + avgRainCover * 0.16 - avgAqi * 0.14 + (accessGood ? 5 : -10)
  )));
  return { distance, avgRainCover, avgAqi, avgShade, indoorRatio, accessGood, crossingCount, score };
}

function renderPlannerMap() {
  if (!plannerNodeLayer || !plannerRouteSvg) return;
  plannerNodeLayer.innerHTML = "";
  plannerRouteSvg.innerHTML = "";
  const autoBikeEnd = state.mode === "bike" ? getEffectiveEndLocation(state.start, state.mode) : state.end;

  Object.entries(locations).forEach(([id, node]) => {
    if (id !== state.start && id !== autoBikeEnd) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `planner-node ${node.type === "bike" ? "bike" : ""}`;
    button.dataset.label = node.name;
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    button.classList.toggle("selected", id === state.start || id === autoBikeEnd);
    button.classList.toggle("start", id === state.start);
    button.classList.toggle("end", id === autoBikeEnd);
    button.title = node.name;
    button.addEventListener("click", () => {
      if (state.mode === "bike") {
        state.start = id;
      } else if (state.plannerPick === "start") {
        state.start = id;
        state.plannerPick = "end";
      } else {
        state.end = id;
        state.plannerPick = "start";
      }
      startSelect.value = state.start;
      endSelect.value = state.end;
      calculateAndRender({ resetStep: true });
    });
    plannerNodeLayer.appendChild(button);
  });
}

function renderMap(path) {
  if (!routeSvg || !nodeLayer) return;
  routeSvg.innerHTML = "";
  nodeLayer.innerHTML = "";
  const activeFrom = path[state.navIndex];
  const activeTo = path[state.navIndex + 1];
  const activeEdge = activeFrom && activeTo ? edgeKey(activeFrom, activeTo) : "";

  path.slice(0, -1).forEach((from, index) => {
    const to = path[index + 1];
    drawLineTo(routeSvg, from, to, edgeKey(from, to) === activeEdge ? "active-route-edge" : "route-edge");
  });

  path.forEach((id, index) => {
    if (!shouldShowRouteMarker(id, index, path)) return;
    const node = routeNodes[id];
    const displayNode = getRouteMarkerDisplayNode(id);
    if (!node || !displayNode) return;
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `map-node ${displayNode.type === "bike" ? "bike" : ""} ${node.type === "door" ? "location" : ""} ${node.type === "road" ? "road" : ""}`;
    marker.style.left = `${displayNode.x}%`;
    marker.style.top = `${displayNode.y}%`;
    marker.title = displayNode.name;
    marker.classList.toggle("start", index === 0);
    marker.classList.toggle("end", index === path.length - 1);
    marker.addEventListener("click", () => showMapPopover(id));
    nodeLayer.appendChild(marker);
  });
}

function drawPath(svg, path, className) {
  path.slice(0, -1).forEach((from, index) => drawLineTo(svg, from, path[index + 1], className));
}

function drawLineTo(svg, from, to, className) {
  const start = routeNodes[from];
  const end = routeNodes[to];
  const edge = graph[from]?.find((item) => item.to === to);
  if (!start || !end) return;
  const points = [
    [start.x * 10, start.y * 6.2],
    ...(edge?.via || []).map(([x, y]) => [x * 10, y * 6.2]),
    [end.x * 10, end.y * 6.2]
  ];
  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points.map(([x, y]) => `${x},${y}`).join(" "));
  polyline.setAttribute("class", `${className}${edge?.crossing ? " crossing-route-edge" : ""}`);
  svg.appendChild(polyline);
}

function showMapPopover(id) {
  const popover = document.querySelector("#mapPopover");
  if (!popover || !routeNodes[id]) return;
  const node = routeNodes[id];
  const parentId = node.parent || id;
  const location = locations[parentId];
  const station = bikes[parentId];
  const facilities = access.facilities[parentId] || ["暫無無障礙設施資料"];
  popover.innerHTML = `
    <strong>${node.name}</strong>
    <span>${location ? location.name : typeLabel[node.type]}｜${typeLabel[node.type] || "節點"}</span>
    <span>無障礙：${facilities.join("、")}</span>
    <span>${station ? `${station.name}：可借 ${station.bikes}、可還 ${station.docks}` : "非 YouBike 站點"}</span>
  `;
}

function renderResult(path, metrics, route) {
  const endLocation = route.endLocation || state.end;
  document.querySelector("#routeTitle").textContent = `${locations[state.start].name} → ${locations[endLocation].name}｜${modeLabel[state.mode]}`;
  document.querySelector("#happyScore").textContent = metrics.score || "--";
  document.querySelector("#scoreLabel").textContent = metrics.score >= 86 ? "非常適合" : metrics.score >= 74 ? "推薦路線" : "可通行，需留意";
  const startDoor = route.startDoor ? routeNodes[route.startDoor].name : "--";
  const endDoor = route.endDoor ? routeNodes[route.endDoor].name : "--";
  const bikeNote = state.mode === "bike" ? `已自動選擇離 ${locations[state.start].name} 最近的 YouBike 站點：${locations[endLocation].name}。` : "";
  const summary = path.length
    ? `${bikeNote}系統先以建築中心顯示選取位置，規劃後改用最近且符合條件的門口：${startDoor} → ${endDoor}。總距離約 ${metrics.distance} 公尺，室內或遮蔽比例 ${metrics.indoorRatio}%${metrics.crossingCount ? `，需過馬路 ${metrics.crossingCount} 次` : ""}。`
    : "找不到符合條件的路線，請放寬無障礙或遮蔽需求。";
  document.querySelector("#routeSummary").textContent = summary;
  document.querySelector("#weatherInfo").textContent = `${weather.condition}，降雨 ${weather.rainProbability}%`;
  document.querySelector("#aqiInfo").textContent = `${metrics.avgAqi || aqi.current.value}（${aqi.current.level}）`;
  document.querySelector("#bikeInfo").textContent = getBikeText(path);
  document.querySelector("#accessInfo").textContent = metrics.accessGood ? "全程避開不適合路段" : "部分路段不建議輪椅通行";
  document.querySelector("#routeTimeInfo").textContent = metrics.distance ? `${Math.max(3, Math.round(metrics.distance / 75))} 分鐘` : "--";
  document.querySelector("#routeDistanceInfo").textContent = metrics.distance ? `${metrics.distance} 公尺` : "--";
  document.querySelector("#routeRainInfo").textContent = metrics.indoorRatio ? `${metrics.indoorRatio}%` : "--";
  document.querySelector("#routeShadeInfo").textContent = metrics.avgShade ? `${metrics.avgShade}%` : "--";
  document.querySelector("#measureInfo").textContent = metrics.distance ? `${locations[state.start].name} 到 ${locations[endLocation].name}，以門口與道路節點估算約 ${metrics.distance} 公尺。` : "--";
  renderModeNote(metrics);
  renderRouteSteps(path);
  renderRouteAlerts(metrics);
  renderSegmentGuide();
}

function renderModeNote(metrics) {
  const notes = {
    fastest: "最近路線只以距離為主，不會特別偏好室內或室外。",
    comfort: "最舒適路線會同時考慮距離、遮蔽、不淋雨、不曬太陽與坡度。",
    accessible: "無障礙路線會排除有樓梯、坡度不佳或不建議輪椅通行的邊。",
    bike: "YouBike 接駁會先找出離起點最近的 YouBike 站，再規劃前往站點的路線。"
  };
  document.querySelector("#routeModeNote").textContent = `${notes[state.mode]} 幸福指數：${metrics.score || "--"}。`;
}

function renderRouteSteps(path) {
  const list = document.querySelector("#routeSteps");
  list.innerHTML = "";
  path.slice(0, -1).forEach((id, index) => {
    const nextId = path[index + 1];
    const edge = graph[id].find((item) => item.to === nextId);
    const li = document.createElement("li");
    li.innerHTML = index === 0
      ? `<strong>從 ${routeNodes[id].name} 出發</strong><span>${getEdgeInstruction(id, nextId, edge, index)}</span>`
      : `<strong>${getNavigationTitle(id, nextId, edge, index)}</strong><span>${getEdgeInstruction(id, nextId, edge, index)} 約 ${edge.distance} 公尺。</span>`;
    list.appendChild(li);
  });
  if (path.length) {
    const end = routeNodes[path[path.length - 1]];
    const li = document.createElement("li");
    li.innerHTML = `<strong>抵達 ${end.name}</strong><span>已到達目的地門口。</span>`;
    list.appendChild(li);
  }
}

function getEdgeKindLabel(edge) {
  if (!edge) return "路段";
  if (edge.crossing || edge.kind === "crossing") return "過馬路路段";
  if (edge.kind === "indoor") return "室內通道";
  if (edge.kind === "covered") return "遮蔽路段";
  return "室外道路";
}

function renderRouteAlerts(metrics) {
  const list = document.querySelector("#routeAlerts");
  if (!list) return;
  const alerts = [];
  alerts.push(metrics.indoorRatio >= 45
    ? ["good", "室內遮蔽比例高", "此路線適合不想淋雨或曬太陽的使用者。"]
    : ["warning", "室外路段較多", "若怕雨或怕曬，可切換最舒適路線。"]);
  alerts.push(metrics.accessGood
    ? ["good", "無障礙條件良好", "路線避開有樓梯或不建議輪椅通行的邊。"]
    : ["info", "無障礙需注意", "一般模式可能包含坡度較高或球場周邊路段。"]);
  alerts.push(metrics.avgAqi <= 62
    ? ["good", "空氣品質較佳", "路線較少靠近車流大的外側道路。"]
    : ["warning", "AQI 普通", "行走時可留意外側道路車流。"]);
  if (metrics.crossingCount) {
    alerts.push(["warning", "包含過馬路提醒", `此路線需要過馬路 ${metrics.crossingCount} 次，導航步驟會在該段特別提醒。`]);
  }
  list.innerHTML = alerts.map(([type, title, text]) => `
    <article class="alert-item ${type}">
      <strong>${title}</strong>
      <span>${text}</span>
    </article>
  `).join("");
}

function getBikeText(path) {
  const stationId = path.map((id) => routeNodes[id]?.parent || id).find((id) => bikes[id]) || "YB_MRT";
  const station = bikes[stationId];
  return `${station.name}：可借 ${station.bikes}、可還 ${station.docks}`;
}

function renderComparison() {
  const compareCards = document.querySelector("#compareCards");
  if (compareCards) compareCards.innerHTML = "";
  Object.keys(modeLabel).forEach((mode) => {
    const endLocation = getEffectiveEndLocation(state.start, mode);
    const route = {
      ...resolveBestRoute(state.start, endLocation, mode),
      endLocation
    };
    const metrics = calculateMetrics(route.path);
    const score = getModeScore(metrics, mode);
    const card = document.createElement("article");
    card.className = "compare-mode-card";
    card.innerHTML = `
      <span>${modeLabel[mode]}</span>
      <strong>${score}</strong>
      <small>${metrics.distance || "--"} 公尺｜${locations[endLocation].name}｜遮蔽 ${metrics.indoorRatio || 0}%</small>
      <div class="bar"><span style="width:${score}%"></span></div>
      <button class="secondary-action" type="button">套用此模式</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      setMode(mode);
      state.needs.accessible = mode === "accessible";
      state.needs.bike = mode === "bike";
      accessibleToggle.checked = state.needs.accessible;
      syncNeedCheckboxes();
      calculateAndRender({ resetStep: true });
      showView("result");
    });
    compareCards?.appendChild(card);
  });
}

function getModeScore(metrics, mode) {
  if (!metrics.distance) return 0;
  const base = {
    fastest: 108 - metrics.distance / 36,
    comfort: metrics.score,
    accessible: metrics.accessGood ? 98 - metrics.distance / 48 : 35,
    bike: 105 - metrics.distance / 32 + metrics.avgShade * 0.1
  }[mode];
  return Math.max(35, Math.min(99, Math.round(base)));
}

function updateEnvironment() {
  document.querySelector("#rainBadge").textContent = `降雨 ${weather.rainProbability}%`;
  document.querySelector("#aqiBadge").textContent = `AQI ${aqi.current.value}`;
  document.querySelector("#tempBadge").textContent = `${weather.temperature}°C`;
}

function updatePreferenceLabels() {
  const ids = { time: "prefTimeText", air: "prefAirText", heat: "prefHeatText", rain: "prefRainText" };
  Object.entries(ids).forEach(([key, id]) => {
    const el = document.querySelector(`#${id}`);
    if (el) el.textContent = `${state.prefs[key]}%`;
  });
}

function refreshLiveInfo() {
  const now = new Date();
  document.querySelector("#liveUpdatedTime").textContent = `最後更新：${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function getNavigationSteps() {
  if (!state.lastPath.length) return [];
  return state.lastPath.slice(0, -1).map((id, index) => {
    const nextId = state.lastPath[index + 1];
    const edge = graph[id]?.find((item) => item.to === nextId);
    return {
      title: getNavigationTitle(id, nextId, edge, index),
      distance: `第 ${index + 1} 段｜${edge?.distance || "--"} 公尺`,
      text: getEdgeInstruction(id, nextId, edge, index)
    };
  });
}

function renderNavigation() {
  if (!document.querySelector("#navStepTitle")) return;
  const steps = getNavigationSteps();
  if (state.lastPath.length < 2 || !steps.length) {
    document.querySelector("#navStepTitle").textContent = "尚未產生可導航路線";
    document.querySelector("#navStepDistance").textContent = "--";
    document.querySelector("#navStepText").textContent = "請選擇不同的起點與終點後重新計算。";
    document.querySelector("#navProgressBar").style.width = "0%";
    document.querySelector("#navProgressText").textContent = "尚未開始。";
    return;
  }
  const segmentCount = Math.max(1, state.lastPath.length - 1);
  state.navIndex = Math.max(0, Math.min(state.navIndex, segmentCount - 1));
  const step = steps[state.navIndex];
  const progress = Math.round(((state.navIndex + 1) / segmentCount) * 100);
  document.querySelector("#navStepTitle").textContent = step.title;
  document.querySelector("#navStepDistance").textContent = step.distance;
  document.querySelector("#navStepText").textContent = step.text;
  document.querySelector("#navProgressBar").style.width = `${progress}%`;
  document.querySelector("#navProgressText").textContent = `已完成 ${progress}% ，共 ${segmentCount} 段。`;
  renderSegmentGuide();
  renderMap(state.lastPath);
  renderNavigationMap(state.lastPath);
}

function renderNavigationMap(path) {
  const svg = document.querySelector("#navRouteSvg");
  const layer = document.querySelector("#navNodeLayer");
  if (!svg || !layer || !path.length) return;
  svg.innerHTML = "";
  layer.innerHTML = "";
  const activeFrom = path[state.navIndex];
  const activeTo = path[state.navIndex + 1];
  const activeEdge = activeFrom && activeTo ? edgeKey(activeFrom, activeTo) : "";
  path.slice(0, -1).forEach((from, index) => {
    const to = path[index + 1];
    drawLineTo(svg, from, to, edgeKey(from, to) === activeEdge ? "active-route-edge" : "route-edge");
  });
  path.forEach((id, index) => {
    if (!shouldShowRouteMarker(id, index, path)) return;
    const node = routeNodes[id];
    const marker = document.createElement("span");
    marker.className = `nav-map-node ${node.type === "road" ? "road" : ""} ${index === state.navIndex ? "current" : ""}`;
    marker.style.left = `${node.x}%`;
    marker.style.top = `${node.y}%`;
    marker.textContent = index + 1;
    layer.appendChild(marker);
  });
}

function moveNavigationStep(delta) {
  if (!state.lastPath.length) return;
  const segmentCount = Math.max(1, state.lastPath.length - 1);
  state.navIndex = Math.max(0, Math.min(segmentCount - 1, state.navIndex + delta));
  renderSegmentGuide();
  renderMap(state.lastPath);
  showMapPopover(state.lastPath[state.navIndex + 1] || state.lastPath[state.navIndex]);
  renderNavigation();
}

function handleRouteNextStep() {
  if (!state.lastPath.length) return;
  const segmentCount = Math.max(1, state.lastPath.length - 1);
  if (state.navIndex >= segmentCount - 1) {
    state.navIndex = 0;
    renderSegmentGuide();
    showView("dashboard");
    return;
  }
  moveNavigationStep(1);
}

function renderSegmentGuide() {
  const counter = document.querySelector("#segmentCounter");
  const instruction = document.querySelector("#segmentInstruction");
  const hint = document.querySelector("#segmentTurnHint");
  const prevButton = document.querySelector("#routePrevStepBtn");
  const nextButton = document.querySelector("#routeNextStepBtn");
  const progressBar = document.querySelector("#segmentProgressBar");
  const guide = document.querySelector(".segment-guide");
  if (!counter || !instruction || !hint || state.lastPath.length < 2) {
    if (counter) counter.textContent = "尚未產生路線";
    if (instruction) instruction.textContent = "請選擇不同的起點與終點";
    if (hint) hint.textContent = "起點與終點相同時不會產生導航段落。";
    if (progressBar) progressBar.style.width = "0%";
    if (guide) guide.classList.remove("crossing", "indoor");
    if (nextButton) {
      nextButton.disabled = true;
      nextButton.classList.remove("finish");
      nextButton.innerHTML = '<span>下一段</span><span class="nav-step-icon" aria-hidden="true"></span>';
    }
    return;
  }
  const segmentCount = Math.max(1, state.lastPath.length - 1);
  const index = Math.min(state.navIndex, segmentCount - 1);
  const from = state.lastPath[index];
  const to = state.lastPath[index + 1];
  const edge = graph[from]?.find((item) => item.to === to);
  counter.textContent = `第 ${index + 1} 段 / 共 ${segmentCount} 段`;
  instruction.textContent = `${routeNodes[from].name} → ${routeNodes[to].name}`;
  hint.textContent = `${edge?.distance || "--"} 公尺，${getEdgeInstruction(from, to, edge, index)}`;
  if (progressBar) progressBar.style.width = `${Math.round(((index + 1) / segmentCount) * 100)}%`;
  if (guide) {
    guide.classList.toggle("crossing", Boolean(edge?.crossing));
    guide.classList.toggle("indoor", Boolean(edge?.indoor || edge?.covered || edge?.type === "indoor"));
  }
  if (prevButton) prevButton.disabled = index === 0;
  if (nextButton) {
    const isLastSegment = index === segmentCount - 1;
    nextButton.disabled = false;
    nextButton.classList.toggle("finish", isLastSegment);
    nextButton.innerHTML = isLastSegment
      ? '<span>結束</span><span class="nav-step-icon" aria-hidden="true"></span>'
      : '<span>下一段</span><span class="nav-step-icon" aria-hidden="true"></span>';
  }
}

function getTurnHint(index) {
  const path = state.lastPath;
  if (index === 0 || !path[index - 1] || !path[index + 1]) return "直行並留意下一個定位點";
  const prev = routeNodes[path[index - 1]];
  const current = routeNodes[path[index]];
  const next = routeNodes[path[index + 1]];
  const v1 = { x: current.x - prev.x, y: current.y - prev.y };
  const v2 = { x: next.x - current.x, y: next.y - current.y };
  const cross = v1.x * v2.y - v1.y * v2.x;
  const dot = v1.x * v2.x + v1.y * v2.y;
  if (dot < -20) return "接近轉折處，請回頭轉向";
  if (Math.abs(cross) < 45) return "大致直行";
  return cross > 0 ? "前方右轉" : "前方左轉";
}

function renderExploreNodes() {
  const layer = document.querySelector("#exploreNodeLayer");
  if (!layer) return;
  layer.innerHTML = "";
  Object.entries(locations).forEach(([id, node]) => {
    const button = document.createElement("button");
    button.className = `explore-node ${node.type === "bike" ? "bike" : ""}`;
    button.type = "button";
    button.style.left = `${node.x}%`;
    button.style.top = `${node.y}%`;
    button.textContent = "";
    button.setAttribute("aria-label", node.name);
    button.title = node.name;
    button.addEventListener("click", () => showExploreDetail(id));
    layer.appendChild(button);
  });
}

function shortName(name) {
  if (name.startsWith("YouBike")) return "You";
  return name.slice(0, 2);
}

function showExploreDetail(id) {
  const detail = document.querySelector("#exploreDetail");
  if (!detail) return;
  const node = locations[id];
  const station = bikes[id];
  const facilities = access.facilities[id] || ["暫無無障礙設施資料"];
  const doors = getCandidateDoors(id).map((doorId) => routeNodes[doorId]?.name).filter(Boolean).join("、");
  detail.innerHTML = `
    <span>${typeLabel[node.type]}</span>
    <strong>${node.name}</strong>
    <div class="detail-list">
      <div><b>可用門口</b><small>${doors || "此點位本身即為定位點"}</small></div>
      <div><b>無障礙設施</b><small>${facilities.join("、")}</small></div>
      ${station ? `<div><b>YouBike 狀態</b><small>可借 ${station.bikes}、可還 ${station.docks}。${station.distanceText}</small></div>` : ""}
    </div>
    <button class="primary-action" id="exploreSetStartBtn" type="button">設為起點</button>
    <button class="secondary-action" id="exploreSetEndBtn" type="button">設為終點</button>
  `;
  document.querySelector("#exploreSetStartBtn").addEventListener("click", () => {
    state.start = id;
    startSelect.value = id;
    calculateAndRender({ resetStep: true });
    showView("dashboard");
  });
  document.querySelector("#exploreSetEndBtn").addEventListener("click", () => {
    state.end = id;
    endSelect.value = id;
    calculateAndRender({ resetStep: true });
    showView("result");
  });
}

function saveCurrentRoute() {
  if (!state.lastPath.length) return;
  const list = document.querySelector(".favorite-list");
  if (!list) return;
  const item = document.createElement("article");
  item.className = "favorite-item";
  item.innerHTML = `
    <span class="favorite-icon green">新</span>
    <div>
      <strong>${locations[state.start].name} → ${locations[state.end].name}</strong>
      <small>${modeLabel[state.mode]}｜${state.lastMetrics.distance} 公尺</small>
    </div>
    <button class="favorite-load" data-start="${state.start}" data-end="${state.end}" data-mode-target="${state.mode}" type="button">載入</button>
  `;
  item.querySelector("button").addEventListener("click", () => {
    state.start = item.querySelector("button").dataset.start;
    state.end = item.querySelector("button").dataset.end;
    startSelect.value = state.start;
    endSelect.value = state.end;
    setMode(item.querySelector("button").dataset.modeTarget);
    calculateAndRender({ resetStep: true });
    showView("result");
  });
  list.prepend(item);
  showView("favorites");
}

function aStarPreview(startLocation, endLocation) {
  const start = getCandidateDoors(startLocation)[0];
  const end = getCandidateDoors(endLocation)[0];
  const open = [start];
  const cameFrom = {};
  const gScore = Object.fromEntries(Object.keys(routeNodes).map((id) => [id, Infinity]));
  const fScore = Object.fromEntries(Object.keys(routeNodes).map((id) => [id, Infinity]));
  gScore[start] = 0;
  fScore[start] = heuristic(start, end);
  while (open.length) {
    open.sort((a, b) => fScore[a] - fScore[b]);
    const current = open.shift();
    if (current === end) break;
    graph[current].forEach((edge) => {
      const tentative = gScore[current] + edge.distance;
      if (tentative < gScore[edge.to]) {
        cameFrom[edge.to] = current;
        gScore[edge.to] = tentative;
        fScore[edge.to] = tentative + heuristic(edge.to, end);
        if (!open.includes(edge.to)) open.push(edge.to);
      }
    });
  }
  const path = [];
  let current = end;
  while (current) {
    path.unshift(current);
    current = cameFrom[current];
  }
  return path[0] === start ? path : [];
}

function heuristic(from, to) {
  const a = routeNodes[from];
  const b = routeNodes[to];
  return Math.hypot(a.x - b.x, a.y - b.y) * 9;
}

function updateDataView() {
  const title = document.querySelector("#dataTitle");
  const content = document.querySelector("#dataContent");
  if (!title || !content) return;
  const route = resolveBestRoute(state.start, state.end, state.mode);
  const views = {
    graph: {
      title: "Graph：門口、室內通道與道路邊",
      content: JSON.stringify(simplifyGraph(), null, 2)
    },
    hash: {
      title: "Hash Map：用地點 ID 快速查中心點、門口、AQI、無障礙資料",
      content: JSON.stringify(simplifyHashMap(), null, 2)
    },
    dijkstra: {
      title: "Dijkstra：先選候選門口，再找最佳路線",
      content: `起點：${locations[state.start].name}\n終點：${locations[state.end].name}\n模式：${modeLabel[state.mode]}\n門口：${route.startDoor ? routeNodes[route.startDoor].name : "--"} → ${route.endDoor ? routeNodes[route.endDoor].name : "--"}\n結果：${route.path.map((id) => routeNodes[id].name).join(" → ")}`
    },
    astar: {
      title: "A*：用座標估計到終點門口的方向",
      content: `A* 預覽路線：${aStarPreview(state.start, state.end).map((id) => routeNodes[id].name).join(" → ")}\n\n啟發式 h(n)：使用地圖座標到終點門口的直線距離估計。`
    }
  };
  title.textContent = views[state.dataTab].title;
  content.textContent = views[state.dataTab].content;
}

function simplifyGraph() {
  return Object.fromEntries(
    Object.entries(graph).map(([id, edges]) => [routeNodes[id].name, edges.map((edge) => routeNodes[edge.to].name)])
  );
}

function simplifyHashMap() {
  return Object.fromEntries(
    Object.entries(locations).map(([id, node]) => [
      id,
      {
        name: node.name,
        center: [node.x, node.y],
        doors: getCandidateDoors(id).map((doorId) => routeNodes[doorId]?.name),
        aqi: aqi.nodeMap[id],
        facilities: access.facilities[id] || []
      }
    ])
  );
}

init();
