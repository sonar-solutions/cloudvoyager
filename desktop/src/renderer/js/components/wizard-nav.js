/**
 * Wizard navigation sidebar component.
 * Renders step indicators and handles step navigation.
 */
window.WizardNav = {
  steps: [],
  currentStep: 0,
  onStepClick: null,

  render(steps, currentStep, onStepClick) {
    this.steps = steps;
    this.currentStep = currentStep;
    this.onStepClick = onStepClick;

    const nav = document.getElementById('wizard-nav');
    nav.innerHTML = '';

    steps.forEach((step, index) => {
      const el = document.createElement('div');
      el.className = 'wizard-step';
      if (index === currentStep) el.classList.add('active');
      if (index < currentStep) el.classList.add('completed');

      const numberContent = index < currentStep ? '&#10003;' : (index + 1);

      el.innerHTML = `
        <div class="wizard-step-number">${numberContent}</div>
        <div class="wizard-step-label">${step}</div>
      `;

      el.addEventListener('click', () => {
        if (onStepClick && index <= currentStep) {
          onStepClick(index);
        }
      });

      nav.appendChild(el);
    });
  },

  clear() {
    document.getElementById('wizard-nav').innerHTML = '';
  },

  setStep(index) {
    this.currentStep = index;
    this.render(this.steps, index, this.onStepClick);
  }
};
