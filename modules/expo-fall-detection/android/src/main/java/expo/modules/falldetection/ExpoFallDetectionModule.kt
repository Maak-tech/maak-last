package expo.modules.falldetection

import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoFallDetectionModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoFallDetection")

    AsyncFunction("isAvailable") {
      val context = appContext.reactContext ?: return@AsyncFunction mapOf(
        "available" to false,
        "reason" to "No React context"
      )

      val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
      val accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
      mapOf(
        "available" to (accelerometer != null),
        "reason" to if (accelerometer == null) "Accelerometer unavailable" else null
      )
    }

    AsyncFunction("start") { _: Map<String, Any>? ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(context, FallDetectionService::class.java)
      ContextCompat.startForegroundService(context, intent)
      true
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(context, FallDetectionService::class.java)
      context.stopService(intent)
      true
    }

    AsyncFunction("isRunning") {
      FallDetectionService.isRunning
    }

    AsyncFunction("getPendingEvents") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val events = FallDetectionStorage.getEvents(context)
      events.map { timestamp ->
        mapOf(
          "timestamp" to timestamp,
          "severity" to "high",
          "source" to "background"
        )
      }
    }

    AsyncFunction("clearPendingEvents") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      FallDetectionStorage.clearEvents(context)
      true
    }
  }
}
