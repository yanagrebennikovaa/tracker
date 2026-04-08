const db = window.supabase.createClient("https://eqdmjsmtjifgoafvkoyk.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxZG1qc210amlmZ29hZnZrb3lrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMzkzOTcsImV4cCI6MjA5MDYxNTM5N30.L_1GA_85Z60J_p4SOmIEZSL27uXE_8H-B-00_CFU9Pc");


const BUCKET_NAME = "tracker-photos";

// ============================
// HELPERS
// ============================
const $ = (id) => document.getElementById(id);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function getText(el) {
  if (!el) return null;
  const value = el.value?.trim();
  return value === "" ? null : value;
}

function getNumber(el) {
  if (!el) return null;
  const value = el.value?.trim();
  if (value === "") return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
}

function setValue(el, value) {
  if (!el) return;
  el.value = value ?? "";
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value ?? "";
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}.${month}.${year}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "—";
  const [year, month, day] = dateStr.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}.${month}`;
}

function toISODate(date) {
  return date.toISOString().split("T")[0];
}

function parseDate(dateStr) {
  return new Date(dateStr + "T00:00:00");
}

function calcPercent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function splitCommaString(str) {
  if (!str) return [];
  return str.split(",").map(s => s.trim()).filter(Boolean);
}

function setButtonActive(button, active) {
  button.classList.toggle("active", !!active);
}

function showOnly(sectionId) {
  [
    "homeSection",
    "dailySection",
    "dailyEditorSection",
    "measurementsSection",
    "measurementsEditorSection",
    "goalsSection",
    "goalEditorSection"
  ].forEach(id => {
    $(id)?.classList.add("hidden");
  });

  $(sectionId)?.classList.remove("hidden");
}

function activateNav(navId) {
  ["navHome", "navDaily", "navMeasurements", "navGoals"].forEach(id => {
    $(id)?.classList.remove("active");
  });
  $(navId)?.classList.add("active");
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function clearPreview(previewEl) {
  if (!previewEl) return;
  previewEl.innerHTML = "";
  previewEl.classList.add("hidden");
}

function renderPreview(previewEl, src) {
  if (!previewEl || !src) {
    clearPreview(previewEl);
    return;
  }

  previewEl.innerHTML = `<img class="preview-image" src="${src}" alt="preview" />`;
  previewEl.classList.remove("hidden");
}

function average(values) {
  if (!values.length) return null;
  return Number((values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1));
}

function getISOWeek(date) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((temp - yearStart) / 86400000) + 1) / 7);

  return {
    year: temp.getUTCFullYear(),
    week: weekNum
  };
}

function getMonthNameShort(monthIndex) {
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return months[monthIndex] || "";
}

// ============================
// STORAGE HELPERS
// ============================
async function uploadImage(file, folder) {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) throw new Error("Нет авторизованного пользователя");

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${user.id}/${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error } = await db.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) throw error;

  return filePath;
}

async function getSignedUrl(filePath) {
  if (!filePath) return "";

  const { data, error } = await db.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 60 * 60);

  if (error) {
    console.error("Ошибка получения signed URL:", error);
    return "";
  }

  return data.signedUrl;
}

async function uploadOrKeep(fileInput, existingPath, folder) {
  const file = fileInput?.files?.[0];
  if (!file) return existingPath ?? null;
  return await uploadImage(file, folder);
}

function setupLocalPreview(fileInput, previewEl) {
  if (!fileInput || !previewEl) return;

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      clearPreview(previewEl);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    renderPreview(previewEl, objectUrl);
  });
}

// ============================
// STATE
// ============================
const state = {
  currentBaseScreen: "home",
  homeRange: "month",
  homeDate: toISODate(new Date()),
  dailyEntries: [],
  measurements: [],
  goals: [],
  selectedPhotoType: "front",
  currentGoalYear: 2026,
  editingGoalId: null,
  currentDailyEntry: null,
  currentMeasurementEntry: null
};

// ============================
// AUTH ELEMENTS
// ============================
const authCard = $("authCard");
const appCard = $("appCard");

const emailInput = $("email");
const passwordInput = $("password");
const signUpButton = $("signUpButton");
const signInButton = $("signInButton");
const authMessage = $("authMessage");

// ============================
// NAV ELEMENTS
// ============================
const navHome = $("navHome");
const navDaily = $("navDaily");
const navMeasurements = $("navMeasurements");
const navGoals = $("navGoals");
const fabButton = $("fabButton");

// ============================
// HOME ELEMENTS
// ============================
const homeDateInput = $("homeDate");
const avgWeightValue = $("avgWeightValue");
const chartMaxLabel = $("chartMaxLabel");
const chartMinLabel = $("chartMinLabel");
const weightChart = $("weightChart");
const weeklyTiles = $("weeklyTiles");
const homeGoalsProgressBar = $("homeGoalsProgressBar");

// ============================
// DAILY LIST
// ============================
const dailyCards = $("dailyCards");

// ============================
// DAILY EDITOR
// ============================
const entryDateInput = $("entryDate");
const wakeUpInput = $("wakeUp");
const wakeUpValue = $("wakeUpValue");
const weightInput = $("weight");
const moodSelect = $("mood");
const daySummaryInput = $("daySummary");
const gratitudeInput = $("gratitude");
const dayPhotoFileInput = $("dayPhotoFile");
const dayPhotoPreview = $("dayPhotoPreview");
const saveDailyButton = $("saveDailyButton");
const dailyBackButton = $("dailyBackButton");
const dailyMessage = $("dailyMessage");

// ============================
// MEASUREMENTS
// ============================
const compareBeforeDate = $("compareBeforeDate");
const compareAfterDate = $("compareAfterDate");
const beforeDateLabel = $("beforeDateLabel");
const afterDateLabel = $("afterDateLabel");
const compareTableBody = $("compareTableBody");
const beforePhotoBox = $("beforePhotoBox");
const afterPhotoBox = $("afterPhotoBox");

// ============================
// MEASUREMENTS EDITOR
// ============================
const measurementDateInput = $("measurementDate");
const chestInput = $("chest");
const underbustInput = $("underbust");
const armInput = $("arm");
const waistInput = $("waist");
const hipsInput = $("hips");
const thighInput = $("thigh");

const frontPhotoFileInput = $("frontPhotoFile");
const leftPhotoFileInput = $("leftPhotoFile");
const rightPhotoFileInput = $("rightPhotoFile");
const backPhotoFileInput = $("backPhotoFile");
const armsBackPhotoFileInput = $("armsBackPhotoFile");
const armsFrontPhotoFileInput = $("armsFrontPhotoFile");

const frontPhotoPreview = $("frontPhotoPreview");
const leftPhotoPreview = $("leftPhotoPreview");
const rightPhotoPreview = $("rightPhotoPreview");
const backPhotoPreview = $("backPhotoPreview");
const armsBackPhotoPreview = $("armsBackPhotoPreview");
const armsFrontPhotoPreview = $("armsFrontPhotoPreview");

const saveMeasurementsButton = $("saveMeasurementsButton");
const measurementsBackButton = $("measurementsBackButton");
const measurementsMessage = $("measurementsMessage");

// ============================
// GOALS
// ============================
const year2025Button = $("year2025Button");
const year2026Button = $("year2026Button");
const goalsProgressBar = $("goalsProgressBar");
const goalsChart = $("goalsChart");
const goalsLists = $("goalsLists");

// ============================
// GOAL EDITOR
// ============================
const goalIdInput = $("goalId");
const goalTitleInput = $("goalTitle");
const goalCategoryInput = $("goalCategory");
const goalYearInput = $("goalYear");
const saveGoalButton = $("saveGoalButton");
const deleteGoalButton = $("deleteGoalButton");
const goalBackButton = $("goalBackButton");
const goalMessage = $("goalMessage");

// ============================
// DEFAULTS
// ============================
const today = toISODate(new Date());
setValue(entryDateInput, today);
setValue(measurementDateInput, today);
setValue(homeDateInput, today);
setText(wakeUpValue, wakeUpInput.value || "5");

// ============================
// DAILY FIELD MAPS
// ============================
const boolCardMap = {
  threeMeals: "three_meals",
  proteinNorm: "protein_norm",
  noFood3hBeforeSleep: "no_food_3h_before_sleep",
  waterNorm: "water_norm",
  supplements: "supplements",
  faceMassage: "face_massage",
  tapes: "tapes",
  scalpSerum: "scalp_serum",
  coldShower: "cold_shower",
  massage: "massage",
  meditation: "Meditation",
  exercise: "exercise",
  timeWithMax: "time_with_max",
  timeWithFriends: "time_with_friends",
  callWithFamily: "call_with_family",
  travel: "travel",
  reading: "reading",
  study: "study",
  melatonin: "melatonin",
  noInstagram: "no_instagram"
};

const boolButtons = $$(".bool-card");
const multiButtons = $$(".multi-card");

// ============================
// AUTH
// ============================
async function signUp() {
  const email = getText(emailInput);
  const password = getText(passwordInput);

  if (!email || !password) {
    setText(authMessage, "Введите email и пароль");
    return;
  }

  const { error } = await db.auth.signUp({ email, password });

  if (error) {
    setText(authMessage, "Ошибка регистрации: " + error.message);
  } else {
    setText(authMessage, "Регистрация прошла успешно. Если нужно — подтверди email.");
  }
}

async function signIn() {
  const email = getText(emailInput);
  const password = getText(passwordInput);

  if (!email || !password) {
    setText(authMessage, "Введите email и пароль");
    return;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });

  if (error) {
    setText(authMessage, "Ошибка входа: " + error.message);
  } else {
    setText(authMessage, "Вход выполнен");
  }
}

db.auth.onAuthStateChange((_event, session) => {
  if (session) {
    authCard.classList.add("hidden");
    appCard.classList.remove("hidden");
    initApp();
  } else {
    authCard.classList.remove("hidden");
    appCard.classList.add("hidden");
  }
});

async function checkSession() {
  const { data } = await db.auth.getSession();
  if (data.session) {
    authCard.classList.add("hidden");
    appCard.classList.remove("hidden");
    initApp();
  }
}

// ============================
// NAVIGATION
// ============================
function openHome() {
  state.currentBaseScreen = "home";
  showOnly("homeSection");
  activateNav("navHome");
}

function openDaily() {
  state.currentBaseScreen = "daily";
  showOnly("dailySection");
  activateNav("navDaily");
}

function openDailyEditor() {
  showOnly("dailyEditorSection");
  activateNav("navDaily");
}

function openMeasurements() {
  state.currentBaseScreen = "measurements";
  showOnly("measurementsSection");
  activateNav("navMeasurements");
}

function openMeasurementsEditor() {
  showOnly("measurementsEditorSection");
  activateNav("navMeasurements");
}

function openGoals() {
  state.currentBaseScreen = "goals";
  showOnly("goalsSection");
  activateNav("navGoals");
}

function openGoalEditor(goal = null) {
  showOnly("goalEditorSection");
  activateNav("navGoals");

  if (goal) {
    state.editingGoalId = goal.id;
    setValue(goalIdInput, goal.id);
    setValue(goalTitleInput, goal.title);
    setValue(goalCategoryInput, goal.category);
    setValue(goalYearInput, goal.goal_year);
    deleteGoalButton.classList.remove("hidden");
  } else {
    state.editingGoalId = null;
    setValue(goalIdInput, "");
    setValue(goalTitleInput, "");
    setValue(goalCategoryInput, "");
    setValue(goalYearInput, state.currentGoalYear);
    deleteGoalButton.classList.add("hidden");
  }

  setText(goalMessage, "");
}

function handleFabClick() {
  if (state.currentBaseScreen === "home" || state.currentBaseScreen === "daily") {
    clearDailyForm();
    openDailyEditor();
    return;
  }

  if (state.currentBaseScreen === "measurements") {
    clearMeasurementsForm();
    openMeasurementsEditor();
    return;
  }

  if (state.currentBaseScreen === "goals") {
    openGoalEditor(null);
  }
}

// ============================
// BUTTON STATE HELPERS
// ============================
function toggleBoolButton(btn) {
  btn.classList.toggle("active");
}

function toggleMultiButton(btn) {
  btn.classList.toggle("active");
}

function getBoolButtonValue(key) {
  const btn = document.querySelector(`.bool-card[data-field="${key}"]`);
  return !!btn?.classList.contains("active");
}

function setBoolButtonValue(key, value) {
  const btn = document.querySelector(`.bool-card[data-field="${key}"]`);
  if (btn) setButtonActive(btn, !!value);
}

function getMultiValues(group) {
  return $$(".multi-card")
    .filter(btn => btn.dataset.group === group && btn.classList.contains("active"))
    .map(btn => btn.dataset.value);
}

function setMultiValues(group, values = []) {
  $$(".multi-card")
    .filter(btn => btn.dataset.group === group)
    .forEach(btn => setButtonActive(btn, values.includes(btn.dataset.value)));
}

// ============================
// DAILY LOGIC
// ============================
function getDailyTrackedFields(entry) {
  return [
    entry.three_meals,
    entry.protein_norm,
    entry.no_food_3h_before_sleep,
    entry.water_norm,
    entry.supplements,
    entry.face_massage,
    entry.tapes,
    entry.scalp_serum,
    entry.cold_shower,
    entry.workout,
    entry.exercise,
    entry.massage,
    entry.no_instagram,
    entry.reading,
    entry.study,
    entry.melatonin,
    entry.time_with_max,
    entry.time_with_friends,
    entry.call_with_family,
    entry.travel,
    entry["Meditation"]
  ];
}

function getDailyCompletionPercent(entry) {
  const arr = getDailyTrackedFields(entry);
  const done = arr.filter(Boolean).length;
  return calcPercent(done, arr.length);
}

function getPercentColor(percent) {
  if (percent >= 75) return "#2fa43a";
  if (percent >= 40) return "#d6a400";
  return "#e34a3d";
}

function clearDailyForm() {
  state.currentDailyEntry = null;

  setValue(entryDateInput, today);
  setValue(weightInput, "");
  setValue(daySummaryInput, "");
  setValue(gratitudeInput, "");
  setValue(moodSelect, "");
  setValue(wakeUpInput, 5);
  setText(wakeUpValue, "5");

  Object.keys(boolCardMap).forEach(key => setBoolButtonValue(key, false));
  setMultiValues("workoutKind", []);
  setMultiValues("workoutType", []);

  if (dayPhotoFileInput) dayPhotoFileInput.value = "";
  clearPreview(dayPhotoPreview);

  setText(dailyMessage, "");
}

function fillDailyForm(entry) {
  state.currentDailyEntry = entry;

  setValue(entryDateInput, entry.entry_date || today);
  setValue(weightInput, entry.weight ?? "");
  setValue(daySummaryInput, entry.day_summary ?? "");
  setValue(gratitudeInput, entry.gratitude ?? "");
  setValue(moodSelect, entry.mood ?? "");
  setValue(wakeUpInput, entry.wake_ease ?? 5);
  setText(wakeUpValue, String(entry.wake_ease ?? 5));

  Object.entries(boolCardMap).forEach(([uiKey, dbKey]) => {
    setBoolButtonValue(uiKey, !!entry[dbKey]);
  });

  setMultiValues("workoutKind", splitCommaString(entry.workout_kind));
  setMultiValues("workoutType", splitCommaString(entry.workout_type));

  if (dayPhotoFileInput) dayPhotoFileInput.value = "";
  renderPreview(dayPhotoPreview, entry.signed_day_photo_url || "");

  setText(dailyMessage, `Редактирование записи за ${formatDate(entry.entry_date)}`);
  openDailyEditor();
}

function buildDailyPayload(userId, dayPhotoPath) {
  const workoutKinds = getMultiValues("workoutKind");
  const workoutTypes = getMultiValues("workoutType");

  return {
    user_id: userId,
    entry_date: getText(entryDateInput),
    wake_ease: getNumber(wakeUpInput),
    weight: getNumber(weightInput),

    three_meals: getBoolButtonValue("threeMeals"),
    protein_norm: getBoolButtonValue("proteinNorm"),
    no_food_3h_before_sleep: getBoolButtonValue("noFood3hBeforeSleep"),
    water_norm: getBoolButtonValue("waterNorm"),
    supplements: getBoolButtonValue("supplements"),

    face_massage: getBoolButtonValue("faceMassage"),
    tapes: getBoolButtonValue("tapes"),
    scalp_serum: getBoolButtonValue("scalpSerum"),
    cold_shower: getBoolButtonValue("coldShower"),

    workout: workoutKinds.length > 0,
    workout_kind: workoutKinds.join(", "),
    workout_type: workoutTypes.join(", "),

    exercise: getBoolButtonValue("exercise"),
    massage: getBoolButtonValue("massage"),
    no_instagram: getBoolButtonValue("noInstagram"),
    reading: getBoolButtonValue("reading"),
    study: getBoolButtonValue("study"),
    melatonin: getBoolButtonValue("melatonin"),

    time_with_max: getBoolButtonValue("timeWithMax"),
    time_with_friends: getBoolButtonValue("timeWithFriends"),
    call_with_family: getBoolButtonValue("callWithFamily"),
    travel: getBoolButtonValue("travel"),

    mood: getText(moodSelect),
    gratitude: getText(gratitudeInput),
    day_summary: getText(daySummaryInput),
    day_photo_path: dayPhotoPath,

    "Meditation": getBoolButtonValue("meditation")
  };
}

async function saveDailyEntry() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) {
    setText(dailyMessage, "Сначала войди в аккаунт");
    return;
  }

  const entryDate = getText(entryDateInput);
  if (!entryDate) {
    setText(dailyMessage, "Выбери дату");
    return;
  }

  try {
    let dayPhotoPath = state.currentDailyEntry?.day_photo_path ?? null;
    dayPhotoPath = await uploadOrKeep(dayPhotoFileInput, dayPhotoPath, "daily");

    const payload = buildDailyPayload(user.id, dayPhotoPath);

    const { error } = await db
      .from("daily_entries")
      .upsert(payload, { onConflict: "user_id,entry_date" });

    if (error) {
      console.error(error);
      setText(dailyMessage, "Ошибка сохранения: " + error.message);
      return;
    }

    setText(dailyMessage, "Запись сохранена");
    await loadDailyEntries();
    openDaily();
  } catch (e) {
    console.error(e);
    setText(dailyMessage, "Ошибка загрузки фото: " + e.message);
  }
}

async function loadDailyEntries() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) return;

  const { data, error } = await db
    .from("daily_entries")
    .select("*")
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const rawEntries = data || [];

  state.dailyEntries = await Promise.all(
    rawEntries.map(async (entry) => {
      const signed_day_photo_url = entry.day_photo_path
        ? await getSignedUrl(entry.day_photo_path)
        : "";

      return {
        ...entry,
        signed_day_photo_url
      };
    })
  );

  renderDailyCards();
  renderHomeDashboard();
}

function renderDailyCards() {
  if (!dailyCards) return;

  if (!state.dailyEntries.length) {
    dailyCards.innerHTML = `
      <div class="day-card no-photo">
        <div class="day-card-body">
          <div class="day-card-date">Записей пока нет</div>
          <div class="day-card-percent" style="color:#999">0%</div>
        </div>
      </div>
    `;
    return;
  }

  dailyCards.innerHTML = state.dailyEntries.map(entry => {
    const percent = getDailyCompletionPercent(entry);
    const color = getPercentColor(percent);
    const photo = entry.signed_day_photo_url;

    if (photo) {
      return `
        <div class="day-card" data-date="${entry.entry_date}">
          <img src="${photo}" alt="photo" class="day-card-photo">
          <div class="day-card-body">
            <div class="day-card-date">${formatDate(entry.entry_date)}</div>
            <div class="day-card-percent" style="color:${color}">${percent}%</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="day-card no-photo" data-date="${entry.entry_date}">
        <div class="day-card-body">
          <div class="day-card-date">${formatDate(entry.entry_date)}</div>
          <div class="day-card-percent" style="color:${color}">${percent}%</div>
        </div>
      </div>
    `;
  }).join("");

  $$(".day-card").forEach(card => {
    card.addEventListener("click", () => {
      const entry = state.dailyEntries.find(x => x.entry_date === card.dataset.date);
      if (entry) fillDailyForm(entry);
    });
  });
}

// ============================
// HOME DASHBOARD: WEIGHT CHART
// ============================
function getChartDataByRange() {
  const entries = state.dailyEntries
    .filter(e => e.weight !== null && e.weight !== undefined && e.weight !== "")
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date));

  if (!entries.length) return [];

  const endDate = parseDate(state.homeDate);

  if (state.homeRange === "day") {
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);

    return entries
      .filter(entry => {
        const d = parseDate(entry.entry_date);
        return d >= startDate && d <= endDate;
      })
      .map(entry => ({
        label: formatShortDate(entry.entry_date),
        value: Number(entry.weight)
      }));
  }

  if (state.homeRange === "week") {
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 7 * 8);

    const filtered = entries.filter(entry => {
      const d = parseDate(entry.entry_date);
      return d >= startDate && d <= endDate;
    });

    const groups = {};

    filtered.forEach(entry => {
      const d = parseDate(entry.entry_date);
      const { year, week } = getISOWeek(d);
      const key = `${year}-W${week}`;

      if (!groups[key]) {
        groups[key] = {
          year,
          week,
          values: []
        };
      }

      groups[key].values.push(Number(entry.weight));
    });

    return Object.values(groups)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.week - b.week;
      })
      .map(group => ({
        label: `W${group.week}`,
        value: average(group.values)
      }));
  }

  if (state.homeRange === "month") {
    const startDate = new Date(endDate);
    startDate.setMonth(startDate.getMonth() - 5);

    const filtered = entries.filter(entry => {
      const d = parseDate(entry.entry_date);
      return d >= startDate && d <= endDate;
    });

    const groups = {};

    filtered.forEach(entry => {
      const d = parseDate(entry.entry_date);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${month}`;

      if (!groups[key]) {
        groups[key] = {
          year,
          month,
          values: []
        };
      }

      groups[key].values.push(Number(entry.weight));
    });

    return Object.values(groups)
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      })
      .map(group => ({
        label: `${getMonthNameShort(group.month)} ${String(group.year).slice(2)}`,
        value: average(group.values)
      }));
  }

  if (state.homeRange === "year") {
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 4);

    const filtered = entries.filter(entry => {
      const d = parseDate(entry.entry_date);
      return d >= startDate && d <= endDate;
    });

    const groups = {};

    filtered.forEach(entry => {
      const d = parseDate(entry.entry_date);
      const year = d.getFullYear();

      if (!groups[year]) {
        groups[year] = {
          year,
          values: []
        };
      }

      groups[year].values.push(Number(entry.weight));
    });

    return Object.values(groups)
      .sort((a, b) => a.year - b.year)
      .map(group => ({
        label: String(group.year),
        value: average(group.values)
      }));
  }

  return [];
}

