// Workout Week - Live 7-Day Weather Forecast Service
(function() {
  window.WorkoutApp = window.WorkoutApp || {};

  WorkoutApp.Weather = {
    // Elegant final fallback location (New York City)
    DEFAULT_LOCATION: {
      latitude: 40.7128,
      longitude: -74.0060,
      city: 'New York',
      region_code: 'NY',
      country_code: 'US'
    },

    init: function() {
      // 1. Fetch location coordinates and proceed to pull daily forecasts
      this.fetchLocationAndWeather();
    },

    fetchLocationAndWeather: function() {
      const self = this;

      // Layer 1: Attempt standard ipapi.co
      $.getJSON('https://ipapi.co/json/')
        .done(function(locData) {
          self.getForecastForCoords({
            latitude: locData.latitude,
            longitude: locData.longitude,
            country_code: locData.country_code || 'US',
            city: locData.city,
            region_code: locData.region_code
          });
        })
        .fail(function() {
          // Layer 2: Fallback to high-availability freeipapi.com (Cloudflare hosted)
          console.warn('Weather: Layer 1 IP geolocation blocked/failed. Trying Layer 2...');
          $.getJSON('https://freeipapi.com/api/json')
            .done(function(locData) {
              self.getForecastForCoords({
                latitude: locData.latitude,
                longitude: locData.longitude,
                country_code: locData.countryCode || 'US',
                city: locData.cityName,
                region_code: locData.regionCode
              });
            })
            .fail(function() {
              // Layer 3: Fallback to Browser Native Geolocation (Requires user prompt)
              console.warn('Weather: Layer 2 IP geolocation failed/blocked. Attempting Browser Geolocation...');
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  function(position) {
                    self.getForecastForCoords({
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      country_code: 'US'
                    });
                  },
                  function() {
                    // Layer 4: Final beautiful fallback to NYC so the app remains fully functional
                    console.warn('Weather: Browser geolocation denied/timed out. Using New York City fallback...');
                    self.getForecastForCoords(self.DEFAULT_LOCATION);
                  },
                  { timeout: 4000 }
                );
              } else {
                // Layer 4: Geolocation unsupported
                console.warn('Weather: Browser geolocation unsupported. Using New York City fallback...');
                self.getForecastForCoords(self.DEFAULT_LOCATION);
              }
            });
        });
    },

    getForecastForCoords: function(loc) {
      const lat = loc.latitude;
      const lon = loc.longitude;
      const country = loc.country_code;

      // Update settings panel location text
      this.updateLocationDisplay(loc);

      // Determine temperature unit based on country
      const isUS = country === 'US';
      const unitParam = isUS ? 'fahrenheit' : 'celsius';
      const unitSymbol = isUS ? '°F' : '°C';

      // Query Open-Meteo for 7-day daily maximum temperature and weather codes
      const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&timezone=auto&temperature_unit=${unitParam}`;

      $.getJSON(weatherUrl)
        .done(function(weatherData) {
          const daily = weatherData.daily;
          if (!daily || !daily.time || !daily.weathercode || !daily.temperature_2m_max) {
            console.error('Weather: Invalid forecast data returned.');
            return;
          }

          // Loop through the 7 days returned and map them to their corresponding calendar day column
          for (let i = 0; i < daily.time.length; i++) {
            const dateStr = daily.time[i];
            const code = daily.weathercode[i];
            const temp = Math.round(daily.temperature_2m_max[i]);

            // Parse date in local time to avoid timezone offset mismatches
            const d = new Date(dateStr + 'T00:00:00');
            const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

            // Weekday index to calendar-column attribute values
            const weekdayMap = {
              1: 'monday',
              2: 'tuesday',
              3: 'wednesday',
              4: 'thursday',
              5: 'friday',
              6: 'saturday',
              0: 'sunday'
            };

            const dayKey = weekdayMap[dayOfWeek];
            if (dayKey) {
              const mapped = WorkoutApp.Weather.getWeatherDetails(code);
              const $daySub = $(`.calendar-column[data-day="${dayKey}"][data-week="1"] .day-sub`);
              
              if ($daySub.length > 0) {
                // Render the weather pill inside the .day-sub element!
                $daySub.html(`
                  <span class="daily-weather-sub" title="${mapped.desc}">
                    <span class="material-symbols-outlined daily-weather-icon" style="color: ${mapped.color}">${mapped.icon}</span>
                    <span class="daily-weather-temp">${temp}${unitSymbol}</span>
                  </span>
                `);
              }
            }
          }
        })
        .fail(function() {
          console.error('Weather: Failed to retrieve forecast data.');
        });
    },

    updateLocationDisplay: function(loc) {
      if (!loc.city || !loc.region_code) {
        // Need to reverse-geocode
        const geocodeUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${loc.latitude}&longitude=${loc.longitude}&localityLanguage=en`;
        $.getJSON(geocodeUrl)
          .done(function(geoData) {
            const cityOrLocality = geoData.locality || geoData.city || 'Unknown';
            let region = geoData.principalSubdivision || '';
            if (geoData.principalSubdivisionCode && geoData.principalSubdivisionCode.includes('-')) {
              region = geoData.principalSubdivisionCode.split('-')[1];
            }
            const displayStr = region ? `${cityOrLocality}, ${region}` : cityOrLocality;
            $('#settings-weather-location').text(`Weather data shown for ${displayStr}`);
          })
          .fail(function() {
            // Fallback to coordinates
            const displayStr = `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`;
            $('#settings-weather-location').text(`Weather data shown for ${displayStr}`);
          });
      } else {
        const displayStr = loc.region_code ? `${loc.city}, ${loc.region_code}` : loc.city;
        $('#settings-weather-location').text(`Weather data shown for ${displayStr}`);
      }
    },

    /**
     * Translates WMO weather codes (0-99) to descriptive strings and Google Material Icons
     */
    getWeatherDetails: function(code) {
      if (code === 0) {
        return { icon: 'wb_sunny', desc: 'Sunny', color: '#f59e0b' }; // Amber
      }
      if (code >= 1 && code <= 3) {
        return { icon: 'filter_drama', desc: 'Partly Cloudy', color: '#94a3b8' }; // Gray
      }
      if (code === 45 || code === 48) {
        return { icon: 'blur_on', desc: 'Foggy', color: '#64748b' };
      }
      if ((code >= 51 && code <= 55) || (code >= 61 && code <= 65)) {
        return { icon: 'rainy', desc: 'Raining', color: '#3b82f6' }; // Rain blue
      }
      if ((code >= 56 && code <= 57) || (code >= 66 && code <= 67) || (code >= 80 && code <= 82)) {
        return { icon: 'water_drop', desc: 'Showers', color: '#60a5fa' };
      }
      if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
        return { icon: 'ac_unit', desc: 'Snowing', color: '#22d3ee' }; // Snowflake teal
      }
      if (code >= 95 && code <= 99) {
        return { icon: 'thunderstorm', desc: 'Thunderstorms', color: '#eab308' }; // Yellow lightning
      }
      return { icon: 'wb_cloudy', desc: 'Cloudy', color: '#cbd5e1' };
    }
  };
})();
