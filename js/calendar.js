// Workout Week - Calendar Management
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  WorkoutApp.Calendar = {
    /**
     * Initializes calendar event handlers.
     */
    init: function() {
      // Clear week 1 button
      $('#clear-week-1-btn').on('click', () => {
        if (confirm('Are you sure you want to clear all workouts and notes for this week?')) {
          this.clearWeek(1);
        }
      });

      // Clear week 2 button
      $('#clear-week-2-btn').on('click', () => {
        if (confirm('Are you sure you want to clear all workouts and notes for next week?')) {
          this.clearWeek(2);
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

      // Hook up copy week button
      $('#copy-week-btn').on('click', () => {
        if (confirm("Are you sure you want to copy this week's workouts and notes to next week? This will overwrite next week's plan.")) {
          this.copyWeek1ToWeek2();
        }
      });

      // Start auto-update interval for today highlights and dates (every 60 seconds)
      setInterval(() => {
        this.updateTodayHighlightAndDates();
      }, 60000);
    },

    /**
     * Recalculates and updates the today column highlights and dates in the headers without rebuilding items.
     */
    updateTodayHighlightAndDates: function() {
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
          const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
          
          const $dayColumn = $(`.calendar-column[data-day="${day}"][data-week="${week}"]`);
          $dayColumn.find('.day-name').text(`${capitalizedDay} - ${dayOfMonth}`);
        });
      });
    },

    /**
     * Renders the columns of the calendar with their scheduled cards and loads notes.
     */
    render: function() {
      const self = this;
      const types = WorkoutApp.Storage.getWorkoutTypes();
      const items = WorkoutApp.Storage.getCalendarItems();

      // Update today highlight and calendar header dates
      this.updateTodayHighlightAndDates();

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

            const showSubtitle = !!item.workoutType;

            const $card = $(`
              <div class="scheduled-card" data-id="${item.id}" style="border-left: 4px solid ${type.color}">
                <div class="scheduled-card-header" style="${(isTimesMetric && !showSubtitle) ? 'margin-bottom: 0;' : ''}">
                  <div class="scheduled-info">
                    <span class="material-icons card-type-icon" style="color: ${type.color}">${type.icon}</span>
                    <div class="card-titles">
                      <span class="card-type-name">${type.name}</span>
                      ${showSubtitle ? `<span class="card-type-subtitle">${item.workoutType}</span>` : ''}
                    </div>
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
      
      // Re-initialize sortable areas
      this.initSortable();
    },

    /**
     * Initializes the jQuery UI Sortable areas.
     */
    initSortable: function() {
      const self = this;

      $('.calendar-day-items').sortable({
        connectWith: '.calendar-day-items',
        items: '.scheduled-card',
        placeholder: 'scheduled-card-placeholder',
        tolerance: 'pointer',
        start: function(event, ui) {
          self.dragHandled = false;
          $('body').addClass('is-dragging');
          ui.placeholder.height(ui.item.outerHeight());
          ui.placeholder.css({
            'background-color': 'rgba(255, 255, 255, 0.03)',
            'border': '2px dashed var(--border-color)',
            'border-radius': 'var(--border-radius-md)',
            'box-sizing': 'border-box'
          });
        },
        activate: function(event, ui) {
          $(this).closest('.calendar-column').addClass('day-droppable-active');
        },
        deactivate: function(event, ui) {
          $(this).closest('.calendar-column').removeClass('day-droppable-active day-droppable-hover');
        },
        over: function(event, ui) {
          $(this).closest('.calendar-column').addClass('day-droppable-hover');
        },
        out: function(event, ui) {
          $(this).closest('.calendar-column').removeClass('day-droppable-hover');
        },
        receive: function(event, ui) {
          if (self.dragHandled) return;
          self.dragHandled = true;

          if (ui.item.hasClass('draggable-workout') || ui.item.hasClass('draggable-subtag')) {
            const typeId = ui.item.data('id');
            const tag = ui.item.data('tag') || null;
            const $column = $(this).closest('.calendar-column');
            const day = $column.data('day');
            const week = $column.data('week') || 1;
            
            const index = ui.item.index();

            // Cancel the sortable action so jQuery UI doesn't interfere with rendering
            $('.calendar-day-items').sortable('cancel');

            // Add the new workout at this index on next tick
            setTimeout(() => {
              self.addWorkoutToDayAtIndex(typeId, day, week, index, tag);
            }, 0);
          }
        },
        stop: function(event, ui) {
          $('body').removeClass('is-dragging');
          if (!ui.item.hasClass('draggable-workout') && !ui.item.hasClass('draggable-subtag')) {
            self.dragHandled = true;
            setTimeout(() => {
              self.saveLayoutFromDOM();
            }, 0);
          }
        }
      });

      // Enable the entire column as a droppable target on empty days (allows drops on header/notes)
      $('.calendar-column').droppable({
        accept: '.draggable-workout, .draggable-subtag, .scheduled-card',
        tolerance: 'pointer',
        activate: function(event, ui) {
          const $column = $(this);
          const hasCards = $column.find('.calendar-day-items .scheduled-card').length > 0;
          if (!hasCards) {
            $column.addClass('day-droppable-active');
          }
        },
        deactivate: function(event, ui) {
          $(this).removeClass('day-droppable-active day-droppable-hover');
        },
        over: function(event, ui) {
          const $column = $(this);
          const hasCards = $column.find('.calendar-day-items .scheduled-card').length > 0;
          if (!hasCards) {
            $column.addClass('day-droppable-hover');
          }
        },
        out: function(event, ui) {
          $(this).removeClass('day-droppable-hover');
        },
        drop: function(event, ui) {
          const $column = $(this);
          const $dayItemsContainer = $column.find('.calendar-day-items');
          const hasCards = $dayItemsContainer.find('.scheduled-card').length > 0;
          
          if (!hasCards) {
            if (self.dragHandled) return;
            self.dragHandled = true;

            const day = $column.data('day');
            const week = $column.data('week') || 1;
            
            // Find what was dropped
            const isWorkout = ui.draggable.hasClass('draggable-workout');
            const isSubtag = ui.draggable.hasClass('draggable-subtag');
            
            if (isWorkout || isSubtag) {
              const typeId = ui.draggable.data('id');
              const tag = ui.draggable.data('tag') || null;
              self.addWorkoutToDayAtIndex(typeId, day, week, 0, tag);
            } else if (ui.draggable.hasClass('scheduled-card')) {
              const cardId = ui.draggable.data('id');
              const items = WorkoutApp.Storage.getCalendarItems();
              const item = items.find(i => i.id === cardId);
              if (item) {
                item.day = day;
                item.week = week;
                WorkoutApp.Storage.saveCalendarItems(items);
                self.render();
              }
            }
          }
        }
      });
    },

    /**
     * Reconstructs and saves calendar items based on their current visual order in the DOM.
     */
    saveLayoutFromDOM: function() {
      const items = WorkoutApp.Storage.getCalendarItems();
      const newItems = [];

      [1, 2].forEach(week => {
        DAYS.forEach(day => {
          const $dayColumn = $(`.calendar-column[data-day="${day}"][data-week="${week}"]`);
          const $cards = $dayColumn.find('.scheduled-card');
          
          $cards.each(function() {
            const cardId = $(this).data('id');
            const item = items.find(i => i.id === cardId);
            if (item) {
              item.day = day;
              item.week = week;
              newItems.push(item);
            }
          });
        });
      });

      // Maintain any missing items
      items.forEach(item => {
        if (!newItems.some(ni => ni.id === item.id)) {
          newItems.push(item);
        }
      });

      WorkoutApp.Storage.saveCalendarItems(newItems);
      this.render();
    },

    /**
     * Adds a workout type to a specific calendar day/week at a specific index.
     */
    addWorkoutToDayAtIndex: function(typeId, day, week, index, tag = null) {
      const types = WorkoutApp.Storage.getWorkoutTypes();
      const type = types.find(t => t.id === typeId);
      if (!type) return;

      let defaultValue = 1;
      if (type.metric !== 'times' && type.target && !type.optional) {
        defaultValue = Math.max(0.1, Math.round((type.target / 3) * 10) / 10);
      } else {
        if (type.metric === 'distance') defaultValue = 3;
        if (type.metric === 'duration') defaultValue = 30;
      }

      const items = WorkoutApp.Storage.getCalendarItems();
      const newItem = {
        id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        typeId: typeId,
        day: day,
        week: week,
        value: defaultValue,
        workoutType: tag
      };

      const dayItems = items.filter(item => item.day === day && (item.week || 1) === week);
      const otherItems = items.filter(item => !(item.day === day && (item.week || 1) === week));

      dayItems.splice(index, 0, newItem);

      const combinedItems = [...otherItems, ...dayItems];
      WorkoutApp.Storage.saveCalendarItems(combinedItems);

      this.render();
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

      // Determine smart default values based on metric type and target
      let defaultValue = 1;
      if (type.metric !== 'times' && type.target && !type.optional) {
        defaultValue = Math.max(0.1, Math.round((type.target / 3) * 10) / 10);
      } else {
        if (type.metric === 'distance') defaultValue = 3;   // e.g. 3 miles
        if (type.metric === 'duration') defaultValue = 30;  // e.g. 30 minutes
      }

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
     * Copies Week 1 calendar items and notes over to Week 2.
     */
    copyWeek1ToWeek2: function() {
      // 1. Get current calendar items
      const items = WorkoutApp.Storage.getCalendarItems();
      
      // 2. Filter out current Week 2 items
      const nonWeek2Items = items.filter(item => (item.week || 1) !== 2);
      
      // 3. Get all Week 1 items
      const week1Items = items.filter(item => (item.week || 1) === 1);
      
      // 4. Map Week 1 items to new Week 2 items (with new unique IDs)
      const newWeek2Items = week1Items.map(item => {
        return {
          id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          typeId: item.typeId,
          day: item.day,
          week: 2,
          value: item.value,
          workoutType: item.workoutType
        };
      });
      
      // 5. Save updated items
      const updatedItems = [...nonWeek2Items, ...newWeek2Items];
      WorkoutApp.Storage.saveCalendarItems(updatedItems);
      
      // 6. Copy notes: read Week 1 notes and write to Week 2 notes
      const notes = WorkoutApp.Storage.getDayNotes();
      DAYS.forEach(day => {
        const week1Note = notes[`${day}-1`];
        if (week1Note !== undefined && week1Note !== null) {
          notes[`${day}-2`] = week1Note;
        } else {
          delete notes[`${day}-2`];
        }
      });
      WorkoutApp.Storage.saveDayNotes(notes);
      
      // 7. Render calendar & update notes inputs in DOM
      this.render();
      WorkoutApp.WorkoutTypes.render();

      $('.day-notes-input').each(function() {
        const day = $(this).data('day');
        const week = $(this).data('week');
        const noteKey = `${day}-${week}`;
        $(this).val(notes[noteKey] || '');
      });
    },

    /**
     * Clears all calendar items and notes for a specific week.
     */
    clearWeek: function(targetWeek) {
      // 1. Filter out calendar items for the target week
      let items = WorkoutApp.Storage.getCalendarItems();
      items = items.filter(item => (item.week || 1) !== targetWeek);
      WorkoutApp.Storage.saveCalendarItems(items);

      // 2. Clear day notes for the target week
      const notes = WorkoutApp.Storage.getDayNotes();
      DAYS.forEach(day => {
        delete notes[`${day}-${targetWeek}`];
      });
      WorkoutApp.Storage.saveDayNotes(notes);

      // 3. Render calendar and metrics
      this.render();
      WorkoutApp.WorkoutTypes.render();

      // 4. Reset textareas for this week in the DOM
      $(`.day-notes-input[data-week="${targetWeek}"]`).val('');
    }
  };
})();