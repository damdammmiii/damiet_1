/* ==========================================================================
   VibeFit - Core Application Script
   ========================================================================== */

// Global State
const state = {
  currentDate: getTodayString(),
  currentLog: null,
  allLogs: [],
  charts: {
    dashboardWeight: null,
    dashboardCalories: null,
    detailWeight: null
  }
};

// Exercise Auto-Calorie Ratios (kcal per minute)
const EXERCISE_METS = {
  running: 10,
  walking: 4,
  cycling: 8,
  swimming: 9,
  strength: 6,
  yoga: 3,
  custom: 0
};

// ==========================================================================
// 1. INDEXEDDB ENGINE
// ==========================================================================

const DB_NAME = 'VibeFitDB';
const DB_VERSION = 1;
const STORE_NAME = 'daily_logs';

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('Database failed to open:', event);
      reject(event);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'date' });
      }
    };
  });
}

async function getLogFromDB(date) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(date);

    request.onsuccess = (event) => {
      resolve(event.target.result || createEmptyLog(date));
    };

    request.onerror = (event) => reject(event);
  });
}

async function saveLogToDB(log) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(log);

    request.onsuccess = () => resolve(true);
    request.onerror = (event) => reject(event);
  });
}

async function getAllLogsFromDB() {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      // Sort logs by date ascending
      const sortedLogs = event.target.result.sort((a, b) => a.date.localeCompare(b.date));
      resolve(sortedLogs);
    };

    request.onerror = (event) => reject(event);
  });
}

async function deleteLogFromDB(date) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(date);

    request.onsuccess = () => resolve(true);
    request.onerror = (event) => reject(event);
  });
}

// Helpers for data structures
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyLog(date) {
  return {
    date: date,
    weight: null,
    meals: {
      breakfast: { desc: '', cal: 0, photo: null },
      lunch: { desc: '', cal: 0, photo: null },
      dinner: { desc: '', cal: 0, photo: null }
    },
    exercises: [],
    water: 0,
    sleep: 7.0,
    condition: 'good',
    diaryNote: ''
  };
}

// ==========================================================================
// 2. STATE MANAGEMENT & INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Set Datepicker to today
  const datePicker = document.getElementById('date-picker');
  datePicker.value = state.currentDate;
  updateDateDisplayText(state.currentDate);

  // Initialize Lucide Icons
  lucide.createIcons();

  // Load Initial State
  await loadCurrentDateData();

  // Setup Event Listeners
  setupNavigationListeners();
  setupDatePickerListeners();
  setupQuickLogListeners();
  setupDietListeners();
  setupExerciseListeners();
  setupWeightListeners();
  setupDiaryListeners();
  setupDemoDataListener();

  // Refresh Charts
  await refreshCharts();
});

async function loadCurrentDateData() {
  state.currentLog = await getLogFromDB(state.currentDate);
  state.allLogs = await getAllLogsFromDB();
  
  // Update inputs and widgets
  updateDashboardWidgets();
  updateDietTabForms();
  updateExerciseTabList();
  updateWeightTabUI();
  updateDiaryTabForms();
}

function updateDateDisplayText(dateStr) {
  const date = new Date(dateStr);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const displayStr = `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일 (${weekdays[date.getDay()]})`;
  document.getElementById('date-display-text').textContent = displayStr;
}

// ==========================================================================
// 3. PAGE NAVIGATION ROUTING
// ==========================================================================

function setupNavigationListeners() {
  const navButtons = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('header-page-title');
  const pageSubtitle = document.getElementById('header-subtitle');

  const pageMeta = {
    dashboard: { title: '대시보드', subtitle: '오늘의 다이어트 여정을 체크하세요.' },
    diet: { title: '식단 기록', subtitle: '아침, 점심, 저녁 식단과 영양을 세세히 기입하세요.' },
    exercise: { title: '운동 기록', subtitle: '칼로리를 활기차게 태우고 비교해 보세요.' },
    weight: { title: '체중 변화', subtitle: '몸무게 추이를 분석하고 변화를 모니터링합니다.' },
    diary: { title: '하루 마무리', subtitle: '컨디션과 간단한 소회를 일기장으로 남기세요.' }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      // Update Nav active states
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Show correct tab section
      tabContents.forEach(tc => {
        if (tc.id === `tab-${targetTab}`) {
          tc.classList.add('active');
        } else {
          tc.classList.remove('active');
        }
      });

      // Update Page Headers
      if (pageMeta[targetTab]) {
        pageTitle.textContent = pageMeta[targetTab].title;
        pageSubtitle.textContent = pageMeta[targetTab].subtitle;
      }

      // Re-render specific graphs to match layout boundaries after resize/tab switch
      refreshCharts();
    });
  });
}

