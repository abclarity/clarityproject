(function(window) {

  const SIDEBAR_STATE_KEY = 'clarity_sidebar_collapsed';

  const SidebarAPI = {
    init() {
      this.createSidebar();
      this.attachListeners();
      this.restoreState();
      
      // Periodic sidebar health check
      this.startHealthCheck();
    },
    
    startHealthCheck() {
      // Check every 10 seconds if sidebar is still in DOM
      setInterval(() => {
        const sidebar = document.getElementById('appSidebar');
        if (!sidebar) {
          console.error('🚨 SIDEBAR MISSING! Recreating...');
          console.trace();
          this.createSidebar();
          this.attachListeners();
          this.restoreState();
        }
      }, 10000);
    },

    createSidebar() {
      const existingSidebar = document.getElementById('appSidebar');
      if (existingSidebar) {
        console.log('⚠️ Sidebar already exists, removing old one...');
        existingSidebar.remove();
      }

      console.log('🔨 Creating new sidebar...');
      const sidebar = document.createElement('div');
      sidebar.id = 'appSidebar';
      sidebar.className = 'app-sidebar';
      
      // Add mutation observer to detect if sidebar gets removed
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.removedNodes.forEach((node) => {
              if (node.id === 'appSidebar') {
                console.error('🚨 SIDEBAR WAS REMOVED! Stack trace:');
                console.trace();
              }
            });
          }
        });
      });
      
      // Observe document.body for sidebar removal
      setTimeout(() => {
        const sidebarElement = document.getElementById('appSidebar');
        if (sidebarElement && sidebarElement.parentNode) {
          observer.observe(sidebarElement.parentNode, { childList: true });
          console.log('👀 Sidebar mutation observer attached');
        }
      }, 100);
      
      const userEmail = window.AuthAPI?.getUser()?.email || '';
      
      sidebar.innerHTML = `
        <div class="sidebar-header">
          <button id="sidebarToggle" class="sidebar-toggle" title="Navigation ein-/ausklappen">
            <span class="toggle-icon">☰</span>
          </button>
        </div>
        <nav class="sidebar-nav">
          <button class="sidebar-item" data-view="datapool">
            <span class="sidebar-icon">💾</span>
            <span class="sidebar-label">Datenpool</span>
          </button>
          <button class="sidebar-item active" data-view="trackingsheets">
            <span class="sidebar-icon">📊</span>
            <span class="sidebar-label">Trackingsheets</span>
          </button>
          <button class="sidebar-item sidebar-item--coming-soon" data-view="projections">
            <span class="sidebar-icon">🎯</span>
            <span class="sidebar-label">Projections</span>
          </button>
          <button class="sidebar-item" data-view="scaleit">
            <span class="sidebar-icon">🚀</span>
            <span class="sidebar-label">Scale it</span>
          </button>
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <span class="sidebar-user-email">${userEmail}</span>
          </div>
          <button id="sidebarLogoutBtn" class="sidebar-logout" title="Abmelden">
            <span class="sidebar-icon">🚪</span>
            <span class="sidebar-label">Abmelden</span>
          </button>
        </div>
      `;

      document.body.insertBefore(sidebar, document.body.firstChild);
    },

    attachListeners() {
      const toggleBtn = document.getElementById('sidebarToggle');
      const sidebar = document.getElementById('appSidebar');
      const navItems = document.querySelectorAll('.sidebar-item');
      const logoutBtn = document.getElementById('sidebarLogoutBtn');

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          const isCollapsed = sidebar.classList.toggle('collapsed');
          localStorage.setItem(SIDEBAR_STATE_KEY, isCollapsed ? 'true' : 'false');
        });
      }

      if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
          if (window.AuthAPI && window.AuthAPI.logout) {
            console.log('🔓 Logout - lösche Cache und localStorage');
            
            // 1. Lösche localStorage
            localStorage.clear();
            
            // 2. Logout bei Supabase
            await window.AuthAPI.logout();
            
            // 3. Seite neu laden für sauberen Zustand
            window.location.reload();
          }
        });
      }

      navItems.forEach(item => {
        item.addEventListener('click', () => {
          const view = item.dataset.view;
          this.switchView(view);

          navItems.forEach(nav => nav.classList.remove('active'));
          item.classList.add('active');
        });
      });
    },

    switchView(view) {
      console.log('🔄 Switching to view:', view);

      if (view === 'trackingsheets') {
        document.getElementById('app').style.display = 'block';
        document.getElementById('tabs').style.display = 'flex';
        document.getElementById('app-header').style.display = 'block';

        const comingSoonView = document.getElementById('comingSoonView');
        if (comingSoonView) comingSoonView.style.display = 'none';

        const datapoolView = document.getElementById('datapoolView');
        if (datapoolView) datapoolView.style.display = 'none';

        const scaleItView = document.getElementById('scaleItView');
        if (scaleItView) scaleItView.style.display = 'none';

        // 🔥 Force reload if Facebook sync just completed
        if (window._facebookSyncJustCompleted && window.activeMonth && window.switchToMonth) {
          console.log('🔄 Facebook sync detected - reloading active month:', window.activeMonth);
          window._facebookSyncJustCompleted = false;
          // Use setTimeout to ensure DOM is ready
          setTimeout(() => {
            window.switchToMonth(window.activeMonth.y, window.activeMonth.m);
          }, 10);
        }
      } else if (view === 'projections') {
        document.getElementById('app').style.display = 'none';
        document.getElementById('tabs').style.display = 'none';
        document.getElementById('app-header').style.display = 'none';
        const datapoolView = document.getElementById('datapoolView');
        if (datapoolView) datapoolView.style.display = 'none';
        const scaleItView = document.getElementById('scaleItView');
        if (scaleItView) scaleItView.style.display = 'none';

        let comingSoonView = document.getElementById('comingSoonView');
        if (!comingSoonView) {
          comingSoonView = document.createElement('div');
          comingSoonView.id = 'comingSoonView';
          document.body.appendChild(comingSoonView);
        }
        comingSoonView.style.display = 'flex';
        comingSoonView.innerHTML = `
          <div style="text-align:center;">
            <div style="font-size:64px; margin-bottom:24px;">🎯</div>
            <h2 style="font-size:28px; font-weight:700; color:#1a1a2e; margin-bottom:12px;">Projections</h2>
            <p style="font-size:16px; color:#6b7280;">Kommt bald.</p>
          </div>
        `;
      } else if (view === 'scaleit') {
        document.getElementById('app').style.display = 'none';
        document.getElementById('tabs').style.display = 'none';
        document.getElementById('app-header').style.display = 'none';
        const datapoolView = document.getElementById('datapoolView');
        if (datapoolView) datapoolView.style.display = 'none';
        const comingSoonView = document.getElementById('comingSoonView');
        if (comingSoonView) comingSoonView.style.display = 'none';

        let scaleItView = document.getElementById('scaleItView');
        if (!scaleItView) {
          scaleItView = document.createElement('div');
          scaleItView.id = 'scaleItView';
          scaleItView.className = 'scaleit-view';
          document.body.appendChild(scaleItView);
        }
        scaleItView.style.display = 'block';

        if (window.ScaleView) {
          window.ScaleView.render(null, scaleItView);
        }
      } else if (view === 'datapool') {
        document.getElementById('app').style.display = 'none';
        document.getElementById('tabs').style.display = 'none';
        document.getElementById('app-header').style.display = 'none';

        const comingSoonView = document.getElementById('comingSoonView');
        if (comingSoonView) comingSoonView.style.display = 'none';

        const scaleItView = document.getElementById('scaleItView');
        if (scaleItView) scaleItView.style.display = 'none';

        let datapoolView = document.getElementById('datapoolView');
        if (!datapoolView) {
          datapoolView = document.createElement('div');
          datapoolView.id = 'datapoolView';
          datapoolView.className = 'datapool-view';
          document.body.appendChild(datapoolView);
        } else {
          datapoolView.style.display = 'block';
        }

        // 🔥 ALWAYS reinitialize DataPool when switching to it
        if (window.DataPool && window.DataPool.init) {
          console.log('🔧 Initializing DataPool...');
          
          // Check if Supabase is loaded
          if (!window.SupabaseClient) {
            console.error('❌ Supabase Client not loaded!');
            datapoolView.innerHTML = '<div style="padding: 40px; text-align: center;"><h2>❌ Fehler</h2><p>Supabase Client nicht geladen. Bitte Seite neu laden.</p></div>';
            return;
          }
          
          window.DataPool.init().catch(err => {
            console.error('❌ DataPool initialization error:', err);
            datapoolView.innerHTML = '<div style="padding: 40px; text-align: center;"><h2>❌ Fehler</h2><p>Fehler beim Laden des Datenpools: ' + err.message + '</p></div>';
          });
        } else {
          console.error('❌ DataPool API not loaded!');
          datapoolView.innerHTML = '<div style="padding: 40px; text-align: center;"><h2>❌ Fehler</h2><p>DataPool API nicht geladen. Bitte Seite neu laden.</p></div>';
        }
      }
    },

    restoreState() {
      const sidebar = document.getElementById('appSidebar');
      const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === 'true';

      if (isCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
      }

      // Detect which view is actually visible and update sidebar accordingly
      this.detectActiveView();
    },

    detectActiveView() {
      const app = document.getElementById('app');
      const datapoolView = document.getElementById('datapoolView');
      const navItems = document.querySelectorAll('.sidebar-item');

      // Check which view is visible
      const isTrackingsheetsVisible = app && app.style.display !== 'none';
      const isDatapoolVisible = datapoolView && datapoolView.style.display !== 'none';

      // Update sidebar active state
      navItems.forEach(item => {
        const view = item.dataset.view;
        if (view === 'trackingsheets' && isTrackingsheetsVisible) {
          item.classList.add('active');
        } else if (view === 'datapool' && isDatapoolVisible) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    }
  };

  window.SidebarAPI = SidebarAPI;

})(window);
