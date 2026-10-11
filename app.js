const DEFAULT_DAILY_GOAL = 2500;
const STORAGE_PREFIX = "trinktracker";
const GOAL_STORAGE_KEY = `${STORAGE_PREFIX}-daily-goal`;
const DRINKS_STORAGE_KEY = `${STORAGE_PREFIX}-drinks`;
const WATER_DRINK = { id: "water", name: "Wasser", color: "#1687D9" };
const DRINK_COLORS = [
  "#E4572E", "#F28E2B", "#D6A700", "#8C6D1F", "#6B8E23",
  "#2E8B57", "#00A878", "#00A6A6", "#3A86FF", "#5E60CE",
  "#8338EC", "#C23B8E", "#D1495B", "#7F5539", "#6C757D",
  "#FF6B6B", "#FF9F1C", "#A7B61A", "#4C956C", "#2A9D8F",
  "#00B4D8", "#4361EE", "#7209B7", "#B5179E", "#F72585",
  "#BC6C25", "#606C38", "#277DA1", "#577590", "#9C6644",
];

const consumedAmount = document.querySelector("#consumed-amount");
const progressPercent = document.querySelector("#progress-percent");
const progressTrack = document.querySelector("#progress-track");
const goalMessage = document.querySelector("#goal-message");
const dailyGoalDisplay = document.querySelector("#daily-goal");
const drinkLegend = document.querySelector("#drink-legend");
const historyList = document.querySelector("#history-list");
const calendarGrid = document.querySelector("#calendar-grid");
const calendarMonthLabel = document.querySelector("#calendar-month-label");
const calendarDayDetails = document.querySelector("#calendar-day-details");
const nextMonthButton = document.querySelector("#next-month-button");
const customForm = document.querySelector("#custom-form");
const customAmount = document.querySelector("#custom-amount");
const inputError = document.querySelector("#input-error");
const storageWarning = document.querySelector("#storage-warning");
const drinkSelect = document.querySelector("#drink-select");
const drinkDialog = document.querySelector("#drink-dialog");
const drinkForm = document.querySelector("#drink-form");
const drinkName = document.querySelector("#drink-name");
const colorPalette = document.querySelector("#color-palette");
const drinkError = document.querySelector("#drink-error");
const menuButton = document.querySelector("#menu-button");
const settingsMenu = document.querySelector("#settings-menu");
const goalDialog = document.querySelector("#goal-dialog");
const goalForm = document.querySelector("#goal-form");
const goalInput = document.querySelector("#goal-input");
const goalError = document.querySelector("#goal-error");
const installAppButton = document.querySelector("#install-app-button");
const importDataButton = document.querySelector("#import-data-button");
const exportDataButton = document.querySelector("#export-data-button");
const importDataFile = document.querySelector("#import-data-file");
const loadSampleDataButton = document.querySelector("#load-sample-data-button");

const today = new Date();
const dateKey = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");
const storageKey = `${STORAGE_PREFIX}-${dateKey}`;
const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

let dailyGoal = loadGoal();
let drinks = loadDrinks();
let entries = loadEntries();
let deferredInstallPrompt;
let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
let selectedCalendarDate = dateKey;

document.querySelector("#today-label").textContent = dateFormatter.format(today);
renderDrinkOptions();
renderColorPalette();
renderCalendar();

document.querySelector("#previous-month-button").addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  selectedCalendarDate = "";
  renderCalendar();
});

nextMonthButton.addEventListener("click", () => {
  visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  selectedCalendarDate = "";
  renderCalendar();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installAppButton.classList.remove("hidden");
});

installAppButton.addEventListener("click", async () => {
  setMenuOpen(false);
  if (!deferredInstallPrompt) return;

  await deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === "accepted") installAppButton.classList.add("hidden");
  deferredInstallPrompt = undefined;
});

window.addEventListener("appinstalled", () => {
  installAppButton.classList.add("hidden");
  deferredInstallPrompt = undefined;
});

