// ==========================================================================
// 1. GLOBAL STATE & UTILITIES
// ==========================================================================

// 애플리케이션 상태 관리 객체
const state = {
  currentDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  logs: {} // 날짜별 데이터 저장소 { 'YYYY-MM-DD': { ... } }
};

// 날짜 포맷 함수 (YYYY-MM-DD -> YYYY년 MM월 DD일)
function formatDateKorean(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일`;
}

// 헤더의 날짜 표시 업데이트
function updateDateDisplayText(dateString) {
  const displayEl = document.getElementById('selected-date-display');
  if (displayEl) {
    displayEl.textContent = formatDateKorean(dateString);
  }
}

// ==========================================================================
// 2. STATE MANAGEMENT & INITIALIZATION
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  const datePicker = document.getElementById('date-picker');
  if (datePicker) {
    datePicker.value = state.currentDate;
  }
  updateDateDisplayText(state.currentDate);

  // Lucide 아이콘 초기화
  if (window.lucide) {
    lucide.createIcons();
  }

  await loadCurrentDateData();

  // 이벤트 리스너 등록
  setupNavigationListeners();
  setupSidebarToggle(); // 모바일 사이드바 토글
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

// 모바일 사이드바 토글 제어
function setupSidebarToggle() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  const openSidebar = () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('active');
  };

  const closeSidebar = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('active');
  };

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (sidebar?.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
}

// ==========================================================================
// 3. PAGE NAVIGATION ROUTING
// ==========================================================================

function setupNavigationListeners() {
  const navButtons = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('header-page-title');
  const pageSubtitle = document.getElementById('header-subtitle');
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');

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

      // 탭 활성화 변경
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // 본문 콘텐츠 전환
      tabContents.forEach(tc => {
        if (tc.id === `tab-${targetTab}`) {
          tc.classList.add('active');
        } else {
          tc.classList.remove('active');
        }
      });

      // 헤더 타이틀 및 서브타이틀 업데이트
      if (pageMeta[targetTab]) {
        if (pageTitle) pageTitle.textContent = pageMeta[targetTab].title;
        if (pageSubtitle) pageSubtitle.textContent = pageMeta[targetTab].subtitle;
      }

      // 모바일 환경일 경우 메뉴 클릭 시 사이드바 자동 닫힘
      if (window.innerWidth <= 768) {
        sidebar?.classList.remove('open');
        overlay?.classList.remove('active');
      }

      refreshCharts();
    });
  });
}

// ==========================================================================
// 4. DATE PICKER & DATA LOADING
// ==========================================================================

function setupDatePickerListeners() {
  const datePicker = document.getElementById('date-picker');
  if (!datePicker) return;

  datePicker.addEventListener('change', async (e) => {
    state.currentDate = e.target.value;
    updateDateDisplayText(state.currentDate);
    await loadCurrentDateData();
    refreshCharts();
  });
}

async function loadCurrentDateData() {
  // 현재 날짜 기준 데이터 불러오기 및 UI 동기화 로직
  // (필요 시 기존 프로젝트의 상세 렌더링 로직 유지)
}

function refreshCharts() {
  // 차트 리프레시 로직
}

// ==========================================================================
// 5. OTHER EVENT LISTENERS (DUMMY / PLACEHOLDERS)
// ==========================================================================

function setupCalendarListeners() {}
function setupQuickLogListeners() {}
function setupDietListeners() {}
function setupExerciseListeners() {}
function setupWeightListeners() {}
function setupDiaryListeners() {}
function setupDemoDataListener() {}