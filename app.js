/* ==========================================================================
   Damiet - Core Application Script
   ========================================================================== */

// Global State
const state = {
  currentDate: getTodayString(),
  currentLog: null,
  allLogs: [],
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(), // 0-indexed
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

const DB_NAME = 'DamietDB';
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
      snack: { desc: '', cal: 0, photo: null },
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
  const datePicker = document.getElementById('date-picker');
  datePicker.value = state.currentDate;
  updateDateDisplayText(state.currentDate);

  lucide.createIcons();

  await loadCurrentDateData();

  setupNavigationListeners();
  setupDatePickerListeners();
  setupCalendarListeners();
  setupQuickLogListeners();
  setupDietListeners();
  setupExerciseListeners();
  setupWeightListeners();
  setupDiaryListeners();
  setupDemoDataListener();

  await refreshCharts();
});

async function loadCurrentDateData() {
  state.currentLog = await getLogFromDB(state.currentDate);
  state.allLogs = await getAllLogsFromDB();
  
  updateDashboardWidgets();
  updateDietTabForms();
  updateExerciseTabList();
  updateWeightTabUI();
  updateDiaryTabForms();
  renderCalendar();
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
    calendar: { title: '한달 달력', subtitle: '이번 달 다이어트 기록 상태를 한눈에 모니터링하세요.' },
    diet: { title: '식단 기록', subtitle: '아침, 점심, 간식, 저녁 식단과 영양을 세세히 기입하세요.' },
    exercise: { title: '운동 기록', subtitle: '칼로리를 활기차게 태우고 비교해 보세요.' },
    weight: { title: '체중 변화', subtitle: '몸무게 추이를 분석하고 변화를 모니터링합니다.' },
    diary: { title: '하루 마무리', subtitle: '컨디션과 간단한 소회를 일기장으로 남기세요.' }
  };

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      tabContents.forEach(tc => {
        if (tc.id === `tab-${targetTab}`) {
          tc.classList.add('active');
        } else {
          tc.classList.remove('active');
        }
      });

      if (pageMeta[targetTab]) {
        pageTitle.textContent = pageMeta[targetTab].title;
        pageSubtitle.textContent = pageMeta[targetTab].subtitle;
      }

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
// 4. MONTHLY CALENDAR ENGINE
// ==========================================================================

function setupCalendarListeners() {
  const btnPrev = document.getElementById('btn-cal-prev-month');
  const btnNext = document.getElementById('btn-cal-next-month');

  btnPrev.addEventListener('click', () => {
    state.calendarMonth--;
    if (state.calendarMonth < 0) {
      state.calendarMonth = 11;
      state.calendarYear--;
    }
    renderCalendar();
  });

  btnNext.addEventListener('click', () => {
    state.calendarMonth++;
    if (state.calendarMonth > 11) {
      state.calendarMonth = 0;
      state.calendarYear++;
    }
    renderCalendar();
  });
}

function renderCalendar() {
  const label = document.getElementById('calendar-month-label');
  const grid = document.getElementById('calendar-days-grid');
  if (!label || !grid) return;

  const year = state.calendarYear;
  const month = state.calendarMonth;

  label.textContent = `${year}년 ${String(month + 1).padStart(2, '0')}월`;
  grid.innerHTML = '';

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Empty cells before start
  for (let i = 0; i < firstDay; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'cal-day empty';
    grid.appendChild(emptyCell);
  }

  // Days cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (dateStr === state.currentDate) {
      cell.classList.add('selected');
    }

    const dayNum = document.createElement('span');
    dayNum.className = 'day-num';
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    // Find log for this date
    const log = state.allLogs.find(l => l.date === dateStr);
    if (log) {
      const indicators = document.createElement('div');
      indicators.className = 'cal-indicators';

      // Meal dots
      if (log.meals.breakfast.desc || log.meals.breakfast.cal > 0) indicators.appendChild(createDot('diet-b'));
      if (log.meals.lunch.desc || log.meals.lunch.cal > 0) indicators.appendChild(createDot('diet-l'));
      if (log.meals.snack.desc || log.meals.snack.cal > 0) indicators.appendChild(createDot('diet-s'));
      if (log.meals.dinner.desc || log.meals.dinner.cal > 0) indicators.appendChild(createDot('diet-d'));

      // Exercise Icon
      if (log.exercises && log.exercises.length > 0) {
        const exTag = document.createElement('span');
        exTag.className = 'cal-ex-tag';
        exTag.innerHTML = '🏋️';
        indicators.appendChild(exTag);
      }

      cell.appendChild(indicators);

      // Weight label
      if (log.weight) {
        const wTag = document.createElement('span');
        wTag.className = 'cal-weight-tag';
        wTag.textContent = `${log.weight.toFixed(1)}k`;
        cell.appendChild(wTag);
      }
    }

    cell.addEventListener('click', async () => {
      state.currentDate = dateStr;
      document.getElementById('date-picker').value = dateStr;
      updateDateDisplayText(dateStr);
      await loadCurrentDateData();
      await refreshCharts();
    });

    grid.appendChild(cell);
  }
}