function setupDatePickerListeners() {
  const datePicker = document.getElementById('date-picker');
  const btnPrev = document.getElementById('btn-prev-day');
  const btnNext = document.getElementById('btn-next-day');
  const btnToday = document.getElementById('btn-today');

  const changeDate = async (newDateStr) => {
    state.currentDate = newDateStr;
    datePicker.value = newDateStr;
    updateDateDisplayText(newDateStr);
    await loadCurrentDateData();
    await refreshCharts();
  };

  datePicker.addEventListener('change', (e) => {
    changeDate(e.target.value);
  });

  btnPrev.addEventListener('click', () => {
    const d = new Date(state.currentDate);
    d.setDate(d.getDate() - 1);
    const prevDateStr = d.toISOString().split('T')[0];
    changeDate(prevDateStr);
  });

  btnNext.addEventListener('click', () => {
    const d = new Date(state.currentDate);
    d.setDate(d.getDate() + 1);
    const nextDateStr = d.toISOString().split('T')[0];
    changeDate(nextDateStr);
  });

  btnToday.addEventListener('click', () => {
    changeDate(getTodayString());
  });
}

// ==========================================================================
// 4. DASHBOARD MANAGER
// ==========================================================================

function updateDashboardWidgets() {
  const log = state.currentLog;

  // 1. Calories Circle Progress Calculator
  const intake = (log.meals.breakfast.cal || 0) + (log.meals.lunch.cal || 0) + (log.meals.dinner.cal || 0);
  const burn = log.exercises.reduce((sum, item) => sum + (item.calories || 0), 0);
  const net = intake - burn;

  document.getElementById('cal-intake-value').textContent = `${intake.toLocaleString()} kcal`;
  document.getElementById('cal-burn-value').textContent = `${burn.toLocaleString()} kcal`;
  document.getElementById('cal-net-value').textContent = net.toLocaleString();

  // Progress Bar Ring Animation (Goal: 2000 kcal target)
  const target = 2000;
  const percentage = Math.min(100, Math.max(0, (intake / target) * 100));
  const ring = document.getElementById('cal-progress-ring');
  const radius = ring.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  ring.style.strokeDashoffset = offset;

  // Change color indicator based on balance
  if (intake > target) {
    ring.style.stroke = 'var(--accent)';
  } else {
    ring.style.stroke = 'var(--primary)';
  }

  // 2. Weight Widget
  const weightDisplay = document.getElementById('today-weight-display');
  const trendLabel = document.getElementById('weight-diff-label');

  if (log.weight) {
    weightDisplay.textContent = log.weight.toFixed(1);
    // Find the previous weight logged before current date
    const prevLogs = state.allLogs.filter(l => l.date < state.currentDate && l.weight !== null);
    if (prevLogs.length > 0) {
      const prevWeight = prevLogs[prevLogs.length - 1].weight;
      const diff = log.weight - prevWeight;
      if (diff < 0) {
        trendLabel.className = 'trend-tag loss';
        trendLabel.innerHTML = `<i data-lucide="trending-down"></i> 어제보다 ${Math.abs(diff).toFixed(1)}kg 감소`;
      } else if (diff > 0) {
        trendLabel.className = 'trend-tag gain';
        trendLabel.innerHTML = `<i data-lucide="trending-up"></i> 어제보다 ${diff.toFixed(1)}kg 증가`;
      } else {
        trendLabel.className = 'trend-tag neutral';
        trendLabel.textContent = '어제와 동일한 몸무게';
      }
    } else {
      trendLabel.className = 'trend-tag neutral';
      trendLabel.textContent = '첫 체중 기록';
    }
  } else {
    weightDisplay.textContent = '-.-';
    trendLabel.className = 'trend-tag neutral';
    trendLabel.textContent = '체중을 기록해 주세요';
  }

  // 3. Water Widget Rendering
  renderWaterCups(log.water);

  // 4. Condition & Sleep Summary
  document.getElementById('dash-sleep-val').textContent = log.sleep ? `${log.sleep} 시간` : '- 시간';
  
  const condMap = {
    excellent: '😊 최상',
    good: '🙂 좋음',
    neutral: '😐 보통',
    'neutral-tired': '🥱 피곤함',
    stressed: '😫 스트레스'
  };
  document.getElementById('dash-condition-val').textContent = condMap[log.condition] || '-';

  const diaryPreview = document.getElementById('dash-diary-preview');
  if (log.diaryNote.trim()) {
    diaryPreview.textContent = `"${log.diaryNote}"`;
    diaryPreview.className = 'diary-preview-box-text';
  } else {
    diaryPreview.textContent = '"오늘 하루 컨디션 노트를 작성해 보세요!"';
    diaryPreview.className = 'diary-preview-box-text text-muted italic';
  }

  // Rerender Lucide Icons generated
  lucide.createIcons();
}

