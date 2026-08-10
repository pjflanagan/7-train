// Workout Week - Progress Tracking Service
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  WorkoutApp.Progress = {
    /**
     * Calculates the aggregate totals and percentage completion for each workout type.
     * @param {Array} types - List of workout types.
     * @param {Array} items - List of scheduled calendar items.
     * @returns {Object} Progress mapping by workout type ID.
     */
    calculateProgress: function(types, items) {
      const progressMap = {};

      // Initialize progress for all types
      types.forEach(type => {
        progressMap[type.id] = {
          type: type,
          current: 0,
          target: Number(type.target) || 0,
          percent: 0,
          isDone: false
        };
      });

      // Sum values from calendar items
      items.forEach(item => {
        const typeProgress = progressMap[item.typeId];
        if (typeProgress) {
          typeProgress.current += Number(item.value) || 0;
        }
      });

      // Compute percentages and completions
      types.forEach(type => {
        const p = progressMap[type.id];
        if (p.target > 0) {
          // Round to 1 decimal place if float, else keep as integer
          p.current = Math.round(p.current * 100) / 100;
          p.percent = Math.min(100, Math.round((p.current / p.target) * 100));
          p.isDone = p.current >= p.target;
        } else {
          p.percent = 100;
          p.isDone = true;
        }
      });

      return progressMap;
    },

    /**
     * Calculates overall weekly completeness.
     * @param {Object} progressMap - Map returned by calculateProgress.
     * @returns {Object} Overall completion metrics.
     */
    getOverallProgress: function(progressMap) {
      const keys = Object.keys(progressMap);
      if (keys.length === 0) {
        return { completed: 0, total: 0, percent: 0 };
      }

      let completed = 0;
      let sumPercent = 0;
      keys.forEach(key => {
        const p = progressMap[key];
        if (p.isDone) {
          completed++;
        }
        sumPercent += p.percent;
      });

      const total = keys.length;
      const percent = Math.round(sumPercent / total);

      return {
        completed: completed,
        total: total,
        percent: percent
      };
    }
  };
})();