function createDot(className) {
  const dot = document.createElement('span');
  dot.className = `legend-dot ${className}`;
  return dot;
}

// ==========================================================================
// 5. DASHBOARD MANAGER
// ==========================================================================

function updateDashboardWidgets() {
  const log = state.currentLog;

  const intake = (log.meals.breakfast.cal || 0) + (log.meals.lunch.cal || 0) + (log.meals.snack.cal || 0) + (log.meals.dinner.cal || 0);
  const burn = log.exercises.reduce((sum, item) => sum + (item.calories || 0), 0);
  const net = intake - burn;

  document.getElementById('cal-intake-value').textContent = `${intake.toLocaleString()} kcal`;
  document.getElementById('cal-burn-value').textContent = `${burn.toLocaleString()} kcal`;
  document.getElementById('cal-net-value').textContent = net.toLocaleString();

  const target = 2000;
  const percentage = Math.min(100, Math.max(0, (intake / target) * 100));
  const ring = document.getElementById('cal-progress-ring');
  const radius = ring.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  ring.style.strokeDashoffset = offset;

  if (intake > target) {
    ring.style.stroke = 'var(--accent)';
  } else {
    ring.style.stroke = 'var(--primary)';
  }

  const weightDisplay = document.getElementById('today-weight-display');
  const trendLabel = document.getElementById('weight-diff-label');

  if (log.weight) {
    weightDisplay.textContent = log.weight.toFixed(1);
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

  renderWaterCups(log.water);

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
    if (state.currentLog.water < 12) {
      state.currentLog.water += 1;
      await saveLogToDB(state.currentLog);
      await loadCurrentDateData();
    }
  });
}

// ==========================================================================
// 6. DIET LOG MANAGER
// ==========================================================================

function updateDietTabForms() {
  const log = state.currentLog;
  const meals = ['breakfast', 'lunch', 'snack', 'dinner'];

  meals.forEach(type => {
    const mealData = log.meals[type];
    
    document.getElementById(`${type}-food-desc`).value = mealData.desc || '';
    document.getElementById(`${type}-calories`).value = mealData.cal || '';
    document.getElementById(`${type}-cal-summary`).textContent = mealData.cal || 0;

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
  const meals = ['breakfast', 'lunch', 'snack', 'dinner'];

  meals.forEach(type => {
    const dropZone = document.getElementById(`${type}-photo-zone`);
    const fileInput = document.getElementById(`${type}-photo-input`);
    const deleteBtn = document.getElementById(`btn-delete-${type}-photo`);

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

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files.length > 0) {
        processUploadedImage(files[0], type);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        processUploadedImage(e.target.files[0], type);
      }
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (confirm('사진을 삭제하시겠습니까?')) {
        state.currentLog.meals[type].photo = null;
        await saveLogToDB(state.currentLog);
        await loadCurrentDateData();
      }
    });
  });

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
      
      const mealLabels = { breakfast: '아침', lunch: '점심', snack: '간식', dinner: '저녁' };
      alert(`${mealLabels[type] || ''} 식단 정보가 저장되었습니다.`);
    });
  });
}