function renderWaterCups(currentCups) {
  const container = document.getElementById('water-cups-container');
  container.innerHTML = '';
  
  for (let i = 1; i <= 8; i++) {
    const cup = document.createElement('div');
    cup.className = `water-cup ${i <= currentCups ? 'filled' : ''}`;
    cup.setAttribute('data-cup-index', i);
    
    const wave = document.createElement('div');
    wave.className = 'cup-wave';
    cup.appendChild(wave);
    
    cup.addEventListener('click', async () => {
      let targetWater = i;
      // If clicking the currently active cup, toggle it off (decrement by 1)
      if (state.currentLog.water === i && i > 0) {
        targetWater = i - 1;
      }
      state.currentLog.water = targetWater;
      await saveLogToDB(state.currentLog);
      await loadCurrentDateData();
    });

    container.appendChild(cup);
  }
  document.getElementById('water-value').textContent = currentCups;
  document.getElementById('diary-water-display').textContent = currentCups;
}

function setupQuickLogListeners() {
  // Quick Weight Input Action
  const weightInput = document.getElementById('quick-weight-input');
  const btnWeight = document.getElementById('btn-quick-weight');

  btnWeight.addEventListener('click', async () => {
    const weightVal = parseFloat(weightInput.value);
    if (!isNaN(weightVal) && weightVal > 20 && weightVal < 250) {
      state.currentLog.weight = weightVal;
      await saveLogToDB(state.currentLog);
      weightInput.value = '';
      await loadCurrentDateData();
      await refreshCharts();
      alert('체중이 기록되었습니다.');
    } else {
      alert('올바른 체중을 입력하세요 (20 ~ 250kg).');
    }
  });

  // Quick Water Button log
  const waterMinus = document.getElementById('btn-water-minus');
  const waterPlus = document.getElementById('btn-water-plus');

  waterMinus.addEventListener('click', async () => {
    if (state.currentLog.water > 0) {
      state.currentLog.water -= 1;
      await saveLogToDB(state.currentLog);
      await loadCurrentDateData();
    }
  });

  waterPlus.addEventListener('click', async () => {
    if (state.currentLog.water < 12) { // Allow logging beyond 8 cups
      state.currentLog.water += 1;
      await saveLogToDB(state.currentLog);
      await loadCurrentDateData();
    }
  });
}

// ==========================================================================
// 5. DIET LOG MANAGER (With Canvas Compression & Preview)
// ==========================================================================

function updateDietTabForms() {
  const log = state.currentLog;
  const meals = ['breakfast', 'lunch', 'dinner'];

  meals.forEach(type => {
    const mealData = log.meals[type];
    
    // Fill text description and calories
    document.getElementById(`${type}-food-desc`).value = mealData.desc || '';
    document.getElementById(`${type}-calories`).value = mealData.cal || '';
    document.getElementById(`${type}-cal-summary`).textContent = mealData.cal || 0;

    // Show/hide thumbnail previews
    const previewContainer = document.getElementById(`${type}-preview-container`);
    const previewImg = document.getElementById(`${type}-preview-img`);
    const placeholder = document.getElementById(`${type}-placeholder`);

    if (mealData.photo) {
      previewImg.src = mealData.photo;
      previewContainer.classList.remove('hidden');
      placeholder.classList.add('hidden');
    } else {
      previewImg.src = '';
      previewContainer.classList.add('hidden');
      placeholder.classList.remove('hidden');
    }
  });
}

function setupDietListeners() {
  const meals = ['breakfast', 'lunch', 'dinner'];

  meals.forEach(type => {
    const dropZone = document.getElementById(`${type}-photo-zone`);
    const fileInput = document.getElementById(`${type}-photo-input`);
    const deleteBtn = document.getElementById(`btn-delete-${type}-photo`);

    // Handle Drag & Drop highlights
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
      }, false);
    });

    // Handle Drop file event
    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        processUploadedImage(files[0], type);
      }
    });

    // Handle Click selector file event
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        processUploadedImage(e.target.files[0], type);
      }
    });

    // Handle Delete photo action
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Avoid triggering click input overlay
      e.preventDefault();
      
      if (confirm('사진을 삭제하시겠습니까?')) {
        state.currentLog.meals[type].photo = null;
        await saveLogToDB(state.currentLog);
        await loadCurrentDateData();
      }
    });
  });

  // Save Buttons for Meals
  const saveButtons = document.querySelectorAll('.btn-save-meal');
  saveButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.getAttribute('data-meal');
      const descVal = document.getElementById(`${type}-food-desc`).value.trim();
      const calVal = parseInt(document.getElementById(`${type}-calories`).value);

      state.currentLog.meals[type].desc = descVal;
      state.currentLog.meals[type].cal = isNaN(calVal) ? 0 : calVal;

      await saveLogToDB(state.currentLog);
      await loadCurrentDateData();
      alert(`${type === 'breakfast' ? '아침' : type === 'lunch' ? '점심' : '저녁'} 식단 정보가 저장되었습니다.`);
    });
  });
}

