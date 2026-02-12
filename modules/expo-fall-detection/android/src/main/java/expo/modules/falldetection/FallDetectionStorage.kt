package expo.modules.falldetection

import android.content.Context
import org.json.JSONArray

internal object FallDetectionStorage {
  private const val PREFS_NAME = "expo_fall_detection"
  private const val KEY_PENDING_EVENTS = "pending_events"

  fun addEvent(context: Context, timestamp: Long) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val events = getEvents(context).toMutableList()
    events.add(timestamp)
    val jsonArray = JSONArray()
    for (event in events) {
      jsonArray.put(event)
    }
    prefs.edit().putString(KEY_PENDING_EVENTS, jsonArray.toString()).apply()
  }

  fun getEvents(context: Context): List<Long> {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val raw = prefs.getString(KEY_PENDING_EVENTS, null) ?: return emptyList()
    return try {
      val jsonArray = JSONArray(raw)
      val events = mutableListOf<Long>()
      for (i in 0 until jsonArray.length()) {
        events.add(jsonArray.optLong(i))
      }
      events
    } catch (_error: Exception) {
      emptyList()
    }
  }

  fun clearEvents(context: Context) {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    prefs.edit().remove(KEY_PENDING_EVENTS).apply()
  }
}
