/**
 * Welcome / landing screen.
 */
window.WelcomeScreen = {
  async render(container) {
    WizardNav.clear();

    // Check if first-time user
    const transferConfig = await window.cloudvoyager.config.loadKey('transferConfig');
    const migrateConfig = await window.cloudvoyager.config.loadKey('migrateConfig');
    const isFirstTime = !transferConfig?.sonarqube?.url && !migrateConfig?.sonarqube?.url;

    const onboarding = isFirstTime ? `
      <div class="welcome-onboarding">
        <strong>Welcome to CloudVoyager.</strong> Start by transferring a single project to test your setup, then use full migration to move everything.
      </div>
    ` : '';

    const subtitleText = 'Migrate data from SonarQube to SonarCloud';

    container.innerHTML = `
      <div class="welcome-container">
        <div class="welcome-hero">
          <h1>${ConfigForm.icon('cloud')} CloudVoyager Desktop</h1>
          <p><span class="typing-target"></span><span class="typing-cursor"></span></p>
        </div>

        ${onboarding}

        <div class="command-cards">
          <div class="command-card" data-command="transfer" tabindex="0" role="button" aria-label="Transfer" title="Transfer data from a single SonarQube project to SonarCloud. Supports checkpoint resume, branch sync, and issue/hotspot metadata sync. CLI equivalent: cloudvoyager transfer">
            <div class="card-icon">${ConfigForm.icon('box')}</div>
            <div>
              <h3>Transfer</h3>
              <p>Transfer data from a single SonarQube project to SonarCloud.</p>
            </div>
            <span class="card-arrow" aria-hidden="true">&#8250;</span>
          </div>
          <div class="command-card" data-command="migrate" tabindex="0" role="button" aria-label="Migrate" title="Full migration from SonarQube to one or more SonarCloud organizations. Migrates projects, quality gates, quality profiles, permissions, permission templates, and portfolios. Supports dry-run mode and selective component migration. CLI equivalent: cloudvoyager migrate">
            <div class="card-icon">${ConfigForm.icon('globe')}</div>
            <div>
              <h3>Migrate</h3>
              <p>Full migration from SonarQube to one or more SonarCloud organizations.</p>
            </div>
            <span class="card-arrow" aria-hidden="true">&#8250;</span>
          </div>
        </div>

        <div class="welcome-divider"><span class="divider-diamond"></span></div>

        <div class="secondary-actions">
          <button class="secondary-action" data-command="verify" title="Verify migration completeness by comparing SonarQube and SonarCloud data. Generates detailed comparison reports for quality gates, quality profiles, permissions, and project data. CLI equivalent: cloudvoyager verify">${ConfigForm.icon('check-circle')} Verify</button>
          <button class="secondary-action" data-command="sync-metadata" title="Sync issue and hotspot metadata (statuses, comments, tags, assignments) and quality profiles for already-migrated projects. CLI equivalent: cloudvoyager sync-metadata">${ConfigForm.icon('sync')} Sync Metadata</button>
          <button class="secondary-action" data-command="status" title="Show current synchronization status including checkpoint progress and migration state. CLI equivalent: cloudvoyager status">${ConfigForm.icon('chart')} Status</button>
          <button class="secondary-action" data-command="reset" title="Reset state and clear sync history, checkpoint journals, lock files, and extraction caches. This action cannot be undone. CLI equivalent: cloudvoyager reset">${ConfigForm.icon('trash')} Reset</button>
        </div>
      </div>
    `;

    // Typing animation for subtitle
    const typingTarget = container.querySelector('.typing-target');
    if (typingTarget) {
      let charIndex = 0;
      const typeWriter = () => {
        if (charIndex < subtitleText.length) {
          typingTarget.textContent += subtitleText.charAt(charIndex);
          charIndex++;
          setTimeout(typeWriter, 40);
        } else {
          // Remove cursor after typing completes (after a brief pause)
          setTimeout(() => {
            const cursor = container.querySelector('.typing-cursor');
            if (cursor) cursor.style.display = 'none';
          }, 1500);
        }
      };
      typeWriter();
    }

    // Staggered entrance for command cards
    const cards = container.querySelectorAll('.command-card');
    cards.forEach((card, i) => {
      card.classList.add('card-visible');
      card.style.animationDelay = `${i * 80}ms`;
    });

    // Bind clicks and keyboard
    container.querySelectorAll('[data-command]').forEach(el => {
      const handler = () => {
        const command = el.dataset.command;
        switch (command) {
          case 'transfer': App.navigate('transfer-config'); break;
          case 'migrate': App.navigate('migrate-config'); break;
          case 'verify': App.navigate('verify-config'); break;
          case 'sync-metadata': App.navigate('sync-metadata-config'); break;
          case 'status': App.navigate('status'); break;
          case 'reset': App.navigate('reset'); break;
        }
      };
      el.addEventListener('click', handler);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler();
        }
      });
    });
  }
};