function processUploadedImage(file, mealType) {
  if (!file.type.startsWith('image/')) {
    alert('이미지 파일만 업로드할 수 있습니다.');
    return;
  }

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 450;
      const MAX_HEIGHT = 450;
      let width = img.width;
      let height = img.height;

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

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
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
// 7. EXERCISE MANAGER
// ==========================================================================

function updateExerciseTabList() {
  const log = state.currentLog;
  const listElement = document.getElementById('exercise-list');
  const emptyState = document.getElementById('exercise-empty-state');
  const summaryElement = document.getElementById('exercise-total-summary');

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
        running: '러닝', walking: '걷기 / 산책', cycling: '자전거',
        swimming: '수영', strength: '웨이트', yoga: '요가 / 필라테스',
        custom: item.customName || '기타'
      };

      const iconMap = {
        running: 'flame', walking: 'footprints', cycling: 'bike',
        swimming: 'waves', strength: 'dumbbell', yoga: 'heart', custom: 'activity'
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

  selectType.addEventListener('change', () => {
    if (selectType.value === 'custom') {
      groupCustomName.style.display = 'block';
      customNameInput.required = true;
      caloriesInput.placeholder = '직접 입력';
    } else {
      groupCustomName.style.display = 'none';
      customNameInput.required = false;
      caloriesInput.placeholder = '자동 계산';
      recalculateCaloriesEstimate();
    }
  });

  durationInput.addEventListener('input', recalculateCaloriesEstimate);

  function recalculateCaloriesEstimate() {
    const type = selectType.value;
    const mins = parseFloat(durationInput.value);

    if (type !== 'custom' && !isNaN(mins) && mins > 0) {
      const ratio = EXERCISE_METS[type] || 0;
      caloriesInput.value = Math.round(mins * ratio);
    }
  }

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
    
    form.reset();
    groupCustomName.style.display = 'none';
    customNameInput.required = false;
    caloriesInput.placeholder = '자동 계산';

    await loadCurrentDateData();
    await refreshCharts();
  });
}

// ==========================================================================
// 8. WEIGHT TRACKER
// ==========================================================================

