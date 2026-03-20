/**
 * Wizard navigation sidebar component.
 * Renders step indicators and handles step navigation.
 */
window.WizardNav = {
  steps: [],
  currentStep: 0,
  maxVisited: 0,
  onStepClick: null,

  render(steps, currentStep, onStepClick) {
    this.steps = steps;
    this.currentStep = currentStep;
    if (currentStep > this.maxVisited) {
      this.maxVisited = currentStep;
    }
    this.onStepClick = onStepClick;

    const nav = document.getElementById('wizard-nav');
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Wizard steps');
    nav.innerHTML = '';

    steps.forEach((step, index) => {
      const el = document.createElement('div');
      el.className = 'wizard-step';
      el.setAttribute('role', 'listitem');

      if (index === currentStep) {
        el.classList.add('active');
        el.setAttribute('aria-current', 'step');
      }
      if (index < currentStep) el.classList.add('completed');

      const isClickable = index <= this.maxVisited;
      el.setAttribute('tabindex', isClickable ? '0' : '-1');
      if (!isClickable) el.setAttribute('aria-disabled', 'true');

      // Strip emoji from step labels for cleaner display
      const cleanLabel = step.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]\s*/u, '');
      const numberContent = index < currentStep ? '&#10003;' : (index + 1);

      el.innerHTML = `
        <div class="wizard-step-number"><span class="wizard-step-inner">${numberContent}</span></div>
        <div class="wizard-step-label">${cleanLabel}</div>
      `;

      if (isClickable) {
        const handleClick = () => {
          if (onStepClick) onStepClick(index);
        };
        el.addEventListener('click', handleClick);
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        });
      }

      nav.appendChild(el);
    });
  },

  clear() {
    this.maxVisited = 0;
    document.getElementById('wizard-nav').innerHTML = '';
  },

  setStep(index) {
    this.currentStep = index;
    if (index > this.maxVisited) this.maxVisited = index;
    this.render(this.steps, index, this.onStepClick);
  }
};