exportDataButton.addEventListener("click", () => {
  setMenuOpen(false);

  try {
    const backup = validateBackup(createBackup());
    const file = new Blob([`${JSON.stringify(backup, null, 2)}\n`], {
      type: "application/json",
    });
    const downloadUrl = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `trinktracker-backup-${dateKey}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    showDataNotice("Deine TrinkTracker-Daten wurden als JSON-Datei exportiert.");
  } catch (error) {
    showStorageWarning("Der Datenexport ist fehlgeschlagen.", error);
  }
});

importDataButton.addEventListener("click", () => {
  setMenuOpen(false);
  importDataFile.click();
});

importDataFile.addEventListener("change", async () => {
  const [file] = importDataFile.files || [];
  importDataFile.value = "";
  if (!file) return;

  try {
    await importBackup(JSON.parse(await file.text()), "Datenimport");
  } catch (error) {
    showStorageWarning(error.message || "Die ausgewählte Datei konnte nicht importiert werden.", error);
  }
});

loadSampleDataButton.addEventListener("click", async () => {
  setMenuOpen(false);

  try {
    const response = await fetch("./beispiel-daten.json");
    if (!response.ok) {
      throw new Error(`Die Beispieldatei konnte nicht geladen werden (HTTP ${response.status}).`);
    }
    await importBackup(await response.json(), "Beispieldaten");
  } catch (error) {
    showStorageWarning(error.message || "Die Beispieldaten konnten nicht geladen werden.", error);
  }
});

if ("serviceWorker" in navigator && window.isSecureContext) {
  navigator.serviceWorker.register("./sw.js").catch((error) => {
    console.error("Der Offline-Modus konnte nicht aktiviert werden.", error);
  });
}

menuButton.addEventListener("click", () => {
  const isExpanded = menuButton.getAttribute("aria-expanded") === "true";
  setMenuOpen(!isExpanded);
});

document.addEventListener("click", (event) => {
  if (!event.target.closest("#settings-menu") && !event.target.closest("#menu-button")) {
    setMenuOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenuOpen(false);
});

document.querySelector("#change-goal-button").addEventListener("click", () => {
  setMenuOpen(false);
  goalInput.value = String(dailyGoal);
  goalError.classList.add("hidden");
  goalDialog.showModal();
  goalInput.focus();
});

document.querySelector("#cancel-goal-button").addEventListener("click", () => {
  goalDialog.close();
});

goalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const newGoal = Number(goalInput.value);

  if (!Number.isSafeInteger(newGoal) || newGoal < 1 || newGoal > 1000000) {
    goalError.textContent = "Bitte gib eine ganze Zahl zwischen 1 und 1.000.000 ml ein.";
    goalError.classList.remove("hidden");
    goalInput.focus();
    return;
  }

  dailyGoal = newGoal;
  render();
  goalDialog.close();

  try {
    localStorage.setItem(GOAL_STORAGE_KEY, String(dailyGoal));
    storageWarning.classList.add("hidden");
  } catch (error) {
    showStorageWarning("Tagesziel geändert, aber nicht dauerhaft gespeichert. Bitte prüfe die Browser-Speichereinstellungen.", error);
  }
});

document.querySelector("#add-drink-button").addEventListener("click", () => {
  drinkForm.reset();
  drinkError.classList.add("hidden");
  renderColorPalette();
  drinkDialog.showModal();
  drinkName.focus();
});

document.querySelector("#cancel-drink-button").addEventListener("click", () => {
  drinkDialog.close();
});

drinkForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = drinkName.value.trim();
  const selectedColor = drinkForm.querySelector('input[name="color"]:checked')?.value;

  if (!name) {
    showDrinkError("Bitte gib einen Namen für das Getränk ein.");
    drinkName.focus();
    return;
  }
  if (drinks.some((drink) => drink.name.toLocaleLowerCase("de-DE") === name.toLocaleLowerCase("de-DE"))) {
    showDrinkError("Dieses Getränk gibt es bereits. Wähle bitte einen anderen Namen.");
    drinkName.focus();
    return;
  }
  if (!selectedColor || !DRINK_COLORS.includes(selectedColor) || drinks.some((drink) => drink.color === selectedColor)) {
    showDrinkError("Bitte wähle eine der noch verfügbaren Farben aus.");
    return;
  }

  const newDrink = {
    id: `drink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    color: selectedColor,
  };
  const updatedDrinks = [...drinks, newDrink];

  try {
    localStorage.setItem(DRINKS_STORAGE_KEY, JSON.stringify(updatedDrinks));
  } catch (error) {
    showDrinkError("Das Getränk konnte nicht gespeichert werden. Bitte prüfe die Browser-Speichereinstellungen.");
    console.error("Getränk konnte nicht gespeichert werden.", error);
    return;
  }

  drinks = updatedDrinks;
  renderDrinkOptions(newDrink.id);
  renderColorPalette();
  render();
  drinkDialog.close();
  storageWarning.classList.add("hidden");
});

document.querySelectorAll("[data-amount]").forEach((button) => {
  button.addEventListener("click", () => {
    addWater(Number(button.dataset.amount));
  });
});

customForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const amount = Number(customAmount.value);

  if (!Number.isSafeInteger(amount) || amount < 1) {
    inputError.textContent = "Bitte gib eine ganze Menge von mindestens 1 ml ein.";
    inputError.classList.remove("hidden");
    customAmount.focus();
    return;
  }

  inputError.classList.add("hidden");
  addWater(amount);
  customForm.reset();
});

document.querySelector("#reset-button").addEventListener("click", () => {
  setMenuOpen(false);
  if (!window.confirm("Möchtest du alle Trinkeinträge von heute löschen?")) return;

  entries = [];
  render();

  try {
    localStorage.removeItem(storageKey);
    storageWarning.classList.add("hidden");
  } catch (error) {
    showStorageWarning("Der Tagesstand wurde zurückgesetzt, konnte aber nicht aus dem Browser-Speicher entfernt werden.", error);
  }
  renderCalendar();
});

function setMenuOpen(isOpen) {
  settingsMenu.classList.toggle("hidden", !isOpen);
  menuButton.setAttribute("aria-expanded", String(isOpen));
}

function loadGoal() {
  try {
    const storedGoal = localStorage.getItem(GOAL_STORAGE_KEY);
    if (storedGoal === null) return DEFAULT_DAILY_GOAL;

    const parsedGoal = Number(storedGoal);
    if (Number.isSafeInteger(parsedGoal) && parsedGoal >= 1 && parsedGoal <= 1000000) {
      return parsedGoal;
    }

    showStorageWarning("Das gespeicherte Tagesziel ist ungültig. Es wird das Standardziel von 2.500 ml verwendet.");
    return DEFAULT_DAILY_GOAL;
  } catch (error) {
    showStorageWarning("Das gespeicherte Tagesziel konnte nicht geladen werden. Es wird das Standardziel von 2.500 ml verwendet.", error);
    return DEFAULT_DAILY_GOAL;
  }
}

function createBackup() {
  const dailyEntries = {};
  const dailyKeyPattern = /^trinktracker-(\d{4}-\d{2}-\d{2})$/;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    const match = key?.match(dailyKeyPattern);
    if (!match) continue;

    const entriesForDay = JSON.parse(localStorage.getItem(key));
    if (!Array.isArray(entriesForDay)) {
      throw new Error(`Die gespeicherten Daten für ${match[1]} sind ungültig; der Export wurde abgebrochen.`);
    }
    if (entriesForDay.length > 0) dailyEntries[match[1]] = entriesForDay;
  }

  return {
    format: "trinktracker-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    dailyGoal,
    drinks,
    dailyEntries,
  };
}

async function importBackup(data, sourceLabel) {
  const backup = validateBackup(data);
  const entryCount = Object.values(backup.dailyEntries).reduce(
    (sum, dayEntries) => sum + dayEntries.length,
    0,
  );
  const dayCount = Object.keys(backup.dailyEntries).length;
  const confirmed = window.confirm(
    `${sourceLabel}: ${entryCount} Einträge aus ${dayCount} Tagen übernehmen? ` +
      "Dein Tagesziel, deine Getränke und alle bisherigen Trinkdaten auf diesem Gerät werden ersetzt.",
  );
  if (!confirmed) return;

  replaceBackup(backup);
  showDataNotice(
    sourceLabel === "Beispieldaten"
      ? "Die Beispieldaten wurden importiert. Du kannst sie jederzeit mit deinem eigenen Backup ersetzen."
      : "Der Datenimport war erfolgreich. Alle Ansichten wurden aktualisiert.",
  );
}

