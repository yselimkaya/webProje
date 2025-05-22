
const API_KEY = 'dab448731c14ff72410a4fd848079b58';

// OpenWeather 3.0 Cagrilari
const GEOCODING_API_URL = 'https://api.openweathermap.org/geo/1.0/direct';
const ONE_CALL_API_URL   = 'https://api.openweathermap.org/data/3.0/onecall';

// jQuery
const $citySelect            = $('#citySelect');
const $searchButton          = $('#searchButton');
const $currentLocationButton = $('#currentLocationButton');
const $loading               = $('#loading');
const $errorMessage          = $('#error-message');
const $weatherDisplay        = $('#weather-display');
const $currentDateElem       = $('#currentDate');
const $currentYearElem       = $('#currentYear');

$currentYearElem.text(new Date().getFullYear());


// Yardımcılar

function isPlaceholderKey (key) {
  return !key || key === 'YOUR_API_KEY_HERE';
}
function showLoadingState () {
  $loading.show();
  $errorMessage.hide();
  $weatherDisplay.hide();
}

function hideLoadingState () {
  $loading.hide();
}

function showError (msg) {
  $errorMessage.html(`<i class="fas fa-exclamation-triangle mr-2"></i>${msg}`).show();
}

function capitalizeFirstLetter (str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatTime (unixTs, tzOffset) {
  const localTs = unixTs + tzOffset;
  const d = new Date(localTs * 1000);
  return d.getUTCHours().toString().padStart(2, '0') + ':' +
         d.getUTCMinutes().toString().padStart(2, '0');
}

function handleApiError (jqXHR, errorThrown, ctx) {
  hideLoadingState();
  let msg = `(${ctx}) veri alınırken hata oluştu.`;

  if (jqXHR.status === 401) {
    msg = 'API anahtarı geçersiz veya One Call 3.0 planı aktif değil.';
  } else if (jqXHR.status === 404) {
    msg = `(${ctx}) kaynak bulunamadı; şehir/koordinat hatalı olabilir.`;
  } else if (jqXHR.status === 0 && errorThrown === 'error') {
    msg = 'Ağ bağlantısı hatası — internet veya CORS engeli kontrol et.';
  } else if (jqXHR.responseJSON?.message) {
    msg = `API Hatası (${ctx}): ${jqXHR.responseJSON.message}`;
  }

  showError(msg);
  console.error(`API Error [${ctx}]`, jqXHR.status, jqXHR.responseText, errorThrown);
}


$searchButton.on('click', () => {
  const city = $citySelect.val();
  city ? getCoordinatesAndFetchWeather(city)
       : showError('Lütfen bir şehir seçin.');
});

$citySelect.on('change', () => $searchButton.click());

$currentLocationButton.on('click', () => {
  if (!navigator.geolocation) {
    showError('Tarayıcınız konum servisini desteklemiyor.');
    return;
  }

  showLoadingState();
  navigator.geolocation.getCurrentPosition(
    pos => fetchWeatherData(pos.coords.latitude, pos.coords.longitude),
    err => {
      hideLoadingState();
      showError('Konum alınamadı. İzinleri kontrol edin veya listeden şehir seçin.');
      console.error('Geolocation error:', err.message);
    }
  );
});


// API Çağrıları

function getCoordinatesAndFetchWeather (cityName) {
  if (isPlaceholderKey(API_KEY)) {
    showError('API_KEY ayarlanmamış. script.js içindeki sabiti güncelle!');
    return;
  }

  showLoadingState();

  $.ajax({
    url: `${GEOCODING_API_URL}?q=${encodeURIComponent(cityName)}&limit=1&appid=${API_KEY}`,
    dataType: 'json'
  })
    .done(geo => {
      if (geo?.length) {
        fetchWeatherData(geo[0].lat, geo[0].lon, cityName);
      } else {
        hideLoadingState();
        showError(`'${cityName}' için koordinat bulunamadı.`);
      }
    })
    .fail((jq, _ts, err) => handleApiError(jq, err, 'Koordinat Alma'));
}

function fetchWeatherData (lat, lon, originalCityName = null) {
  if (isPlaceholderKey(API_KEY)) {
    if (!originalCityName) hideLoadingState();
    showError('API_KEY ayarlanmamış. script.js içindeki sabiti güncelle!');
    return;
  }

  if (!originalCityName) showLoadingState();

  $.ajax({
    url: `${ONE_CALL_API_URL}?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric&lang=tr&exclude=minutely,alerts`,
    dataType: 'json'
  })
    .done(data => {
      displayCurrentWeather(data, originalCityName);
      displayForecast(data);
      hideLoadingState();
      $weatherDisplay.show();

      const cityToSet = originalCityName || data.timezone?.split('/')[1].replace('_', ' ');
      updateCityDropdown(cityToSet);
    })
    .fail((jq, _ts, err) => handleApiError(jq, err, 'Hava Durumu Alma'));
}


// UI güncelleme

function updateCityDropdown (cityName) {
  if (!cityName) return;
  const exists = $citySelect.find(`option[value="${cityName}"]`).length;
  if (!exists) {
    $citySelect.prepend(new Option(cityName, cityName, true, true));
  }
  $citySelect.val(cityName);
}

function displayCurrentWeather (data, originalCityName = null) {
  const current  = data.current;
  const tzOffset = data.timezone_offset;

  $currentDateElem.text(
    new Date((current.dt + tzOffset) * 1000)
      .toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  );

  const name = originalCityName || data.timezone?.split('/')[1].replace('_', ' ') || 'Konumunuz';
  $('#cityName').text(name);

  $('#weatherIcon').attr({
    src: `https://openweathermap.org/img/wn/${current.weather[0].icon}@4x.png`,
    alt: current.weather[0].description
  });

  $('#weatherDescription').text(capitalizeFirstLetter(current.weather[0].description));
  $('#temperature').html(`${Math.round(current.temp)}°<span class="celsius-symbol">C</span>`);
  $('#feelsLike').html(`Hissedilen: ${Math.round(current.feels_like)}°C`);

  $('#humidity').html(`<i class="fas fa-tint fa-fw"></i> Nem <span>${current.humidity}%</span>`);
  $('#windSpeed').html(`<i class="fas fa-wind fa-fw"></i> Rüzgar <span>${current.wind_speed.toFixed(1)} m/s</span>`);
  $('#pressure').html(`<i class="fas fa-tachometer-alt fa-fw"></i> Basınç <span>${current.pressure} hPa</span>`);
  $('#visibility').html(`<i class="fas fa-eye fa-fw"></i> Görüş <span>${(current.visibility / 1000).toFixed(1)} km</span>`);
  $('#sunrise').html(`<i class="fas fa-sun fa-fw"></i> Gün Doğumu <span>${formatTime(current.sunrise, tzOffset)}</span>`);
  $('#sunset').html(`<i class="fas fa-moon fa-fw"></i> Gün Batımı <span>${formatTime(current.sunset, tzOffset)}</span>`);
}

function displayForecast (data) {
  const $cards    = $('#forecast-cards').empty();
  const tzOffset  = data.timezone_offset;
  const forecasts = data.daily.slice(1, 6);

  forecasts.forEach(d => {
    const dateStr     = new Date((d.dt + tzOffset) * 1000)
      .toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' });
    const minTemp     = Math.round(d.temp.min);
    const maxTemp     = Math.round(d.temp.max);
    const icon        = d.weather[0].icon;
    const description = capitalizeFirstLetter(d.weather[0].description);

    $cards.append(`
      <div class="col-lg col-md-4 col-sm-6 mb-3 d-flex">
        <div class="card forecast-card text-center h-100 flex-fill">
          <div class="card-body d-flex flex-column justify-content-between">
            <div>
              <h5 class="card-title">${dateStr}</h5>
              <img src="https://openweathermap.org/img/wn/${icon}@2x.png" alt="${description}" class="weather-icon-small my-2">
            </div>
            <div>
              <p class="card-text font-weight-bold mb-1">${maxTemp}° / ${minTemp}°C</p>
              <p class="card-text text-muted small">${description}</p>
            </div>
          </div>
        </div>
      </div>
    `);
  });
}

//Baslangic
const defaultCity = $citySelect.val();
if (isPlaceholderKey(API_KEY)) {
  showError("API_KEY ayarlanmadı. 'script.js' içinde kendi anahtarını yaz.");
} else if (defaultCity) {
  getCoordinatesAndFetchWeather(defaultCity);
}
