// Workout Week - Workout types Management
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
  let modalTags = [];
  let modalLinks = [];

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

      // Add workout type sub-tag button click
      $('#add-workout-type-tag-btn').on('click', function() {
        const tagVal = $('#workout-type-tag-input').val().trim();
        if (tagVal) {
          if (!modalTags.includes(tagVal)) {
            modalTags.push(tagVal);
            self.renderModalTags();
          }
          $('#workout-type-tag-input').val('').focus();
        }
      });

      // Prevent enter key in tag input from submitting form
      $('#workout-type-tag-input').on('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          $('#add-workout-type-tag-btn').trigger('click');
        }
      });

      // Tab switching in workout goal modal
      $(document).on('click', '.modal-tab-btn', function() {
        const tab = $(this).data('tab');
        $('.modal-tab-btn').removeClass('active');
        $(this).addClass('active');

        $('.modal-tab-content').removeClass('active');
        $(`#tab-${tab}`).addClass('active');
      });

      // Add goal-specific link click
      $('#add-goal-link-btn').on('click', function() {
        const title = $('#goal-link-title').val().trim();
        const url = $('#goal-link-url').val().trim();
        if (title && url) {
          modalLinks.push({
            id: 'link-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            title: title,
            url: url
          });
          self.renderModalLinks();
          $('#goal-link-title').val('');
          $('#goal-link-url').val('').focus();
        }
      });

      // Prevent enter key inside goal-link inputs from submitting form
      $('#goal-link-title, #goal-link-url').on('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          $('#add-goal-link-btn').trigger('click');
        }
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
     * Renders the current list of workout type tags inside the modal.
     */
    renderModalTags: function() {
      const $container = $('#workout-type-tags-list');
      $container.empty();

      if (modalTags.length === 0) {
        $container.html('<span style="font-size: 0.75rem; color: var(--text-dim); font-style: italic; padding: 0.25rem 0;">No tags added yet</span>');
        return;
      }

      modalTags.forEach((tag, index) => {
        const $tagBadge = $(`
          <div class="workout-type-modal-tag">
            <span>${tag}</span>
            <button type="button" class="remove-tag-btn" data-index="${index}" title="Remove tag">
              <span class="material-icons" style="font-size: 12px;">close</span>
            </button>
          </div>
        `);

        $tagBadge.find('.remove-tag-btn').on('click', function() {
          const idx = $(this).data('index');
          modalTags.splice(idx, 1);
          WorkoutApp.WorkoutTypes.renderModalTags();
        });

        $container.append($tagBadge);
      });
    },

    /**
     * Renders the current list of goal-specific links inside the modal.
     */
    renderModalLinks: function() {
      const $container = $('#goal-links-list');
      $container.empty();

      if (modalLinks.length === 0) {
        $container.html('<span style="font-size: 0.75rem; color: var(--text-dim); font-style: italic; padding: 0.25rem 0;">No links added yet</span>');
        return;
      }

      modalLinks.forEach((link, index) => {
        const $linkRow = $(`
          <div style="display: flex; justify-content: space-between; align-items: center; background-color: var(--bg-tertiary); padding: 0.4rem 0.6rem; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); width: 100%; margin-bottom: 0.25rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;">
              <span class="material-icons" style="font-size: 14px; color: var(--text-muted); flex-shrink: 0;">link</span>
              <span style="font-size: 0.75rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-main);">${link.title}</span>
            </div>
            <button type="button" class="remove-scheduled-btn remove-goal-link-btn" data-index="${index}" title="Remove link" style="flex-shrink: 0;">
              <span class="material-icons" style="font-size: 12px;">close</span>
            </button>
          </div>
        `);

        $linkRow.find('.remove-goal-link-btn').on('click', function() {
          const idx = $(this).data('index');
          modalLinks.splice(idx, 1);
          WorkoutApp.WorkoutTypes.renderModalLinks();
        });

        $container.append($linkRow);
      });
    },

    /**
     * Launches a modal selection overlay when clicking on a multi-link weekly goal.
     */
    openLinksSelectModal: function(goalName, links) {
      $('#goal-links-select-title').text(`${goalName} Links`);
      const $list = $('#goal-links-select-list');
      $list.empty();

      links.forEach(link => {
        const $btn = $(`
          <button class="btn btn-secondary" style="width: 100%; display: flex; align-items: center; gap: 0.5rem; justify-content: flex-start; text-align: left; padding: 0.6rem 0.8rem; background-color: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--accent-primary); border-radius: var(--border-radius-md); font-weight: 600; cursor: pointer; transition: var(--transition-smooth);">
            <span class="material-icons" style="font-size: 16px;">open_in_new</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">${link.title}</span>
          </button>
        `);

        $btn.on('click', function() {
          window.open(link.url, '_blank', 'noopener,noreferrer');
          $('#goal-links-select-modal-overlay').removeClass('active');
        });

        $list.append($btn);
      });

      $('#goal-links-select-modal-overlay').addClass('active');
    },

    /**
     * Renders both the 'My Week' Goal Definition modal list and the horizontal week-by-week goals lists.
     */
    render: function() {
      const types = WorkoutApp.Storage.getWorkoutTypes();

      // 1. Render 'My Week' modal goal list (no progress metrics)
      const $modalList = $('#my-week-goals-list');
      $modalList.empty();

      if (types.length === 0) {
        $modalList.html(`
          <div class="empty-goals-message">
            <span class="material-icons">info_outline</span>
            <p>No workout goals created yet. Click "Add Goal" above to define your weekly routine!</p>
          </div>
        `);
      } else {
        types.forEach(type => {
          const targetMetaHTML = type.optional ? '' : `<div class="goal-meta">${type.target} ${type.unit}</div>`;

          const $card = $(`
            <div class="goal-card" data-id="${type.id}" style="--accent-color: ${type.color}">
              <div class="goal-drag-handle" data-id="${type.id}">
                <span class="material-icons drag-icon" title="Drag indicator to reorder">drag_indicator</span>
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

              ${type.workoutTypes && type.workoutTypes.length > 0 ? `
                <div class="goal-subtags-container">
                  ${type.workoutTypes.map(tag => `
                    <div style="border: 1px solid ${type.color}40; background-color: ${type.color}08; color: ${type.color}; padding: 0.2rem 0.5rem; border-radius: 6px; font-size: 0.65rem; font-weight: 700; white-space: nowrap;">
                      <span class="subtag-name">${tag}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              <div class="goal-actions">
                <button class="goal-action-btn edit-goal-btn" title="Edit workout goal">
                  <span class="material-icons">edit</span>
                </button>
                <button class="goal-action-btn delete-goal-btn" title="Delete Workout Goal">
                  <span class="material-icons">delete</span>
                </button>
              </div>
            </div>
          `);

          $card.find('.edit-goal-btn').on('click', () => this.openEditModal(type.id));
          $card.find('.delete-goal-btn').on('click', () => {
            if (confirm(`Are you sure you want to delete "${type.name}"? This will also remove any planned instances of this workout.`)) {
              this.deleteWorkoutType(type.id);
            }
          });

          $modalList.append($card);
        });
      }

      // 2. Render weekly progress trackers on the calendar & populate horizontal lists
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

        // Render Horizontal small goal cards for dragging & progress
        const $horizontalList = $(`#week-${weekNum}-goals-list-horizontal`);
        $horizontalList.empty();

        if (types.length === 0) {
          $horizontalList.html(`
            <span style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">No goals defined yet. Open 'My Week' above to get started!</span>
          `);
          return;
        }

        types.forEach(type => {
          const p = weekProgressMap[type.id];
          const isDone = p.isDone;
          const percent = p.percent;

          const progressLabelsHTML = type.optional 
            ? `<span>Logged: ${p.current} ${type.unit}</span>`
            : `
              <span class="progress-current" style="display: inline-flex; align-items: center; gap: 0.15rem;">
                <span>${p.current}</span>
                <span>/</span>
                <input type="number" 
                       class="small-goal-target-input" 
                       data-id="${type.id}" 
                       value="${type.target}" 
                       min="0.1" 
                       step="any" 
                       style="width: 45px; background: rgba(255,255,255,0.05); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.05rem 0.2rem; color: white; text-align: center; font-size: 0.65rem; font-weight: 700; outline: none;" />
                <span style="font-size: 0.65rem; color: var(--text-muted);">${type.unit}</span>
              </span>
              <span>${percent}%</span>
            `;

          const hasLinks = type.links && type.links.length > 0;
          const linksIconHTML = hasLinks 
            ? `
              <button class="small-goal-link-btn" data-id="${type.id}" title="Open links" style="background: transparent; border: none; color: rgba(255,255,255,0.6); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; margin-left: auto; flex-shrink: 0; z-index: 5;">
                <span class="material-icons" style="font-size: 12px; transition: var(--transition-smooth);">link</span>
              </button>
            ` 
            : '';

          const $smallCard = $(`
            <div class="small-goal-card ${isDone ? 'completed' : ''}" data-id="${type.id}" style="--accent-color: ${type.color}; border-left: 3px solid ${type.color};">
              <div class="small-goal-header draggable-workout" data-id="${type.id}" style="width: 100%; display: flex; align-items: center; gap: 0.35rem;">
                <div class="small-goal-icon-badge" style="background-color: ${type.color}15; color: ${type.color}">
                  <span class="material-icons" style="font-size: 11px;">${type.icon}</span>
                </div>
                <span class="small-goal-name">${type.name}</span>
                ${type.optional ? '<span class="optional-badge" style="font-size: 0.5rem; padding: 0.1rem 0.25rem;">Opt</span>' : ''}
                ${linksIconHTML}
              </div>

              <div class="small-goal-progress">
                <div class="small-goal-progress-labels" style="align-items: center;">
                  ${progressLabelsHTML}
                </div>
                ${type.optional ? '' : `
                  <div class="small-goal-progress-bar-bg">
                    <div class="small-goal-progress-bar-fill" style="width: ${percent}%; background-color: ${type.color}"></div>
                  </div>
                `}
              </div>

              ${type.workoutTypes && type.workoutTypes.length > 0 ? `
                <div class="small-goal-subtags">
                  ${type.workoutTypes.map(tag => `
                    <div class="draggable-subtag" data-id="${type.id}" data-tag="${tag}" style="border: 1px solid ${type.color}40; background-color: ${type.color}08; color: ${type.color}; cursor: grab; display: inline-flex; align-items: center; gap: 0.15rem; padding: 0.15rem 0.35rem; border-radius: 4px; font-size: 0.6rem; font-weight: 700; white-space: nowrap;">
                      <span class="material-icons subtag-drag-icon" style="font-size: 8px;">drag_indicator</span>
                      <span class="subtag-name">${tag}</span>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `);

          // Event listener for links click
          if (hasLinks) {
            $smallCard.find('.small-goal-link-btn').on('mousedown click', function(e) {
              e.stopPropagation(); // Prevents dragging from starting!
              if (e.type === 'click') {
                const linksList = type.links || [];
                if (linksList.length === 1) {
                  window.open(linksList[0].url, '_blank', 'noopener,noreferrer');
                } else if (linksList.length > 1) {
                  WorkoutApp.WorkoutTypes.openLinksSelectModal(type.name, linksList);
                }
              }
            });
          }

          // Event listeners for inline target input
          if (!type.optional) {
            $smallCard.find('.small-goal-target-input').on('input', function() {
              const valStr = $(this).val();
              if (valStr === '') return;

              const val = parseFloat(valStr);
              if (!isNaN(val) && val > 0) {
                const typesList = WorkoutApp.Storage.getWorkoutTypes();
                const targetType = typesList.find(t => t.id === type.id);
                if (targetType) {
                  targetType.target = val;
                  WorkoutApp.Storage.saveWorkoutTypes(typesList);

                  // Update active progress UI instantly
                  const activePercent = Math.round((p.current / val) * 100);
                  $smallCard.find('.small-goal-progress-bar-fill').css('width', `${Math.min(100, activePercent)}%`);
                  $smallCard.find('.small-goal-progress-labels span:last-child').text(`${activePercent}%`);
                }
              }
            });

            $smallCard.find('.small-goal-target-input').on('change', function() {
              const valStr = $(this).val();
              let val = parseFloat(valStr);
              if (isNaN(val) || val <= 0) {
                val = 1;
                $(this).val(val);
              }

              const typesList = WorkoutApp.Storage.getWorkoutTypes();
              const targetType = typesList.find(t => t.id === type.id);
              if (targetType) {
                targetType.target = val;
                WorkoutApp.Storage.saveWorkoutTypes(typesList);
              }

              // Full render to refresh all progress bars and dependencies
              WorkoutApp.WorkoutTypes.render();
              WorkoutApp.Calendar.render();
            });
          }

          $horizontalList.append($smallCard);
        });
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
          if (WorkoutApp.Calendar) {
            WorkoutApp.Calendar.dragHandled = false;
          }
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

      $('.draggable-subtag').draggable({
        connectToSortable: '.calendar-day-items',
        start: function(event, ui) {
          if (WorkoutApp.Calendar) {
            WorkoutApp.Calendar.dragHandled = false;
          }
          $('body').addClass('is-dragging');
        },
        stop: function(event, ui) {
          $('body').removeClass('is-dragging');
        },
        helper: function(event) {
          const typeId = $(this).data('id');
          const tag = $(this).data('tag');
          const types = WorkoutApp.Storage.getWorkoutTypes();
          const type = types.find(t => t.id === typeId);
          
          return $(`
            <div class="workout-drag-helper" style="border-left: 4px solid ${type.color}">
              <span class="material-icons">${type.icon}</span>
              <span>${type.name}: ${tag}</span>
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
     * Initializes the jQuery UI Sortable plugin on the My Week goals list.
     */
    initSortableGoals: function() {
      const self = this;
      $('#my-week-goals-list').sortable({
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
     * Reconstructs and saves goals based on their current visual order.
     */
    saveGoalsOrderFromDOM: function() {
      const types = WorkoutApp.Storage.getWorkoutTypes();
      const newTypes = [];

      $('#my-week-goals-list .goal-card').each(function() {
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
      modalTags = [];
      modalLinks = [];
      $('#workout-type-tag-input').val('');
      $('#goal-link-title').val('');
      $('#goal-link-url').val('');
      this.setupModalOptions();
      this.renderModalTags();
      this.renderModalLinks();

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

      // Reset active tab to basic
      $('.modal-tab-btn').removeClass('active');
      $('.modal-tab-btn[data-tab="basic"]').addClass('active');
      $('.modal-tab-content').removeClass('active');
      $('#tab-basic').addClass('active');

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

      modalTags = [...(type.workoutTypes || [])];
      modalLinks = [...(type.links || [])];
      $('#workout-type-tag-input').val('');
      $('#goal-link-title').val('');
      $('#goal-link-url').val('');
      this.renderModalTags();
      this.renderModalLinks();

      $('#workout-modal-title').text('Edit workout goal');
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

      // Reset active tab to basic
      $('.modal-tab-btn').removeClass('active');
      $('.modal-tab-btn[data-tab="basic"]').addClass('active');
      $('.modal-tab-content').removeClass('active');
      $('#tab-basic').addClass('active');

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
      const workoutTypes = [...modalTags];
      const links = [...modalLinks];

      const types = WorkoutApp.Storage.getWorkoutTypes();
      const newType = { id, name, icon, metric, unit, target, color, optional, workoutTypes, links };

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