function validateBackup(data) {
  if (
    !data ||
    typeof data !== "object" ||
    data.format !== "trinktracker-backup" ||
    data.version !== 1 ||
    !Number.isSafeInteger(data.dailyGoal) ||
    data.dailyGoal < 1 ||
    data.dailyGoal > 1000000 ||
    !Array.isArray(data.drinks) ||
    !data.dailyEntries ||
    typeof data.dailyEntries !== "object" ||
    Array.isArray(data.dailyEntries)
  ) {
    throw new Error("Die Datei hat kein gültiges TrinkTracker-Backup-Format.");
  }

  const validDrinks = data.drinks.every(
    (drink) =>
      drink &&
      typeof drink.id === "string" &&
      drink.id.length > 0 &&
      typeof drink.name === "string" &&
      drink.name.trim().length > 0 &&
      typeof drink.color === "string" &&
      /^#[0-9A-F]{6}$/i.test(drink.color),
  );
  if (!validDrinks) {
    throw new Error("Das Backup enthält ungültige Getränkedaten.");
  }

  const water = data.drinks.find((drink) => drink.id === WATER_DRINK.id);
  const otherDrinks = data.drinks.filter((drink) => drink.id !== WATER_DRINK.id);
  if (
    !water ||
    water.name !== WATER_DRINK.name ||
    water.color.toUpperCase() !== WATER_DRINK.color ||
    data.drinks.length !== otherDrinks.length + 1 ||
    otherDrinks.length > DRINK_COLORS.length ||
    new Set(data.drinks.map((drink) => drink.id)).size !== data.drinks.length ||
    new Set(data.drinks.map((drink) => drink.name.trim().toLocaleLowerCase("de-DE"))).size !== data.drinks.length ||
    new Set(otherDrinks.map((drink) => drink.color.toUpperCase())).size !== otherDrinks.length ||
    otherDrinks.some((drink) => !DRINK_COLORS.includes(drink.color.toUpperCase()))
  ) {
    throw new Error("Das Backup benötigt Wasser und darf höchstens 30 eindeutige Getränkefarben enthalten.");
  }

  const drinkIds = new Set(data.drinks.map((drink) => drink.id));
  const dailyEntries = {};
  for (const [key, entriesForDay] of Object.entries(data.dailyEntries)) {
    if (!isValidDateKey(key) || !Array.isArray(entriesForDay)) {
      throw new Error(`Ungültiges Datum oder Eintragsliste im Backup: ${key}`);
    }

    const entriesAreValid = entriesForDay.every(
      (entry) =>
        entry &&
        Number.isSafeInteger(entry.amount) &&
        entry.amount > 0 &&
        typeof entry.timestamp === "string" &&
        !Number.isNaN(Date.parse(entry.timestamp)) &&
        (entry.drinkId === undefined || drinkIds.has(entry.drinkId)),
    );
    if (!entriesAreValid) {
      throw new Error(`Das Backup enthält ungültige Trinkeinträge für ${key}.`);
    }

    dailyEntries[key] = entriesForDay.map((entry) => ({
      ...entry,
      drinkId: entry.drinkId ?? WATER_DRINK.id,
    }));
  }

  return {
    exportedAt:
      typeof data.exportedAt === "string" && !Number.isNaN(Date.parse(data.exportedAt))
        ? data.exportedAt
        : new Date().toISOString(),
    dailyGoal: data.dailyGoal,
    drinks: [WATER_DRINK, ...otherDrinks],
    dailyEntries,
  };
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function replaceBackup(backup) {
  const previousData = new Map();
  const newData = new Map([
    [GOAL_STORAGE_KEY, String(backup.dailyGoal)],
    [DRINKS_STORAGE_KEY, JSON.stringify(backup.drinks)],
    ...Object.entries(backup.dailyEntries).map(([date, dayEntries]) => [
      `${STORAGE_PREFIX}-${date}`,
      JSON.stringify(dayEntries),
    ]),
  ]);

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (isTrackerDataKey(key)) previousData.set(key, localStorage.getItem(key));
  }

  try {
    for (const key of previousData.keys()) localStorage.removeItem(key);
    for (const [key, value] of newData) localStorage.setItem(key, value);
  } catch (error) {
    try {
      for (const key of newData.keys()) localStorage.removeItem(key);
      for (const [key, value] of previousData) localStorage.setItem(key, value);
    } catch (rollbackError) {
      console.error("Die Wiederherstellung der vorherigen TrinkTracker-Daten ist fehlgeschlagen.", rollbackError);
    }
    throw new Error("Die Daten konnten nicht gespeichert werden. Die vorherigen Daten wurden, soweit möglich, wiederhergestellt.", {
      cause: error,
    });
  }

  dailyGoal = backup.dailyGoal;
  drinks = backup.drinks;
  entries = backup.dailyEntries[dateKey] || [];
  renderDrinkOptions();
  renderColorPalette();
  render();
  renderCalendar();
}

function isTrackerDataKey(key) {
  return (
    key === GOAL_STORAGE_KEY ||
    key === DRINKS_STORAGE_KEY ||
    /^trinktracker-\d{4}-\d{2}-\d{2}$/.test(key)
  );
}

