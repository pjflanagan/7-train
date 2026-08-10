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
      $('.cancel-workout-modal').on('click', function() {
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

      // Toggle Weekly target goal based on Optional checkbox
      $('#workout-optional').on('change', function() {
        const isOptional = $(this).is(':checked');
        const $targetGroup = $('#workout-target').closest('.form-group');
        if (isOptional) {
          $targetGroup.hide();
          $('#workout-target').prop('required', false).val('');
        } else {
          $targetGroup.show();
          $('#workout-target').prop('required', true);
          // Auto-populate sensible target default if empty
          if (!$('#workout-target').val()) {
            const metric = $('#workout-metric').val();
            let defaultTarget = 3;
            if (metric === 'times') defaultTarget = 3;
            if (metric === 'duration') defaultTarget = 120;
            $('#workout-target').val(defaultTarget);
          }
        }
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
      const items = WorkoutApp.Storage.getCalendarItems().filter(item => (item.week || 1) === 1);
      const progressMap = WorkoutApp.Progress.calculateProgress(types, items);

      // Render weekly progress trackers on the calendar
      [1, 2].forEach(weekNum => {
        const weekItems = WorkoutApp.Storage.getCalendarItems().filter(item => (item.week || 1) === weekNum);
        const weekProgressMap = WorkoutApp.Progress.calculateProgress(types, weekItems);
        const weekOverall = WorkoutApp.Progress.getOverallProgress(weekProgressMap);

        const $tracker = $(`.calendar-week-section[data-week="${weekNum}"] .week-progress-tracker`);
        if (types.length > 0) {
          $tracker.find('.week-progress-percentage').text(`${weekOverall.percent}%`);
          $tracker.find('.week-progress-stats').text(`${weekOverall.completed} of ${weekOverall.total} goals met`);
          $tracker.find('.week-progress-bar-fill').css('width', `${weekOverall.percent}%`);
          $tracker.css('display', 'flex');
        } else {
          $tracker.hide();
        }
      });

      if (types.length === 0) {
        $list.html(`
          <div class="empty-goals-message">
            <span class="material-icons">info_outline</span>
            <p>No workout goals created yet. Click "+ Add workout goal" above to define your weekly routine!</p>
          </div>
        `);
        return;
      }

      types.forEach(type => {
        const p = progressMap[type.id];
        const isDone = p.isDone;
        const percent = p.percent;

        const targetMetaHTML = type.optional ? '' : `<div class="goal-meta">${type.target} ${type.unit}</div>`;
        const progressSectionHTML = type.optional ? `
            <div class="goal-progress-section">
              <div class="goal-progress-labels">
                <span class="progress-current">Logged: ${p.current} ${type.unit}</span>
              </div>
            </div>
        ` : `
            <div class="goal-progress-section">
              <div class="goal-progress-labels">
                <span class="progress-current">${p.current} / ${p.target} ${type.unit}</span>
                <span class="progress-percent">${percent}%</span>
              </div>
              <div class="goal-progress-bar-bg">
                <div class="goal-progress-bar-fill" style="width: ${percent}%; background-color: ${type.color}"></div>
              </div>
            </div>
        `;

        const $card = $(`
          <div class="goal-card ${isDone ? 'completed' : ''}" data-id="${type.id}" style="--accent-color: ${type.color}">
            <div class="goal-drag-handle draggable-workout" data-id="${type.id}">
              <span class="material-icons drag-icon" title="Drag to planner (or drag indicator to reorder)">drag_indicator</span>
              <div class="workout-icon-badge" style="background-color: ${type.color}15; color: ${type.color}">
                <span class="material-icons">${type.icon}</span>
              </div>
              <div class="goal-details">
                <div class="goal-title-row">
                  <span class="goal-name">${type.name}</span>
                  ${type.optional ? '<span class="optional-badge">Optional</span>' : ''}
                </div>
                ${targetMetaHTML}
              </div>
            </div>

            ${progressSectionHTML}

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
      this.initSortableGoals();
    },

    /**
     * Initializes the jQuery UI Draggable plugin on the list items.
     */
    initDraggable: function() {
      $('.draggable-workout').draggable({
        connectToSortable: '.calendar-day-items',
        start: function(event, ui) {
          $('body').addClass('is-dragging');
        },
        stop: function(event, ui) {
          $('body').removeClass('is-dragging');
        },
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
     * Initializes the jQuery UI Sortable plugin on the sidebar goals list.
     */
    initSortableGoals: function() {
      const self = this;
      $('#goals-list').sortable({
        items: '.goal-card',
        handle: '.drag-icon', // Use the drag indicator icon to reorder
        placeholder: 'goal-card-placeholder',
        start: function(event, ui) {
          ui.placeholder.height(ui.item.height());
          ui.placeholder.css({
            'margin-bottom': '0.75rem',
            'border-radius': 'var(--border-radius-md)',
            'background-color': 'rgba(255, 255, 255, 0.02)',
            'border': '1px dashed var(--border-color)',
            'box-sizing': 'border-box'
          });
        },
        stop: function(event, ui) {
          self.saveGoalsOrderFromDOM();
        }
      });
    },

    /**
     * Reconstructs and saves goals based on their current visual order in the sidebar.
     */
    saveGoalsOrderFromDOM: function() {
      const types = WorkoutApp.Storage.getWorkoutTypes();
      const newTypes = [];

      $('#goals-list .goal-card').each(function() {
        const typeId = $(this).data('id');
        const type = types.find(t => t.id === typeId);
        if (type) {
          newTypes.push(type);
        }
      });

      // Maintain any missing types
      types.forEach(type => {
        if (!newTypes.some(nt => nt.id === type.id)) {
          newTypes.push(type);
        }
      });

      WorkoutApp.Storage.saveWorkoutTypes(newTypes);
      
      // Re-render sidebar and calendar
      this.render();
      WorkoutApp.Calendar.render();
    },

    /**
     * Opens modal for adding a new workout type.
     */
    openAddModal: function() {
      currentEditingTypeId = null;
      this.setupModalOptions();

      $('#workout-modal-title').text('Add workout goal');
      $('#workout-type-form')[0].reset();
      $('#workout-type-id').val('');
      
      // Default selections
      $('.icon-grid-item[data-icon="directions_run"]').addClass('active');
      $('#workout-icon').val('directions_run');
      
      const defaultColor = '#ff4d4d';
      $('.color-preset-btn[data-color="' + defaultColor + '"]').addClass('active');
      $('#workout-color-picker').val(defaultColor);
      $('#workout-metric').val('distance').trigger('change');
      $('#workout-optional').prop('checked', false).trigger('change');

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
      $('#workout-target').val(type.target !== null && type.target !== undefined ? type.target : '');
      $('#workout-optional').prop('checked', !!type.optional).trigger('change');
      
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
      const optional = $('#workout-optional').is(':checked');
      const target = optional ? null : (Number($('#workout-target').val()) || 1);
      const color = $('#workout-color-picker').val();

      const types = WorkoutApp.Storage.getWorkoutTypes();
      const newType = { id, name, icon, metric, unit, target, color, optional };

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