function processUploadedImage(file, mealType) {
  if (!file.type.startsWith('image/')) {
    alert('이미지 파일만 업로드할 수 있습니다.');
    return;
  }

  // Compress image client side using Canvas to save memory in IndexedDB
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 450;
      const MAX_HEIGHT = 450;
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio
      if (width > height) {
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
      } else {
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / height;
          height = MAX_HEIGHT;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Export compressed base64 string
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85); // 85% quality
      
      // Update State and DB
      state.currentLog.meals[mealType].photo = compressedDataUrl;
      saveLogToDB(state.currentLog).then(() => {
        loadCurrentDateData();
      });
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

// ==========================================================================
// 6. EXERCISE MANAGER
// ==========================================================================

function updateExerciseTabList() {
  const log = state.currentLog;
  const listElement = document.getElementById('exercise-list');
  const emptyState = document.getElementById('exercise-empty-state');
  const summaryElement = document.getElementById('exercise-total-summary');

  // Clear list
  listElement.innerHTML = '';

  const totalCalories = log.exercises.reduce((sum, item) => sum + item.calories, 0);
  summaryElement.textContent = `총 ${totalCalories.toLocaleString()} kcal 소모`;

  if (log.exercises.length === 0) {
    emptyState.style.display = 'flex';
    listElement.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    listElement.style.display = 'flex';

    log.exercises.forEach(item => {
      const li = document.createElement('li');
      li.className = 'exercise-item';

      const typeLabels = {
        running: '러닝',
        walking: '걷기 / 산책',
        cycling: '자전거',
        swimming: '수영',
        strength: '웨이트',
        yoga: '요가 / 필라테스',
        custom: item.customName || '기타'
      };

      const iconMap = {
        running: 'flame',
        walking: 'footprints',
        cycling: 'bike',
        swimming: 'waves',
        strength: 'dumbbell',
        yoga: 'heart',
        custom: 'activity'
      };

      li.innerHTML = `
        <div class="ex-info-block">
          <div class="ex-icon-box">
            <i data-lucide="${iconMap[item.type] || 'activity'}"></i>
          </div>
          <div class="ex-name-details">
            <span class="ex-name">${typeLabels[item.type]}</span>
            <span class="ex-duration">${item.duration}분 수행</span>
          </div>
        </div>
        <div class="ex-right-block">
          <span class="ex-calories">${item.calories} kcal</span>
          <button class="btn-delete-item" data-id="${item.id}" aria-label="운동 삭제">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // Set listener for Delete single workout
      li.querySelector('.btn-delete-item').addEventListener('click', async (e) => {
        const idToDelete = parseFloat(e.currentTarget.getAttribute('data-id'));
        state.currentLog.exercises = state.currentLog.exercises.filter(ex => ex.id !== idToDelete);
        await saveLogToDB(state.currentLog);
        await loadCurrentDateData();
        await refreshCharts();
      });

      listElement.appendChild(li);
    });

    lucide.createIcons();
  }
}

function setupExerciseListeners() {
  const form = document.getElementById('form-exercise');
  const selectType = document.getElementById('exercise-type');
  const groupCustomName = document.getElementById('group-custom-name');
  const customNameInput = document.getElementById('exercise-custom-name');
  const durationInput = document.getElementById('exercise-duration');
  const caloriesInput = document.getElementById('exercise-calories');

  // Toggle Custom Exercise Name visibility
  selectType.addEventListener('change', () => {
    if (selectType.value === 'custom') {
      groupCustomName.style.display = 'block';
      customNameInput.required = true;
      caloriesInput.placeholder = '직접 입력';
    } else {
      groupCustomName.style.display = 'none';
      customNameInput.required = false;
      caloriesInput.placeholder = '자동 계산';
      
      // Auto estimate calories if duration is already typed
      recalculateCaloriesEstimate();
    }
  });

  // Calculate calories auto-estimations on duration input
  durationInput.addEventListener('input', recalculateCaloriesEstimate);

  function recalculateCaloriesEstimate() {
    const type = selectType.value;
    const mins = parseFloat(durationInput.value);

    if (type !== 'custom' && !isNaN(mins) && mins > 0) {
      const ratio = EXERCISE_METS[type] || 0;
      caloriesInput.value = Math.round(mins * ratio);
    }
  }

  // Handle Form submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = selectType.value;
    const customName = customNameInput.value.trim();
    const duration = parseFloat(durationInput.value);
    const calories = parseFloat(caloriesInput.value);

    if (isNaN(duration) || duration <= 0) {
      alert('운동 시간을 올바르게 기입해 주세요.');
      return;
    }

    if (isNaN(calories) || calories < 0) {
      alert('칼로리를 올바르게 기입해 주세요.');
      return;
    }

    const newWorkout = {
      id: Date.now(),
      type: type,
      customName: type === 'custom' ? customName : '',
      duration: duration,
      calories: Math.round(calories)
    };

    state.currentLog.exercises.push(newWorkout);
    await saveLogToDB(state.currentLog);
    
    // Reset Form
    form.reset();
    groupCustomName.style.display = 'none';
    customNameInput.required = false;
    caloriesInput.placeholder = '자동 계산';

    await loadCurrentDateData();
    await refreshCharts();
  });
}

// ==========================================================================
// 7. WEIGHT TRACKER & HISTORICAL LISTS
// ==========================================================================

function updateWeightTabUI() {
  const log = state.currentLog;

  // Weight form input value update
  document.getElementById('weight-input').value = log.weight || '';

  // Stats calculate
  const loggedWeights = state.allLogs.filter(l => l.weight !== null);
  
  const latestWeightStat = document.getElementById('weight-stat-latest');
  const maxWeightStat = document.getElementById('weight-stat-max');
  const minWeightStat = document.getElementById('weight-stat-min');
  const countWeightStat = document.getElementById('weight-stat-count');

  if (loggedWeights.length > 0) {
    const weightsArr = loggedWeights.map(l => l.weight);
    latestWeightStat.textContent = `${loggedWeights[loggedWeights.length - 1].weight.toFixed(1)} kg`;
    maxWeightStat.textContent = `${Math.max(...weightsArr).toFixed(1)} kg`;
    minWeightStat.textContent = `${Math.min(...weightsArr).toFixed(1)} kg`;
    countWeightStat.textContent = `${loggedWeights.length} 회`;
  } else {
    latestWeightStat.textContent = '- kg';
    maxWeightStat.textContent = '- kg';
    minWeightStat.textContent = '- kg';
    countWeightStat.textContent = '0 회';
  }

  // Weight History Table Render
  const tbody = document.getElementById('weight-history-tbody');
  tbody.innerHTML = '';

  // Reverse list to show newest on top
  const sortedHistory = [...loggedWeights].reverse();

  if (sortedHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">등록된 몸무게 기록이 없습니다.</td>
      </tr>
    `;
  } else {
    sortedHistory.forEach((item, index) => {
      const tr = document.createElement('tr');

      // Date formatter
      const date = new Date(item.date);
      const formattedDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

      // Calculate diff from older log
      let diffHtml = '<span class="text-muted">-</span>';
      
      // Find chronologically older item
      const chronIndex = loggedWeights.findIndex(l => l.date === item.date);
      if (chronIndex > 0) {
        const olderItem = loggedWeights[chronIndex - 1];
        const diff = item.weight - olderItem.weight;
        if (diff < 0) {
          diffHtml = `<span class="text-primary bold">-${Math.abs(diff).toFixed(1)} kg</span>`;
        } else if (diff > 0) {
          diffHtml = `<span class="text-warning bold">+${diff.toFixed(1)} kg</span>`;
        } else {
          diffHtml = '<span class="text-muted">0.0 kg</span>';
        }
      }

      tr.innerHTML = `
        <td>${formattedDate}</td>
        <td><span class="weight-val">${item.weight.toFixed(1)}</span> kg</td>
        <td>${diffHtml}</td>
        <td>
          <button class="btn-delete-item btn-delete-weight" data-date="${item.date}" aria-label="기록 삭제">
            <i data-lucide="trash-2"></i>
          </button>
        </td>
      `;

      tr.querySelector('.btn-delete-weight').addEventListener('click', async (e) => {
        const dateToDelete = e.currentTarget.getAttribute('data-date');
        if (confirm(`${dateToDelete}의 체중 기록을 삭제하시겠습니까?`)) {
          // If we delete the record, we reset weight in that day's log
          const targetLog = await getLogFromDB(dateToDelete);
          targetLog.weight = null;
          await saveLogToDB(targetLog);
          await loadCurrentDateData();
          await refreshCharts();
        }
      });

      tbody.appendChild(tr);
    });

    lucide.createIcons();
  }
}

function setupWeightListeners() {
  const form = document.getElementById('form-weight');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const weightVal = parseFloat(document.getElementById('weight-input').value);

    if (isNaN(weightVal) || weightVal < 20 || weightVal > 250) {
      alert('올바른 몸무게를 입력해 주세요 (20 ~ 250kg).');
      return;
    }

    state.currentLog.weight = weightVal;
    await saveLogToDB(state.currentLog);
    await loadCurrentDateData();
    await refreshCharts();
    alert('체중이 기록되었습니다.');
  });
}

// ==========================================================================
// 8. DIARY NOTE & CONDITION MANAGER
// ==========================================================================

function updateDiaryTabForms() {
  const log = state.currentLog;

  // 1. Emoji picker active status
  const conditionRadios = document.getElementsByName('condition');
  conditionRadios.forEach(radio => {
    if (radio.value === log.condition) {
      radio.checked = true;
    }
  });

  // 2. Sleep display and range slider
  document.getElementById('sleep-hours-val').textContent = log.sleep.toFixed(1);
  document.getElementById('sleep-range').value = log.sleep;

  // 3. Water cup status display (already rendered in Dashboard, sync text here)
  document.getElementById('diary-water-display').textContent = log.water;

  // 4. Diary feedback note text
  document.getElementById('diary-note-textarea').value = log.diaryNote || '';
}

function setupDiaryListeners() {
  const sleepRange = document.getElementById('sleep-range');
  const sleepVal = document.getElementById('sleep-hours-val');

  sleepRange.addEventListener('input', (e) => {
    sleepVal.textContent = parseFloat(e.target.value).toFixed(1);
  });

  // Hydration buttons inside Diary Page
  const wMinus = document.getElementById('btn-diary-water-minus');
  const wPlus = document.getElementById('btn-diary-water-plus');

  wMinus.addEventListener('click', async () => {
    if (state.currentLog.water > 0) {
      state.currentLog.water -= 1;
      await saveLogToDB(state.currentLog);
      await loadCurrentDateData();
    }
  });

  wPlus.addEventListener('click', async () => {
    if (state.currentLog.water < 12) {
      state.currentLog.water += 1;
      await saveLogToDB(state.currentLog);
      await loadCurrentDateData();
    }
  });

  // Submit day notes
  const form = document.getElementById('form-diary');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Get selected condition emoji
    const conditionRadios = document.getElementsByName('condition');
    let selectedCondition = 'good';
    for (const radio of conditionRadios) {
      if (radio.checked) {
        selectedCondition = radio.value;
        break;
      }
    }

    const sleepHours = parseFloat(sleepRange.value);
    const noteText = document.getElementById('diary-note-textarea').value.trim();

    state.currentLog.condition = selectedCondition;
    state.currentLog.sleep = sleepHours;
    state.currentLog.diaryNote = noteText;

    await saveLogToDB(state.currentLog);
    await loadCurrentDateData();
    alert('오늘 하루 마무리 일기가 저장되었습니다!');
  });
}

