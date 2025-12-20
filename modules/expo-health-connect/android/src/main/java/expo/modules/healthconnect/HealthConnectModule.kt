package expo.modules.healthconnect

import android.app.Activity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant

class HealthConnectModule : Module() {
  private val healthConnectScope = CoroutineScope(Dispatchers.IO)
  private var permissionLauncher: ActivityResultLauncher<Set<HealthPermission>>? = null
  private var pendingPermissionPromise: Promise? = null
  private var requestedPermissions: List<String> = emptyList()
  
  private fun getHealthConnectClient(): HealthConnectClient? {
    return try {
      val context = appContext.reactContext ?: return null
      HealthConnectClient.getOrCreate(context)
    } catch (e: Exception) {
      null
    }
  }

  private fun initializePermissionLauncher(activity: Activity) {
    val client = getHealthConnectClient() ?: return
    
    val permissionController = client.permissionController
    val requestPermissionContract = permissionController.createRequestPermissionResultContract()
    
    permissionLauncher = activity.registerForActivityResult(requestPermissionContract) { grantedPermissions ->
      // Handle permission result
      val granted: MutableList<String> = mutableListOf()
      val denied: MutableList<String> = mutableListOf()
      
      // Map granted HealthPermissions back to permission strings
      requestedPermissions.forEach { permissionString ->
        val healthPermission = permissionStringToHealthPermission(permissionString)
        if (healthPermission != null && grantedPermissions.contains(healthPermission)) {
          granted.add(permissionString)
        } else {
          denied.add(permissionString)
        }
      }
      
      // Resolve the pending promise
      pendingPermissionPromise?.resolve(mapOf(
        "granted" to granted,
        "denied" to denied
      ))
      
      // Clear pending state
      pendingPermissionPromise = null
      requestedPermissions = emptyList()
    }
  }