function loadDrinks() {
  try {
    const stored = localStorage.getItem(DRINKS_STORAGE_KEY);
    if (stored === null) return [WATER_DRINK];

    const parsed = JSON.parse(stored);
    if (
      !Array.isArray(parsed) ||
      !parsed.every(
        (drink) =>
          drink &&
          typeof drink.id === "string" &&
          drink.id.length > 0 &&
          typeof drink.name === "string" &&
          drink.name.trim().length > 0 &&
          typeof drink.color === "string" &&
          /^#[0-9A-F]{6}$/i.test(drink.color),
      )
    ) {
      showStorageWarning("Die gespeicherten Getränke sind ungültig. Es wird vorerst nur Wasser angezeigt.");
      return [WATER_DRINK];
    }

    const otherDrinks = parsed.filter((drink) => drink.id !== WATER_DRINK.id);
    if (
      otherDrinks.length > DRINK_COLORS.length ||
      new Set(otherDrinks.map((drink) => drink.color.toUpperCase())).size !== otherDrinks.length ||
      otherDrinks.some((drink) => !DRINK_COLORS.includes(drink.color.toUpperCase()))
    ) {
      showStorageWarning("Die gespeicherten Getränkefarben sind ungültig. Es wird vorerst nur Wasser angezeigt.");
      return [WATER_DRINK];
    }

    return [WATER_DRINK, ...otherDrinks];
  } catch (error) {
    showStorageWarning("Gespeicherte Getränke konnten nicht geladen werden. Es wird vorerst nur Wasser angezeigt.", error);
    return [WATER_DRINK];
  }
}

function loadEntries() {
  let savedEntries;
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];
    savedEntries = JSON.parse(stored);
  } catch (error) {
    showStorageWarning("Gespeicherte Einträge konnten nicht geladen werden. Neue Einträge bleiben bis zum Schließen dieser Seite verfügbar.", error);
    return [];
  }

  if (
    !Array.isArray(savedEntries) ||
    !savedEntries.every(
      (entry) =>
        entry &&
        Number.isSafeInteger(entry.amount) &&
        entry.amount > 0 &&
        typeof entry.timestamp === "string" &&
        !Number.isNaN(Date.parse(entry.timestamp)) &&
        (entry.drinkId === undefined || drinks.some((drink) => drink.id === entry.drinkId)),
    )
  ) {
    showStorageWarning("Die gespeicherten Einträge sind ungültig und wurden nicht geladen.");
    return [];
  }

  return savedEntries.map((entry) => ({
    ...entry,
    drinkId: entry.drinkId ?? WATER_DRINK.id,
  }));
}

function addWater(amount) {
  entries.unshift({
    amount,
    timestamp: new Date().toISOString(),
    drinkId: drinkSelect.value || WATER_DRINK.id,
  });
  render();

  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
    storageWarning.classList.add("hidden");
  } catch (error) {
    showStorageWarning("Eintrag hinzugefügt, aber nicht dauerhaft gespeichert. Bitte prüfe die Browser-Speichereinstellungen.", error);
  }
  renderCalendar();
}

function renderDrinkOptions(selectedId = drinkSelect.value || WATER_DRINK.id) {
  drinkSelect.replaceChildren();
  drinks.forEach((drink) => {
    const option = document.createElement("option");
    option.value = drink.id;
    option.textContent = drink.name;
    drinkSelect.append(option);
  });
  drinkSelect.value = drinks.some((drink) => drink.id === selectedId) ? selectedId : WATER_DRINK.id;

  const addDrinkButton = document.querySelector("#add-drink-button");
  const noColorsLeft = drinks.length - 1 >= DRINK_COLORS.length;
  addDrinkButton.disabled = noColorsLeft;
  addDrinkButton.title = noColorsLeft ? "Alle 30 Getränkefarben sind bereits vergeben." : "";
  addDrinkButton.classList.toggle("cursor-not-allowed", noColorsLeft);
  addDrinkButton.classList.toggle("opacity-50", noColorsLeft);
}

function renderColorPalette() {
  colorPalette.replaceChildren();
  const usedColors = new Set(drinks.map((drink) => drink.color.toUpperCase()));

  DRINK_COLORS.forEach((color, index) => {
    if (usedColors.has(color)) return;

    const label = document.createElement("label");
    label.className = "relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-1.5 transition hover:scale-110 has-[:checked]:ring-2 has-[:checked]:ring-ink has-[:checked]:ring-offset-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink has-[:focus-visible]:ring-offset-2";
    label.style.backgroundColor = color;
    label.title = `Farbe ${index + 1}`;

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "color";
    input.value = color;
    input.className = "sr-only";
    input.setAttribute("aria-label", `Farbe ${index + 1}`);
    input.required = true;
    label.append(input);
    colorPalette.append(label);
  });

  if (colorPalette.childElementCount === 0) {
    const message = document.createElement("p");
    message.className = "col-span-full text-sm text-slate-500";
    message.textContent = "Alle 30 Farben sind vergeben. Du kannst keine weiteren Getränke anlegen.";
    colorPalette.append(message);
  }
}