// ==========================================================================
// 9. CHART.JS VISUALIZATIONS
// ==========================================================================

let activeWeightFilterRange = 7;

async function refreshCharts() {
  // Wait a small timeout to let the container size calculations complete if switching tabs
  setTimeout(async () => {
    await renderWeightCharts();
    await renderCalorieComparisonChart();
  }, 50);
}

// Event handlers for Weight range buttons
document.querySelectorAll('.chart-filters button').forEach(button => {
  button.addEventListener('click', async (e) => {
    document.querySelectorAll('.chart-filters button').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeWeightFilterRange = parseInt(e.target.getAttribute('data-range'));
    await renderWeightCharts();
  });
});

async function renderWeightCharts() {
  const loggedWeights = state.allLogs.filter(l => l.weight !== null);
  
  // Filter weights by selected range (7 or 30 days) before current selected date
  const maxDate = new Date(state.currentDate);
  const minDate = new Date(state.currentDate);
  minDate.setDate(minDate.getDate() - activeWeightFilterRange + 1);

  const minDateStr = minDate.toISOString().split('T')[0];
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const filteredLogs = loggedWeights.filter(l => l.date >= minDateStr && l.date <= maxDateStr);

  // If there are no points in the range, look back further to populate something readable
  const finalLogsForChart = filteredLogs.length > 0 
    ? filteredLogs 
    : loggedWeights.slice(-activeWeightFilterRange);

  const chartLabels = finalLogsForChart.map(l => {
    const d = new Date(l.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const chartData = finalLogsForChart.map(l => l.weight);

  // Style properties
  const gridColor = 'rgba(255, 255, 255, 0.05)';
  const labelColor = '#94a3b8';

  // --- CHART 1: Dashboard weight trend line ---
  const ctxDash = document.getElementById('weightDashboardChart').getContext('2d');
  if (state.charts.dashboardWeight) {
    state.charts.dashboardWeight.destroy();
  }

  // Linear gradient for area chart line fill
  const gradient = ctxDash.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(245, 158, 11, 0.2)');
  gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

  state.charts.dashboardWeight = new Chart(ctxDash, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [{
        label: '몸무게 (kg)',
        data: chartData,
        borderColor: 'var(--warning)',
        borderWidth: 3,
        pointBackgroundColor: 'var(--warning)',
        pointBorderColor: '#0b0f17',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.3,
        fill: true,
        backgroundColor: gradient
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit, Noto Sans KR' },
          bodyFont: { family: 'Outfit, Noto Sans KR' },
          padding: 10,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          displayColors: false
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: labelColor, font: { size: 10 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { size: 10 } },
          suggestedMin: chartData.length > 0 ? Math.min(...chartData) - 1 : 40,
          suggestedMax: chartData.length > 0 ? Math.max(...chartData) + 1 : 90
        }
      }
    }
  });

  // --- CHART 2: Weight Detail Tab line ---
  const ctxDetail = document.getElementById('weightDetailChart').getContext('2d');
  if (state.charts.detailWeight) {
    state.charts.detailWeight.destroy();
  }

  // Linear gradient for Detail graph
  const gradientDetail = ctxDetail.createLinearGradient(0, 0, 0, 300);
  gradientDetail.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
  gradientDetail.addColorStop(1, 'rgba(245, 158, 11, 0.01)');

  // For Detail chart, use full historical weight points (up to 30 days default)
  const fullChartLogs = loggedWeights.slice(-30);
  const detailLabels = fullChartLogs.map(l => {
    const d = new Date(l.date);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  });
  const detailData = fullChartLogs.map(l => l.weight);

  state.charts.detailWeight = new Chart(ctxDetail, {
    type: 'line',
    data: {
      labels: detailLabels,
      datasets: [{
        label: '체중 기록',
        data: detailData,
        borderColor: 'var(--warning)',
        borderWidth: 3,
        pointBackgroundColor: 'var(--warning)',
        pointBorderColor: '#0b0f17',
        pointBorderWidth: 2,
        pointRadius: 5,
        tension: 0.35,
        fill: true,
        backgroundColor: gradientDetail
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit, Noto Sans KR', size: 12 },
          bodyFont: { family: 'Outfit, Noto Sans KR', size: 12 },
          padding: 12,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return ` 몸무게: ${context.parsed.y} kg`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: labelColor, font: { size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { size: 11 } },
          suggestedMin: detailData.length > 0 ? Math.min(...detailData) - 2 : 40,
          suggestedMax: detailData.length > 0 ? Math.max(...detailData) + 2 : 100
        }
      }
    }
  });
}

async function renderCalorieComparisonChart() {
  // Render calorie intake vs burn side-by-side comparison for the last 7 days ending at current selected date
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(state.currentDate);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const intakeData = [];
  const burnData = [];
  const chartLabels = [];

  for (const dt of dates) {
    const log = await getLogFromDB(dt);
    const intake = (log.meals.breakfast.cal || 0) + (log.meals.lunch.cal || 0) + (log.meals.dinner.cal || 0);
    const burn = log.exercises.reduce((sum, item) => sum + (item.calories || 0), 0);
    
    intakeData.push(intake);
    burnData.push(burn);

    const dateObj = new Date(dt);
    chartLabels.push(`${dateObj.getMonth() + 1}/${dateObj.getDate()}`);
  }

  const ctxCal = document.getElementById('calorieComparisonChart').getContext('2d');
  if (state.charts.dashboardCalories) {
    state.charts.dashboardCalories.destroy();
  }

  state.charts.dashboardCalories = new Chart(ctxCal, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: '섭취 칼로리 (kcal)',
          data: intakeData,
          backgroundColor: 'rgba(16, 185, 129, 0.85)',
          borderColor: 'var(--primary)',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: '소모 칼로리 (kcal)',
          data: burnData,
          backgroundColor: 'rgba(139, 92, 246, 0.85)',
          borderColor: 'var(--secondary)',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#f1f5f9',
            font: { family: 'Outfit, Noto Sans KR', size: 10 }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { family: 'Outfit, Noto Sans KR' },
          bodyFont: { family: 'Outfit, Noto Sans KR' },
          padding: 10,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', font: { size: 10 } }
        }
      }
    }
  });
}

