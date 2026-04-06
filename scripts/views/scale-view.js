(function(window) {

  const SECTIONS = [
    { id: 'ads',     label: 'Ads' },
    { id: 'funnel',  label: 'Funnel' },
    { id: 'setting', label: 'Setting' },
    { id: 'closing', label: 'Closing' },
  ];

  // Default section when navigating to Scale IT
  let activeSection = 'ads';

  // Whether the Ads section is showing cards or the audit table
  let adsMode = 'cards'; // 'cards' | 'audit'

  // ── Content definitions per section ──────────────────────────────────────

  const CONTENT = {

    ads: {
      title: 'Ads optimieren',
      subtitle: 'Verbessere deine Paid-Traffic Performance und senke deinen CPL.',
      cards: [
        {
          icon: '📊',
          title: 'Ads Audit',
          desc: 'Welche Ads bringen die meisten Calls, Sales & ROAS? Ad-Level Auswertung auf einen Blick.',
          badge: { label: 'Aktiv', type: 'active' },
          action: 'audit',
        },
        {
          icon: '💰',
          title: 'CPL-Ziel setzen',
          desc: 'Definiere deinen maximalen Cost-per-Lead basierend auf Closing-Rate & Ticket.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🎯',
          title: 'Hook-Rate analysieren',
          desc: 'Welche Ads stoppen den Scroll? Hook-Rate unter 30% = Creative austauschen.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🔄',
          title: 'Creative Rotation',
          desc: 'Erkenne wann ein Creative ermüdet und wechsle rechtzeitig zu neuen Varianten.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🌍',
          title: 'Zielgruppen-Analyse',
          desc: 'Welche Audiences konvertieren am besten? Alter, Standort, Interessen auswerten.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '📅',
          title: 'Best-Time Analyse',
          desc: 'Zu welchen Uhrzeiten und Wochentagen performt dein Budget am besten?',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
      ],
    },

    funnel: {
      title: 'Funnel optimieren',
      subtitle: 'Erhöhe deine Opt-in-Rate, Survey-Rate und Booking-Rate.',
      cards: [
        {
          icon: '📈',
          title: 'Opt-in Rate verbessern',
          desc: 'A/B-Testing für Landing Pages, Headlines und Opt-in-Formulare.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🎬',
          title: 'VSL-Performance',
          desc: 'Wie viele Besucher schauen den VSL bis zum Ende? Drop-off-Punkte identifizieren.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '📝',
          title: 'Survey-Completion',
          desc: 'Wo brechen Leads im Survey ab? Fragen optimieren für höhere Abschlussrate.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '📆',
          title: 'Booking-Rate steigern',
          desc: 'Von Survey zu gebuchtem Termin: Welche Schritte verhindern die Buchung?',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '⚡',
          title: 'Funnel-Geschwindigkeit',
          desc: 'Wie lange dauert es vom ersten Klick bis zum gebuchten Call? Zeit reduzieren.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🔁',
          title: 'Re-Targeting',
          desc: 'Leads die nicht gebucht haben automatisch mit passenden Ads re-targeten.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
      ],
    },

    setting: {
      title: 'Setting optimieren',
      subtitle: 'Verbessere Show-up-Rate, Qualifikationsrate und Setter-Performance.',
      cards: [
        {
          icon: '📞',
          title: 'Show-up Rate steigern',
          desc: 'Reminder-Sequenzen, Vorqualifikation und No-Show-Analyse für mehr Show-ups.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🏆',
          title: 'Setter Performance',
          desc: 'Wer von deinen Settern hat die beste Qualifikationsrate? KPIs pro Setter.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🗣️',
          title: 'Call-Analyse',
          desc: 'Welche Einwände tauchen im Setting am häufigsten auf? Skript optimieren.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '⏱️',
          title: 'Speed-to-Lead',
          desc: 'Wie schnell werden neue Leads kontaktiert? Jede Stunde Delay kostet Abschlüsse.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '📋',
          title: 'Qualifikations-Score',
          desc: 'Welche Lead-Eigenschaften sagen am besten vorher, ob jemand bucht und kauft?',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🔔',
          title: 'No-Show Follow-up',
          desc: 'Automatisches Follow-up für gebuchte aber nicht erschienene Leads.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
      ],
    },

    closing: {
      title: 'Closing optimieren',
      subtitle: 'Erhöhe deine Closing-Rate und deinen durchschnittlichen Deal-Wert.',
      cards: [
        {
          icon: '💼',
          title: 'Closer Performance',
          desc: 'Closing-Rate, Revenue und Cash-in pro Closer. Wer ist dein Top-Performer?',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🎯',
          title: 'Einwand-Analyse',
          desc: 'Welche Einwände führen am häufigsten zu verlorenen Deals? Skript anpassen.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '💳',
          title: 'Payment Plan Optimierung',
          desc: 'Wie viele Deals laufen über Raten? Cashflow vs. Closing-Rate abwägen.',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '📊',
          title: 'Deal-Wert steigern',
          desc: 'Upsells, Premium-Pakete und Add-ons: Wie erhöhst du den durchschnittlichen Ticket?',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '🔂',
          title: '2-Call-Close Analyse',
          desc: 'Wie viele Leads brauchen einen zweiten Call? Wo liegt die Abbruchrate?',
          badge: { label: 'Bald verfügbar', type: 'soon' },
        },
        {
          icon: '📞',
          title: 'Call-Recording Insights',
          desc: 'KI-Analyse deiner Closing-Calls: Gesprächsanteil, Fragetechnik, Pace.',
          badge: { label: 'Phase 3', type: 'soon' },
        },
      ],
    },

  };

  // ── Render ────────────────────────────────────────────────────────────────

  function renderBadge(badge) {
    if (!badge) return '';
    return `<span class="scale-card-badge badge-${badge.type}">${badge.label}</span>`;
  }

  function renderCards(cards) {
    return cards.map(card => {
      const actionAttr = card.action ? `data-action="${card.action}" style="cursor:pointer;"` : '';
      const activeClass = card.action ? ' scale-card--actionable' : '';
      return `
        <div class="scale-card${activeClass}" ${actionAttr}>
          <div class="scale-card-icon">${card.icon}</div>
          <p class="scale-card-title">${card.title}</p>
          <p class="scale-card-desc">${card.desc}</p>
          ${renderBadge(card.badge)}
          ${card.action ? '<p class="scale-card-cta">Öffnen →</p>' : ''}
        </div>
      `;
    }).join('');
  }

  function renderSubnav(currentSection) {
    return SECTIONS.map(s => `
      <button
        class="scale-subnav-btn${s.id === currentSection ? ' active' : ''}"
        data-section="${s.id}"
      >${s.label}</button>
    `).join('');
  }

  function renderAdsContent() {
    if (adsMode === 'audit') {
      return `
        <div class="scale-section active" data-section="ads">
          <button class="scale-back-btn" id="adsAuditBack">← Zurück zur Übersicht</button>
          <div id="adsAuditSection"></div>
        </div>
      `;
    }
    const data = CONTENT['ads'];
    return `
      <div class="scale-section active" data-section="ads">
        <p class="scale-section-title">${data.title}</p>
        <p class="scale-section-subtitle">${data.subtitle}</p>
        <div class="scale-cards" id="adsCards">
          ${renderCards(data.cards)}
        </div>
      </div>
    `;
  }

  function renderSections(currentSection) {
    return SECTIONS.map(s => {
      if (s.id === 'ads') {
        const isActive = currentSection === 'ads';
        if (!isActive) return `<div class="scale-section" data-section="ads"></div>`;
        return renderAdsContent();
      }
      const data = CONTENT[s.id];
      const isActive = s.id === currentSection;
      return `
        <div class="scale-section${isActive ? ' active' : ''}" data-section="${s.id}">
          <p class="scale-section-title">${data.title}</p>
          <p class="scale-section-subtitle">${data.subtitle}</p>
          <div class="scale-cards">
            ${renderCards(data.cards)}
          </div>
        </div>
      `;
    }).join('');
  }

  function attachAdsListeners(container, topContainer) {
    const adsCards = document.getElementById('adsCards');
    if (!adsCards) return;
    adsCards.addEventListener('click', e => {
      const card = e.target.closest('[data-action="audit"]');
      if (!card) return;
      // Hand the full top-level container to AdsAuditAPI so it goes full-width
      if (window.AdsAuditAPI) {
        window.AdsAuditAPI.render(topContainer);
      }
    });
  }

  function render(section, container) {
    if (section) activeSection = section;
    // Reset ads mode when re-rendering the whole view
    adsMode = 'cards';

    if (!container) container = document.getElementById('app');
    if (!container) return;

    container.innerHTML = `
      <div class="scale-view">
        <div class="scale-header">
          <h1>Scale It</h1>
          <p>Optimierungen und Hebel, um deinen Funnel auf das nächste Level zu bringen.</p>
        </div>

        <nav class="scale-subnav" id="scaleSubnav">
          ${renderSubnav(activeSection)}
        </nav>

        ${renderSections(activeSection)}
      </div>
    `;

    attachAdsListeners(container, container);

    // Sub-navigation click handler
    const subnav = document.getElementById('scaleSubnav');
    if (subnav) {
      subnav.addEventListener('click', e => {
        const btn = e.target.closest('.scale-subnav-btn');
        if (!btn) return;

        const section = btn.dataset.section;
        if (section === activeSection) return;

        activeSection = section;
        adsMode = 'cards';

        // Update active button
        subnav.querySelectorAll('.scale-subnav-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.section === section);
        });

        // Re-render section content
        container.querySelectorAll('.scale-section').forEach(el => {
          const isTarget = el.dataset.section === section;
          el.classList.toggle('active', isTarget);
          if (isTarget && section === 'ads') {
            const data = CONTENT['ads'];
            el.innerHTML = `
              <p class="scale-section-title">${data.title}</p>
              <p class="scale-section-subtitle">${data.subtitle}</p>
              <div class="scale-cards" id="adsCards">
                ${renderCards(data.cards)}
              </div>
            `;
            attachAdsListeners(container, container);
          }
        });
      });
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.ScaleView = {
    render,
    getActiveSection: () => activeSection,
  };

})(window);
