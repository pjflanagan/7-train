// Workout Week - Workout Types Management
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  const POPULAR_ICONS = [
    { name: 'Run', icon: 'directions_run' },
    { name: 'Gym', icon: 'fitness_center' },
    { name: 'Bike', icon: 'directions_bike' },
    { name: 'Swim', icon: 'pool' },
    { name: 'Yoga', icon: 'self_improvement' },
    { name: 'Walk', icon: 'directions_walk' },
    { name: 'Skate', icon: 'roller_skating' },
    { name: 'Row', icon: 'rowing' },
    { name: 'Tennis', icon: 'sports_tennis' },
    { name: 'Gymnastics', icon: 'sports_gymnastics' },
    { name: 'Combat', icon: 'sports_kabaddi' },
    { name: 'Other', icon: 'help_outline' }
  ];

  const PRESET_COLORS = [
    '#ff4d4d', // Red
    '#ff7a00', // Orange
    '#ffb800', // Yellow/Gold
    '#10b981', // Green
    '#06b6d4', // Cyan
    '#3b82f6', // Blue
    '#a855f7', // Purple
    '#ec4899', // Pink
    '#64748b'  // Slate
  ];

  let currentEditingTypeId = null;

  WorkoutApp.WorkoutTypes = {
    /**
     * Initializes the UI event listeners for adding and editing workout types.
     */
    init: function() {
      const self = this;
      
      // Hook up the form submit
      $('#workout-type-form').on('submit', function(e) {
        e.preventDefault();
        self.handleFormSubmit();
      });

      // Hook up cancel button
      $('#cancel-workout-modal').on('click', function() {
        self.closeModal();
      });

      // Metric change updates default unit
      $('#workout-metric').on('change', function() {
        const metric = $(this).val();
        let unit = 'times';
        if (metric === 'distance') unit = 'miles';
        if (metric === 'duration') unit = 'mins';
        $('#workout-unit').val(unit);
      });

      // Preset color selections
      $(document).on('click', '.color-preset-btn', function() {
        $('.color-preset-btn').removeClass('active');
        $(this).addClass('active');
        $('#workout-color-picker').val($(this).data('color'));
      });

      // Custom color picker changes update presets selection
      $('#workout-color-picker').on('input change', function() {
        const customColor = $(this).val().toLowerCase();
        $('.color-preset-btn').removeClass('active');
        $(`.color-preset-btn[data-color="${customColor}"]`).addClass('active');
      });

      // Select icon in modal
      $(document).on('click', '.icon-grid-item', function() {
        $('.icon-grid-item').removeClass('active');
        $(this).addClass('active');
        $('#workout-icon').val($(this).data('icon'));
      });
    },

    /**
     * Renders the preset colors grid and icon grid inside the modal.
     */
    setupModalOptions: function() {
      // Setup preset colors
      const $colorPresets = $('.color-presets-container');
      $colorPresets.empty();
      PRESET_COLORS.forEach(color => {
        $colorPresets.append(`
          <button type="button" class="color-preset-btn" data-color="${color.toLowerCase()}" style="background-color: ${color};" title="${color}"></button>
        `);
      });

      // Setup icons grid
      const $iconGrid = $('.icon-grid-container');
      $iconGrid.empty();
      POPULAR_ICONS.forEach(item => {
        $iconGrid.append(`
          <button type="button" class="icon-grid-item" data-icon="${item.icon}" title="${item.name}">
            <span class="material-icons">${item.icon}</span>
          </button>
        `);
      });
    },

    /**
     * Renders the left sidebar list of workout goals and their corresponding progress.
     */
    render: function() {
      const $list = $('#goals-list');
      $list.empty();

      const types = WorkoutApp.Storage.getWorkoutTypes();
      const items = WorkoutApp.Storage.getCalendarItems();
      const progressMap = WorkoutApp.Progress.calculateProgress(types, items);
      const overall = WorkoutApp.Progress.getOverallProgress(progressMap);

      // Render aggregate stats card if we have workout goals
      if (types.length > 0) {
        $('#overall-progress-percentage').text(`${overall.percent}%`);
        $('#overall-progress-stats').text(`${overall.completed} of ${overall.total} goals met`);
        $('#overall-progress-bar-fill').css('width', `${overall.percent}%`);
        $('.sidebar-stats-card').show();
      } else {
        $('.sidebar-stats-card').hide();
      }

      if (types.length === 0) {
        $list.html(`
          <div class="empty-goals-message">
            <span class="material-icons">info_outline</span>
            <p>No workout goals created yet. Click "+ Add Workout Goal" above to define your weekly routine!</p>
          </div>
        `);
        return;
      }

      types.forEach(type => {
        const p = progressMap[type.id];
        const isDone = p.isDone;
        const percent = p.percent;

        const $card = $(`
          <div class="goal-card ${isDone ? 'completed' : ''}" data-id="${type.id}" style="--accent-color: ${type.color}">
            <div class="goal-drag-handle draggable-workout" data-id="${type.id}">
              <span class="material-icons drag-icon" title="Drag to planner">pan_tool</span>
              <div class="workout-icon-badge" style="background-color: ${type.color}15; color: ${type.color}">
                <span class="material-icons">${type.icon}</span>
              </div>
              <div class="goal-details">
                <div class="goal-title-row">
                  <span class="goal-name">${type.name}</span>
                </div>
                <div class="goal-meta">Target: ${type.target} ${type.unit}</div>
              </div>
            </div>

            <div class="goal-progress-section">
              <div class="goal-progress-labels">
                <span class="progress-current">${p.current} / ${p.target} ${type.unit}</span>
                <span class="progress-percent">${percent}%</span>
              </div>
              <div class="goal-progress-bar-bg">
                <div class="goal-progress-bar-fill" style="width: ${percent}%; background-color: ${type.color}"></div>
              </div>
            </div>

            <div class="goal-actions">
              <button class="goal-action-btn edit-goal-btn" title="Edit Workout Goal">
                <span class="material-icons">edit</span>
              </button>
              <button class="goal-action-btn delete-goal-btn" title="Delete Workout Goal">
                <span class="material-icons">delete</span>
              </button>
            </div>
          </div>
        `);

        // Attach action events
        $card.find('.edit-goal-btn').on('click', () => this.openEditModal(type.id));
        $card.find('.delete-goal-btn').on('click', () => this.deleteWorkoutType(type.id));

        $list.append($card);
      });

      // Re-initialize drag-and-drop handles for goals
      this.initDraggable();
    },

    /**
     * Initializes the jQuery UI Draggable plugin on the list items.
     */
    initDraggable: function() {
      $('.draggable-workout').draggable({
        helper: function(event) {
          const typeId = $(this).data('id');
          const types = WorkoutApp.Storage.getWorkoutTypes();
          const type = types.find(t => t.id === typeId);
          
          return $(`
            <div class="workout-drag-helper" style="border-left: 4px solid ${type.color}">
              <span class="material-icons">${type.icon}</span>
              <span>${type.name}</span>
            </div>
          `);
        },
        cursorAt: { left: 10, top: 15 },
        zIndex: 1000,
        revert: 'invalid',
        appendTo: 'body'
      });
    },

    /**
     * Opens modal for adding a new workout type.
     */
    openAddModal: function() {
      currentEditingTypeId = null;
      this.setupModalOptions();

      $('#workout-modal-title').text('Add Workout Goal');
      $('#workout-type-form')[0].reset();
      $('#workout-type-id').val('');
      
      // Default selections
      $('.icon-grid-item[data-icon="directions_run"]').addClass('active');
      $('#workout-icon').val('directions_run');
      
      const defaultColor = '#ff4d4d';
      $('.color-preset-btn[data-color="' + defaultColor + '"]').addClass('active');
      $('#workout-color-picker').val(defaultColor);
      $('#workout-metric').val('distance').trigger('change');

      $('#workout-modal-overlay').addClass('active');
    },

    /**
     * Opens modal for editing an existing workout type.
     */
    openEditModal: function(id) {
      currentEditingTypeId = id;
      this.setupModalOptions();

      const types = WorkoutApp.Storage.getWorkoutTypes();
      const type = types.find(t => t.id === id);
      if (!type) return;

      $('#workout-modal-title').text('Edit Workout Goal');
      $('#workout-type-id').val(type.id);
      $('#workout-name').val(type.name);
      $('#workout-metric').val(type.metric);
      $('#workout-unit').val(type.unit);
      $('#workout-target').val(type.target);
      
      // Setup icon selection
      $('.icon-grid-item').removeClass('active');
      $(`.icon-grid-item[data-icon="${type.icon}"]`).addClass('active');
      $('#workout-icon').val(type.icon);

      // Setup color selection
      const colorVal = type.color.toLowerCase();
      $('#workout-color-picker').val(colorVal);
      $('.color-preset-btn').removeClass('active');
      $(`.color-preset-btn[data-color="${colorVal}"]`).addClass('active');

      $('#workout-modal-overlay').addClass('active');
    },

    /**
     * Closes the creation/editing modal.
     */
    closeModal: function() {
      $('#workout-modal-overlay').removeClass('active');
    },

    /**
     * Handles adding or editing a workout type form submission.
     */
    handleFormSubmit: function() {
      const id = $('#workout-type-id').val() || 'type-' + Date.now();
      const name = $('#workout-name').val().trim() || 'Workout';
      const icon = $('#workout-icon').val() || 'directions_run';
      const metric = $('#workout-metric').val();
      const unit = $('#workout-unit').val().trim() || 'times';
      const target = Number($('#workout-target').val()) || 1;
      const color = $('#workout-color-picker').val();

      const types = WorkoutApp.Storage.getWorkoutTypes();
      const newType = { id, name, icon, metric, unit, target, color };

      if (currentEditingTypeId) {
        // Update existing
        const index = types.findIndex(t => t.id === currentEditingTypeId);
        if (index !== -1) {
          types[index] = newType;
        }
      } else {
        // Create new
        types.push(newType);
      }

      WorkoutApp.Storage.saveWorkoutTypes(types);
      this.closeModal();
      
      // Refresh views
      this.render();
      WorkoutApp.Calendar.render();
    },

    /**
     * Deletes a workout type and removes all scheduled workouts of this type on the calendar.
     */
    deleteWorkoutType: function(id) {
      if (!confirm('Are you sure you want to delete this workout goal? This will also remove all scheduled activities of this type from your calendar.')) {
        return;
      }

      // Delete type
      let types = WorkoutApp.Storage.getWorkoutTypes();
      types = types.filter(t => t.id !== id);
      WorkoutApp.Storage.saveWorkoutTypes(types);

      // Delete related calendar items
      let items = WorkoutApp.Storage.getCalendarItems();
      items = items.filter(item => item.typeId !== id);
      WorkoutApp.Storage.saveCalendarItems(items);

      // Refresh views
      this.render();
      WorkoutApp.Calendar.render();
    }
  };
})();
