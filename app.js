const toggleBtn = document.getElementById('toggleBtn');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const navItems = document.querySelectorAll('.nav-item');

// 사이드바 열기/닫기 토글
function toggleSidebar() {
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

// 사이드바 닫기
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

// 햄버거 버튼 클릭 이벤트
toggleBtn.addEventListener('click', toggleSidebar);

// 어두운 배경 클릭 시 사이드바 닫기
overlay.addEventListener('click', closeSidebar);

// 모바일 환경에서 메뉴 항목 클릭 시 자동으로 메뉴창 닫기
navItems.forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  });
});