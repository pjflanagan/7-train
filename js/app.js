// Workout Week - App Orchestrator
$(document).ready(function() {
  // Ensure the WorkoutApp namespace and components are available
  if (!window.WorkoutApp || !WorkoutApp.Storage || !WorkoutApp.WorkoutTypes || !WorkoutApp.Calendar) {
    console.error('Workout Week components failed to load correctly.');
    return;
  }

  // 1. Initialize core component event listeners
  WorkoutApp.WorkoutTypes.init();
  WorkoutApp.Calendar.init();

  // 2. Wire up top-level main actions
  $('#add-goal-btn').on('click', function() {
    WorkoutApp.WorkoutTypes.openAddModal();
  });

  // Open settings modal
  $('#settings-btn').on('click', function() {
    $('#settings-modal-overlay').addClass('active');
  });

  // Close settings modal
  function closeSettingsModal() {
    $('#settings-modal-overlay').removeClass('active');
  }

  $('.cancel-settings-modal').on('click', function() {
    closeSettingsModal();
  });

  // Open links modal
  $('#links-btn').on('click', function() {
    renderLinksModalList();
    $('#links-modal-overlay').addClass('active');
  });

  // Close links modal
  function closeLinksModal() {
    $('#links-modal-overlay').removeClass('active');
  }

  $('.cancel-links-modal').on('click', function() {
    closeLinksModal();
  });

  // Dynamically populate links list inside the modal
  function renderLinksModalList() {
    const $list = $('#links-list');
    $list.empty();
    
    const links = WorkoutApp.Storage.getLinks();
    if (links.length === 0) {
      $list.append(`
        <p style="font-size: 0.8rem; color: var(--text-muted); text-align: center; margin: 1rem 0;">No links stored yet. Add one below!</p>
      `);
      return;
    }

    links.forEach(link => {
      const $row = $(`
        <div class="link-item-row" style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-tertiary); padding: 0.6rem 0.8rem; border-radius: var(--border-radius-md); border: 1px solid var(--border-color);">
          <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; gap: 0.6rem; color: var(--accent-primary); text-decoration: none; font-weight: 600; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
            <span class="material-icons" style="font-size: 18px; color: var(--text-muted);">link</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${link.title}</span>
          </a>
          <button class="remove-scheduled-btn delete-link-btn" data-id="${link.id}" title="Delete link">
            <span class="material-icons" style="font-size: 16px;">delete</span>
          </button>
        </div>
      `);

      // Delete link event
      $row.find('.delete-link-btn').on('click', function() {
        const id = $(this).data('id');
        let currentLinks = WorkoutApp.Storage.getLinks();
        currentLinks = currentLinks.filter(l => l.id !== id);
        WorkoutApp.Storage.saveLinks(currentLinks);
        renderLinksModalList();
      });

      $list.append($row);
    });
  }

  // Handle add-link form submission
  $('#add-link-form').on('submit', function(e) {
    e.preventDefault();
    const title = $('#link-title').val().trim();
    const url = $('#link-url').val().trim();
    
    if (!title || !url) return;

    const links = WorkoutApp.Storage.getLinks();
    const newLink = {
      id: 'link-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      title: title,
      url: url
    };
    links.push(newLink);
    WorkoutApp.Storage.saveLinks(links);

    // Reset inputs and re-render list
    $('#link-title').val('');
    $('#link-url').val('');
    renderLinksModalList();
  });

  // Close modals on overlay click (if clicking precisely on the overlay background)
  $('#workout-modal-overlay').on('click', function(e) {
    if (e.target === this) {
      WorkoutApp.WorkoutTypes.closeModal();
    }
  });

  $('#settings-modal-overlay').on('click', function(e) {
    if (e.target === this) {
      closeSettingsModal();
    }
  });

  $('#links-modal-overlay').on('click', function(e) {
    if (e.target === this) {
      closeLinksModal();
    }
  });

  // Close modal with Escape key
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape') {
      WorkoutApp.WorkoutTypes.closeModal();
      closeSettingsModal();
      closeLinksModal();
    }
  });

  // 3. Kick off initial rendering of sidebar and calendar
  WorkoutApp.WorkoutTypes.render();
  WorkoutApp.Calendar.render();
  
  // 4. Initialize 7-day weather forecast inside calendar column headers
  if (WorkoutApp.Weather) {
    WorkoutApp.Weather.init();
  }
  
  console.log('Workout Week App fully initialized! 🏋️‍♂️');
});