function showDrinkError(message) {
  drinkError.textContent = message;
  drinkError.classList.remove("hidden");
}

function render() {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const percentage = Math.round((total / dailyGoal) * 100);

  consumedAmount.textContent = total.toLocaleString("de-DE");
  dailyGoalDisplay.textContent = dailyGoal.toLocaleString("de-DE");
  progressPercent.textContent = `${percentage}%`;
  progressTrack.setAttribute("aria-valuemax", String(dailyGoal));
  progressTrack.setAttribute("aria-valuenow", String(Math.min(total, dailyGoal)));
  progressTrack.replaceChildren();
  goalMessage.textContent =
    total >= dailyGoal
      ? "Tagesziel erreicht – stark gemacht!"
      : `Noch ${(dailyGoal - total).toLocaleString("de-DE")} ml bis zu deinem Tagesziel.`;

  const amountsByDrink = new Map();
  entries.forEach((entry) => {
    amountsByDrink.set(entry.drinkId, (amountsByDrink.get(entry.drinkId) || 0) + entry.amount);
  });

  let renderedProgress = 0;
  const goalProgress = Math.min(total, dailyGoal);
  drinks.forEach((drink) => {
    const amount = amountsByDrink.get(drink.id) || 0;
    if (amount === 0 || renderedProgress >= goalProgress) return;

    const segmentAmount = Math.min(amount, goalProgress - renderedProgress);
    const segment = document.createElement("div");
    segment.className = "h-full shrink-0 transition-all duration-500";
    segment.style.backgroundColor = drink.color;
    segment.style.width = `${(segmentAmount / dailyGoal) * 100}%`;
    segment.setAttribute("aria-hidden", "true");
    progressTrack.append(segment);
    renderedProgress += segmentAmount;
  });

  drinkLegend.replaceChildren();
  drinks.forEach((drink) => {
    const amount = amountsByDrink.get(drink.id) || 0;
    if (amount === 0) return;

    const legendItem = document.createElement("li");
    legendItem.className = "flex items-center gap-2 text-xs font-medium text-slate-600";
    const swatch = document.createElement("span");
    swatch.className = "h-2.5 w-2.5 rounded-full";
    swatch.style.backgroundColor = drink.color;
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = `${drink.name}: ${amount.toLocaleString("de-DE")} ml`;
    legendItem.append(swatch, label);
    drinkLegend.append(legendItem);
  });

  historyList.replaceChildren();
  if (entries.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center";
    emptyItem.innerHTML = `
      <span class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 text-water">
        <svg aria-hidden="true" class="h-6 w-6" viewBox="0 0 24 24" fill="none">
          <path d="M12 3s-6 6.8-6 11a6 6 0 0 0 12 0c0-4.2-6-11-6-11Z" stroke="currentColor" stroke-width="1.7" />
        </svg>
      </span>
      <p class="font-semibold text-slate-700">Noch keine Einträge</p>
      <p class="mt-1 text-sm text-slate-500">Dein erster Schluck erscheint hier.</p>
    `;
    historyList.append(emptyItem);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-3 sm:gap-4 sm:px-4";

    const details = document.createElement("div");
    details.className = "flex min-w-0 items-center gap-3";

    const drink = drinks.find((item) => item.id === entry.drinkId) || WATER_DRINK;
    const icon = document.createElement("span");
    icon.className = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl";
    icon.style.backgroundColor = `${drink.color}20`;
    icon.style.color = drink.color;
    icon.innerHTML = `
      <svg aria-hidden="true" class="h-5 w-5" viewBox="0 0 24 24" fill="none">
        <path d="M12 3s-6 6.8-6 11a6 6 0 0 0 12 0c0-4.2-6-11-6-11Z" stroke="currentColor" stroke-width="1.7" />
      </svg>
    `;

    const time = document.createElement("p");
    time.className = "truncate text-sm font-semibold text-slate-700";
    time.textContent = `${drink.name} · ${timeFormatter.format(new Date(entry.timestamp))}`;

    const amount = document.createElement("p");
    amount.className = "shrink-0 font-bold text-ink";
    amount.textContent = `+${entry.amount.toLocaleString("de-DE")} ml`;

    const actions = document.createElement("div");
    actions.className = "flex shrink-0 items-center gap-2";
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.className = "rounded-lg px-2 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 focus:outline-none focus:ring-4 focus:ring-rose-100 sm:px-3 sm:text-sm";
    undoButton.textContent = "Zurücknehmen";
    undoButton.setAttribute("aria-label", `${drink.name}, ${entry.amount.toLocaleString("de-DE")} ml, zurücknehmen`);
    undoButton.addEventListener("click", () => {
      entries = entries.filter((candidate) => candidate !== entry);
      render();

      try {
        localStorage.setItem(storageKey, JSON.stringify(entries));
        storageWarning.classList.add("hidden");
      } catch (error) {
        showStorageWarning("Eintrag zurückgenommen, aber die Änderung konnte nicht dauerhaft gespeichert werden. Bitte prüfe die Browser-Speichereinstellungen.", error);
      }
      renderCalendar();
    });

    details.append(icon, time);
    actions.append(amount, undoButton);
    item.append(details, actions);
    historyList.append(item);
  });
}

function getDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function loadDailyHistory() {
  const dailyHistory = new Map();

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      const match = key?.match(/^trinktracker-(\d{4}-\d{2}-\d{2})$/);
      if (!match) continue;

      const savedEntries = JSON.parse(localStorage.getItem(key));
      if (
        !Array.isArray(savedEntries) ||
        !savedEntries.every(
          (entry) =>
            entry &&
            Number.isSafeInteger(entry.amount) &&
            entry.amount > 0 &&
            typeof entry.timestamp === "string" &&
            !Number.isNaN(Date.parse(entry.timestamp)),
        )
      ) {
        console.error(`Ungültige Trink-Historie im lokalen Speicher: ${key}`);
        showStorageWarning("Einige gespeicherte Tagesdaten sind ungültig und wurden in der Monatsübersicht ausgelassen.");
        continue;
      }

      if (savedEntries.length > 0) {
        dailyHistory.set(match[1], savedEntries);
      }
    }
  } catch (error) {
    showStorageWarning("Die Trink-Historie konnte nicht aus dem Browser-Speicher gelesen werden.", error);
  }

  return dailyHistory;
}

function renderCalendar() {
  const dailyHistory = loadDailyHistory();
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const isCurrentMonth =
    visibleMonth.getFullYear() === currentMonth.getFullYear() &&
    visibleMonth.getMonth() === currentMonth.getMonth();
  const visibleMonthPrefix =
    `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, "0")}`;
  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const monthLabel = new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
  });

  if (!selectedCalendarDate || !selectedCalendarDate.startsWith(visibleMonthPrefix)) {
    selectedCalendarDate =
      isCurrentMonth
        ? dateKey
        : [...dailyHistory.keys()]
            .filter((key) => key.startsWith(visibleMonthPrefix))
            .sort()
            .pop() || getDateKey(firstOfMonth);
  }

  calendarMonthLabel.textContent = monthLabel.format(visibleMonth);
  nextMonthButton.disabled =
    visibleMonth.getFullYear() > currentMonth.getFullYear() ||
    (visibleMonth.getFullYear() === currentMonth.getFullYear() &&
      visibleMonth.getMonth() >= currentMonth.getMonth());
  nextMonthButton.classList.toggle("cursor-not-allowed", nextMonthButton.disabled);
  nextMonthButton.classList.toggle("opacity-40", nextMonthButton.disabled);

  calendarGrid.replaceChildren();
  for (let index = 0; index < leadingDays; index += 1) {
    const spacer = document.createElement("span");
    spacer.setAttribute("aria-hidden", "true");
    calendarGrid.append(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
    const key = getDateKey(date);
    const dayEntries = dailyHistory.get(key) || [];
    const total = dayEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const isFuture = date > today;
    const isToday = key === dateKey;
    const isSelected = key === selectedCalendarDate;
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = isFuture;
    button.className = "flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border p-1 text-center transition focus:outline-none focus:ring-4 focus:ring-sky-100 sm:min-h-[4.75rem]";

    if (total >= dailyGoal) {
      button.classList.add("border-emerald-500", "bg-emerald-500", "text-white", "hover:bg-emerald-600");
    } else if (total > 0) {
      button.classList.add("border-sky-200", "bg-sky-50", "text-sky-900", "hover:bg-sky-100");
    } else {
      button.classList.add("border-transparent", "bg-slate-50", "text-slate-500", "hover:bg-slate-100");
    }

    if (isToday) button.classList.add("ring-2", "ring-water", "ring-offset-1");
    if (isSelected) button.classList.add("!border-ink", "ring-2", "ring-ink");
    if (isFuture) button.classList.add("cursor-not-allowed", "opacity-40");
    button.setAttribute(
      "aria-label",
      `${dateLabel.format(date)}: ${total.toLocaleString("de-DE")} ml${total >= dailyGoal ? ", Tagesziel erreicht" : total > 0 ? ", getrunken" : ", kein Eintrag"}`,
    );
    button.setAttribute("aria-pressed", String(isSelected));
    button.title = `${dateLabel.format(date)} · ${total.toLocaleString("de-DE")} ml`;

    const dayNumber = document.createElement("span");
    dayNumber.className = "text-sm font-bold";
    dayNumber.textContent = String(day);
    button.append(dayNumber);

    if (total > 0) {
      const dailyAmount = document.createElement("span");
      dailyAmount.className = "max-w-full truncate text-[10px] font-semibold leading-4 sm:text-xs";
      dailyAmount.textContent = `${total.toLocaleString("de-DE")} ml`;
      button.append(dailyAmount);
    }

    button.addEventListener("click", () => {
      selectedCalendarDate = key;
      renderCalendar();
    });
    calendarGrid.append(button);
  }

  let monthTotal = 0;
  let activeDays = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = getDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day));
    const dayEntries = dailyHistory.get(dayKey) || [];
    if (dayEntries.length > 0) activeDays += 1;
    monthTotal += dayEntries.reduce((sum, entry) => sum + entry.amount, 0);
  }

  renderCalendarDayDetails(dailyHistory, selectedCalendarDate, activeDays, monthTotal, monthLabel);

}

