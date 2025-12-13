# iOS Safari Fix Guide / Руководство по исправлению проблемы iOS Safari

## Problem / Проблема

На iPhone (iOS Safari) приложение показывает "Ошибка загрузки данных о ветре", в то время как на Android все работает нормально.

On iPhone (iOS Safari), the app shows "Error loading wind data", while on Android everything works fine.

## Root Cause / Причина

iOS Safari имеет более строгие правила безопасности для CORS (Cross-Origin Resource Sharing) запросов, чем Chrome на Android. Service Worker может блокировать или некорректно обрабатывать API запросы.

iOS Safari has stricter security policies for CORS (Cross-Origin Resource Sharing) requests than Chrome on Android. The Service Worker may block or incorrectly handle API requests.

## Solutions Implemented / Реализованные решения

### 1. Enhanced Fetch Error Handling / Улучшенная обработка ошибок fetch

**File:** `js/WindDataManager.js:16-67`

Добавлены:
- Explicit CORS mode и cache control
- Детальное логирование ошибок
- User-friendly error messages
- Проверка offline режима от Service Worker

Added:
- Explicit CORS mode and cache control
- Detailed error logging
- User-friendly error messages
- Service Worker offline mode detection

```javascript
const response = await fetch(this.apiUrl, {
    method: 'GET',
    headers: {
        'Accept': 'application/json',
    },
    mode: 'cors',
    cache: 'no-cache'
});
```

### 2. Service Worker Improvements / Улучшения Service Worker

**File:** `sw.js`

Изменения:
- Updated cache version to v1.2.4
- Added explicit CORS mode and credentials handling
- Enhanced logging for debugging
- Better error handling

```javascript
const response = await fetch(request, {
    mode: 'cors',
    credentials: 'omit'
});
```

### 3. Offline Detection / Определение офлайн режима

Приложение теперь проверяет, находится ли оно в офлайн режиме (данные от Service Worker) и показывает соответствующее сообщение.

The app now checks if it's in offline mode (data from Service Worker) and shows appropriate message.

## Testing / Тестирование

### For Developers / Для разработчиков

1. Open Safari DevTools on iPhone (Settings → Safari → Advanced → Web Inspector)
2. Check Console for error messages starting with `[SW]` or `Ошибка загрузки данных`
3. Check Network tab to see if API requests are failing
4. Look for CORS errors or 403/404 responses

### For Users / Для пользователей

1. Перезагрузите страницу (hard refresh: long-tap reload button → "Reload without content blockers")
2. Очистите кеш Safari (Settings → Safari → Clear History and Website Data)
3. Проверьте подключение к интернету
4. Убедитесь, что iPhone не в режиме "Low Data Mode" (Settings → Cellular → Cellular Data Options)

## Alternative Data Source / Альтернативный источник данных

Если проблема не решается, можно переключиться на Windguru источник данных (требуется настройка backend на Vercel):

If the problem persists, you can switch to Windguru data source (requires backend setup on Vercel):

1. Enable "PYC" toggle in app settings (top-right corner)
2. Select "WINDGURU" option

## Additional Recommendations / Дополнительные рекомендации

### For iOS Safari:

1. **Disable Content Blockers** / Отключите блокировщики контента:
   - Settings → Safari → Content Blockers → Disable all

2. **Allow Cross-Site Tracking** / Разрешите кросс-сайт трекинг:
   - Settings → Safari → Prevent Cross-Site Tracking → OFF (temporarily)

3. **Check Privacy Settings** / Проверьте настройки приватности:
   - Settings → Safari → Privacy & Security → Block All Cookies → OFF

4. **Use Private Browsing Mode** / Попробуйте режим приватного просмотра:
   - Sometimes helps to bypass cache and tracking issues

## Monitoring / Мониторинг

After deploying these changes, monitor:
1. Console logs with `[SW]` prefix
2. API response times
3. Network errors in browser DevTools
4. Service Worker registration status

## Next Steps / Следующие шаги

If the problem persists after these fixes:

1. Implement proxy server for Ambient Weather API (bypass CORS)
2. Add alternative API source (Windguru backend)
3. Implement local WebSocket server for real-time data
4. Consider native iOS app using WebView with CORS disabled

## Support / Поддержка

- Check browser console for detailed error messages
- Telegram: @gypsy_mermaid
- GitHub Issues: https://github.com/drunzel/Jollykite1/issues

---

**Version:** 1.2.4
**Last Updated:** 2024-12-13
