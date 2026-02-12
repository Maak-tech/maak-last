import ExpoModulesCore
import CoreMotion
import UserNotifications
import UIKit

public class ExpoFallDetectionModule: Module {
  private let motionManager = CMMotionManager()
  private let motionQueue = OperationQueue()
  private var isRunning = false
  private var freefallStartMs: Double?
  private var lastFallMs: Double = 0
  private var lastMagnitude: Double = 1.0
  private var lastTimestampMs: Double = 0
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

  private let pendingEventsKey = "expo_fall_detection_pending_events"

  private let freefallThreshold = 0.4
  private let freefallMinDurationMs = 150.0
  private let freefallMaxDurationMs = 1000.0
  private let impactThreshold = 2.0
  private let jerkThreshold = 5.0
  private let alertCooldownMs = 30_000.0

  public func definition() -> ModuleDefinition {
    Name("ExpoFallDetection")
    Events("onFallDetected")

    AsyncFunction("isAvailable") { () -> [String: Any?] in
      if !self.motionManager.isDeviceMotionAvailable {
        return [
          "available": false,
          "reason": "Device motion unavailable"
        ]
      }
      return ["available": true, "reason": nil]
    }

    AsyncFunction("start") { (_ options: [String: Any]?) -> Bool in
      return self.startDetection()
    }

    AsyncFunction("stop") { () -> Bool in
      return self.stopDetection()
    }

    AsyncFunction("isRunning") { () -> Bool in
      return self.isRunning
    }

    AsyncFunction("getPendingEvents") { () -> [[String: Any]] in
      return self.getPendingEvents()
    }

    AsyncFunction("clearPendingEvents") { () -> Bool in
      self.clearPendingEvents()
      return true
    }
  }

  private func startDetection() -> Bool {
    if isRunning {
      return true
    }

    guard motionManager.isDeviceMotionAvailable else {
      return false
    }

    beginBackgroundTask()

    motionManager.deviceMotionUpdateInterval = 1.0 / 20.0
    motionQueue.qualityOfService = .userInitiated

    motionManager.startDeviceMotionUpdates(to: motionQueue) { [weak self] motion, _ in
      guard let self = self, let motion = motion else {
        return
      }

      let nowMs = Date().timeIntervalSince1970 * 1000.0
      let totalX = motion.userAcceleration.x + motion.gravity.x
      let totalY = motion.userAcceleration.y + motion.gravity.y
      let totalZ = motion.userAcceleration.z + motion.gravity.z
      let magnitude = sqrt(totalX * totalX + totalY * totalY + totalZ * totalZ)

      let deltaSeconds = self.lastTimestampMs > 0
        ? (nowMs - self.lastTimestampMs) / 1000.0
        : 0.0
      let jerk = deltaSeconds > 0 ? abs(magnitude - self.lastMagnitude) / deltaSeconds : 0.0

      self.lastMagnitude = magnitude
      self.lastTimestampMs = nowMs

      if magnitude < self.freefallThreshold {
        if self.freefallStartMs == nil {
          self.freefallStartMs = nowMs
        }
        return
      }

      guard let start = self.freefallStartMs else {
        return
      }

      let freefallDuration = nowMs - start
      if freefallDuration > self.freefallMaxDurationMs {
        self.freefallStartMs = nil
        return
      }

      if freefallDuration >= self.freefallMinDurationMs &&
        magnitude >= self.impactThreshold &&
        jerk >= self.jerkThreshold {
        self.handleFallDetected(timestampMs: nowMs)
        self.freefallStartMs = nil
      }
    }

    isRunning = true
    return true
  }

  private func stopDetection() -> Bool {
    if !isRunning {
      return true
    }
    motionManager.stopDeviceMotionUpdates()
    isRunning = false
    endBackgroundTask()
    return true
  }

  private func handleFallDetected(timestampMs: Double) {
    if timestampMs - lastFallMs < alertCooldownMs {
      return
    }
    lastFallMs = timestampMs

    savePendingEvent(timestampMs: timestampMs)
    sendEvent("onFallDetected", [
      "timestamp": timestampMs,
      "severity": "high",
      "source": "background"
    ])
    scheduleLocalNotification()
  }

  private func scheduleLocalNotification() {
    let content = UNMutableNotificationContent()
    content.title = "Fall detected"
    content.body = "We detected a possible fall. Tap to open Maak Health."
    content.sound = UNNotificationSound.default

    let request = UNNotificationRequest(
      identifier: "fall_detected_\(Int(Date().timeIntervalSince1970))",
      content: content,
      trigger: nil
    )

    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
  }

  private func savePendingEvent(timestampMs: Double) {
    var events = getPendingEventTimestamps()
    events.append(timestampMs)
    let data = try? JSONSerialization.data(withJSONObject: events)
    if let data = data {
      UserDefaults.standard.set(data, forKey: pendingEventsKey)
    }
  }

  private func getPendingEvents() -> [[String: Any]] {
    let events = getPendingEventTimestamps()
    return events.map { timestamp in
      [
        "timestamp": timestamp,
        "severity": "high",
        "source": "background"
      ]
    }
  }

  private func clearPendingEvents() {
    UserDefaults.standard.removeObject(forKey: pendingEventsKey)
  }

  private func getPendingEventTimestamps() -> [Double] {
    guard let data = UserDefaults.standard.data(forKey: pendingEventsKey) else {
      return []
    }
    guard let json = try? JSONSerialization.jsonObject(with: data),
          let events = json as? [Double] else {
      return []
    }
    return events
  }

  private func beginBackgroundTask() {
    if backgroundTask != .invalid {
      return
    }
    backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "FallDetection") { [weak self] in
      self?.endBackgroundTask()
    }
  }

  private func endBackgroundTask() {
    if backgroundTask == .invalid {
      return
    }
    UIApplication.shared.endBackgroundTask(backgroundTask)
    backgroundTask = .invalid
  }
}
