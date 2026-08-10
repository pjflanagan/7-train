// Workout Week - Calendar Management
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  WorkoutApp.Calendar = {
    /**
     * Initializes calendar event handlers.
     */
    init: function() {
      // Clear calendar button
      $('#clear-week-btn').on('click', () => {
        if (confirm('Are you sure you want to clear all workouts from the calendar?')) {
          WorkoutApp.Storage.clearCalendar();
          WorkoutApp.Storage.saveDayNotes({});
          this.render();
          WorkoutApp.WorkoutTypes.render();
          
          // Clear notes inputs in DOM
          $('.day-notes-input').val('');
          // Close settings modal
          $('#settings-modal-overlay').removeClass('active');
        }
      });

      // Reset application button
      $('#reset-app-btn').on('click', () => {
        if (confirm('Are you sure you want to reset EVERYTHING back to defaults? This will erase all custom workouts, notes, and planned activities.')) {
          WorkoutApp.Storage.resetToDefaults();
          // Reload page to re-initialize with storage defaults
          window.location.reload();
        }
      });

      // Day notes input listener
      $(document).on('input', '.day-notes-input', function() {
        const day = $(this).data('day');
        const week = $(this).data('week');
        const text = $(this).val();
        
        const notes = WorkoutApp.Storage.getDayNotes();
        notes[`${day}-${week}`] = text;
        WorkoutApp.Storage.saveDayNotes(notes);
      });

      // Hook up advance button
      $('#advance-week-btn').on('click', () => {
        if (confirm('Are you sure you want to advance to the next week? This week\'s workouts will be cleared, and next week\'s workouts and notes will move to this week.')) {
          this.advanceToNextWeek();
        }
      });
    },

    /**
     * Renders the columns of the calendar with their scheduled cards and loads notes.
     */
    render: function() {
      const self = this;
      const types = WorkoutApp.Storage.getWorkoutTypes();
      const items = WorkoutApp.Storage.getCalendarItems();

      // Clear today highlights and compute today
      $('.calendar-column').removeClass('is-today');
      const todayIndex = new Date().getDay();
      const weekdayMap = {
        1: 'monday',
        2: 'tuesday',
        3: 'wednesday',
        4: 'thursday',
        5: 'friday',
        6: 'saturday',
        0: 'sunday'
      };
      const todayDayName = weekdayMap[todayIndex];
      if (todayDayName) {
        $(`.calendar-column[data-day="${todayDayName}"][data-week="1"]`).addClass('is-today');
      }

      // Calculate calendar dates starting from current Monday
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
      const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
      const mondayDate = new Date(today);
      mondayDate.setDate(today.getDate() + mondayDiff);

      [1, 2].forEach(week => {
        DAYS.forEach((day, index) => {
          const columnDate = new Date(mondayDate);
          const totalDaysOffset = (week - 1) * 7 + index;
          columnDate.setDate(mondayDate.getDate() + totalDaysOffset);
          
          const dayOfMonth = columnDate.getDate();
          const capitalizedDay = day.toUpperCase();
          
          const $dayColumn = $(`.calendar-column[data-day="${day}"][data-week="${week}"]`);
          $dayColumn.find('.day-name').text(`${capitalizedDay} - ${dayOfMonth}`);
        });
      });

      // Populate notes from storage (ignoring focused inputs)
      const notes = WorkoutApp.Storage.getDayNotes();
      $('.day-notes-input').each(function() {
        const day = $(this).data('day');
        const week = $(this).data('week');
        const noteKey = `${day}-${week}`;
        if (!$(this).is(':focus')) {
          $(this).val(notes[noteKey] || '');
        }
      });

      // Loop through both weeks
      [1, 2].forEach(week => {
        DAYS.forEach(day => {
          const $dayContainer = $(`.calendar-column[data-day="${day}"][data-week="${week}"] .calendar-day-items`);
          $dayContainer.empty();

          const dayItems = items.filter(item => item.day === day && (item.week || 1) === week);

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
        });
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
          const week = $(this).data('week') || 1;
          
          if (ui.draggable.hasClass('scheduled-card')) {
            // Re-schedule an existing event to a different day/week
            const itemId = ui.draggable.data('id');
            self.moveWorkoutToDay(itemId, day, week);
          } else {
            // Add a brand new event
            const typeId = ui.draggable.data('id');
            self.addWorkoutToDay(typeId, day, week);
          }
        }
      });
    },

    /**
     * Reschedules an existing scheduled workout to a new day/week.
     */
    moveWorkoutToDay: function(itemId, day, week) {
      const items = WorkoutApp.Storage.getCalendarItems();
      const item = items.find(i => i.id === itemId);
      if (item) {
        // Only trigger update if the day or week has actually changed
        if (item.day !== day || (item.week || 1) !== week) {
          item.day = day;
          item.week = week;
          WorkoutApp.Storage.saveCalendarItems(items);
          this.render();
        }
      }
    },

    /**
     * Adds a workout type to a specific calendar day/week.
     * Assigns sensible default values based on the workout's metric.
     */
    addWorkoutToDay: function(typeId, day, week) {
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
        week: week,
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
    },

    /**
     * Advances to the next week (Shift week 2 items & notes to week 1).
     */
    advanceToNextWeek: function() {
      // 1. Shift calendar items
      const items = WorkoutApp.Storage.getCalendarItems();
      const updatedItems = items
        .filter(item => (item.week || 1) !== 1) // Remove week 1 items
        .map(item => {
          return {
            ...item,
            week: 1 // Promote week 2 items to week 1
          };
        });
      WorkoutApp.Storage.saveCalendarItems(updatedItems);

      // 2. Shift day notes
      const notes = WorkoutApp.Storage.getDayNotes();
      const updatedNotes = {};
      DAYS.forEach(day => {
        const nextWeekNote = notes[`${day}-2`];
        if (nextWeekNote) {
          updatedNotes[`${day}-1`] = nextWeekNote;
        }
      });
      WorkoutApp.Storage.saveDayNotes(updatedNotes);

      // 3. Render calendar & update notes inputs in DOM
      this.render();
      WorkoutApp.WorkoutTypes.render();

      $('.day-notes-input').each(function() {
        const day = $(this).data('day');
        const week = $(this).data('week');
        const noteKey = `${day}-${week}`;
        $(this).val(updatedNotes[noteKey] || '');
      });
    }
  };
})();