// ==========================================================================
// 10. DEMO DATA GENERATOR
// ==========================================================================

function setupDemoDataListener() {
  const btnDemo = document.getElementById('btn-demo-data');
  btnDemo.addEventListener('click', async () => {
    if (confirm('최근 7일간의 데모 데이터(식단, 운동, 몸무게 및 컨디션 일기)를 생성하시겠습니까? 기존 기록이 덮어씌워질 수 있습니다.')) {
      await generateMockData();
      await loadCurrentDateData();
      await refreshCharts();
      alert('데모 데이터가 성공적으로 생성되었습니다!');
    }
  });
}

async function generateMockData() {
  const today = new Date();
  
  // Base starting weight
  let startingWeight = 72.8;

  // Preset food descriptions & calories
  const breakfastOptions = [
    { desc: '바나나 1개, 플레인 요거트, 그래놀라 30g', cal: 320 },
    { desc: '사과 반 쪽, 호밀빵 1조각, 아보카도 스프레드', cal: 280 },
    { desc: '고구마 1개, 삶은 계란 2개, 아몬드 브리즈', cal: 340 }
  ];

  const lunchOptions = [
    { desc: '닭가슴살 현미밥 볶음밥, 샐러드 드레싱 없이', cal: 480 },
    { desc: '소고기 안심 구이 120g, 구운 아스파라거스, 잡곡밥', cal: 520 },
    { desc: '연어 스테이크 150g, 믹스 샐러드, 방울토마토', cal: 490 }
  ];

  const dinnerOptions = [
    { desc: '연두부 샐러드, 닭가슴살 소시지 1개, 파프리카', cal: 290 },
    { desc: '그릭 요거트 100g, 아몬드 10알, 블루베리 한 줌', cal: 240 },
    { desc: '단호박 수프, 리코타 치즈 샐러드, 통밀 크래커', cal: 310 }
  ];

  const diaryNotes = [
    '스쿼트 자극이 잘 들어왔고 야식 참는 데 성공했다. 뿌듯한 하루.',
    '점심에 살짝 배고팠지만 참았음. 오후 런닝 후 상쾌함이 대박!',
    '몸무게가 줄기 시작했다! 피곤하지만 컨디션 자체는 훌륭함.',
    '야근으로 인해 밤 운동은 패스. 대신 식단을 칼같이 지켰다.',
    '체중 감량이 더뎌서 스트레스를 받았으나 물을 많이 마시며 견뎌냄.',
    '등 산책 코스로 만보 걷기 완료. 숙면을 취할 것 같다.',
    '가벼운 요가로 몸을 풀었다. 주말 식단도 무사히 마무리가 기대된다!'
  ];

  const conditions = ['excellent', 'good', 'neutral', 'neutral-tired', 'stressed'];

  // Delete previous logs first if exists to prevent messy overlays
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    await deleteLogFromDB(dateStr);
  }

  // Create 7 days of logs (from 6 days ago up to today)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    // Weight trends slowly downwards
    startingWeight -= (Math.random() * 0.3) - 0.08; // gradual weight loss with random fluctuations

    const log = createEmptyLog(dateStr);
    log.weight = parseFloat(startingWeight.toFixed(1));

    // Hydration logs
    log.water = Math.floor(Math.random() * 4) + 5; // 5 to 8 cups

    // Sleep logs
    log.sleep = parseFloat((Math.random() * 3 + 6).toFixed(1)); // 6 to 9 hours

    // Notes
    log.diaryNote = diaryNotes[i % diaryNotes.length];
    log.condition = conditions[i % conditions.length];

    // Meals
    log.meals.breakfast = {
      desc: breakfastOptions[i % breakfastOptions.length].desc,
      cal: breakfastOptions[i % breakfastOptions.length].cal,
      photo: null // Mock generated text meals, user can upload photo for testing
    };
    log.meals.lunch = {
      desc: lunchOptions[i % lunchOptions.length].desc,
      cal: lunchOptions[i % lunchOptions.length].cal,
      photo: null
    };
    log.meals.dinner = {
      desc: dinnerOptions[i % dinnerOptions.length].desc,
      cal: dinnerOptions[i % dinnerOptions.length].cal,
      photo: null
    };

    // Exercises
    if (i === 6) {
      log.exercises.push({ id: 1001, type: 'running', customName: '', duration: 30, calories: 300 });
    } else if (i === 5) {
      log.exercises.push({ id: 1002, type: 'walking', customName: '', duration: 45, calories: 180 });
    } else if (i === 4) {
      log.exercises.push({ id: 1003, type: 'strength', customName: '', duration: 50, calories: 300 });
      log.exercises.push({ id: 1004, type: 'walking', customName: '', duration: 20, calories: 80 });
    } else if (i === 3) {
      log.exercises.push({ id: 1005, type: 'yoga', customName: '', duration: 40, calories: 120 });
    } else if (i === 2) {
      log.exercises.push({ id: 1006, type: 'cycling', customName: '', duration: 30, calories: 240 });
    } else if (i === 1) {
      log.exercises.push({ id: 1007, type: 'swimming', customName: '', duration: 40, calories: 360 });
    } else if (i === 0) { // today
      log.exercises.push({ id: 1008, type: 'running', customName: '', duration: 25, calories: 250 });
      log.exercises.push({ id: 1009, type: 'strength', customName: '', duration: 30, calories: 180 });
    }

    await saveLogToDB(log);
  }
}
