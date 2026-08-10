# 🌦️ Adding Live Local Weather (No Keys & 100% Free)

This document contains a complete, copy-paste-ready guide to adding live local weather to **Workout Week**. The solution uses a keyless, zero-configuration pipeline that automatically detects location and pulls real-time weather metrics without requesting intrusive browser permissions.

---

## 🗺️ How the Pipeline Works

1. **IP Geolocation (Zero Popups):** We hit `https://ipapi.co/json/` to instantly get coarse coordinates (`latitude`, `longitude`), `city`, `region_code` (State), and `country_code`. This avoids disturbing the user with browser location permissions.
2. **Weather API Fetch (Open-Meteo):** We hit `https://api.open-meteo.com/v1/forecast` with the coordinates.
   - **Smart Units:** If `country_code` is `"US"`, temperature unit is set to `fahrenheit`. Otherwise, it default to `celsius`.
3. **Symbol Translation:** We map the WMO weather codes (0-99) returned by Open-Meteo to appropriate Google Material Icons.

---

## 📂 Step-by-Step Implementation

### Step 1: Create `js/weather.js`
Create a new file named `js/weather.js` and paste the following standalone service code:

```javascript
// Workout Week - Live Weather Service (Keyless & Free)
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  WorkoutApp.Weather = {
    init: function($container) {
      if (!$container || $container.length === 0) return;

      // Render loading state
      $container.html(`
        <div class="weather-loading">
          <span class="material-icons rotating">sync</span>
          <span>Loading weather...</span>
        </div>
      `);

      // 1. Get Location via Coarse IP Geolocation
      $.getJSON('https://ipapi.co/json/')
        .done(function(locData) {
          const lat = locData.latitude;
          const lon = locData.longitude;
          const city = locData.city || 'Local';
          const region = locData.region_code || '';
          const country = locData.country_code || 'US';
          const locationString = region ? `${city}, ${region}` : city;

          // Determine temperature unit based on country
          const isUS = country === 'US';
          const unitParam = isUS ? 'fahrenheit' : 'celsius';
          const unitSymbol = isUS ? '°F' : '°C';

          // 2. Query Free Open-Meteo Weather API
          const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${unitParam}`;

          $.getJSON(weatherUrl)
            .done(function(weatherData) {
              const current = weatherData.current_weather;
              if (!current) {
                $container.html('<span class="weather-err">No weather data</span>');
                return;
              }

              const temp = Math.round(current.temperature);
              const code = current.weathercode;
              const mapped = WorkoutApp.Weather.getWeatherDetails(code);

              // 3. Render Weather Capsule
              $container.html(`
                <div class="header-weather-capsule" title="${mapped.desc} in ${locationString}">
                  <span class="material-icons weather-icon" style="color: ${mapped.color};">${mapped.icon}</span>
                  <div class="weather-info">
                    <span class="weather-temp">${temp}${unitSymbol}</span>
                    <span class="weather-desc">${mapped.desc}</span>
                  </div>
                  <span class="weather-location">${locationString}</span>
                </div>
              `);
            })
            .fail(function() {
              $container.html('<span class="weather-err">Weather unavailable</span>');
            });
        })
        .fail(function() {
          $container.html('<span class="weather-err">Location blocked</span>');
        });
    },

    /**
     * Translates WMO weather codes (0-99) to descriptive strings and Google Material Icons
     */
    getWeatherDetails: function(code) {
      // WMO Code list: https://open-meteo.com/en/docs
      if (code === 0) {
        return { icon: 'wb_sunny', desc: 'Sunny', color: '#f59e0b' }; // Amber
      }
      if (code >= 1 && code <= 3) {
        return { icon: 'filter_drama', desc: 'Partly Cloudy', color: '#94a3b8' }; // Muted blue-gray
      }
      if (code === 45 || code === 48) {
        return { icon: 'blur_on', desc: 'Foggy', color: '#64748b' };
      }
      if ((code >= 51 && code <= 55) || (code >= 61 && code <= 65)) {
        return { icon: 'umbrella', desc: 'Raining', color: '#3b82f6' }; // Rain blue
      }
      if ((code >= 56 && code <= 57) || (code >= 66 && code <= 67) || (code >= 80 && code <= 82)) {
        return { icon: 'water_drop', desc: 'Showers', color: '#60a5fa' };
      }
      if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        return { icon: 'ac_unit', desc: 'Snowing', color: '#22d3ee' }; // Teal-blue snow
      }
      if (code >= 95 && code <= 99) {
        return { icon: 'thunderstorm', desc: 'Thunderstorms', color: '#eab308' }; // Bright gold lightning
      }
      return { icon: 'wb_cloudy', desc: 'Cloudy', color: '#cbd5e1' };
    }
  };
})();
```

---

### Step 2: Incorporate styles into `css/base.css`
Paste these CSS rules at the bottom of `css/base.css` to beautifully integrate the capsule:

```css
/* --- Live Weather Capsule --- */
.header-weather-capsule {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  padding: 0.4rem 0.85rem;
  border-radius: var(--border-radius-md);
  margin-right: 0.5rem;
  transition: var(--transition-smooth);
}

.header-weather-capsule:hover {
  border-color: var(--border-focus);
  background-color: rgba(255, 255, 255, 0.05);
}

.weather-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text-dim);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0 0.5rem;
}

.rotating {
  animation: spin-animation 1.5s linear infinite;
  font-size: 16px;
}

@keyframes spin-animation {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.weather-icon {
  font-size: 18px;
  display: flex;
  align-items: center;
}

.weather-info {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.weather-temp {
  font-size: 0.8rem;
  font-weight: 800;
  color: white;
}

.weather-desc {
  font-size: 0.625rem;
  color: var(--text-muted);
  font-weight: 600;
}

.weather-location {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-dim);
  border-left: 1px solid var(--border-color);
  padding-left: 0.65rem;
  margin-left: 0.25rem;
  white-space: nowrap;
}

.weather-err {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-dim);
}
```

---

### Step 3: Insert into `index.html`

1. **Add the Weather Placeholder** inside the `<header>` element, right at the start of the `<div class="header-actions">` wrapper:
   ```html
   <div class="header-actions">
     <!-- Added Live Weather Container -->
     <div id="header-weather-widget"></div>

     <button id="clear-week-btn" class="btn btn-secondary" title="Clear all workouts from the calendar">
       ...
   ```

2. **Register the JS files** at the bottom of the `index.html` file:
   ```html
     <!-- App Scripts -->
     <script src="js/storage.js"></script>
     <script src="js/progress.js"></script>
     <script src="js/weather.js"></script> <!-- Added script -->
     <script src="js/workout-types.js"></script>
     <script src="js/calendar.js"></script>
     <script src="js/app.js"></script>
   ```

---

### Step 4: Boot from `js/app.js`
Inside the application setup (`WorkoutApp.App.init`), boot the weather service:

```javascript
// Inside WorkoutApp.App.init:
WorkoutApp.Weather.init($('#header-weather-widget'));
```