function renderWeightChart() {
  const chartData = getChartDataByRange();

  if (!chartData.length) {
    weightChart.innerHTML = `<div class="status-text">Нет данных по весу</div>`;
    setText(avgWeightValue, "—");
    setText(chartMaxLabel, "—");
    setText(chartMinLabel, "—");
    return;
  }

  const values = chartData.map(item => item.value).filter(v => v !== null);

  if (!values.length) {
    weightChart.innerHTML = `<div class="status-text">Нет данных по весу</div>`;
    setText(avgWeightValue, "—");
    setText(chartMaxLabel, "—");
    setText(chartMinLabel, "—");
    return;
  }

  const avg = average(values);
  setText(avgWeightValue, avg);

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    min = min - 1;
    max = max + 1;
  }

  setText(chartMaxLabel, Math.ceil(max));
  setText(chartMinLabel, Math.floor(min));

  const width = 320;
  const height = 170;
  const leftPad = 10;
  const rightPad = 10;
  const topPad = 16;
  const bottomPad = 34;

  const usableWidth = width - leftPad - rightPad;
  const usableHeight = height - topPad - bottomPad;

  const stepX = chartData.length > 1 ? usableWidth / (chartData.length - 1) : 0;

  const points = chartData.map((item, index) => {
    const x = leftPad + index * stepX;
    const y = topPad + ((max - item.value) / (max - min)) * usableHeight;
    return {
      x,
      y,
      label: item.label,
      value: item.value
    };
  });

  const polylinePoints = points.map(p => `${p.x},${p.y}`).join(" ");

  let labelStep = 1;
  if (points.length > 10) labelStep = 3;
  else if (points.length > 6) labelStep = 2;

  const visibleLabels = points.filter((_, index) => {
    return index % labelStep === 0 || index === points.length - 1;
  });

  weightChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line
        x1="${leftPad}"
        y1="${height - bottomPad}"
        x2="${width - rightPad}"
        y2="${height - bottomPad}"
        stroke="#d8d8dd"
        stroke-width="1"
      />
      <polyline
        fill="none"
        stroke="#d86fe7"
        stroke-width="2.5"
        points="${polylinePoints}"
      />
      ${points.map(p => `
        <circle
          cx="${p.x}"
          cy="${p.y}"
          r="3.5"
          fill="#d86fe7"
        ></circle>
      `).join("")}
      ${visibleLabels.map(p => `
        <text
          x="${p.x}"
          y="${height - 12}"
          font-size="9"
          text-anchor="middle"
          fill="#666"
        >${p.label}</text>
      `).join("")}
    </svg>
  `;
}

function getWeeklyTileData() {
  const endDate = parseDate(state.homeDate);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 6);

  const entries = state.dailyEntries.filter(entry => {
    const d = parseDate(entry.entry_date);
    return d >= startDate && d <= endDate;
  });

  const tiles = [
    {
      label: "Питание",
      value: entries.filter(e => e.three_meals || e.protein_norm || e.water_norm || e.supplements).length
    },
    {
      label: "Кардио",
      value: entries.filter(e => (e.workout_kind || "").toLowerCase().includes("кардио") || (e.workout_kind || "").toLowerCase().includes("бег")).length
    },
    {
      label: "Силовые",
      value: entries.filter(e => (e.workout_kind || "").toLowerCase().includes("силовая")).length
    },
    {
      label: "Лицо",
      value: entries.filter(e => e.face_massage || e.tapes).length
    },
    {
      label: "Волосы",
      value: entries.filter(e => e.scalp_serum).length
    },
    {
      label: "Холодный душ",
      value: entries.filter(e => e.cold_shower).length
    },
    {
      label: "Максим",
      value: entries.filter(e => e.time_with_max).length
    },
    {
      label: "Родные",
      value: entries.filter(e => e.call_with_family).length
    }
  ];

  return tiles.map(tile => ({
    ...tile,
    percent: calcPercent(tile.value, 7)
  }));
}

function getTileColor(percent) {
  if (percent >= 70) return "var(--green)";
  if (percent >= 35) return "var(--yellow-soft)";
  return "var(--red-soft)";
}

function renderWeeklyTiles() {
  const data = getWeeklyTileData();

  weeklyTiles.innerHTML = data.map(tile => `
    <div class="tile-card" style="background:${getTileColor(tile.percent)}">
      ${tile.label}
    </div>
  `).join("");
}

function renderHomeGoalsProgress() {
  const yearGoals = state.goals.filter(g => Number(g.goal_year) === Number(state.currentGoalYear));
  const done = yearGoals.filter(g => g.is_completed).length;
  const percent = calcPercent(done, yearGoals.length);
  homeGoalsProgressBar.style.width = `${percent}%`;
  homeGoalsProgressBar.textContent = `${percent}%`;
}

function renderHomeDashboard() {
  renderWeightChart();
  renderWeeklyTiles();
  renderHomeGoalsProgress();
}

// ============================
// MEASUREMENTS
// ============================
function clearMeasurementsForm() {
  state.currentMeasurementEntry = null;

  setValue(measurementDateInput, today);
  setValue(chestInput, "");
  setValue(underbustInput, "");
  setValue(armInput, "");
  setValue(waistInput, "");
  setValue(hipsInput, "");
  setValue(thighInput, "");

  if (frontPhotoFileInput) frontPhotoFileInput.value = "";
  if (leftPhotoFileInput) leftPhotoFileInput.value = "";
  if (rightPhotoFileInput) rightPhotoFileInput.value = "";
  if (backPhotoFileInput) backPhotoFileInput.value = "";
  if (armsBackPhotoFileInput) armsBackPhotoFileInput.value = "";
  if (armsFrontPhotoFileInput) armsFrontPhotoFileInput.value = "";

  clearPreview(frontPhotoPreview);
  clearPreview(leftPhotoPreview);
  clearPreview(rightPhotoPreview);
  clearPreview(backPhotoPreview);
  clearPreview(armsBackPhotoPreview);
  clearPreview(armsFrontPhotoPreview);

  setText(measurementsMessage, "");
}

function fillMeasurementsForm(entry) {
  state.currentMeasurementEntry = entry;

  setValue(measurementDateInput, entry.measurement_date || today);
  setValue(chestInput, entry.chest ?? "");
  setValue(underbustInput, entry.underbust ?? "");
  setValue(armInput, entry.arm ?? "");
  setValue(waistInput, entry.waist ?? "");
  setValue(hipsInput, entry.hips ?? "");
  setValue(thighInput, entry.thigh ?? "");

  if (frontPhotoFileInput) frontPhotoFileInput.value = "";
  if (leftPhotoFileInput) leftPhotoFileInput.value = "";
  if (rightPhotoFileInput) rightPhotoFileInput.value = "";
  if (backPhotoFileInput) backPhotoFileInput.value = "";
  if (armsBackPhotoFileInput) armsBackPhotoFileInput.value = "";
  if (armsFrontPhotoFileInput) armsFrontPhotoFileInput.value = "";

  renderPreview(frontPhotoPreview, entry.signed_front_photo_url || "");
  renderPreview(leftPhotoPreview, entry.signed_left_photo_url || "");
  renderPreview(rightPhotoPreview, entry.signed_right_photo_url || "");
  renderPreview(backPhotoPreview, entry.signed_back_photo_url || "");
  renderPreview(armsBackPhotoPreview, entry.signed_arms_back_photo_url || "");
  renderPreview(armsFrontPhotoPreview, entry.signed_arms_front_photo_url || "");

  setText(measurementsMessage, `Редактирование замера за ${formatDate(entry.measurement_date)}`);
  openMeasurementsEditor();
}

function buildMeasurementsPayload(userId, photoPaths) {
  return {
    user_id: userId,
    measurement_date: getText(measurementDateInput),
    chest: getNumber(chestInput),
    underbust: getNumber(underbustInput),
    arm: getNumber(armInput),
    waist: getNumber(waistInput),
    hips: getNumber(hipsInput),
    thigh: getNumber(thighInput),
    front_photo_path: photoPaths.front_photo_path,
    left_photo_path: photoPaths.left_photo_path,
    right_photo_path: photoPaths.right_photo_path,
    back_photo_path: photoPaths.back_photo_path,
    arms_back_photo: photoPaths.arms_back_photo,
    arms_front_photo: photoPaths.arms_front_photo
  };
}

async function saveMeasurements() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) {
    setText(measurementsMessage, "Сначала войди в аккаунт");
    return;
  }

  const measurementDate = getText(measurementDateInput);
  if (!measurementDate) {
    setText(measurementsMessage, "Выбери дату замера");
    return;
  }

  try {
    const current = state.currentMeasurementEntry || {};

    const photoPaths = {
      front_photo_path: await uploadOrKeep(frontPhotoFileInput, current.front_photo_path, "measurements/front"),
      left_photo_path: await uploadOrKeep(leftPhotoFileInput, current.left_photo_path, "measurements/left"),
      right_photo_path: await uploadOrKeep(rightPhotoFileInput, current.right_photo_path, "measurements/right"),
      back_photo_path: await uploadOrKeep(backPhotoFileInput, current.back_photo_path, "measurements/back"),
      arms_back_photo: await uploadOrKeep(armsBackPhotoFileInput, current.arms_back_photo, "measurements/arms-back"),
      arms_front_photo: await uploadOrKeep(armsFrontPhotoFileInput, current.arms_front_photo, "measurements/arms-front")
    };

    const payload = buildMeasurementsPayload(user.id, photoPaths);

    const { error } = await db
      .from("body_measurements")
      .upsert(payload, { onConflict: "user_id,measurement_date" });

    if (error) {
      console.error(error);
      setText(measurementsMessage, "Ошибка сохранения: " + error.message);
      return;
    }

    setText(measurementsMessage, "Замеры сохранены");
    await loadMeasurements();
    openMeasurements();
  } catch (e) {
    console.error(e);
    setText(measurementsMessage, "Ошибка загрузки фото: " + e.message);
  }
}

async function loadMeasurements() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) return;

  const { data, error } = await db
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .order("measurement_date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const rawMeasurements = data || [];

  state.measurements = await Promise.all(
    rawMeasurements.map(async (entry) => {
      const signed_front_photo_url = entry.front_photo_path ? await getSignedUrl(entry.front_photo_path) : "";
      const signed_left_photo_url = entry.left_photo_path ? await getSignedUrl(entry.left_photo_path) : "";
      const signed_right_photo_url = entry.right_photo_path ? await getSignedUrl(entry.right_photo_path) : "";
      const signed_back_photo_url = entry.back_photo_path ? await getSignedUrl(entry.back_photo_path) : "";
      const signed_arms_back_photo_url = entry.arms_back_photo ? await getSignedUrl(entry.arms_back_photo) : "";
      const signed_arms_front_photo_url = entry.arms_front_photo ? await getSignedUrl(entry.arms_front_photo) : "";

      return {
        ...entry,
        signed_front_photo_url,
        signed_left_photo_url,
        signed_right_photo_url,
        signed_back_photo_url,
        signed_arms_back_photo_url,
        signed_arms_front_photo_url
      };
    })
  );

  fillMeasurementSelects();
  renderMeasurementsComparison();
}

function fillMeasurementSelects() {
  const options = state.measurements.map(m => m.measurement_date);

  compareBeforeDate.innerHTML = options.length
    ? options.map(d => `<option value="${d}">${formatDate(d)}</option>`).join("")
    : `<option value="">Нет данных</option>`;

  compareAfterDate.innerHTML = options.length
    ? options.map(d => `<option value="${d}">${formatDate(d)}</option>`).join("")
    : `<option value="">Нет данных</option>`;

  if (options.length) {
    compareAfterDate.value = options[0];
    compareBeforeDate.value = options[1] || options[0];
  }
}

function getMeasurementByDate(date) {
  return state.measurements.find(m => m.measurement_date === date);
}

function getDailyWeightByDate(date) {
  const entry = state.dailyEntries.find(d => d.entry_date === date);
  return entry?.weight ?? null;
}

function cellClass(beforeVal, afterVal) {
  if (beforeVal == null || afterVal == null) return "";
  if (afterVal > beforeVal) return "value-positive";
  if (afterVal < beforeVal) return "value-negative";
  return "";
}

function renderMeasurementsComparison() {
  const before = getMeasurementByDate(compareBeforeDate.value);
  const after = getMeasurementByDate(compareAfterDate.value);

  setText(beforeDateLabel, before ? formatDate(before.measurement_date) : "До");
  setText(afterDateLabel, after ? formatDate(after.measurement_date) : "После");

  const rows = [
    ["Грудь", before?.chest, after?.chest],
    ["Под грудью", before?.underbust, after?.underbust],
    ["Руки", before?.arm, after?.arm],
    ["Талия", before?.waist, after?.waist],
    ["Попа", before?.hips, after?.hips],
    ["Бедра", before?.thigh, after?.thigh],
    ["Вес", getDailyWeightByDate(before?.measurement_date), getDailyWeightByDate(after?.measurement_date)]
  ];

  compareTableBody.innerHTML = rows.map(([label, b, a]) => `
    <tr>
      <td>${label}</td>
      <td>${b ?? "-"}</td>
      <td class="${cellClass(b, a)}">${a ?? "-"}</td>
    </tr>
  `).join("");

  renderComparePhotos(before, after);
}

function getPhotoValue(entry, type) {
  if (!entry) return null;
  if (type === "front") return entry.signed_front_photo_url;
  if (type === "back") return entry.signed_back_photo_url;
  if (type === "left") return entry.signed_left_photo_url;
  if (type === "right") return entry.signed_right_photo_url;
  if (type === "arms_back") return entry.signed_arms_back_photo_url;
  if (type === "arms_front") return entry.signed_arms_front_photo_url;
  return null;
}

function renderPhotoBox(el, photo, fallback) {
  if (!photo) {
    el.innerHTML = fallback;
    return;
  }

  el.innerHTML = `<img src="${photo}" alt="photo" />`;
}

function renderComparePhotos(beforeEntry, afterEntry) {
  const type = state.selectedPhotoType;
  renderPhotoBox(beforePhotoBox, getPhotoValue(beforeEntry, type), "Фото<br>до");
  renderPhotoBox(afterPhotoBox, getPhotoValue(afterEntry, type), "Фото<br>После");
}

// ============================
// GOALS
// ============================
async function loadGoals() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) return;

  const { data, error } = await db
    .from("goals")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  state.goals = data || [];
  renderGoals();
  renderHomeGoalsProgress();
}

function getGoalsByYear(year) {
  return state.goals.filter(goal => Number(goal.goal_year) === Number(year));
}

function groupGoals(goals) {
  return goals.reduce((acc, goal) => {
    if (!acc[goal.category]) acc[goal.category] = [];
    acc[goal.category].push(goal);
    return acc;
  }, {});
}

function renderGoals() {
  year2025Button.classList.toggle("active", Number(state.currentGoalYear) === 2025);
  year2026Button.classList.toggle("active", Number(state.currentGoalYear) === 2026);

  const goals = getGoalsByYear(state.currentGoalYear);
  const done = goals.filter(g => g.is_completed).length;
  const percent = calcPercent(done, goals.length);

  goalsProgressBar.style.width = `${percent}%`;
  goalsProgressBar.textContent = `${percent}%`;

  const grouped = groupGoals(goals);
  const categories = Object.keys(grouped);

  const maxTotal = Math.max(...categories.map(category => grouped[category].length), 1);

  goalsChart.innerHTML = categories.map(category => {
    const total = grouped[category].length;
    const completed = grouped[category].filter(g => g.is_completed).length;

    const shellHeight = Math.max(24, (total / maxTotal) * 126);
    const fillHeight = total > 0 ? (completed / total) * shellHeight : 0;

    return `
      <div class="chart-col">
        <div class="chart-count">${completed}/${total}</div>
        <div class="chart-bar-shell" style="height:${shellHeight}px">
          <div class="chart-bar-fill" style="height:${fillHeight}px"></div>
        </div>
        <div class="chart-label">${escapeHtml(category)}</div>
      </div>
    `;
  }).join("");

  goalsLists.innerHTML = categories.map(category => `
    <div class="goal-group">
      <div class="goal-group-title">${escapeHtml(category)}</div>
      ${grouped[category].map(goal => `
        <div class="goal-item">
          <input type="checkbox" data-goal-check="${goal.id}" ${goal.is_completed ? "checked" : ""}>
          <div class="goal-item-label ${goal.is_completed ? "done" : ""}">
            ${escapeHtml(goal.title)}
          </div>
          <button type="button" class="goal-edit-btn" data-goal-edit="${goal.id}">
            <i data-lucide="pencil"></i>
          </button>
        </div>
      `).join("")}
    </div>
  `).join("");

  $$("[data-goal-check]").forEach(el => {
    el.addEventListener("change", async () => {
      await toggleGoalCompleted(el.dataset.goalCheck, el.checked);
    });
  });

  $$("[data-goal-edit]").forEach(el => {
    el.addEventListener("click", () => {
      const goal = state.goals.find(g => String(g.id) === String(el.dataset.goalEdit));
      if (goal) openGoalEditor(goal);
    });
  });

  refreshIcons();
}

async function toggleGoalCompleted(goalId, value) {
  const { error } = await db
    .from("goals")
    .update({ is_completed: value })
    .eq("id", goalId);

  if (error) {
    console.error(error);
    return;
  }

  await loadGoals();
}

async function saveGoal() {
  const {
    data: { user }
  } = await db.auth.getUser();

  if (!user) {
    setText(goalMessage, "Сначала войди в аккаунт");
    return;
  }

  const title = getText(goalTitleInput);
  const category = getText(goalCategoryInput);
  const goalYear = getNumber(goalYearInput);

  if (!title || !category || !goalYear) {
    setText(goalMessage, "Заполни все поля");
    return;
  }

  const payload = {
    user_id: user.id,
    title,
    category,
    goal_year: goalYear
  };

  let result;
  if (state.editingGoalId) {
    result = await db
      .from("goals")
      .update(payload)
      .eq("id", state.editingGoalId);
  } else {
    result = await db
      .from("goals")
      .insert([{ ...payload, is_completed: false }]);
  }

  if (result.error) {
    console.error(result.error);
    setText(goalMessage, "Ошибка сохранения: " + result.error.message);
    return;
  }

  setText(goalMessage, "Цель сохранена");
  await loadGoals();
  openGoals();
}

async function deleteGoal() {
  if (!state.editingGoalId) return;

  const { error } = await db
    .from("goals")
    .delete()
    .eq("id", state.editingGoalId);

  if (error) {
    console.error(error);
    setText(goalMessage, "Ошибка удаления: " + error.message);
    return;
  }

  await loadGoals();
  openGoals();
}

// ============================
// INIT
// ============================
async function initApp() {
  await Promise.all([
    loadDailyEntries(),
    loadMeasurements(),
    loadGoals()
  ]);

  openHome();
  refreshIcons();
}

// ============================
// EVENTS
// ============================
signUpButton?.addEventListener("click", signUp);
signInButton?.addEventListener("click", signIn);

navHome?.addEventListener("click", openHome);
navDaily?.addEventListener("click", openDaily);
navMeasurements?.addEventListener("click", openMeasurements);
navGoals?.addEventListener("click", openGoals);

fabButton?.addEventListener("click", handleFabClick);

wakeUpInput?.addEventListener("input", () => {
  setText(wakeUpValue, wakeUpInput.value);
});

dailyBackButton?.addEventListener("click", openDaily);
saveDailyButton?.addEventListener("click", saveDailyEntry);

measurementsBackButton?.addEventListener("click", openMeasurements);
saveMeasurementsButton?.addEventListener("click", saveMeasurements);

goalBackButton?.addEventListener("click", openGoals);
saveGoalButton?.addEventListener("click", saveGoal);
deleteGoalButton?.addEventListener("click", deleteGoal);

homeDateInput?.addEventListener("change", () => {
  state.homeDate = homeDateInput.value || today;
  renderHomeDashboard();
});

$$(".period-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".period-tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.homeRange = btn.dataset.range;
    renderHomeDashboard();
  });
});

year2025Button?.addEventListener("click", () => {
  state.currentGoalYear = 2025;
  renderGoals();
  renderHomeGoalsProgress();
});

year2026Button?.addEventListener("click", () => {
  state.currentGoalYear = 2026;
  renderGoals();
  renderHomeGoalsProgress();
});

boolButtons.forEach(btn => {
  btn.addEventListener("click", () => toggleBoolButton(btn));
});

multiButtons.forEach(btn => {
  btn.addEventListener("click", () => toggleMultiButton(btn));
});

$$(".photo-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".photo-tab").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.selectedPhotoType = btn.dataset.photoType;
    renderMeasurementsComparison();
  });
});

compareBeforeDate?.addEventListener("change", renderMeasurementsComparison);
compareAfterDate?.addEventListener("change", renderMeasurementsComparison);

// PREVIEWS
setupLocalPreview(dayPhotoFileInput, dayPhotoPreview);
setupLocalPreview(frontPhotoFileInput, frontPhotoPreview);
setupLocalPreview(leftPhotoFileInput, leftPhotoPreview);
setupLocalPreview(rightPhotoFileInput, rightPhotoPreview);
setupLocalPreview(backPhotoFileInput, backPhotoPreview);
setupLocalPreview(armsBackPhotoFileInput, armsBackPhotoPreview);
setupLocalPreview(armsFrontPhotoFileInput, armsFrontPhotoPreview);

// ============================
// START
// ============================
checkSession();
refreshIcons();
