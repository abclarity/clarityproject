// scripts/auth.js - Authentication Module
(function(window) {
  'use strict';

  const AuthAPI = {
    currentUser: null,
    
    async init() {
      console.log('🔐 Initializing Auth...');
      
      // Check for existing session
      const { data: { session }, error } = await window.SupabaseClient.auth.getSession();
      
      if (error) {
        console.error('❌ Error getting session:', error);
        this.showAuthScreen();
        return;
      }

      if (session) {
        this.currentUser = session.user;
        console.log('✅ User logged in:', this.currentUser.email);
        this.showApp();
      } else {
        this.showAuthScreen();
      }

      // Listen for auth state changes
      window.SupabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('🔄 Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        if (event === 'SIGNED_IN' && session) {
          this.currentUser = session.user;
          this.showApp();
        } else if (event === 'SIGNED_OUT') {
          this.currentUser = null;
          this.showAuthScreen();
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token was refreshed successfully
          this.currentUser = session.user;
          console.log('✅ Token refreshed successfully');
        } else if (event === 'USER_UPDATED' && session) {
          this.currentUser = session.user;
        } else if (!session && event !== 'INITIAL_SESSION') {
          // Session lost unexpectedly (timeout, network error, etc.)
          console.warn('⚠️ Session lost, showing auth screen');
          this.currentUser = null;
          this.showAuthScreen();
        }
      });
    },

    showAuthScreen() {
      console.log('🔒 Showing auth screen, hiding app...');
      
      // Hide main app
      document.getElementById('app-header')?.classList.add('hidden');
      document.getElementById('app')?.classList.add('hidden');
      document.getElementById('tabs')?.classList.add('hidden');
      
      // Hide sidebar
      const sidebar = document.getElementById('funnelSidebar');
      if (sidebar) {
        sidebar.classList.add('hidden');
      }
      
      // Show auth screen
      let authContainer = document.getElementById('authContainer');
      if (!authContainer) {
        authContainer = document.createElement('div');
        authContainer.id = 'authContainer';
        authContainer.className = 'auth-container';
        document.body.insertBefore(authContainer, document.body.firstChild);
      }

      authContainer.innerHTML = `
        <div class="auth-card">
          <div class="auth-header">
            <h1>🎯 Clarity</h1>
            <p>Funnel Tracking für Marketing Analytics</p>
          </div>

          <div class="auth-tabs">
            <button class="auth-tab active" data-tab="login">Login</button>
            <button class="auth-tab" data-tab="signup">Registrieren</button>
          </div>

          <div id="loginTab" class="auth-tab-content active">
            <form id="loginForm">
              <div class="form-group">
                <label>E-Mail</label>
                <input type="email" id="loginEmail" required autocomplete="email" />
              </div>
              <div class="form-group">
                <label>Passwort</label>
                <input type="password" id="loginPassword" required autocomplete="current-password" />
              </div>
              <button type="submit" class="btn-primary btn-full">Anmelden</button>
            </form>
            <div class="auth-footer">
              <button id="forgotPasswordBtn" class="btn-link">Passwort vergessen?</button>
            </div>
          </div>

          <div id="signupTab" class="auth-tab-content">
            <form id="signupForm">
              <div class="form-group">
                <label>E-Mail</label>
                <input type="email" id="signupEmail" required autocomplete="email" />
              </div>
              <div class="form-group">
                <label>Passwort</label>
                <input type="password" id="signupPassword" required autocomplete="new-password" minlength="6" />
              </div>
              <div class="form-group">
                <label>Passwort bestätigen</label>
                <input type="password" id="signupPasswordConfirm" required autocomplete="new-password" minlength="6" />
              </div>
              <button type="submit" class="btn-primary btn-full">Account erstellen</button>
            </form>
          </div>
        </div>
      `;

      authContainer.classList.remove('hidden');

      // Attach event listeners
      this.attachAuthListeners();
    },

    attachAuthListeners() {
      // Tab switching
      document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
          const tabName = e.target.dataset.tab;
          
          document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.auth-tab-content').forEach(c => c.classList.remove('active'));
          
          e.target.classList.add('active');
          document.getElementById(`${tabName}Tab`).classList.add('active');
        });
      });

      // Login form
      const loginForm = document.getElementById('loginForm');
      if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleLogin();
        });
      }

      // Signup form
      const signupForm = document.getElementById('signupForm');
      if (signupForm) {
        signupForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.handleSignup();
        });
      }

      // Forgot password
      const forgotBtn = document.getElementById('forgotPasswordBtn');
      if (forgotBtn) {
        forgotBtn.addEventListener('click', () => {
          this.handleForgotPassword();
        });
      }
    },

    async handleLogin() {
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      if (!email || !password) {
        window.Toast?.error('Bitte E-Mail und Passwort eingeben');
        return;
      }

      window.Loading?.show('Anmeldung läuft...');

      const { data, error } = await window.SupabaseClient.auth.signInWithPassword({
        email,
        password
      });

      window.Loading?.hide();

      if (error) {
        console.error('❌ Login error:', error);
        if (error.message.includes('Invalid login credentials')) {
          window.Toast?.error('E-Mail oder Passwort falsch');
        } else {
          window.Toast?.error('Fehler beim Anmelden: ' + error.message);
        }
        return;
      }

      window.Toast?.success('Erfolgreich angemeldet!');
      this.currentUser = data.user;
      this.showApp();
    },

    async handleSignup() {
      const email = document.getElementById('signupEmail').value.trim();
      const password = document.getElementById('signupPassword').value;
      const passwordConfirm = document.getElementById('signupPasswordConfirm').value;

      if (!email || !password || !passwordConfirm) {
        window.Toast?.error('Bitte alle Felder ausfüllen');
        return;
      }

      if (password !== passwordConfirm) {
        window.Toast?.error('Passwörter stimmen nicht überein');
        return;
      }

      if (password.length < 6) {
        window.Toast?.error('Passwort muss mindestens 6 Zeichen lang sein');
        return;
      }

      window.Loading?.show('Account wird erstellt...');

      const { data, error } = await window.SupabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      window.Loading?.hide();

      if (error) {
        console.error('❌ Signup error:', error);
        if (error.message.includes('already registered')) {
          window.Toast?.error('Diese E-Mail ist bereits registriert');
        } else {
          window.Toast?.error('Fehler bei der Registrierung: ' + error.message);
        }
        return;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        window.Toast?.error('Diese E-Mail ist bereits registriert');
        return;
      }

      window.Toast?.success('Account erstellt! Bitte E-Mail bestätigen.');
      
      // Auto-switch to login tab
      document.querySelector('.auth-tab[data-tab="login"]').click();
      document.getElementById('loginEmail').value = email;
    },

    async handleForgotPassword() {
      const email = prompt('E-Mail-Adresse für Passwort-Reset eingeben:');
      
      if (!email) return;

      window.Loading?.show('E-Mail wird gesendet...');

      const { error } = await window.SupabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password'
      });

      window.Loading?.hide();

      if (error) {
        console.error('❌ Password reset error:', error);
        window.Toast?.error('Fehler beim Senden der E-Mail');
        return;
      }

      window.Toast?.success('Passwort-Reset E-Mail gesendet!');
    },

    showApp() {
      console.log('✅ Showing app, hiding auth screen...');
      
      // Hide auth screen
      const authContainer = document.getElementById('authContainer');
      if (authContainer) {
        authContainer.classList.add('hidden');
      }

      // Show main app
      document.getElementById('app-header')?.classList.remove('hidden');
      document.getElementById('app')?.classList.remove('hidden');
      document.getElementById('tabs')?.classList.remove('hidden');
      
      // Show sidebar
      const sidebar = document.getElementById('funnelSidebar');
      if (sidebar) {
        sidebar.classList.remove('hidden');
      }

      // Initialize app if not already done
      if (window.mainInit && !window.appInitialized) {
        window.appInitialized = true;
        window.mainInit();
      }
    },

    async logout() {
      const confirmed = confirm('Möchten Sie sich wirklich abmelden?');
      if (!confirmed) return;

      window.Loading?.show('Abmeldung läuft...');

      const { error } = await window.SupabaseClient.auth.signOut();

      window.Loading?.hide();

      if (error) {
        console.error('❌ Logout error:', error);
        window.Toast?.error('Fehler beim Abmelden');
        return;
      }

      window.Toast?.success('Erfolgreich abgemeldet');
      this.currentUser = null;
      
      // 🔥 WICHTIG: Cache leeren bei Logout (Sicherheit!)
      if (window.StorageAPI?.clearCache) {
        window.StorageAPI.clearCache();
      }
      if (window.FunnelAPI?.clearCache) {
        window.FunnelAPI.clearCache();
      }
      
      // localStorage leeren (außer Migration-Flag)
      const migrationFlag = localStorage.getItem('vsl_tracking_migrated');
      localStorage.clear();
      if (migrationFlag) {
        localStorage.setItem('vsl_tracking_migrated', migrationFlag);
      }
      
      this.showAuthScreen();
    },

    getUserId() {
      return this.currentUser?.id || null;
    },

    getUser() {
      return this.currentUser;
    },

    isAuthenticated() {
      return this.currentUser !== null;
    }
  };

  window.AuthAPI = AuthAPI;

})(window);