function updateWeightTabUI() {
  const log = state.currentLog;

  document.getElementById('weight-input').value = log.weight || '';

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

  const tbody = document.getElementById('weight-history-tbody');
  tbody.innerHTML = '';

  const sortedHistory = [...loggedWeights].reverse();

  if (sortedHistory.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center text-muted py-4">등록된 몸무게 기록이 없습니다.</td>
      </tr>
    `;
  } else {
    sortedHistory.forEach((item) => {
      const tr = document.createElement('tr');

      const date = new Date(item.date);
      const formattedDate = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;

      let diffHtml = '<span class="text-muted">-</span>';
      
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
// 9. DIARY NOTE & CONDITION MANAGER
// ==========================================================================

function updateDiaryTabForms() {
  const log = state.currentLog;

  const conditionRadios = document.getElementsByName('condition');
  conditionRadios.forEach(radio => {
    if (radio.value === log.condition) {
      radio.checked = true;
    }
  });

  document.getElementById('sleep-hours-val').textContent = log.sleep.toFixed(1);
  document.getElementById('sleep-range').value = log.sleep;

  document.getElementById('diary-water-display').textContent = log.water;

  document.getElementById('diary-note-textarea').value = log.diaryNote || '';
}

function setupDiaryListeners() {
  const sleepRange = document.getElementById('sleep-range');
  const sleepVal = document.getElementById('sleep-hours-val');

  sleepRange.addEventListener('input', (e) => {
    sleepVal.textContent = parseFloat(e.target.value).toFixed(1);
  });

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

  const form = document.getElementById('form-diary');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

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
// 10. CHART.JS VISUALIZATIONS
// ==========================================================================

let activeWeightFilterRange = 7;

async function refreshCharts() {
  setTimeout(async () => {
    await renderWeightCharts();
    await renderCalorieComparisonChart();
  }, 50);
}

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
  
  const maxDate = new Date(state.currentDate);
  const minDate = new Date(state.currentDate);
  minDate.setDate(minDate.getDate() - activeWeightFilterRange + 1);

  const minDateStr = minDate.toISOString().split('T')[0];
  const maxDateStr = maxDate.toISOString().split('T')[0];

  const filteredLogs = loggedWeights.filter(l => l.date >= minDateStr && l.date <= maxDateStr);

  const finalLogsForChart = filteredLogs.length > 0 
    ? filteredLogs 
    : loggedWeights.slice(-activeWeightFilterRange);

  const chartLabels = finalLogsForChart.map(l => {
    const d = new Date(l.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const chartData = finalLogsForChart.map(l => l.weight);

  const gridColor = '#EAE3DA';
  const labelColor = '#8E7E7C';

  const ctxDash = document.getElementById('weightDashboardChart').getContext('2d');
  if (state.charts.dashboardWeight) {
    state.charts.dashboardWeight.destroy();
  }

  const gradient = ctxDash.createLinearGradient(0, 0, 0, 220);
  gradient.addColorStop(0, 'rgba(224, 173, 149, 0.3)');
  gradient.addColorStop(1, 'rgba(224, 173, 149, 0.0)');

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
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 5,
        tension: 0.3,
        fill: true,
        backgroundColor: gradient
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: labelColor, font: { size: 10 } } },
        y: {
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { size: 10 } },
          suggestedMin: chartData.length > 0 ? Math.min(...chartData) - 1 : 40,
          suggestedMax: chartData.length > 0 ? Math.max(...chartData) + 1 : 90
        }
      }
    }
  });

  const ctxDetail = document.getElementById('weightDetailChart').getContext('2d');
  if (state.charts.detailWeight) {
    state.charts.detailWeight.destroy();
  }

  const gradientDetail = ctxDetail.createLinearGradient(0, 0, 0, 300);
  gradientDetail.addColorStop(0, 'rgba(224, 173, 149, 0.35)');
  gradientDetail.addColorStop(1, 'rgba(224, 173, 149, 0.02)');

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
        pointBorderColor: '#ffffff',
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
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: labelColor, font: { size: 11 } } },
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
    const intake = (log.meals.breakfast.cal || 0) + (log.meals.lunch.cal || 0) + (log.meals.snack.cal || 0) + (log.meals.dinner.cal || 0);
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
          backgroundColor: 'rgba(143, 168, 155, 0.85)',
          borderColor: 'var(--primary)',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: '소모 칼로리 (kcal)',
          data: burnData,
          backgroundColor: 'rgba(214, 159, 155, 0.85)',
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
          labels: { color: '#4A3E3D', font: { family: 'Outfit, Noto Sans KR', size: 10, weight: 'bold' } }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#8E7E7C', font: { size: 10 } } },
        y: { grid: { color: '#EAE3DA' }, ticks: { color: '#8E7E7C', font: { size: 10 } } }
      }
    }
  });
}

// ==========================================================================
// 11. DEMO DATA GENERATOR
// ==========================================================================

function setupDemoDataListener() {
  const btnDemo = document.getElementById('btn-demo-data');
  btnDemo.addEventListener('click', async () => {
    if (confirm('최근 7일간의 데모 데이터를 생성하시겠습니까?')) {
      await generateMockData();
      await loadCurrentDateData();
      await refreshCharts();
      alert('데모 데이터가 생성되었습니다!');
    }
  });
}

async function generateMockData() {
  const today = new Date();
  let startingWeight = 54.5;

  const breakfastOptions = [
    { desc: '바나나 1개, 플레인 요거트, 그래놀라 30g', cal: 320 },
    { desc: '사과 반 쪽, 호밀빵 1조각', cal: 280 },
    { desc: '고구마 1개, 삶은 계란 2개', cal: 340 }
  ];

  const lunchOptions = [
    { desc: '닭가슴살 현미 볶음밥', cal: 480 },
    { desc: '소고기 안심 구이 120g, 잡곡밥', cal: 520 },
    { desc: '연어 스테이크 150g, 샐러드', cal: 490 }
  ];

  const dinnerOptions = [
    { desc: '연두부 샐러드, 파프리카', cal: 290 },
    { desc: '그릭 요거트 100g, 블루베리', cal: 240 },
    { desc: '단호박 수프, 리코타 치즈 샐러드', cal: 310 }
  ];

  const diaryNotes = [
    '스쿼트 자극이 잘 들어왔고 야식 참기 성공!',
    '오후 런닝 후 상쾌함 대박!',
    '몸무게가 줄기 시작했다. 컨디션 굿!',
    '식단 칼같이 지킨 하루.',
    '체중 감량을 위해 물 많이 마심.',
    '산책 코스로 만보 걷기 완료.',
    '가벼운 요가로 몸을 풀었다.'
  ];

  const conditions = ['excellent', 'good', 'neutral', 'neutral-tired', 'stressed'];

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    await deleteLogFromDB(dateStr);
  }

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    startingWeight -= (Math.random() * 0.2) - 0.05;

    const log = createEmptyLog(dateStr);
    log.weight = parseFloat(startingWeight.toFixed(1));
    log.water = Math.floor(Math.random() * 4) + 5;
    log.sleep = parseFloat((Math.random() * 3 + 6).toFixed(1));
    log.diaryNote = diaryNotes[i % diaryNotes.length];
    log.condition = conditions[i % conditions.length];

    log.meals.breakfast = breakfastOptions[i % breakfastOptions.length];
    log.meals.lunch = lunchOptions[i % lunchOptions.length];
    log.meals.dinner = dinnerOptions[i % dinnerOptions.length];

    if (i % 2 === 0) {
      log.exercises.push({ id: Date.now() + i, type: 'running', customName: '', duration: 30, calories: 250 });
    } else {
      log.exercises.push({ id: Date.now() + i, type: 'yoga', customName: '', duration: 40, calories: 150 });
    }

    await saveLogToDB(log);
  }
}