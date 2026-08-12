(function () {
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    if (a.getAttribute('href') === window.location.pathname) a.classList.add('active');
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await fetch('/api/logout', { method: 'POST' }); } catch {}
      window.location.href = '/employee-login.html';
    });
  }

  (async () => {
    try {
      const res = await fetch('/api/session');
      if (!res.ok) { window.location.href = '/employee-login.html'; return; }
      const data = await res.json();
      if (data.mustChangePassword) { window.location.href = '/change-password.html'; return; }

      const usernameEl = document.getElementById('sidebarUsername');
      if (usernameEl) usernameEl.textContent = data.username + (data.isAdmin ? ' (admin)' : '');

      const adminLink = document.getElementById('navUserMgmt');
      if (adminLink) adminLink.style.display = data.isAdmin ? 'flex' : 'none';

      const mailLink = document.getElementById('navMail');
      if (mailLink) mailLink.style.display = data.isAdmin ? 'flex' : 'none';

      window.pfpSession = data;
      document.dispatchEvent(new CustomEvent('pfp-session-ready', { detail: data }));
    } catch {
      window.location.href = '/employee-login.html';
    }
  })();
})();
