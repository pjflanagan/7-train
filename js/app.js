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

  // Close modal with Escape key
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape') {
      WorkoutApp.WorkoutTypes.closeModal();
      closeSettingsModal();
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