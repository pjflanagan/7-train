// Workout Week - Local Storage Service
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  const STORAGE_KEYS = {
    WORKOUT_TYPES: 'workout_week_types',
    CALENDAR_ITEMS: 'workout_week_calendar',
    DAY_NOTES: 'workout_week_notes',
    LINKS: 'workout_week_links'
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
      color: '#ff4d4d' // Vibrant Red
    },
    {
      id: 'type-lift',
      name: 'Lift',
      icon: 'fitness_center',
      metric: 'times',
      unit: 'times',
      target: 3,
      color: '#a855f7' // Sunset Purple
    },
    {
      id: 'type-bike',
      name: 'Bike',
      icon: 'directions_bike',
      metric: 'distance',
      unit: 'miles',
      target: 25,
      color: '#10b981' // Emerald Green
    },
    {
      id: 'type-swim',
      name: 'Swim',
      icon: 'pool',
      metric: 'duration',
      unit: 'mins',
      target: 90,
      color: '#06b6d4' // Ocean Blue
    },
    {
      id: 'type-yoga',
      name: 'Yoga',
      icon: 'self_improvement',
      metric: 'duration',
      unit: 'mins',
      target: 60,
      color: '#f59e0b' // Gold Amber
    }
  ];

  const DEFAULT_CALENDAR_ITEMS = [
    {
      id: 'item-1',
      typeId: 'type-run',
      day: 'monday',
      value: 3
    },
    {
      id: 'item-2',
      typeId: 'type-lift',
      day: 'tuesday',
      value: 1
    },
    {
      id: 'item-3',
      typeId: 'type-bike',
      day: 'wednesday',
      value: 12
    },
    {
      id: 'item-4',
      typeId: 'type-yoga',
      day: 'thursday',
      value: 30
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
    }
  };
})();
