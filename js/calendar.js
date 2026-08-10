// Workout Week - Calendar Management
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  WorkoutApp.Calendar = {
    /**
     * Initializes calendar event handlers.
     */
    init: function() {
      // Clean calendar button
      $('#clear-week-btn').on('click', () => {
        if (confirm('Are you sure you want to clear all workouts from this week\'s calendar?')) {
          WorkoutApp.Storage.clearCalendar();
          this.render();
          WorkoutApp.WorkoutTypes.render();
        }
      });

      // Reset application button
      $('#reset-app-btn').on('click', () => {
        if (confirm('Are you sure you want to reset EVERYTHING back to defaults? This will erase all custom workouts and planned activities.')) {
          WorkoutApp.Storage.resetToDefaults();
          // Reload page to re-initialize with storage defaults
          window.location.reload();
        }
      });
    },

    /**
     * Renders the 7 columns of the calendar with their scheduled cards.
     */
    render: function() {
      const self = this;
      const types = WorkoutApp.Storage.getWorkoutTypes();
      const items = WorkoutApp.Storage.getCalendarItems();

      DAYS.forEach(day => {
        const $dayContainer = $(`.calendar-column[data-day="${day}"] .calendar-day-items`);
        $dayContainer.empty();

        const dayItems = items.filter(item => item.day === day);

        if (dayItems.length === 0) {
          // $dayContainer.html(`
          //   <div class="empty-day-placeholder">
          //     <span class="material-icons">add</span>
          //     <p class="placeholder-text">Drop workouts here</p>
          //   </div>
          // `);
        } else {
          dayItems.forEach(item => {
            const type = types.find(t => t.id === item.typeId);
            
            // If the workout type was deleted somehow, don't break rendering
            if (!type) return;

            const isTimesMetric = type.metric === 'times';
            
            // For times-measured activities, the value is always implicitly 1
            if (isTimesMetric && item.value !== 1) {
              item.value = 1;
              self.updateItemValue(item.id, 1);
            }

            const $card = $(`
              <div class="scheduled-card" data-id="${item.id}" style="border-left: 4px solid ${type.color}">
                <div class="scheduled-card-header" style="${isTimesMetric ? 'margin-bottom: 0;' : ''}">
                  <div class="scheduled-info">
                    <span class="material-icons card-type-icon" style="color: ${type.color}">${type.icon}</span>
                    <span class="card-type-name">${type.name}</span>
                  </div>
                  <button class="remove-scheduled-btn" title="Remove activity">
                    <span class="material-icons">close</span>
                  </button>
                </div>
                ${isTimesMetric ? '' : `
                  <div class="scheduled-card-body">
                    <div class="value-input-group">
                      <input type="number" 
                             class="scheduled-value-input" 
                             value="${item.value}" 
                             min="0.1" 
                             step="0.1" 
                             title="Planned amount" />
                      <span class="unit-label">${type.unit}</span>
                    </div>
                  </div>
                `}
              </div>
            `);

            // Initialize draggable behavior for moving events between calendar columns
            $card.draggable({
              revert: 'invalid',
              zIndex: 1000,
              helper: 'clone',
              cursor: 'move',
              appendTo: 'body',
              start: function(event, ui) {
                $(this).addClass('dragging-card');
                // Lock the helper width to match the original card's size so it doesn't stretch when appended to body
                ui.helper.css('width', $(this).outerWidth() + 'px');
              },
              stop: function(event, ui) {
                $(this).removeClass('dragging-card');
              }
            });

            // Inline value update events (only for distance/duration, since times doesn't have an input)
            if (!isTimesMetric) {
              // On input (typing): allow user to clear the field to type freely
              $card.find('.scheduled-value-input').on('input', function() {
                const valStr = $(this).val();
                if (valStr === '') return; // Allow empty string while typing!
                
                const val = parseFloat(valStr);
                if (!isNaN(val) && val > 0) {
                  self.updateItemValue(item.id, val);
                }
              });

              // On change (blur/enter): enforce fallback if left empty or invalid
              $card.find('.scheduled-value-input').on('change', function() {
                const valStr = $(this).val();
                let val = parseFloat(valStr);
                if (isNaN(val) || val <= 0) {
                  val = 1; // sensible fallback
                  $(this).val(val);
                }
                self.updateItemValue(item.id, val);
              });
            }

            // Remove item event
            $card.find('.remove-scheduled-btn').on('click', function() {
              self.removeItem(item.id);
            });

            $dayContainer.append($card);
          });
        }
      });

      // Refresh progress metrics on the left
      WorkoutApp.WorkoutTypes.render();
      
      // Re-initialize droppable areas
      this.initDroppable();
    },

    /**
     * Initializes the jQuery UI Droppable areas.
     */
    initDroppable: function() {
      const self = this;

      $('.calendar-column').droppable({
        accept: '.draggable-workout, .scheduled-card',
        activeClass: 'day-droppable-active',
        hoverClass: 'day-droppable-hover',
        drop: function(event, ui) {
          const day = $(this).data('day');
          
          if (ui.draggable.hasClass('scheduled-card')) {
            // Re-schedule an existing event to a different day
            const itemId = ui.draggable.data('id');
            self.moveWorkoutToDay(itemId, day);
          } else {
            // Add a brand new event
            const typeId = ui.draggable.data('id');
            self.addWorkoutToDay(typeId, day);
          }
        }
      });
    },

    /**
     * Reschedules an existing scheduled workout to a new day.
     */
    moveWorkoutToDay: function(itemId, day) {
      const items = WorkoutApp.Storage.getCalendarItems();
      const item = items.find(i => i.id === itemId);
      if (item) {
        // Only trigger update if the day has actually changed
        if (item.day !== day) {
          item.day = day;
          WorkoutApp.Storage.saveCalendarItems(items);
          this.render();
        }
      }
    },

    /**
     * Adds a workout type to a specific calendar day.
     * Assigns sensible default values based on the workout's metric.
     */
    addWorkoutToDay: function(typeId, day) {
      const types = WorkoutApp.Storage.getWorkoutTypes();
      const type = types.find(t => t.id === typeId);
      if (!type) return;

      // Determine smart default values based on metric type
      let defaultValue = 1;
      if (type.metric === 'distance') defaultValue = 3;   // e.g. 3 miles
      if (type.metric === 'duration') defaultValue = 30;  // e.g. 30 minutes

      const items = WorkoutApp.Storage.getCalendarItems();
      const newItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        typeId: typeId,
        day: day,
        value: defaultValue
      };

      items.push(newItem);
      WorkoutApp.Storage.saveCalendarItems(items);

      this.render();
    },

    /**
     * Updates the logged/planned value of a calendar item.
     */
    updateItemValue: function(itemId, newValue) {
      const items = WorkoutApp.Storage.getCalendarItems();
      const item = items.find(i => i.id === itemId);
      if (item) {
        item.value = Number(newValue);
        WorkoutApp.Storage.saveCalendarItems(items);
        
        // Refresh sidebar progress values (no full re-render of calendar needed)
        WorkoutApp.WorkoutTypes.render();
      }
    },

    /**
     * Removes an item from the calendar.
     */
    removeItem: function(itemId) {
      let items = WorkoutApp.Storage.getCalendarItems();
      items = items.filter(i => i.id !== itemId);
      WorkoutApp.Storage.saveCalendarItems(items);

      this.render();
    }
  };
})();
