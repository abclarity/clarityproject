// scripts/wizard.js
// Funnel Wizard - Step-by-Step Builder

(function(window) {
  'use strict';

  let wizardState = {
    traffic: null,
    coldcallsFlow: null,
    hasVsl: null,
    noVslNext: null,
    optin: null,
    afterVsl: null,
    surveyQuali: null,
    closeType: null,
    name: '',
    color: '#9146ff'
  };

  let currentStep = 1;
  let isInitialized = false;

  // === Init Wizard ===
  function initWizard() {
    if (isInitialized) {
      console.log('🧙 Wizard bereits initialisiert');
      return;
    }

    console.log('🧙 Wizard initialisiert');

    setupToggle();
    setupNavigation();
    setupColorPicker();
    setupRadioListeners();

    isInitialized = true;
  }

  // === Toggle: Wizard ⇄ Presets ===
  function setupToggle() {
    const wizardBtn = document.getElementById('wizardModeBtn');
    const presetBtn = document.getElementById('presetModeBtn');
    const wizardMode = document.getElementById('wizardMode');
    const presetMode = document.getElementById('presetMode');

    if (!wizardBtn || !presetBtn || !wizardMode || !presetMode) return;

    wizardBtn.addEventListener('click', () => {
      wizardBtn.classList.add('active');
      presetBtn.classList.remove('active');
      wizardMode.classList.remove('hidden');
      wizardMode.style.display = 'block';
      presetMode.classList.add('hidden');
      presetMode.style.display = 'none';
      resetWizard();
    });

    presetBtn.addEventListener('click', () => {
      presetBtn.classList.add('active');
      wizardBtn.classList.remove('active');
      presetMode.classList.remove('hidden');
      presetMode.style.display = 'block';
      wizardMode.classList.add('hidden');
      wizardMode.style.display = 'none';
    });
  }

  function setupNavigation() {
    const nextBtn = document.getElementById('wizardNext');
    const backBtn = document.getElementById('wizardBack');
    const createBtn = document.getElementById('wizardCreate');
    const cancelBtn = document.getElementById('wizardCancel');  // 🔥 NEU

    if (!nextBtn || !backBtn || !createBtn) return;

    nextBtn.addEventListener('click', () => {
      if (validateCurrentStep()) {
        saveCurrentStep();
        goToNextStep();
      }
    });

    backBtn.addEventListener('click', () => {
      goToPreviousStep();
    });

    createBtn.addEventListener('click', () => {
      createFunnelFromWizard();
    });

    // 🔥 NEU: Abbrechen-Button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        const modal = document.getElementById('funnelModal');
        if (modal) {
          modal.classList.add('hidden');
        }
        resetWizard();
      });
    }
  }

  // === Color Picker ===
  function setupColorPicker() {
    const colorPicker = document.getElementById('wizardColorPicker');
    if (!colorPicker) return;

    const colorOptions = colorPicker.querySelectorAll('.color-option');

    colorOptions.forEach(option => {
      option.addEventListener('click', () => {
        colorOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        wizardState.color = option.dataset.color;
      });
    });
  }

  // === Radio Listeners ===
  function setupRadioListeners() {
    const wizardContainer = document.getElementById('wizardMode');
    if (!wizardContainer) return;

    const allRadios = wizardContainer.querySelectorAll('input[type="radio"]');

    allRadios.forEach(radio => {
      radio.addEventListener('change', () => {
        enableNextButton();
      });
    });

    // Name Input
    const nameInput = document.getElementById('wizardFunnelName');
    if (nameInput) {
      nameInput.addEventListener('input', () => {
        enableNextButton();
      });
    }
  }

  // === Validate Current Step ===
  function validateCurrentStep() {
    const step = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
    if (!step) return false;

    if (currentStep === 6) {
      const nameInput = document.getElementById('wizardFunnelName');
      return nameInput && nameInput.value.trim() !== '';
    }

    const radio = step.querySelector('input[type="radio"]:checked');
    return radio !== null;
  }

  // === Enable Next Button ===
  function enableNextButton() {
    const nextBtn = document.getElementById('wizardNext');
    if (nextBtn) {
      nextBtn.disabled = !validateCurrentStep();
    }
  }

  // === Save Current Step ===
  function saveCurrentStep() {
    const step = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
    if (!step) return;

    const radio = step.querySelector('input[type="radio"]:checked');

    if (currentStep === 1 && radio) {
      wizardState.traffic = radio.value;
    } else if (currentStep === '1b' && radio) {
      wizardState.coldcallsFlow = radio.value;
    } else if (currentStep === 2 && radio) {
      wizardState.hasVsl = radio.value;
    } else if (currentStep === '2b' && radio) {
      wizardState.noVslNext = radio.value;
    } else if (currentStep === 3 && radio) {
      wizardState.optin = radio.value;
    } else if (currentStep === '3b' && radio) {
      wizardState.afterVsl = radio.value;
    } else if (currentStep === 4 && radio) {
      wizardState.surveyQuali = radio.value;
    } else if (currentStep === 5 && radio) {
      wizardState.closeType = radio.value;
    } else if (currentStep === 6) {
      const nameInput = document.getElementById('wizardFunnelName');
      if (nameInput) {
        wizardState.name = nameInput.value.trim();
      }
    }

    console.log('💾 Wizard State:', wizardState);
  }

  // === Go To Next Step ===
  function goToNextStep() {
    let nextStep = null;

    if (currentStep === 1) {
      if (wizardState.traffic === 'cold-calls') {
        nextStep = '1b';
      } else {
        nextStep = 2;
      }
    } else if (currentStep === '1b') {
      if (wizardState.coldcallsFlow === 'direct') {
        nextStep = 5;
      } else {
        nextStep = 2;
      }
    } else if (currentStep === 2) {
      if (wizardState.hasVsl === 'yes') {
        nextStep = 3;
      } else {
        nextStep = '2b';
      }
    } else if (currentStep === '2b') {
      if (wizardState.noVslNext === 'survey') {
        nextStep = 4;
      } else {
        nextStep = 5;
      }
    } else if (currentStep === 3) {
      nextStep = '3b';
    } else if (currentStep === '3b') {
      if (wizardState.afterVsl === 'survey') {
        nextStep = 4;
      } else {
        nextStep = 5;
      }
    } else if (currentStep === 4) {
      nextStep = 5;
    } else if (currentStep === 5) {
      nextStep = 6;
      generateFunnelName();
    } else if (currentStep === 6) {
      nextStep = 7;
      buildSummary();
    }

    if (nextStep) {
      showStep(nextStep);
    }
  }

  // === Go To Previous Step ===
  function goToPreviousStep() {
    let prevStep = null;

    if (currentStep === 7) {
      prevStep = 6;
    } else if (currentStep === 6) {
      prevStep = 5;
    } else if (currentStep === 5) {
      if (wizardState.afterVsl === 'booking' || wizardState.noVslNext === 'booking' || wizardState.coldcallsFlow === 'direct') {
        if (wizardState.coldcallsFlow === 'direct') {
          prevStep = '1b';
        } else if (wizardState.hasVsl === 'yes') {
          prevStep = '3b';
        } else if (wizardState.hasVsl === 'no') {
          prevStep = '2b';
        }
      } else {
        prevStep = 4;
      }
    } else if (currentStep === 4) {
      if (wizardState.afterVsl === 'survey') {
        prevStep = '3b';
      } else if (wizardState.noVslNext === 'survey') {
        prevStep = '2b';
      }
    } else if (currentStep === '3b') {
      prevStep = 3;
    } else if (currentStep === 3) {
      prevStep = 2;
    } else if (currentStep === '2b') {
      prevStep = 2;
    } else if (currentStep === 2) {
      if (wizardState.traffic === 'cold-calls') {
        prevStep = '1b';
      } else {
        prevStep = 1;
      }
    } else if (currentStep === '1b') {
      prevStep = 1;
    }

    if (prevStep) {
      showStep(prevStep);
    }
  }

  // === Show Step ===
  function showStep(step) {
    document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));

    const targetStep = document.querySelector(`.wizard-step[data-step="${step}"]`);
    if (targetStep) {
      targetStep.classList.add('active');
      currentStep = step;
    }

    updateProgressDots();
    updateNavButtons();
    enableNextButton();
  }

  // === Update Progress Dots ===
  function updateProgressDots() {
    const progressContainer = document.getElementById('wizardProgress');
    if (!progressContainer) return;

    const dots = progressContainer.querySelectorAll('.dot');
    const stepMap = {
      1: 0,
      '1b': 1,
      2: 1,
      '2b': 2,
      3: 2,
      '3b': 3,
      4: 3,
      5: 4,
      6: 5,
      7: 6
    };

    const activeIndex = stepMap[currentStep] || 0;

    dots.forEach((dot, i) => {
      if (i <= activeIndex) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });
  }

  // === Update Nav Buttons ===
  function updateNavButtons() {
    const nextBtn = document.getElementById('wizardNext');
    const backBtn = document.getElementById('wizardBack');
    const createBtn = document.getElementById('wizardCreate');

    if (!nextBtn || !backBtn || !createBtn) return;

    if (currentStep === 7) {
      nextBtn.style.display = 'none';
      createBtn.style.display = 'block';
    } else {
      nextBtn.style.display = 'block';
      createBtn.style.display = 'none';
    }

    if (currentStep === 1) {
      backBtn.style.display = 'none';
    } else {
      backBtn.style.display = 'block';
    }
  }

  function generateFunnelName() {
  const parts = [];

  // 1️⃣ Traffic
  const trafficMap = {
    'paid-ads': 'Paid Ads',
    'organic': 'Organic',
    'cold-email': 'Cold Email',
    'cold-calls': 'Cold Calls'
  };
  parts.push(trafficMap[wizardState.traffic]);

  // 2️⃣ Funnel Type
  let funnelType = '';

  if (wizardState.coldcallsFlow === 'direct') {
    funnelType = 'Direct';
  } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'yes') {
    funnelType = 'Classic VSL';
  } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'no') {
    funnelType = 'Direct VSL';
  } else if (wizardState.hasVsl === 'no' && wizardState.noVslNext === 'survey') {
    funnelType = 'Direct Survey';
  } else if (wizardState.hasVsl === 'no' && wizardState. noVslNext === 'booking') {
    funnelType = 'Direct Booking';
  } else {
    funnelType = 'Funnel';
  }

  if (funnelType) {
    parts.push(funnelType);
  }

  // 3️⃣ Qualification
  if (wizardState.surveyQuali === 'yes') {
    parts.push('QualiSurvey');
  }

  // 4️⃣ Close Type
  if (wizardState. closeType === '1-call') {
    parts.push('1CC');
  } else if (wizardState.closeType === '2-call') {
    parts.push('2CC');
  }

  // 🔥 Name zusammenbauen mit " | " als Trenner
  const suggestedName = parts.join(' | ');

  const nameInput = document.getElementById('wizardFunnelName');
  if (nameInput) {
    nameInput.value = suggestedName;
    wizardState.name = suggestedName;
  }
}

  // === Build Summary ===
  function buildSummary() {
    const summaryFunnelName = document.getElementById('summaryFunnelName');
    const summaryTraffic = document.getElementById('summaryTraffic');
    const summaryFunnel = document.getElementById('summaryFunnel');
    const summaryQuali = document.getElementById('summaryQuali');
    const summaryClose = document.getElementById('summaryClose');

    if (summaryFunnelName) summaryFunnelName.textContent = wizardState.name;

    const trafficMap = {
      'paid-ads': 'Paid Ads',
      'organic': 'Organic',
      'cold-email': 'Cold Email',
      'cold-calls': 'Cold Calls'
    };
    if (summaryTraffic) summaryTraffic.textContent = trafficMap[wizardState.traffic];

    let funnelText = '';
    if (wizardState.coldcallsFlow === 'direct') {
      funnelText = 'Direct Call Booking';
    } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'yes') {
      funnelText = 'Classic VSL';
    } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'no') {
      funnelText = 'Direct VSL';
    } else if (wizardState.hasVsl === 'no' && wizardState.noVslNext === 'booking') {
      funnelText = 'Direct Call Booking';
    } else {
      funnelText = 'No VSL';
    }
    if (summaryFunnel) summaryFunnel.textContent = funnelText;

    let qualiText = '';
    if (wizardState.surveyQuali === 'yes') {
      qualiText = 'Qualified Survey';
    } else if (wizardState.surveyQuali === 'no') {
      qualiText = 'Unqualified Survey';
    } else {
      qualiText = 'No Survey';
    }
    if (summaryQuali) summaryQuali.textContent = qualiText;

    const closeText = wizardState.closeType === '1-call' ? '1-Call Close' : '2-Call Close';
    if (summaryClose) summaryClose.textContent = closeText;
  }

  // === Create Funnel From Wizard ===
  function createFunnelFromWizard() {
    const modules = buildModulesFromState();

    console.log('✅ Creating Funnel:', {
      name: wizardState.name,
      color: wizardState.color,
      modules: modules
    });

    const newFunnel = FunnelAPI.createFunnel({
      name: wizardState.name,
      color: wizardState.color,
      modules: modules
    });

    document.getElementById('funnelModal').classList.add('hidden');

    if (window.switchToFunnel) {
      window.switchToFunnel(newFunnel.id);
    }

    resetWizard();
  }

  // === Build Modules From State ===
  function buildModulesFromState() {
    const modules = [];

    modules.push(wizardState.traffic);

    const isOrganic = wizardState.traffic === 'organic' || wizardState.traffic === 'cold-email' || wizardState.traffic === 'cold-calls';

    if (wizardState.coldcallsFlow === 'direct') {
      modules.push('direct-call-booking-coldcalls');
    } else if (wizardState.traffic === 'cold-calls' && wizardState.coldcallsFlow === 'landingpage') {
      if (wizardState.hasVsl === 'no' && wizardState.noVslNext === 'booking') {
        modules.push('direct-call-booking-coldcalls-withclicks');
      } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'yes' && wizardState.afterVsl === 'survey') {
        modules.push(isOrganic ? 'classic-vsl-organic' : 'classic-vsl');
      } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'yes' && wizardState.afterVsl === 'booking') {
        modules.push(isOrganic ? 'classic-vsl-no-survey-organic' : 'classic-vsl-no-survey');
      } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'no' && wizardState.afterVsl === 'survey') {
        modules.push(isOrganic ? 'direct-vsl-organic' : 'direct-vsl');
      } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'no' && wizardState.afterVsl === 'booking') {
        modules.push(isOrganic ? 'direct-no-survey' : 'direct-no-survey');
      } else if (wizardState.hasVsl === 'no' && wizardState.noVslNext === 'survey') {
        modules.push(isOrganic ? 'direct-vsl-organic' : 'direct-vsl');
      }
    } else {
      if (wizardState.hasVsl === 'yes' && wizardState.optin === 'yes' && wizardState.afterVsl === 'survey') {
        modules.push(isOrganic ? 'classic-vsl-organic' : 'classic-vsl');
      } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'yes' && wizardState.afterVsl === 'booking') {
        modules.push(isOrganic ? 'classic-vsl-no-survey-organic' : 'classic-vsl-no-survey');
      } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'no' && wizardState.afterVsl === 'survey') {
        modules.push(isOrganic ? 'direct-vsl-organic' : 'direct-vsl');
      } else if (wizardState.hasVsl === 'yes' && wizardState.optin === 'no' && wizardState.afterVsl === 'booking') {
        modules.push(isOrganic ? 'direct-no-survey' : 'direct-no-survey');
      } else if (wizardState.hasVsl === 'no' && wizardState.noVslNext === 'booking') {
        modules.push('direct-call-booking');
      } else if (wizardState.hasVsl === 'no' && wizardState.noVslNext === 'survey') {
        modules.push(isOrganic ? 'direct-vsl-organic' : 'direct-vsl');
      }
    }

    if (wizardState.surveyQuali === 'yes') {
      modules.push(isOrganic ? 'survey-qualified-organic' : 'survey-qualified');
    } else if (wizardState.surveyQuali === 'no') {
      modules.push('survey-unqualified');
    } else {
      modules.push('no-survey');
    }

    if (wizardState.closeType === '1-call') {
      modules.push(isOrganic ? '1-call-close-organic' : '1-call-close');
    } else {
      modules.push(isOrganic ? '2-call-close-organic' : '2-call-close');
    }

    modules.push(isOrganic ? 'revenue-organic' : 'revenue-paid');

    return modules;
  }

  // === Reset Wizard ===
  function resetWizard() {
    wizardState = {
      traffic: null,
      coldcallsFlow: null,
      hasVsl: null,
      noVslNext: null,
      optin: null,
      afterVsl: null,
      surveyQuali: null,
      closeType: null,
      name: '',
      color: '#9146ff'
    };

    currentStep = 1;

    const wizardContainer = document.getElementById('wizardMode');
    if (wizardContainer) {
      wizardContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.checked = false;
      });
    }

    const nameInput = document.getElementById('wizardFunnelName');
    if (nameInput) {
      nameInput.value = '';
    }

    const colorPicker = document.getElementById('wizardColorPicker');
    if (colorPicker) {
      colorPicker.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
      const defaultColor = colorPicker.querySelector('.color-option[data-color="#9146ff"]');
      if (defaultColor) {
        defaultColor.classList.add('active');
      }
    }

    showStep(1);
  }

  window.WizardAPI = {
    initWizard
  };

})(window);