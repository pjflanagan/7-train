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

  // Close modals on overlay click (if clicking precisely on the overlay background)
  $('#workout-modal-overlay').on('click', function(e) {
    if (e.target === this) {
      WorkoutApp.WorkoutTypes.closeModal();
    }
  });

  // Close modal with Escape key
  $(document).on('keydown', function(e) {
    if (e.key === 'Escape') {
      WorkoutApp.WorkoutTypes.closeModal();
    }
  });

  // 3. Kick off initial rendering of sidebar and calendar
  WorkoutApp.WorkoutTypes.render();
  WorkoutApp.Calendar.render();
  
  console.log('Workout Week App fully initialized! 🏋️‍♂️');
});