  private fun permissionStringToHealthPermission(permissionString: String): HealthPermission? {
    return when (permissionString) {
      "android.permission.health.READ_HEART_RATE" -> 
        HealthPermission.getReadPermission(HeartRateRecord::class)
      "android.permission.health.READ_STEPS" -> 
        HealthPermission.getReadPermission(StepsRecord::class)
      "android.permission.health.READ_SLEEP" -> 
        HealthPermission.getReadPermission(SleepSessionRecord::class)
      "android.permission.health.READ_BODY_TEMPERATURE" -> 
        HealthPermission.getReadPermission(BodyTemperatureRecord::class)
      "android.permission.health.READ_BLOOD_PRESSURE" -> 
        HealthPermission.getReadPermission(BloodPressureRecord::class)
      "android.permission.health.READ_WEIGHT" -> 
        HealthPermission.getReadPermission(WeightRecord::class)
      "android.permission.health.READ_RESTING_HEART_RATE" -> 
        HealthPermission.getReadPermission(RestingHeartRateRecord::class)
      "android.permission.health.READ_RESPIRATORY_RATE" -> 
        HealthPermission.getReadPermission(RespiratoryRateRecord::class)
      "android.permission.health.READ_OXYGEN_SATURATION" -> 
        HealthPermission.getReadPermission(OxygenSaturationRecord::class)
      "android.permission.health.READ_HEIGHT" -> 
        HealthPermission.getReadPermission(HeightRecord::class)
      "android.permission.health.READ_BODY_MASS_INDEX" -> 
        HealthPermission.getReadPermission(BodyMassIndexRecord::class)
      "android.permission.health.READ_ACTIVE_CALORIES_BURNED" -> 
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
      "android.permission.health.READ_DISTANCE" -> 
        HealthPermission.getReadPermission(DistanceRecord::class)
      "android.permission.health.READ_EXERCISE" -> 
        HealthPermission.getReadPermission(ExerciseSessionRecord::class)
      "android.permission.health.READ_HYDRATION" -> 
        HealthPermission.getReadPermission(HydrationRecord::class)
      "android.permission.health.READ_BLOOD_GLUCOSE" -> 
        HealthPermission.getReadPermission(BloodGlucoseRecord::class)
      else -> null
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ExpoHealthConnect")

    // Initialize permission launcher when module is created
    OnCreate {
      val activity = appContext.currentActivity
      if (activity != null) {
        initializePermissionLauncher(activity)
      }
    }

    // Re-initialize permission launcher when activity changes
    OnActivityEntersForeground {
      val activity = appContext.currentActivity
      if (activity != null && permissionLauncher == null) {
        initializePermissionLauncher(activity)
      }
    }

    /**
     * Check if Health Connect is available
     */
    AsyncFunction("isAvailable") { promise: Promise ->
      healthConnectScope.launch {
        try {
          val context = appContext.reactContext ?: run {
            promise.resolve(mapOf("available" to false, "reason" to "Context not available"))
            return@launch
          }
          
          val availabilityStatus = HealthConnectClient.getSdkStatus(context)
          val available = availabilityStatus == HealthConnectClient.SDK_AVAILABLE
          
          promise.resolve(mapOf(
            "available" to available,
            "reason" to if (available) null else "Health Connect SDK not available"
          ))
        } catch (e: Exception) {
          promise.resolve(mapOf(
            "available" to false,
            "reason" to (e.message ?: "Unknown error")
          ))
        }
      }
    }

    /**
     * Request permissions for health data types
     */
    AsyncFunction("requestPermissions") { permissions: List<String>, promise: Promise ->
      try {
        val activity = appContext.currentActivity
        if (activity == null) {
          promise.reject("HEALTH_CONNECT_ERROR", "Activity not available", null)
          return@AsyncFunction
        }

        val client = getHealthConnectClient()
        if (client == null) {
          promise.reject("HEALTH_CONNECT_ERROR", "Health Connect client not available", null)
          return@AsyncFunction
        }

        // Convert permission strings to HealthPermission objects
        val healthPermissions = permissions.mapNotNull { permissionString ->
          permissionStringToHealthPermission(permissionString)
        }

        if (healthPermissions.isEmpty()) {
          promise.reject("HEALTH_CONNECT_ERROR", "No valid permissions provided", null)
          return@AsyncFunction
        }

        // Initialize launcher if not already initialized
        if (permissionLauncher == null) {
          initializePermissionLauncher(activity)
        }

        // Check if there's already a pending request
        if (pendingPermissionPromise != null) {
          promise.reject("HEALTH_CONNECT_ERROR", "Permission request already in progress", null)
          return@AsyncFunction
        }

        // Store promise and permissions for result handling
        pendingPermissionPromise = promise
        requestedPermissions = permissions

        // Launch permission request
        permissionLauncher?.launch(healthPermissions.toSet())
      } catch (e: Exception) {
        promise.reject("HEALTH_CONNECT_ERROR", e.message ?: "Unknown error", e)
      }
    }

    /**
     * Read health records
     */
    AsyncFunction("readRecords") { 
      recordType: String, 
      startTime: String, 
      endTime: String, 
      promise: Promise 
    ->
      healthConnectScope.launch {
        try {
          val client = getHealthConnectClient() ?: run {
            promise.reject("HEALTH_CONNECT_ERROR", "Health Connect client not available", null)
            return@launch
          }

          val startInstant = Instant.parse(startTime)
          val endInstant = Instant.parse(endTime)
          val timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant)

          val records = when (recordType) {
            "HeartRateRecord" -> {
              val request = ReadRecordsRequest(
                recordType = HeartRateRecord::class,
                timeRangeFilter = timeRangeFilter
              )
              client.readRecords(request).records.map { record ->
                mapOf(
                  "value" to record.beatsPerMinute,
                  "unit" to "bpm",
                  "startDate" to record.time.toString(),
                  "endDate" to record.time.toString(),
                  "source" to (record.metadata.dataOrigin.packageName ?: "Health Connect")
                )
              }
            }
            "StepsRecord" -> {
              val request = ReadRecordsRequest(
                recordType = StepsRecord::class,
                timeRangeFilter = timeRangeFilter
              )
              client.readRecords(request).records.map { record ->
                mapOf(
                  "value" to record.count,
                  "unit" to "count",
                  "startDate" to record.startTime.toString(),
                  "endDate" to record.endTime.toString(),
                  "source" to (record.metadata.dataOrigin.packageName ?: "Health Connect")
                )
              }
            }
            "SleepSessionRecord" -> {
              val request = ReadRecordsRequest(
                recordType = SleepSessionRecord::class,
                timeRangeFilter = timeRangeFilter
              )
              client.readRecords(request).records.map { record ->
                val duration = java.time.Duration.between(record.startTime, record.endTime)
                mapOf(
                  "value" to duration.toHours(),
                  "unit" to "hours",
                  "startDate" to record.startTime.toString(),
                  "endDate" to record.endTime.toString(),
                  "source" to (record.metadata.dataOrigin.packageName ?: "Health Connect")
                )
              }
            }
            "WeightRecord" -> {
              val request = ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = timeRangeFilter
              )
              client.readRecords(request).records.map { record ->
                mapOf(
                  "value" to record.weight.inKilograms,
                  "unit" to "kg",
                  "startDate" to record.time.toString(),
                  "endDate" to record.time.toString(),
                  "source" to (record.metadata.dataOrigin.packageName ?: "Health Connect")
                )
              }
            }
            "BodyTemperatureRecord" -> {
              val request = ReadRecordsRequest(
                recordType = BodyTemperatureRecord::class,
                timeRangeFilter = timeRangeFilter
              )
              client.readRecords(request).records.map { record ->
                mapOf(
                  "value" to record.temperature.inCelsius,
                  "unit" to "°C",
                  "startDate" to record.time.toString(),
                  "endDate" to record.time.toString(),
                  "source" to (record.metadata.dataOrigin.packageName ?: "Health Connect")
                )
              }
            }
            "BloodPressureRecord" -> {
              val request = ReadRecordsRequest(
                recordType = BloodPressureRecord::class,
                timeRangeFilter = timeRangeFilter
              )
              client.readRecords(request).records.map { record ->
                mapOf(
                  "value" to "${record.systolic.inMillimetersOfMercury}/${record.diastolic.inMillimetersOfMercury}",
                  "unit" to "mmHg",
                  "startDate" to record.time.toString(),
                  "endDate" to record.time.toString(),
                  "source" to (record.metadata.dataOrigin.packageName ?: "Health Connect")
                )
              }
            }
            else -> {
              promise.reject("HEALTH_CONNECT_ERROR", "Unsupported record type: $recordType", null)
              return@launch
            }
          }

          promise.resolve(records)
        } catch (e: Exception) {
          promise.reject("HEALTH_CONNECT_ERROR", e.message ?: "Unknown error", e)
        }
      }
    }

    /**
     * Get permission status
     */
    AsyncFunction("getPermissionStatus") { permission: String, promise: Promise ->
      healthConnectScope.launch {
        try {
          val client = getHealthConnectClient() ?: run {
            promise.reject("HEALTH_CONNECT_ERROR", "Health Connect client not available", null)
            return@launch
          }

          // Health Connect doesn't provide a direct way to check permission status
          // We'll return "undetermined" for now
          promise.resolve("undetermined")
        } catch (e: Exception) {
          promise.reject("HEALTH_CONNECT_ERROR", e.message ?: "Unknown error", e)
        }
      }
    }
  }
}

