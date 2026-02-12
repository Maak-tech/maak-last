package expo.modules.falldetection

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import kotlin.math.abs
import kotlin.math.sqrt

class FallDetectionService : Service(), SensorEventListener {
  companion object {
    private const val CHANNEL_ID_SERVICE = "fall_detection_service"
    private const val CHANNEL_ID_ALERTS = "fall_detection_alerts"
    private const val NOTIFICATION_ID_SERVICE = 11001
    private const val NOTIFICATION_ID_ALERT = 11002

    private const val FREEFALL_THRESHOLD_G = 0.4f
    private const val FREEFALL_MIN_DURATION_MS = 150L
    private const val FREEFALL_MAX_DURATION_MS = 1000L
    private const val IMPACT_THRESHOLD_G = 2.0f
    private const val JERK_THRESHOLD = 5.0f
    private const val ALERT_COOLDOWN_MS = 30_000L

    @Volatile
    var isRunning: Boolean = false
      private set
  }

  private var sensorManager: SensorManager? = null
  private var accelerometer: Sensor? = null
  private var wakeLock: PowerManager.WakeLock? = null

  private var lastMagnitude = 1.0f
  private var lastTimestampMs = 0L
  private var freefallStartMs: Long? = null
  private var lastFallMs = 0L

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
    accelerometer = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
    createNotificationChannels()
    acquireWakeLock()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (accelerometer == null) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForeground(NOTIFICATION_ID_SERVICE, buildServiceNotification())
    registerSensors()
    isRunning = true
    return START_STICKY
  }

  override fun onDestroy() {
    super.onDestroy()
    unregisterSensors()
    releaseWakeLock()
    isRunning = false
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  override fun onSensorChanged(event: SensorEvent) {
    if (event.sensor.type != Sensor.TYPE_ACCELEROMETER) {
      return
    }

    val nowMs = System.currentTimeMillis()
    val x = event.values[0]
    val y = event.values[1]
    val z = event.values[2]
    val magnitude = sqrt(x * x + y * y + z * z) / SensorManager.GRAVITY_EARTH

    val deltaSeconds =
      if (lastTimestampMs > 0) (nowMs - lastTimestampMs) / 1000f else 0f
    val jerk =
      if (deltaSeconds > 0) abs(magnitude - lastMagnitude) / deltaSeconds else 0f

    lastMagnitude = magnitude
    lastTimestampMs = nowMs

    if (magnitude < FREEFALL_THRESHOLD_G) {
      if (freefallStartMs == null) {
        freefallStartMs = nowMs
      }
      return
    }

    val freefallStart = freefallStartMs ?: return
    val freefallDuration = nowMs - freefallStart

    if (freefallDuration > FREEFALL_MAX_DURATION_MS) {
      freefallStartMs = null
      return
    }

    if (
      freefallDuration >= FREEFALL_MIN_DURATION_MS &&
        magnitude >= IMPACT_THRESHOLD_G &&
        jerk >= JERK_THRESHOLD
    ) {
      triggerFall(nowMs)
      freefallStartMs = null
    }
  }

  private fun registerSensors() {
    sensorManager?.registerListener(
      this,
      accelerometer,
      SensorManager.SENSOR_DELAY_GAME
    )
  }

  private fun unregisterSensors() {
    sensorManager?.unregisterListener(this)
  }

  private fun triggerFall(timestampMs: Long) {
    if (timestampMs - lastFallMs < ALERT_COOLDOWN_MS) {
      return
    }
    lastFallMs = timestampMs

    FallDetectionStorage.addEvent(applicationContext, timestampMs)
    showAlertNotification(timestampMs)
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val notificationManager =
      getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    val serviceChannel = NotificationChannel(
      CHANNEL_ID_SERVICE,
      "Fall Detection",
      NotificationManager.IMPORTANCE_LOW
    )
    serviceChannel.description = "Background fall detection service"
    notificationManager.createNotificationChannel(serviceChannel)

    val alertChannel = NotificationChannel(
      CHANNEL_ID_ALERTS,
      "Fall Detection Alerts",
      NotificationManager.IMPORTANCE_HIGH
    )
    alertChannel.description = "Fall detection alerts"
    notificationManager.createNotificationChannel(alertChannel)
  }

  private fun buildServiceNotification(): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = if (launchIntent != null) {
      PendingIntent.getActivity(
        this,
        0,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else {
      null
    }

    return NotificationCompat.Builder(this, CHANNEL_ID_SERVICE)
      .setContentTitle("Fall detection running")
      .setContentText("Monitoring device motion in the background.")
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .build()
  }

  private fun showAlertNotification(timestampMs: Long) {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntent = if (launchIntent != null) {
      PendingIntent.getActivity(
        this,
        1,
        launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else {
      null
    }

    val notification = NotificationCompat.Builder(this, CHANNEL_ID_ALERTS)
      .setContentTitle("Fall detected")
      .setContentText("We detected a possible fall. Tap to open Maak Health.")
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(pendingIntent)
      .build()

    val notificationManager =
      ContextCompat.getSystemService(this, NotificationManager::class.java)
    notificationManager?.notify(NOTIFICATION_ID_ALERT, notification)
  }

  private fun acquireWakeLock() {
    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock =
      powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "maak:fallDetection")
    wakeLock?.setReferenceCounted(false)
    wakeLock?.acquire()
  }

  private fun releaseWakeLock() {
    try {
      if (wakeLock?.isHeld == true) {
        wakeLock?.release()
      }
    } catch (_error: Exception) {
      // Ignore release errors.
    }
  }
}
