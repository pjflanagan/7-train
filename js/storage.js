// Workout Week - Local Storage Service
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  const STORAGE_KEYS = {
    WORKOUT_TYPES: 'workout_week_types',
    CALENDAR_ITEMS: 'workout_week_calendar',
    DAY_NOTES: 'workout_week_notes',
    LINKS: 'workout_week_links',
    HISTORY: 'workout_week_history',
    LAST_VIEWED_MONDAY: 'workout_week_last_viewed_monday'
  };

  const DEFAULT_LINKS = [
    {
      id: 'link-1',
      title: 'Gym Pool Schedule',
      url: 'https://www.google.com'
    }
  ];

  const DEFAULT_WORKOUT_TYPES = [
    {
      id: 'type-run',
      name: 'Run',
      icon: 'directions_run',
      metric: 'distance',
      unit: 'miles',
      target: 10,
      color: '#ff4d4d', // Vibrant Red
      workoutTypes: ['Long Run', 'Tempo Run', 'Intervals']
    },
    {
      id: 'type-lift',
      name: 'Lift',
      icon: 'fitness_center',
      metric: 'times',
      unit: 'times',
      target: 3,
      color: '#a855f7', // Sunset Purple
      workoutTypes: ['Chest Day', 'Leg Day', 'Arms']
    },
    {
      id: 'type-bike',
      name: 'Bike',
      icon: 'directions_bike',
      metric: 'distance',
      unit: 'miles',
      target: 25,
      color: '#10b981', // Emerald Green
      workoutTypes: ['Road Bike', 'Mountain Bike']
    },
    {
      id: 'type-swim',
      name: 'Swim',
      icon: 'pool',
      metric: 'duration',
      unit: 'mins',
      target: 90,
      color: '#06b6d4', // Ocean Blue
      workoutTypes: ['Laps', 'Technique']
    },
    {
      id: 'type-yoga',
      name: 'Yoga',
      icon: 'self_improvement',
      metric: 'duration',
      unit: 'mins',
      target: 60,
      color: '#f59e0b', // Gold Amber
      workoutTypes: ['Vinyasa', 'Hatha']
    }
  ];

  const DEFAULT_CALENDAR_ITEMS = [
    {
      id: 'item-1',
      typeId: 'type-run',
      day: 'monday',
      value: 3,
      workoutType: 'Long Run'
    },
    {
      id: 'item-2',
      typeId: 'type-lift',
      day: 'tuesday',
      value: 1,
      workoutType: 'Chest Day'
    },
    {
      id: 'item-3',
      typeId: 'type-bike',
      day: 'wednesday',
      value: 12,
      workoutType: 'Road Bike'
    },
    {
      id: 'item-4',
      typeId: 'type-yoga',
      day: 'thursday',
      value: 30,
      workoutType: 'Vinyasa'
    }
  ];

  WorkoutApp.Storage = {
    /**
     * Retrieves all workout types. Initializes with defaults if empty.
     */
    getWorkoutTypes: function() {
      const data = localStorage.getItem(STORAGE_KEYS.WORKOUT_TYPES);
      if (!data) {
        this.saveWorkoutTypes(DEFAULT_WORKOUT_TYPES);
        return JSON.parse(JSON.stringify(DEFAULT_WORKOUT_TYPES));
      }
      return JSON.parse(data);
    },

    /**
     * Saves workout types to localStorage.
     */
    saveWorkoutTypes: function(types) {
      localStorage.setItem(STORAGE_KEYS.WORKOUT_TYPES, JSON.stringify(types));
    },

    /**
     * Retrieves calendar entries. Initializes with defaults if empty.
     */
    getCalendarItems: function() {
      const data = localStorage.getItem(STORAGE_KEYS.CALENDAR_ITEMS);
      if (!data) {
        this.saveCalendarItems(DEFAULT_CALENDAR_ITEMS);
        return JSON.parse(JSON.stringify(DEFAULT_CALENDAR_ITEMS));
      }
      return JSON.parse(data);
    },

    /**
     * Saves calendar entries to localStorage.
     */
    saveCalendarItems: function(items) {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_ITEMS, JSON.stringify(items));
    },

    /**
     * Retrieves day notes.
     */
    getDayNotes: function() {
      const data = localStorage.getItem(STORAGE_KEYS.DAY_NOTES);
      if (!data) {
        return {};
      }
      return JSON.parse(data);
    },

    /**
     * Saves day notes.
     */
    saveDayNotes: function(notes) {
      localStorage.setItem(STORAGE_KEYS.DAY_NOTES, JSON.stringify(notes));
    },

    /**
     * Retrieves Helpful links. Initializes with defaults if empty.
     */
    getLinks: function() {
      const data = localStorage.getItem(STORAGE_KEYS.LINKS);
      if (!data) {
        this.saveLinks(DEFAULT_LINKS);
        return JSON.parse(JSON.stringify(DEFAULT_LINKS));
      }
      return JSON.parse(data);
    },

    /**
     * Saves Helpful links to localStorage.
     */
    saveLinks: function(links) {
      localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(links));
    },

    /**
     * Retrieves all history items.
     */
    getHistory: function() {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (!data) {
        return [];
      }
      return JSON.parse(data);
    },

    /**
     * Saves history items.
     */
    saveHistory: function(history) {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    },

    /**
     * Checks if real-world time has advanced to a new week, archiving past weeks and shifting calendar items.
     */
    checkAndProcessWeekTransition: function() {
      const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      function formatDateLocal(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }

      // Calculate current Monday's date
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
      const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
      const mondayDate = new Date(today);
      mondayDate.setDate(today.getDate() + mondayDiff);
      const currentMondayStr = formatDateLocal(mondayDate);

      let lastViewedMonday = localStorage.getItem(STORAGE_KEYS.LAST_VIEWED_MONDAY);

      if (!lastViewedMonday) {
        // First time running. Set the marker and stop.
        localStorage.setItem(STORAGE_KEYS.LAST_VIEWED_MONDAY, currentMondayStr);
        return;
      }

      if (lastViewedMonday === currentMondayStr) {
        // No week transition has occurred.
        return;
      }

      // Calculate weeks elapsed
      const lastDate = new Date(lastViewedMonday + 'T00:00:00');
      const currDate = new Date(currentMondayStr + 'T00:00:00');
      const diffTime = currDate - lastDate;
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      const weeksPassed = Math.round(diffDays / 7);

      if (weeksPassed <= 0) {
        // System clock went backwards or value is invalid. Just update the marker.
        localStorage.setItem(STORAGE_KEYS.LAST_VIEWED_MONDAY, currentMondayStr);
        return;
      }

      const activeItems = this.getCalendarItems();
      const activeNotes = this.getDayNotes();
      const history = this.getHistory();

      // Archive weeks step-by-step
      for (let i = 0; i < weeksPassed; i++) {
        const archiveMonday = new Date(lastDate);
        archiveMonday.setDate(lastDate.getDate() + (i * 7));
        const archiveMondayStr = formatDateLocal(archiveMonday);

        const activeWeekNum = i + 1;

        if (activeWeekNum === 1 || activeWeekNum === 2) {
          DAYS.forEach(day => {
            const dayItems = activeItems.filter(item => item.day === day && (item.week || 1) === activeWeekNum);
            const noteText = activeNotes[`${day}-${activeWeekNum}`] || "";

            if (dayItems.length > 0) {
              dayItems.forEach(item => {
                const dayOffset = DAYS.indexOf(day);
                const itemDate = new Date(archiveMonday);
                itemDate.setDate(archiveMonday.getDate() + dayOffset);

                history.push({
                  id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                  date: formatDateLocal(itemDate),
                  day: day,
                  typeId: item.typeId,
                  workoutType: item.workoutType || null,
                  value: item.value,
                  notes: noteText || null
                });
              });
            } else if (noteText) {
              // Note-only record
              const dayOffset = DAYS.indexOf(day);
              const itemDate = new Date(archiveMonday);
              itemDate.setDate(archiveMonday.getDate() + dayOffset);

              history.push({
                id: 'hist-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                date: formatDateLocal(itemDate),
                day: day,
                typeId: null,
                workoutType: null,
                value: null,
                notes: noteText
              });
            }
          });
        }
      }

      // Shift active calendar items
      let updatedActiveItems = [];
      let updatedActiveNotes = {};

      if (weeksPassed === 1) {
        // Old Week 2 becomes new Week 1
        updatedActiveItems = activeItems.filter(item => (item.week || 1) === 2);
        updatedActiveItems.forEach(item => {
          item.week = 1;
        });

        DAYS.forEach(day => {
          if (activeNotes[`${day}-2`]) {
            updatedActiveNotes[`${day}-1`] = activeNotes[`${day}-2`];
          }
        });
      } else {
        // All active items in Week 1 & 2 are in the past. Clear active week.
        updatedActiveItems = [];
        updatedActiveNotes = {};
      }

      // Save transitions
      this.saveHistory(history);
      this.saveCalendarItems(updatedActiveItems);
      this.saveDayNotes(updatedActiveNotes);
      localStorage.setItem(STORAGE_KEYS.LAST_VIEWED_MONDAY, currentMondayStr);
    },

    /**
     * Clears all session progress (calendar items) but keeps workout goals.
     */
    clearCalendar: function() {
      this.saveCalendarItems([]);
    },

    /**
     * Resets everything back to defaults.
     */
    resetToDefaults: function() {
      localStorage.removeItem(STORAGE_KEYS.WORKOUT_TYPES);
      localStorage.removeItem(STORAGE_KEYS.CALENDAR_ITEMS);
      localStorage.removeItem(STORAGE_KEYS.DAY_NOTES);
      localStorage.removeItem(STORAGE_KEYS.LINKS);
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      localStorage.removeItem(STORAGE_KEYS.LAST_VIEWED_MONDAY);
    }
  };
})();