function renderCalendarDayDetails(dailyHistory, selectedDate, activeDays, monthTotal, monthLabel) {
  const dayEntries = dailyHistory.get(selectedDate) || [];
  const selected = new Date(`${selectedDate}T12:00:00`);
  const dateLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const heading = document.createElement("h4");
  heading.className = "font-bold text-ink";
  heading.textContent = dateLabel.format(selected);

  const daySummary = document.createElement("p");
  daySummary.className = "mt-1 text-sm text-slate-600";
  const total = dayEntries.reduce((sum, entry) => sum + entry.amount, 0);
  daySummary.textContent =
    total > 0
      ? `${total.toLocaleString("de-DE")} ml getrunken${total >= dailyGoal ? " · Tagesziel erreicht" : ""}`
      : "An diesem Tag sind keine Trinkeinträge gespeichert.";

  const monthlySummary = document.createElement("p");
  monthlySummary.className = "mt-3 border-t border-slate-200 pt-3 text-xs font-medium text-slate-500";
  monthlySummary.textContent = `${monthLabel.format(visibleMonth)}: ${activeDays} ${activeDays === 1 ? "aktiver Tag" : "aktive Tage"} · ${monthTotal.toLocaleString("de-DE")} ml insgesamt`;

  calendarDayDetails.replaceChildren(heading, daySummary);
  if (dayEntries.length > 0) {
    const drinkTotals = new Map();
    dayEntries.forEach((entry) => {
      const drink = drinks.find((item) => item.id === entry.drinkId) || WATER_DRINK;
      const current = drinkTotals.get(drink.id) || { drink, amount: 0 };
      current.amount += entry.amount;
      drinkTotals.set(drink.id, current);
    });

    const drinkSummary = document.createElement("ul");
    drinkSummary.className = "mt-2 flex flex-wrap gap-x-4 gap-y-1";
    drinkTotals.forEach(({ drink, amount }) => {
      const listItem = document.createElement("li");
      listItem.className = "flex items-center gap-2 text-xs font-medium text-slate-600";
      const swatch = document.createElement("span");
      swatch.className = "h-2.5 w-2.5 rounded-full";
      swatch.style.backgroundColor = drink.color;
      swatch.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = `${drink.name}: ${amount.toLocaleString("de-DE")} ml`;
      listItem.append(swatch, label);
      drinkSummary.append(listItem);
    });
    calendarDayDetails.append(drinkSummary);
  }
  calendarDayDetails.append(monthlySummary);
}

function showStorageWarning(message, error) {
  storageWarning.textContent = message;
  storageWarning.classList.remove("border-emerald-200", "bg-emerald-50", "text-emerald-800");
  storageWarning.classList.add("border-amber-200", "bg-amber-50", "text-amber-800");
  storageWarning.classList.remove("hidden");
  if (error) console.error(message, error);
}

function showDataNotice(message) {
  storageWarning.textContent = message;
  storageWarning.classList.remove("border-amber-200", "bg-amber-50", "text-amber-800");
  storageWarning.classList.add("border-emerald-200", "bg-emerald-50", "text-emerald-800");
  storageWarning.classList.remove("hidden");
}

render();