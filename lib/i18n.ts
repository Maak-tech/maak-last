import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Platform } from "react-native";

const resources = {
  en: {
    translation: {
      // Common
      welcome: "Welcome",
      continue: "Continue",
      skip: "Skip",
      next: "Next",
      back: "Back",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      add: "Add",
      loading: "Loading...",
      error: "Error",
      success: "Success",

      // Auth
      signIn: "Sign In",
      signUp: "Sign Up",
      signOut: "Sign Out",
      email: "Email",
      password: "Password",
      confirmPassword: "Confirm Password",
      forgotPassword: "Forgot Password?",
      createAccount: "Create Account",
      alreadyHaveAccount: "Already have an account?",
      dontHaveAccount: "Don't have an account?",

      // Onboarding
      onboardingTitle1: "Track Your Health",
      onboardingDesc1:
        "Monitor your symptoms, medications, and vitals in one place",
      onboardingTitle2: "Family Care",
      onboardingDesc2: "Keep your entire family healthy with shared monitoring",
      onboardingTitle3: "Smart Alerts",
      onboardingDesc3: "Get timely reminders and emergency notifications",

      // Navigation
      home: "Home",
      dashboard: "Dashboard",
      zeina: "Zeina",
      symptoms: "Symptoms",
      medications: "Medications",
      family: "Family",
      profile: "Profile",

      // Zeina Chat
      zeinaWelcome: "Hello! I'm Zeina, your personal health AI assistant. I have access to your health profile, medications, symptoms, and family information. How can I help you today?",
      zeinaUnavailable: "Zeina is temporarily unavailable. Please contact support.",
      serviceUnavailable: "Service Unavailable",
      chatWithZeina: "Chat with Zeina",
      askZeina: "Ask Zeina about your health, medications, symptoms...",
      quickQuestions: "Quick Questions",
      manageSymptomsQuestion: "How can I manage my symptoms?",
      medicationQuestions: "Medication questions",
      dietNutritionAdvice: "Diet and nutrition advice",
      exerciseRecommendations: "Exercise recommendations",
      generalHealthConcerns: "General health concerns",
      loadingHealthContext: "Loading your health context...",
      chatHistory: "Chat History",
      noChatHistory: "No chat history yet",
      conversationsWillAppear: "Your conversations will appear here",
      startNewChat: "Start New Chat",
      chatSession: "Chat Session",
      noMessages: "No messages",
      messages: "messages",
      deleteChat: "Delete Chat",
      confirmDeleteChat: "Are you sure you want to delete this chat session?",
      failedToLoadSession: "Failed to load chat session",
      failedToDeleteSession: "Failed to delete chat session",
      mustBeLoggedIn: "You must be logged in to delete chat sessions",
      failedToGetResponse: "Failed to get response. Please try again.",

      // Voice Features
      microphonePermissionRequired: "Microphone Permission Required",
      microphonePermissionMessage: "Microphone access is needed for voice input. Please grant permission in your device settings.",
      voiceError: "Voice Error",
      failedToStartRecording: "Failed to start voice recording",
      speechError: "Speech Error",

      // Dashboard
      healthOverview: "Health Overview",
      healthInsights: "Health Insights",
      recentSymptoms: "Recent Symptoms",
      upcomingMeds: "Upcoming Medications",
      familyAlerts: "Family Alerts",

      // Symptoms
      logSymptom: "Log Symptom",
      symptomType: "Symptom Type",
      severity: "Severity",
      description: "Description",
      painLevel: "Pain Level",

      // Medications
      addMedication: "Add Medication",
      medicationName: "Medication Name",
      dosage: "Dosage",
      frequency: "Frequency",
      setReminder: "Set Reminder",

      // Family
      inviteFamily: "Invite Family Member",
      familyMembers: "Family Members",
      healthStatus: "Health Status",

      // Common symptoms
      headache: "Headache",
      fever: "Fever",
      cough: "Cough",
      fatigue: "Fatigue",
      nausea: "Nausea",
      dizziness: "Dizziness",
      chestPain: "Chest Pain",
      backPain: "Back Pain",
      soreThroat: "Sore Throat",
      runnyNose: "Runny Nose",
      shortnessOfBreath: "Shortness of Breath",
      muscleAche: "Muscle Ache",
      jointPain: "Joint Pain",
      stomachPain: "Stomach Pain",
      diarrhea: "Diarrhea",
      constipation: "Constipation",
      insomnia: "Insomnia",
      anxiety: "Anxiety",
      depression: "Depression",
      rash: "Rash",
      itchiness: "Itchiness",
      swelling: "Swelling",
      chills: "Chills",
      sweating: "Sweating",
      lossOfAppetite: "Loss of Appetite",
      blurredVision: "Blurred Vision",
      ringingInEars: "Ringing in Ears",
      numbness: "Numbness",

      // Severity levels
      mild: "Mild",
      moderate: "Moderate",
      severe: "Severe",
      verySevere: "Very Severe",

      // Mood types - Positive
      veryHappy: "Very Happy",
      happy: "Happy",
      excited: "Excited",
      content: "Content",
      grateful: "Grateful",
      hopeful: "Hopeful",
      proud: "Proud",
      calm: "Calm",
      peaceful: "Peaceful",
      // Mood types - Negative
      sad: "Sad",
      verySad: "Very Sad",
      anxious: "Anxious",
      angry: "Angry",
      frustrated: "Frustrated",
      overwhelmed: "Overwhelmed",
      hopeless: "Hopeless",
      guilty: "Guilty",
      ashamed: "Ashamed",
      lonely: "Lonely",
      irritable: "Irritable",
      restless: "Restless",
      stressed: "Stressed",
      // Mood types - Neutral/Other
      neutral: "Neutral",
      confused: "Confused",
      numb: "Numb",
      detached: "Detached",
      empty: "Empty",
      apathetic: "Apathetic",
      tired: "Tired",
      notes: "Notes",
      thisWeek: "This Week",

      // Relations
      father: "Father",
      mother: "Mother",
      spouse: "Spouse",
      child: "Child",
      sibling: "Sibling",
      grandparent: "Grandparent",
      other: "Other",

      // Profile
      personalInformation: "Personal Information",
      healthReports: "Health Reports",
      helpSupport: "Help & Support",
      termsConditions: "Terms & Conditions",
      privacyPolicy: "Privacy Policy",
      healthScore: "Health Score",
      symptomsThisMonth: "Symptoms This Month",
      activeMedications: "Active Medications",
      notifications: "Notifications",
      fallDetection: "Fall Detection",
      language: "Language",
      comingSoon: "Coming Soon",
      ok: "OK",

      // Subscription
      subscription: "Subscription",
      premium: "Premium",
      subscribe: "Subscribe",
      manageSubscription: "Manage Subscription",
      restorePurchases: "Restore Purchases",
      subscriptionActive: "Subscription Active",
      subscriptionInactive: "No Active Subscription",
      familyPlan: "Family Plan",
      individualPlan: "Individual Plan",
      monthly: "Monthly",
      yearly: "Yearly",
      planLimits: "Plan Limits",
      maxFamilyMembers: "Max Family Members",
      maxTotalMembers: "Max Total Members",
      individualPlanDescription: "1 admin + 1 family member",
      familyPlanDescription: "1 admin + 3 family members",
      purchaseSuccess: "Purchase Successful",
      purchaseSuccessMessage: "Your subscription has been activated successfully!",
      purchaseError: "Purchase Failed",
      purchaseErrorMessage: "There was an error processing your purchase. Please try again.",
      restoreSuccess: "Purchases Restored",
      restoreSuccessMessage: "Your purchases have been restored successfully.",
      loadError: "Failed to load subscription information. Please try again.",
      noOfferingsAvailable: "No subscription options are currently available.",
      noCustomerInfo: "Unable to load customer information.",
      subscriptionError: "An error occurred",
      errorMessage: "Something went wrong. Please try again.",

      // Additional common strings
      account: "Account",
      settings: "Settings",
      support: "Support",
      changePassword: "Change Password",
      healthResources: "Health Resources",
      selectLanguage: "Select Language",
      arabic: "العربية",
      english: "English",
      memberSince: "Member since",
      healthSummary: "Health Summary",
      chooseYourAvatar: "Choose Your Avatar",
      avatarSavedSuccessfully: "Avatar saved successfully",
      failedToSaveAvatar: "Failed to save avatar",
      exportInProgress: "Export in Progress",
      exportInProgressMessage: "An export is already in progress. Please wait for it to complete.",
      exportSuccessful: "Export Successful",
      exportSuccessfulMessage: "Health metrics exported successfully. Use the share option to save the file.",
      exportError: "Export Error",
      exportErrorMessage: "An error occurred while exporting health metrics",
      errorExportingMetrics: "Error exporting metrics",
      confirmSignOut: "Are you sure you want to sign out?",
      failedToSignOut: "Failed to sign out. Please try again.",
      errorLoadingData: "Error loading data",
      errorSavingData: "Error saving data",
      errorDeletingData: "Error deleting data",
      confirmDelete: "Confirm Delete",
      confirmDeleteAllergy: "Are you sure you want to delete this allergy?",
      pleaseEnterAllergyName: "Please enter an allergy name",
      allergies: "Allergies",
      statistics: "Statistics",
      totalAllergies: "Total Allergies",
      severeAllergies: "Severe Allergies",
      myAllergies: "My Allergies",
      noAllergiesRecorded: "No allergies recorded",
      allergyName: "Allergy Name",
      customAllergy: "Custom Allergy",
      orEnterCustomAllergy: "Or enter custom allergy",
      reaction: "Reaction",
      optional: "Optional",
      reactionOptional: "Reaction (optional)",
      notesOptional: "Notes (optional)",
      // Allergy names
      allergyPeanuts: "Peanuts",
      allergyTreeNuts: "Tree Nuts",
      allergyMilk: "Milk",
      allergyEggs: "Eggs",
      allergyFish: "Fish",
      allergyShellfish: "Shellfish",
      allergySoy: "Soy",
      allergyWheat: "Wheat",
      allergyPollen: "Pollen",
      allergyDustMites: "Dust Mites",
      allergyPetDander: "Pet Dander",
      allergyMold: "Mold",
      allergyLatex: "Latex",
      allergyPenicillin: "Penicillin",
      allergyAspirin: "Aspirin",
      allergyBeeStings: "Bee Stings",
      allergySesame: "Sesame",
      allergySulfites: "Sulfites",
      // Severity labels
      severityMild: "Mild",
      severityModerate: "Moderate",
      severitySevere: "Severe",
      severitySevereLifeThreatening: "Severe (Life-threatening)",
      healthTracking: "Health Tracking",
      symptomsThisWeek: "Symptoms This Week",
      medCompliance: "Med Compliance",
      trackingOptions: "Tracking Options",
      track: "Track",
      manage: "Manage",
      mood: "Mood",
      trackYourMood: "Track your mood",
      bloodPressure: "Blood Pressure",
      bloodPressureEntry: "Blood Pressure Entry",
      systolic: "Systolic",
      diastolic: "Diastolic",
      exportToHealthKit: "Export to HealthKit",
      saving: "Saving...",
      invalidInput: "Invalid Input",
      pleaseEnterBothValues: "Please enter both systolic and diastolic values.",
      pleaseEnterValidNumbers: "Please enter valid numbers.",
      systolicRangeError: "Systolic pressure should be between 50 and 250 mmHg.",
      diastolicRangeError: "Diastolic pressure should be between 30 and 150 mmHg.",
      systolicMustBeGreater: "Systolic pressure must be greater than diastolic pressure.",
      permissionDenied: "Permission Denied",
      healthKitPermissionMessage: "Please grant write permissions for blood pressure in Settings > Privacy & Security > Health > [App Name] > Blood Pressure.",
      exportFailed: "Export Failed",
      healthKitExportFailed: "Failed to export blood pressure to HealthKit. Please try again or check your settings.",
      savedLocally: "Saved Locally",
      savedLocallyMessage: "Blood pressure saved to your health records. HealthKit export failed or is not available.",
      bloodPressureSaved: "Success",
      bloodPressureSavedMessage: "Blood pressure saved and exported to HealthKit!",
      bloodPressureSavedLocallyMessage: "Blood pressure saved to your health records!",
      pleaseLogInToSave: "Please log in to save blood pressure readings.",
      failedToSaveBloodPressure: "Failed to save blood pressure. Please try again.",
      normalBloodPressureInfo: "Normal blood pressure is typically below 120/80 mmHg. High blood pressure (hypertension) is 130/80 mmHg or higher.",
      enter: "Enter",
      vitalSigns: "Vital Signs",
      view: "View",
      medicalHistory: "Medical History",
      labResults: "Lab Results",
      healthTimeline: "Health Timeline",
      healthData: "Health Data",
      vitalsMonitor: "Vitals Monitor",
      measure: "Measure",
      viewAll: "View All",
      // PPG Vital Monitor
      howToMeasureHeartRate: "How to measure your heart rate",
      keepFingerStill: "Keep your finger still for {{seconds}} seconds...",
      processingHeartRate: "Processing heart rate measurement...",
      measurementComplete: "Measurement complete!",
      readyToMeasureHeartRate: "Ready to measure heart rate",
      howToMeasure: "How to Measure",
      instructionFindComfortablePlace: "Find a comfortable place to sit",
      instructionPositionFinger: "Position your index finger or thumb over the FRONT camera (selfie camera) lens",
      instructionPositionFingerAlt: "Position your index finger or thumb over the FRONT camera (selfie camera) lens - either hand works equally well",
      instructionCoverCamera: "Cover the front camera lens completely - no gaps or light leaks",
      instructionKeepFingerStill: "Keep your finger still and relaxed",
      instructionHoldStill: "Hold still for 60 seconds without moving",
      instructionScreenBrightness: "Your screen brightness will increase automatically to provide light",
      cameraViewDarkNote: "Note: The camera view may appear dark when your finger covers it - this is normal!",
      realPPGTechnology: "Real PPG Technology",
      realPPGTechnologyDesc: "This version uses real camera data to measure your heart rate by detecting blood volume changes in your fingertip. Medical-grade accuracy with 60-second measurement.",
      why60Seconds: "Why 60 seconds?",
      why60SecondsDesc: "• Captures 60-90 heartbeats for statistical reliability\n• Enables medical-grade HRV analysis\n• Achieves 95-97% authentication accuracy\n• 0.2% false acceptance rate (bank-grade security)",
      tipsForBestResults: "Tips for Best Results",
      tipKeepHandSteady: "Keep your hand steady and relaxed",
      tipDontPressHard: "Don't press too hard - gentle contact works best",
      tipFingerWarm: "Make sure your finger is warm (not cold)",
      tipEitherHand: "Either hand works equally well - use whichever is more comfortable",
      tipPlaceFingerGently: "Place your finger gently over the front camera lens - the screen brightness provides the light source",
      tipStayCalm: "Stay calm and breathe normally",
      processingYourHeartRate: "Processing your heart rate...",
      cameraPermissionRequired: "Camera Permission Required",
      onceFingerInPlace: "Once your finger is in place, tap the button below to start measurement.",
      startMeasurement: "Start Measurement",
      fingerInPlaceStartMeasurement: "✓ Finger in Place - Start Measurement",
      grantCameraPermission: "Grant Camera Permission",
      done: "Done",
      realPPG: "REAL PPG",
      beta: "BETA",
      vitalSignsMonitorDescription: "Measures heart rate, HRV, and respiratory rate using real camera data (PPG technology)",
      vitalSignsSaved: "Your vital signs have been saved to your health records.",
      intensity: "Intensity",
      todaysMedications: "Today's Medications",
      recentMedicalHistory: "Recent Medical History",
      latestVitalSigns: "Latest Vital Signs",
      heartRate: "Heart Rate",
      steps: "Steps",
      step: "steps",
      sleep: "Sleep",
      hours: "hours",
      healthBeyondBorders: '"Health, beyond borders"',
      fullName: "Full Name",
      emailAddress: "Email Address",
      accountCreationDate: "Account creation date",
      memberSinceLabel: "Member Since",
      userRole: "User Role",
      accountDetails: "Account Details",
      uniqueAccountIdentifier: "Unique account identifier",
      userId: "User ID",
      notSpecified: "Not specified",
      preferredLanguage: "Preferred Language",
      appInterfaceLanguage: "App interface language",
      phoneNumber: "Phone Number",
      forEmergenciesAndNotifications: "For emergencies and notifications",
      accountStatistics: "Account Statistics",
      daysActive: "Days Active",
      profileComplete: "Profile Complete",
      editProfile: "Edit Profile",
      firstName: "First Name",
      enterYourFirstName: "Enter your first name",
      lastName: "Last Name",
      enterYourLastName: "Enter your last name",
      enterPhoneNumber: "Enter phone number",
      pleaseEnterFirstName: "Please enter a first name",
      profileUpdatedSuccessfully: "Profile updated successfully",
      failedToUpdateProfile: "Failed to update profile",
      basicInformation: "Basic Information",
      forLoginAndCommunication: "For login and communication",
      resetPassword: "Reset Password",
      emailSent: "Email Sent",
      failedToSendEmail: "Failed to send email",
      passwordChanged: "Password Changed",
      failedToChangePassword: "Failed to change password",
      currentPassword: "Current Password",
      enterCurrentPassword: "Enter current password",
      newPassword: "New Password",
      enterNewPassword: "Enter new password",
      send: "Send",
      noMetricsSelected: "No Metrics Selected",
      pleaseSelectAtLeastOneMetric: "Please select at least one metric to continue.",
      notificationSent: "Notification Sent",
      emergencyNotificationSent: "Emergency notification sent to all family members",
      failedToSendNotification: "Failed to send notification. Please try again.",

      // Interactive Notifications
      morningCheckinTitle: "🌅 Good Morning! How are you feeling?",
      morningCheckinBody: "Quick check-in: Rate your energy level and note any symptoms. Building healthy habits together!",
      eveningReflectionTitle: "🌙 Evening Health Reflection",
      eveningReflectionBody: "How was your day? Log your mood, symptoms, and medication adherence. Building healthy habits together!",

      // Streak Notifications
      streakCelebrationTitle: "🔥 {{streak}} Day Streak!",
      streakCelebrationBody: "Amazing! You've been consistently tracking your health for {{streak}} days. Keep up the fantastic work!",
      streakRiskTitle: "⚠️ Don't Break Your Streak!",
      streakRiskBody: "You haven't logged any health data today. Just a quick check-in to maintain your {{streak}}-day streak!",
      streakRecoveryTitle: "💪 Ready to Restart Your Streak?",
      streakRecoveryBody: "It's been {{days}} days since your last health log. Your longest streak was {{longest}} days - you can do it!",

      // Activity Alerts
      missedSymptomsTitle: "📝 Symptom Check-in",
      missedSymptomsBody: "It's been {{days}} days since your last symptom log. How are you feeling today? Regular tracking helps you stay on top of your health.",
      medicationComplianceTitle: "💊 Medication Check",
      medicationComplianceBody: "We noticed your medication compliance is at {{compliance}}%. Everything okay? Tap to update your medication status.",
      weeklySummaryTitle: "📊 Weekly Health Check",
      weeklySummaryBody: "It's been a week since your last health activity. Time for a quick health summary and goal check-in?",

      // Achievement Notifications
      achievementUnlockedTitle: "🏆 {{title}}",
      achievementUnlockedBody: "{{description}}",

      // Quick Action Labels
      quickActionFeelingGreat: "😊 Feeling Great",
      quickActionHaveSymptoms: "🤒 Have Symptoms",
      quickActionCheckMeds: "💊 Check Meds",
      quickActionNeedHelp: "🆘 Need Help",
      quickActionAllGood: "✅ All Good",
      quickActionLogDetails: "📝 Log Details",
      quickActionMedsTaken: "💊 Meds Taken",
      quickActionQuickLog: "📝 Quick Log",
      quickActionRemindLater: "⏰ Remind Later",
      quickActionConfirmMedication: "✅ Took Meds",
      quickActionUpdateStatus: "📝 Update Status",
      quickActionContactCaregiver: "🆘 Contact Caregiver",
      quickActionNoSymptoms: "😊 Feeling Good",
      quickActionTomorrow: "⏰ Tomorrow",

      // Phase 2: Condition-Specific Reminders
      diabetesBloodSugarTitle: "🩸 Blood Sugar Check",
      diabetesBloodSugarBody: "Regular blood sugar monitoring is key to managing diabetes. Time for your daily check?",
      hypertensionBPTitle: "❤️ Blood Pressure Check",
      hypertensionBPBody: "Keeping track of your blood pressure helps manage hypertension. Let's check it today.",
      respiratoryCheckTitle: "🫁 Respiratory Check",
      respiratoryCheckBody: "Monitoring your breathing rate helps manage respiratory conditions. Let's do a quick check.",
      mentalHealthCheckTitle: "😊 Mental Health Check",
      mentalHealthCheckBody: "Taking a moment for your mental well-being is important. How are you feeling today?",

      // Phase 2: Vital Sign Prompts
      weightCheckTitle: "⚖️ Monthly Weight Check",
      weightCheckBody: "Regular weight monitoring is important for overall health. Let's check your weight this month.",
      temperatureCheckTitle: "🌡️ Temperature Check",
      temperatureCheckBody: "Regular temperature monitoring helps catch potential issues early. Time for a quick check?",

      // Phase 2: Medication Adherence
      adherenceEncouragementTitle: "💪 Medication Adherence Help",
      adherenceEncouragementBody: "We noticed your medication compliance is below 60%. Would you like help setting up reminders or organizing your medications?",
      adherenceMotivationTitle: "🎯 Stay on Track",
      adherenceMotivationBody: "You're at {{compliance}}% medication compliance. Let's work together to improve this!",
      complexRegimenTitle: "📋 Medication Organization Help",
      complexRegimenBody: "With multiple medications, organization is key. Would you like help organizing your medication schedule?",

      // Phase 2: Quick Actions
      quickActionLogReading: "📝 Log Reading",
      quickActionCheckNow: "📏 Check Now",
      quickActionSetReminder: "⏰ Set Reminder",
      quickActionLogSymptoms: "📝 Log Symptoms",
      quickActionFeelingGood: "😊 Feeling Good",
      quickActionLogMood: "📝 Log Mood",
      quickActionTalkToZeina: "🤖 Talk to Zeina",
      quickActionLogWeight: "📝 Log Weight",
      quickActionSkipThisMonth: "⏭️ Skip This Month",
      quickActionTakeTemperature: "🌡️ Take Reading",
      quickActionFeelingNormal: "😊 Feeling Normal",
      quickActionSetupReminders: "⏰ Setup Reminders",
      quickActionOrganizeMeds: "📦 Organize Meds",
      quickActionTalkToCaregiver: "👨‍⚕️ Talk to Caregiver",
      quickActionViewSchedule: "📅 View Schedule",
      quickActionLogMeds: "💊 Log Today's Meds",
      quickActionSetGoal: "🎯 Set Goal",
      quickActionCreateSchedule: "📅 Create Schedule",
      quickActionPillOrganizer: "📦 Pill Organizer",

      // Phase 4: Additional Quick Actions
      quickActionLogReading: "📝 Log Reading",
      quickActionCheckNow: "📏 Check Now",
      quickActionSetReminder: "⏰ Set Reminder",
      quickActionFeelingGood: "😊 Feeling Good",
      quickActionLogMood: "📝 Log Mood",
      quickActionTalkToZeina: "🤖 Talk to Zeina",
      quickActionLogWeight: "📝 Log Weight",
      quickActionSkipThisMonth: "⏭️ Skip This Month",
      quickActionTakeTemperature: "🌡️ Take Reading",
      quickActionFeelingNormal: "😊 Feeling Normal",
      quickActionEmergencyResponse: "🚑 Respond Now",
      quickActionCallEmergency: "📞 Call Emergency",
      quickActionUpdateCareNotes: "📝 Update Notes",
      quickActionScheduleHandoff: "📅 Schedule Handoff",
      quickActionViewAppointments: "📅 View Appointments",
      quickActionConfirmAttendance: "✅ Confirm Attendance",
      quickActionShareAchievement: "📤 Share",
      quickActionViewProgress: "📊 View Progress",

      // Phase 3: Family Health Updates
      familyHealthSummaryTitle: "👨‍👩‍👧‍👦 Family Health Update",
      familyHealthSummaryBody: "{{count}} family member(s) may need attention. Check the Family tab for details.",
      familyMedicationCoordinationTitle: "💊 Family Medication Time",
      familyMedicationCoordinationBody: "{{count}} family member(s) have medications due soon. Help coordinate their care.",
      familyMemberAchievementTitle: "🎉 Family Achievement",
      familyMemberAchievementBody: "{{name}} reached a health milestone: {{achievement}}",

      // Phase 3: Caregiver Coordination
      emergencyCoordinationTitle: "🚨 Emergency Coordination Needed",
      emergencyCoordinationBody: "{{count}} family member(s) have triggered emergency alerts. Immediate attention required.",
      careHandoffTitle: "🤝 Care Coordination",
      careHandoffBody: "Time for care handoff. Update family members on recent health developments.",
      appointmentCoordinationTitle: "📅 Appointment Coordination",
      appointmentCoordinationBody: "{{count}} upcoming appointments need coordination. Review and confirm attendance.",

      // Phase 3: Achievement Celebrations
      achievementUnlockedTitle: "🏆 Achievement Unlocked!",
      achievementTypeStreak: "Streak",
      achievementTypeCompliance: "Compliance",
      achievementTypeConsistency: "Consistency",
      achievementTypeMilestone: "Milestone",

      // Phase 3: Quick Actions
      quickActionViewFamily: "👨‍👩‍👧‍👦 View Family",
      quickActionCheckAlerts: "🚨 Check Alerts",
      quickActionSendReminders: "📱 Send Reminders",
      quickActionEmergencyResponse: "🚑 Respond Now",
      quickActionCallEmergency: "📞 Call Emergency",
      quickActionUpdateCareNotes: "📝 Update Notes",
      quickActionScheduleHandoff: "📅 Schedule Handoff",
      quickActionViewAppointments: "📅 View Appointments",
      quickActionConfirmAttendance: "✅ Confirm Attendance",
      quickActionShareAchievement: "📤 Share",
      quickActionViewProgress: "📊 View Progress",
      pleaseLogInToViewDashboard: "Please log in to view your dashboard",
      familyAdmin: "Family Admin",
      member: "Member",
      manageFamilyAndSettings: "Manage family and settings",
      familyMember: "Family member",
      man: "Man",
      woman: "Woman",
      boy: "Boy",
      girl: "Girl",
      grandpa: "Grandpa",
      grandma: "Grandma",
      darkMode: "Dark Mode",
      healthIntegrations: "Health Integrations",
      editAllergy: "Edit Allergy",
      addAllergy: "Add Allergy",
      // Health Integrations
      availableProviders: "Available Providers",
      appleHealth: "Apple Health",
      appleHealthDescription: "Sync data from Apple's Health app",
      fitbit: "Fitbit",
      fitbitDescription: "Sync data from your Fitbit account",
      recommended: "Recommended",
      connected: "Connected",
      metrics: "metrics",
      notAvailableOnPlatform: "Not available on this platform",
      notAvailable: "Not Available",
      aboutHealthIntegrations: "About Health Integrations",
      healthDataReadOnly: "• Health data is read-only and fully under your control",
      chooseMetricsToShare: "• You choose exactly which metrics to share",
      dataEncrypted: "• Data is encrypted and securely synced",
      disconnectAnytime: "• You can disconnect anytime",
      // Apple Health Intro
      connectAppleHealth: "Connect Apple Health",
      syncHealthDataBetterInsights: "Sync your health data to provide better care insights",
      whatYoullGet: "What You'll Get",
      completeHealthPicture: "Complete Health Picture",
      completeHealthPictureDesc: "View all your health metrics in one place for better care coordination",
      earlyRiskDetection: "Early Risk Detection",
      earlyRiskDetectionDesc: "Track trends and identify potential health issues early",
      yourDataYourControl: "Your Data, Your Control",
      yourDataYourControlDesc: "You choose exactly which metrics to share. Read-only access.",
      yourPrivacyPromise: "Your Privacy Promise",
      weOnlyReadWhatYouChoose: "We only read what you choose",
      weOnlyReadWhatYouChooseDesc: "You have complete control. Select exactly which metrics to share, and we'll only access those.",
      weNeverSellHealthData: "We never sell or share health data",
      weNeverSellHealthDataDesc: "Your health data is yours alone. We never sell it, share it with third parties, or use it for advertising.",
      changePermissionsAnytime: "You can change permissions anytime",
      changePermissionsAnytimeDesc: "Update your selections or disconnect completely at any time through the app or iOS Settings.",
      readOnlyAccess: "• Read-only access - we never write to your health data",
      dataEncryptedSynced: "• Data is encrypted and securely synced",
      usedForCaregiving: "• Used only for caregiving insights and health tracking",
      notNow: "Not Now",
      appleHealthOnlyIOS: "Apple Health is only available on iOS devices.",
      // Apple Health Permissions
      selectMetrics: "Select Metrics",
      chooseHealthMetricsToSync: "Choose which health metrics to sync from Apple Health",
      selectAll: "Select All",
      allSelected: "✓ All Selected",
      authorizeMetrics: "Authorize",
      metric: "Metric",
      changePermissionsLater: "You can change these permissions later in iOS Settings → Privacy & Security → Health",
      appleHealthPermissions: "Apple Health Permissions",
      // Fitbit Intro
      connectFitbit: "Connect Fitbit",
      syncFitbitToMaak: "Sync your health data from Fitbit to Maak Health",
      yourPrivacy: "Your Privacy",
      // Fitbit Permissions
      fitbitPermissions: "Fitbit Permissions",
      chooseHealthMetricsToSyncFitbit: "Choose which health metrics to sync from Fitbit",
      // Health Metrics (moved to nested healthMetrics object below)
      restingHeartRate: "Resting Heart Rate",
      heartRateVariability: "Heart Rate Variability",
      walkingHeartRateAverage: "Walking Heart Rate Average",
      bloodPressureSystolic: "Blood Pressure (Systolic)",
      bloodPressureDiastolic: "Blood Pressure (Diastolic)",
      respiratoryRate: "Respiratory Rate",
      bloodOxygen: "Blood Oxygen (SpO2)",
      bodyTemperature: "Body Temperature",
      bodyMassIndex: "Body Mass Index",
      bodyFatPercentage: "Body Fat Percentage",
      activeEnergyBurned: "Active Energy Burned",
      basalEnergyBurned: "Basal Energy Burned",
      distanceWalkingRunning: "Distance Walking/Running",
      flightsClimbed: "Flights Climbed",
      exerciseMinutes: "Exercise Minutes",
      standTime: "Stand Time",
      workouts: "Workouts",
      sleepAnalysis: "Sleep Analysis",
      waterIntake: "Water Intake",
      bloodGlucose: "Blood Glucose",
      // Metric Groups
      heartCardiovascular: "Heart & Cardiovascular",
      respiratory: "Respiratory",
      temperature: "Temperature",
      bodyMeasurements: "Body Measurements",
      activityFitness: "Activity & Fitness",
      nutrition: "Nutrition",
      glucose: "Glucose",
      // Health Metrics (nested)
      healthMetrics: {
        // Groups
        heart_cardiovascular: "Heart & Cardiovascular",
        respiratory: "Respiratory",
        temperature: "Temperature",
        body_measurements: "Body Measurements",
        activity_fitness: "Activity & Fitness",
        sleep: "Sleep",
        nutrition: "Nutrition",
        glucose: "Glucose",
        // Metrics
        heart_rate: "Heart Rate",
        resting_heart_rate: "Resting Heart Rate",
        heart_rate_variability: "Heart Rate Variability",
        walking_heart_rate_average: "Walking Heart Rate Average",
        blood_pressure_systolic: "Blood Pressure (Systolic)",
        blood_pressure_diastolic: "Blood Pressure (Diastolic)",
        respiratory_rate: "Respiratory Rate",
        blood_oxygen: "Blood Oxygen (SpO2)",
        body_temperature: "Body Temperature",
        weight: "Weight",
        height: "Height",
        body_mass_index: "Body Mass Index",
        body_fat_percentage: "Body Fat Percentage",
        steps: "Steps",
        active_energy: "Active Energy Burned",
        basal_energy: "Basal Energy Burned",
        distance_walking_running: "Distance Walking/Running",
        flights_climbed: "Flights Climbed",
        exercise_minutes: "Exercise Minutes",
        stand_time: "Stand Time",
        workouts: "Workouts",
        sleep_analysis: "Sleep Analysis",
        water_intake: "Water Intake",
        blood_glucose: "Blood Glucose",
      },
    },
  },
  ar: {
    translation: {
      // Common
      welcome: "مرحباً",
      continue: "متابعة",
      skip: "تخطي",
      next: "التالي",
      back: "رجوع",
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      edit: "تعديل",
      add: "إضافة",
      loading: "جاري التحميل...",
      error: "خطأ",
      success: "نجح",

      // Auth
      signIn: "تسجيل الدخول",
      signUp: "إنشاء حساب",
      signOut: "تسجيل الخروج",
      email: "البريد الإلكتروني",
      password: "كلمة المرور",
      confirmPassword: "تأكيد كلمة المرور",
      forgotPassword: "نسيت كلمة المرور؟",
      createAccount: "إنشاء حساب",
      alreadyHaveAccount: "لديك حساب بالفعل؟",
      dontHaveAccount: "ليس لديك حساب؟",

      // Onboarding
      onboardingTitle1: "تتبع صحتك",
      onboardingDesc1: "راقب أعراضك وأدويتك وعلاماتك الحيوية في مكان واحد",
      onboardingTitle2: "رعاية العائلة",
      onboardingDesc2: "حافظ على صحة عائلتك بالكامل مع المراقبة المشتركة",
      onboardingTitle3: "تنبيهات ذكية",
      onboardingDesc3: "احصل على تذكيرات في الوقت المناسب وإشعارات الطوارئ",

      // Navigation
      home: "الرئيسية",
      dashboard: "لوحة التحكم",
      track: "تتبع",
      zeina: "زينة",
      symptoms: "الأعراض الصحية",
      medications: "الأدوية",
      family: "العائلة",
      profile: "الملف الشخصي",

      // Zeina Chat
      zeinaWelcome: "مرحباً! أنا زينة، مساعدك الصحي الذكي الشخصي. لدي إمكانية الوصول إلى ملفك الصحي، الأدوية، الأعراض، ومعلومات العائلة. كيف يمكنني مساعدتك اليوم؟",
      zeinaUnavailable: "زينة غير متاحة مؤقتاً. يرجى الاتصال بالدعم.",
      serviceUnavailable: "الخدمة غير متاحة",
      chatWithZeina: "محادثة مع زينة",
      askZeina: "اسأل زينة عن صحتك، أدويتك، أعراضك...",
      quickQuestions: "أسئلة سريعة",
      manageSymptomsQuestion: "كيف يمكنني إدارة أعراضي؟",
      medicationQuestions: "أسئلة حول الأدوية",
      dietNutritionAdvice: "نصائح التغذية والحمية",
      exerciseRecommendations: "توصيات التمارين",
      generalHealthConcerns: "الاهتمامات الصحية العامة",
      loadingHealthContext: "جاري تحميل السياق الصحي الخاص بك...",
      chatHistory: "سجل المحادثات",
      noChatHistory: "لا يوجد سجل محادثات بعد",
      conversationsWillAppear: "ستظهر محادثاتك هنا",
      startNewChat: "بدء محادثة جديدة",
      chatSession: "جلسة محادثة",
      noMessages: "لا توجد رسائل",
      messages: "رسائل",
      deleteChat: "حذف المحادثة",
      confirmDeleteChat: "هل أنت متأكد من حذف جلسة المحادثة هذه؟",
      failedToLoadSession: "فشل تحميل جلسة المحادثة",
      failedToDeleteSession: "فشل حذف جلسة المحادثة",
      mustBeLoggedIn: "يجب تسجيل الدخول لحذف جلسات المحادثة",
      failedToGetResponse: "فشل الحصول على رد. يرجى المحاولة مرة أخرى.",

      // Voice Features - Arabic
      microphonePermissionRequired: "إذن الميكروفون مطلوب",
      microphonePermissionMessage: "وصول الميكروفون مطلوب للإدخال الصوتي. يرجى منح الإذن في إعدادات جهازك.",
      voiceError: "خطأ صوتي",
      failedToStartRecording: "فشل بدء التسجيل الصوتي",
      speechError: "خطأ في النطق",

      // Dashboard
      healthOverview: "نظرة عامة على الصحة",
      healthInsights: "تحليلات صحية",
      recentSymptoms: "الأعراض الأخيرة",
      upcomingMeds: "الأدوية القادمة",
      familyAlerts: "تنبيهات العائلة",

      // Symptoms
      logSymptom: "تسجيل عرض",
      symptomType: "نوع العرض",
      severity: "الشدة",
      description: "الوصف",
      painLevel: "مستوى الألم",

      // Medications
      addMedication: "إضافة دواء",
      medicationName: "اسم الدواء",
      dosage: "الجرعة",
      frequency: "التكرار",
      setReminder: "تعيين تذكير",

      // Family
      inviteFamily: "دعوة فرد من العائلة",
      familyMembers: "أفراد العائلة",
      healthStatus: "الحالة الصحية",

      // Common symptoms
      headache: "صداع",
      fever: "حمى",
      cough: "سعال",
      fatigue: "إرهاق",
      nausea: "غثيان",
      dizziness: "دوخة",
      chestPain: "ألم في الصدر",
      backPain: "ألم في الظهر",
      soreThroat: "التهاب الحلق",
      runnyNose: "سيلان الأنف",
      shortnessOfBreath: "ضيق في التنفس",
      muscleAche: "ألم في العضلات",
      jointPain: "ألم في المفاصل",
      stomachPain: "ألم في المعدة",
      diarrhea: "إسهال",
      constipation: "إمساك",
      insomnia: "أرق",
      anxiety: "قلق",
      depression: "اكتئاب",
      rash: "طفح جلدي",
      itchiness: "حكة",
      swelling: "تورم",
      chills: "قشعريرة",
      sweating: "تعرق",
      lossOfAppetite: "فقدان الشهية",
      blurredVision: "عدم وضوح الرؤية",
      ringingInEars: "طنين في الأذنين",
      numbness: "خدر",

      // Severity levels
      mild: "خفيف",
      moderate: "متوسط",
      severe: "شديد",
      verySevere: "شديد جداً",

      // Mood types - Positive
      veryHappy: "سعيد جداً",
      happy: "سعيد",
      excited: "متحمس",
      content: "راضٍ",
      grateful: "ممتن",
      hopeful: "متفائل",
      proud: "فخور",
      calm: "هادئ",
      peaceful: "مطمئن",
      // Mood types - Negative
      sad: "حزين",
      verySad: "حزين جداً",
      anxious: "قلق",
      angry: "غاضب",
      frustrated: "محبط",
      overwhelmed: "مثقل",
      hopeless: "يائس",
      guilty: "شاعر بالذنب",
      ashamed: "خجلان",
      lonely: "وحيد",
      irritable: "عصبي",
      restless: "قلق",
      stressed: "متوتر",
      // Mood types - Neutral/Other
      neutral: "عادي",
      confused: "محتار",
      numb: "خدر",
      detached: "منفصل",
      empty: "فارغ",
      apathetic: "غير مبال",
      tired: "متعب",
      notes: "ملاحظات",
      thisWeek: "هذا الأسبوع",

      // Relations
      father: "الأب",
      mother: "الأم",
      spouse: "الزوج/الزوجة",
      child: "الطفل",
      sibling: "الأخ/الأخت",
      grandparent: "الجد/الجدة",
      other: "آخر",

      // Profile
      personalInformation: "المعلومات الشخصية",
      healthReports: "التقارير الصحية",
      helpSupport: "المساعدة والدعم",
      termsConditions: "الشروط والأحكام",
      privacyPolicy: "سياسة الخصوصية",
      healthScore: "نقاط الصحة",
      symptomsThisMonth: "أعراض هذا الشهر",
      activeMedications: "أدوية نشطة",
      notifications: "الإشعارات",
      fallDetection: "كشف السقوط",
      language: "اللغة",
      comingSoon: "قريباً",
      ok: "موافق",

      // Subscription
      subscription: "الاشتراك",
      premium: "مميز",
      subscribe: "اشترك",
      manageSubscription: "إدارة الاشتراك",
      restorePurchases: "استعادة المشتريات",
      subscriptionActive: "الاشتراك نشط",
      subscriptionInactive: "لا يوجد اشتراك نشط",
      familyPlan: "خطة العائلة",
      individualPlan: "الخطة الفردية",
      monthly: "شهري",
      yearly: "سنوي",
      planLimits: "حدود الخطة",
      maxFamilyMembers: "الحد الأقصى لأفراد العائلة",
      maxTotalMembers: "الحد الأقصى لإجمالي الأعضاء",
      individualPlanDescription: "مدير واحد + فرد واحد من العائلة",
      familyPlanDescription: "مدير واحد + 3 أفراد من العائلة",
      purchaseSuccess: "تم الشراء بنجاح",
      purchaseSuccessMessage: "تم تفعيل اشتراكك بنجاح!",
      purchaseError: "فشل الشراء",
      purchaseErrorMessage: "حدث خطأ أثناء معالجة عملية الشراء. يرجى المحاولة مرة أخرى.",
      restoreSuccess: "تم استعادة المشتريات",
      restoreSuccessMessage: "تم استعادة مشترياتك بنجاح.",
      loadError: "فشل تحميل معلومات الاشتراك. يرجى المحاولة مرة أخرى.",
      noOfferingsAvailable: "لا توجد خيارات اشتراك متاحة حالياً.",
      noCustomerInfo: "تعذر تحميل معلومات العميل.",
      subscriptionError: "حدث خطأ",
      errorMessage: "حدث خطأ ما. يرجى المحاولة مرة أخرى.",

      // Additional common strings
      account: "الحساب",
      settings: "الإعدادات",
      support: "الدعم",
      changePassword: "تغيير كلمة المرور",
      calendar: "التقويم",
      healthResources: "المصادر التعليمية",
      selectLanguage: "اختر اللغة",
      arabic: "العربية",
      english: "English",
      memberSince: "عضو منذ",
      healthSummary: "ملخص الصحة",
      chooseYourAvatar: "اختر الصورة الرمزية",
      avatarSavedSuccessfully: "تم حفظ الصورة الرمزية بنجاح",
      failedToSaveAvatar: "فشل حفظ الصورة الرمزية",
      exportInProgress: "جاري التصدير",
      exportInProgressMessage: "يتم تصدير المقاييس الصحية حالياً. يرجى الانتظار حتى يكتمل التصدير.",
      exportSuccessful: "نجح التصدير",
      exportSuccessfulMessage: "تم تصدير المقاييس الصحية بنجاح. استخدم خيار المشاركة لحفظ الملف.",
      exportError: "خطأ في التصدير",
      exportErrorMessage: "حدث خطأ أثناء تصدير المقاييس الصحية",
      errorExportingMetrics: "حدث خطأ في التصدير",
      confirmSignOut: "هل أنت متأكد من تسجيل الخروج؟",
      failedToSignOut: "فشل في تسجيل الخروج",
      errorLoadingData: "حدث خطأ في تحميل البيانات",
      errorSavingData: "حدث خطأ في حفظ البيانات",
      errorDeletingData: "حدث خطأ في حذف البيانات",
      confirmDelete: "تأكيد الحذف",
      confirmDeleteAllergy: "هل أنت متأكد من حذف هذه الحساسية؟",
      pleaseEnterAllergyName: "يرجى إدخال اسم الحساسية",
      allergies: "الحساسية",
      statistics: "الإحصائيات",
      totalAllergies: "إجمالي الحساسيات",
      severeAllergies: "حساسيات شديدة",
      myAllergies: "حساسياتي",
      noAllergiesRecorded: "لا توجد حساسيات مسجلة",
      allergyName: "اسم الحساسية",
      customAllergy: "حساسية مخصصة",
      orEnterCustomAllergy: "أو أدخل حساسية مخصصة",
      reaction: "رد الفعل",
      optional: "اختياري",
      reactionOptional: "رد الفعل (اختياري)",
      notesOptional: "ملاحظات (اختياري)",
      // Allergy names
      allergyPeanuts: "الفول السوداني",
      allergyTreeNuts: "المكسرات",
      allergyMilk: "الحليب",
      allergyEggs: "البيض",
      allergyFish: "السمك",
      allergyShellfish: "المأكولات البحرية",
      allergySoy: "الصويا",
      allergyWheat: "القمح",
      allergyPollen: "حبوب اللقاح",
      allergyDustMites: "عث الغبار",
      allergyPetDander: "وبر الحيوانات الأليفة",
      allergyMold: "العفن",
      allergyLatex: "اللاتكس",
      allergyPenicillin: "البنسلين",
      allergyAspirin: "الأسبرين",
      allergyBeeStings: "لسعات النحل",
      allergySesame: "السمسم",
      allergySulfites: "الكبريتات",
      // Severity labels
      severityMild: "خفيف",
      severityModerate: "متوسط",
      severitySevere: "شديد",
      severitySevereLifeThreatening: "شديد (مهدد للحياة)",
      healthTracking: "تتبع الصحة",
      symptomsThisWeek: "أعراض هذا الأسبوع",
      medCompliance: "الالتزام بالدواء",
      trackingOptions: "خيارات التتبع",
      manage: "إدارة",
      mood: "الحالة النفسية",
      trackYourMood: "تسجيل ومراقبة الحالة النفسية",
      bloodPressure: "ضغط الدم",
      bloodPressureEntry: "إدخال ضغط الدم",
      systolic: "الانقباضي",
      diastolic: "الانبساطي",
      exportToHealthKit: "تصدير إلى HealthKit",
      saving: "جاري الحفظ...",
      invalidInput: "إدخال غير صحيح",
      pleaseEnterBothValues: "يرجى إدخال قيم الانقباضي والانبساطي.",
      pleaseEnterValidNumbers: "يرجى إدخال أرقام صحيحة.",
      systolicRangeError: "يجب أن يكون ضغط الدم الانقباضي بين 50 و 250 ملم زئبق.",
      diastolicRangeError: "يجب أن يكون ضغط الدم الانبساطي بين 30 و 150 ملم زئبق.",
      systolicMustBeGreater: "يجب أن يكون ضغط الدم الانقباضي أكبر من الانبساطي.",
      permissionDenied: "تم رفض الإذن",
      healthKitPermissionMessage: "يرجى منح أذونات الكتابة لضغط الدم في الإعدادات > الخصوصية والأمان > الصحة > [اسم التطبيق] > ضغط الدم.",
      exportFailed: "فشل التصدير",
      healthKitExportFailed: "فشل تصدير ضغط الدم إلى HealthKit. يرجى المحاولة مرة أخرى أو التحقق من إعداداتك.",
      savedLocally: "تم الحفظ محلياً",
      savedLocallyMessage: "تم حفظ ضغط الدم في سجلاتك الصحية. فشل تصدير HealthKit أو غير متاح.",
      bloodPressureSaved: "نجح",
      bloodPressureSavedMessage: "تم حفظ ضغط الدم وتصديره إلى HealthKit!",
      bloodPressureSavedLocallyMessage: "تم حفظ ضغط الدم في سجلاتك الصحية!",
      pleaseLogInToSave: "يرجى تسجيل الدخول لحفظ قراءات ضغط الدم.",
      failedToSaveBloodPressure: "فشل حفظ ضغط الدم. يرجى المحاولة مرة أخرى.",
      normalBloodPressureInfo: "ضغط الدم الطبيعي عادة ما يكون أقل من 120/80 ملم زئبق. ارتفاع ضغط الدم (ارتفاع ضغط الدم) هو 130/80 ملم زئبق أو أعلى.",
      enter: "إدخال",
      vitalSigns: "المؤشرات الحيوية",
      view: "عرض",
      medicalHistory: "التاريخ الطبي",
      labResults: "نتائج المختبر",
      healthTimeline: "الخط الزمني الصحي",
      healthData: "البيانات الصحية",
      vitalsMonitor: "مراقب العلامات الحيوية",
      measure: "قياس",
      viewAll: "عرض الكل",
      // PPG Vital Monitor
      howToMeasureHeartRate: "كيفية قياس معدل ضربات القلب",
      keepFingerStill: "أبقِ إصبعك ثابتاً لمدة {{seconds}} ثانية...",
      processingHeartRate: "جاري معالجة قياس معدل ضربات القلب...",
      measurementComplete: "اكتمل القياس!",
      readyToMeasureHeartRate: "جاهز لقياس معدل ضربات القلب",
      howToMeasure: "كيفية القياس",
      instructionFindComfortablePlace: "ابحث عن مكان مريح للجلوس",
      instructionPositionFinger: "ضع إصبعك السبابة أو الإبهام على عدسة الكاميرا الأمامية (كاميرا السيلفي)",
      instructionPositionFingerAlt: "ضع إصبعك السبابة أو الإبهام على عدسة الكاميرا الأمامية (كاميرا السيلفي) - أي يد تعمل بنفس الكفاءة",
      instructionCoverCamera: "غطّ عدسة الكاميرا الأمامية بالكامل - بدون فجوات أو تسريب للضوء",
      instructionKeepFingerStill: "أبقِ إصبعك ثابتاً ومسترخياً",
      instructionHoldStill: "أبقِ ثابتاً لمدة 60 ثانية دون حركة",
      instructionScreenBrightness: "ستزداد سطوع الشاشة تلقائياً لتوفير الضوء",
      cameraViewDarkNote: "ملاحظة: قد تظهر الكاميرا مظلمة عند تغطيتها بإصبعك - هذا طبيعي!",
      realPPGTechnology: "تقنية PPG الحقيقية",
      realPPGTechnologyDesc: "تستخدم هذه النسخة بيانات الكاميرا الحقيقية لقياس معدل ضربات القلب من خلال اكتشاف تغيرات حجم الدم في أطراف أصابعك. دقة طبية مع قياس لمدة 60 ثانية.",
      why60Seconds: "لماذا 60 ثانية؟",
      why60SecondsDesc: "• التقاط 60-90 نبضة قلب للحصول على موثوقية إحصائية\n• تمكين تحليل HRV بدرجة طبية\n• تحقيق دقة مصادقة 95-97%\n• معدل قبول خاطئ 0.2% (أمان على مستوى البنوك)",
      tipsForBestResults: "نصائح للحصول على أفضل النتائج",
      tipKeepHandSteady: "أبقِ يدك ثابتة ومسترخية",
      tipDontPressHard: "لا تضغط بقوة - الاتصال اللطيف يعمل بشكل أفضل",
      tipFingerWarm: "تأكد من أن إصبعك دافئ (وليس بارداً)",
      tipEitherHand: "أي يد تعمل بنفس الكفاءة - استخدم الأكثر راحة",
      tipPlaceFingerGently: "ضع إصبعك بلطف على عدسة الكاميرا الأمامية - سطوع الشاشة يوفر مصدر الضوء",
      tipStayCalm: "ابق هادئاً وتنفس بشكل طبيعي",
      processingYourHeartRate: "جاري معالجة معدل ضربات القلب...",
      cameraPermissionRequired: "إذن الكاميرا مطلوب",
      onceFingerInPlace: "بمجرد وضع إصبعك في مكانه، اضغط على الزر أدناه لبدء القياس.",
      startMeasurement: "بدء القياس",
      fingerInPlaceStartMeasurement: "✓ الإصبع في المكان - بدء القياس",
      grantCameraPermission: "منح إذن الكاميرا",
      done: "تم",
      realPPG: "PPG حقيقي",
      beta: "تجريبي",
      vitalSignsMonitorDescription: "يقيس معدل ضربات القلب وتغير معدل ضربات القلب ومعدل التنفس باستخدام بيانات الكاميرا الحقيقية (تقنية PPG)",
      vitalSignsSaved: "تم حفظ علاماتك الحيوية في سجلاتك الصحية.",
      intensity: "شدة",
      todaysMedications: "أدوية اليوم",
      recentMedicalHistory: "التاريخ الطبي الأخير",
      latestVitalSigns: "المؤشرات الحيوية الأخيرة",
      heartRate: "معدل ضربات القلب",
      steps: "الخطوات",
      step: "خطوة",
      sleep: "النوم",
      hours: "ساعة",
      healthBeyondBorders: '"الصحة، تتجاوز الحدود"',
      fullName: "الاسم الكامل",
      emailAddress: "البريد الإلكتروني",
      accountCreationDate: "تاريخ إنشاء الحساب",
      memberSinceLabel: "تاريخ الانضمام",
      userRole: "دور المستخدم",
      accountDetails: "تفاصيل الحساب",
      uniqueAccountIdentifier: "معرف فريد للحساب",
      userId: "معرف المستخدم",
      notSpecified: "غير محدد",
      preferredLanguage: "اللغة المفضلة",
      appInterfaceLanguage: "لغة واجهة التطبيق",
      phoneNumber: "رقم الهاتف",
      forEmergenciesAndNotifications: "للطوارئ والإشعارات",
      accountStatistics: "إحصائيات الحساب",
      daysActive: "أيام العضوية",
      profileComplete: "اكتمال الملف",
      editProfile: "تعديل الملف الشخصي",
      firstName: "الاسم الأول",
      enterYourFirstName: "ادخل اسمك الأول",
      lastName: "اسم العائلة",
      enterYourLastName: "ادخل اسم عائلتك",
      enterPhoneNumber: "ادخل رقم الهاتف",
      pleaseEnterFirstName: "يرجى إدخال الاسم الأول",
      profileUpdatedSuccessfully: "تم تحديث الملف الشخصي بنجاح",
      failedToUpdateProfile: "حدث خطأ في تحديث الملف الشخصي",
      basicInformation: "المعلومات الأساسية",
      forLoginAndCommunication: "للدخول والتواصل",
      resetPassword: "إعادة تعيين كلمة المرور",
      emailSent: "تم الإرسال",
      failedToSendEmail: "فشل إرسال البريد الإلكتروني",
      passwordChanged: "تم التغيير",
      failedToChangePassword: "فشل تغيير كلمة المرور",
      currentPassword: "كلمة المرور الحالية",
      enterCurrentPassword: "أدخل كلمة المرور الحالية",
      newPassword: "كلمة المرور الجديدة",
      enterNewPassword: "أدخل كلمة المرور الجديدة",
      send: "إرسال",
      noMetricsSelected: "لا توجد مقاييس محددة",
      pleaseSelectAtLeastOneMetric: "يرجى تحديد مقياس واحد على الأقل للمتابعة",
      notificationSent: "تم إرسال الإشعار",
      emergencyNotificationSent: "تم إرسال إشعار طوارئ لجميع أفراد العائلة",
      failedToSendNotification: "فشل إرسال الإشعار. حاول مرة أخرى.",

      // Interactive Notifications - Arabic
      morningCheckinTitle: "🌅 صباح الخير! كيف تشعر اليوم؟",
      morningCheckinBody: "تحقق سريع: قيم مستوى طاقتك ولاحظ أي أعراض. نبني عادات صحية معاً!",
      eveningReflectionTitle: "🌙 تأمل صحي مسائي",
      eveningReflectionBody: "كيف كان يومك؟ سجل مزاجك وأعراضك وامتثالك للأدوية. نبني عادات صحية معاً!",

      // Streak Notifications - Arabic
      streakCelebrationTitle: "🔥 {{streak}} يوم متتالي!",
      streakCelebrationBody: "رائع! لقد كنت تتابع صحتك بانتظام لمدة {{streak}} يوم. استمر في العمل الرائع!",
      streakRiskTitle: "⚠️ لا تكسر سلسلتك!",
      streakRiskBody: "لم تقم بتسجيل أي بيانات صحية اليوم. مجرد تحقق سريع للحفاظ على سلسلتك البالغة {{streak}} يوم!",
      streakRecoveryTitle: "💪 جاهز لإعادة بدء سلسلتك؟",
      streakRecoveryBody: "مر {{days}} يوم منذ آخر تسجيل صحي لك. أطول سلسلة لديك كانت {{longest}} يوم - يمكنك فعل ذلك!",

      // Activity Alerts - Arabic
      missedSymptomsTitle: "📝 تحقق من الأعراض",
      missedSymptomsBody: "مر {{days}} يوم منذ آخر تسجيل للأعراض. كيف تشعر اليوم؟ التتبع المنتظم يساعدك على البقاء على اطلاع بصحتك.",
      medicationComplianceTitle: "💊 فحص الأدوية",
      medicationComplianceBody: "لاحظنا أن امتثالك للأدوية عند {{compliance}}%. كل شيء بخير؟ اضغط لتحديث حالة أدويتك.",
      weeklySummaryTitle: "📊 فحص صحي أسبوعي",
      weeklySummaryBody: "مر أسبوع منذ آخر نشاط صحي لك. وقت لملخص صحي سريع وفحص الأهداف؟",

      // Achievement Notifications - Arabic
      achievementUnlockedTitle: "🏆 {{title}}",
      achievementUnlockedBody: "{{description}}",

      // Quick Action Labels - Arabic
      quickActionFeelingGreat: "😊 أشعر بالروعة",
      quickActionHaveSymptoms: "🤒 لدي أعراض",
      quickActionCheckMeds: "💊 فحص الأدوية",
      quickActionNeedHelp: "🆘 أحتاج مساعدة",
      quickActionAllGood: "✅ كل شيء بخير",
      quickActionLogDetails: "📝 سجل التفاصيل",
      quickActionMedsTaken: "💊 تم أخذ الأدوية",
      quickActionQuickLog: "📝 تسجيل سريع",
      quickActionRemindLater: "⏰ تذكير لاحقاً",
      quickActionConfirmMedication: "✅ تم أخذ الأدوية",
      quickActionUpdateStatus: "📝 تحديث الحالة",
      quickActionContactCaregiver: "🆘 اتصل بالممرض",
      quickActionNoSymptoms: "😊 أشعر بالخير",
      quickActionTomorrow: "⏰ غداً",

      // Phase 2: Condition-Specific Reminders - Arabic
      diabetesBloodSugarTitle: "🩸 فحص سكر الدم",
      diabetesBloodSugarBody: "مراقبة سكر الدم بانتظام هي المفتاح لإدارة السكري. وقت للفحص اليومي؟",
      hypertensionBPTitle: "❤️ فحص ضغط الدم",
      hypertensionBPBody: "تتبع ضغط الدم يساعد في إدارة ارتفاع ضغط الدم. دعنا نفحصه اليوم.",
      respiratoryCheckTitle: "🫁 فحص التنفس",
      respiratoryCheckBody: "مراقبة معدل التنفس يساعد في إدارة حالات الجهاز التنفسي. دعنا نفعل فحص سريع.",
      mentalHealthCheckTitle: "😊 فحص الصحة النفسية",
      mentalHealthCheckBody: "أخذ لحظة لصحتك النفسية مهم. كيف تشعر اليوم؟",

      // Phase 2: Vital Sign Prompts - Arabic
      weightCheckTitle: "⚖️ فحص الوزن الشهري",
      weightCheckBody: "مراقبة الوزن بانتظام مهمة للصحة العامة. دعنا نفحص وزنك هذا الشهر.",
      temperatureCheckTitle: "🌡️ فحص درجة الحرارة",
      temperatureCheckBody: "مراقبة درجة الحرارة بانتظام تساعد في اكتشاف المشاكل المحتملة مبكراً. وقت لفحص سريع؟",

      // Phase 2: Medication Adherence - Arabic
      adherenceEncouragementTitle: "💪 مساعدة الالتزام بالأدوية",
      adherenceEncouragementBody: "لاحظنا أن الامتثال للأدوية أقل من 60%. هل تريد مساعدة في إعداد تذكيرات أو تنظيم أدويتك؟",
      adherenceMotivationTitle: "🎯 ابق على المسار",
      adherenceMotivationBody: "أنت عند {{compliance}}% من الامتثال للأدوية. دعنا نعمل معاً لتحسين هذا!",
      complexRegimenTitle: "📋 مساعدة تنظيم الأدوية",
      complexRegimenBody: "مع أدوية متعددة، التنظيم هو المفتاح. هل تريد مساعدة في تنظيم جدول أدويتك؟",

      // Phase 2: Quick Actions - Arabic
      quickActionLogReading: "📝 سجل القراءة",
      quickActionCheckNow: "📏 افحص الآن",
      quickActionSetReminder: "⏰ ضع تذكير",
      quickActionLogSymptoms: "📝 سجل الأعراض",
      quickActionFeelingGood: "😊 أشعر بالخير",
      quickActionLogMood: "📝 سجل المزاج",
      quickActionTalkToZeina: "🤖 تحدث مع زينة",
      quickActionLogWeight: "📝 سجل الوزن",
      quickActionSkipThisMonth: "⏭️ تخطى هذا الشهر",
      quickActionTakeTemperature: "🌡️ خذ القراءة",
      quickActionFeelingNormal: "😊 أشعر بالطبيعي",
      quickActionSetupReminders: "⏰ إعداد التذكيرات",
      quickActionOrganizeMeds: "📦 نظم الأدوية",
      quickActionTalkToCaregiver: "👨‍⚕️ تحدث مع الممرض",
      quickActionViewSchedule: "📅 عرض الجدول",
      quickActionLogMeds: "💊 سجل أدوية اليوم",
      quickActionSetGoal: "🎯 ضع هدف",
      quickActionCreateSchedule: "📅 أنشئ جدول",
      quickActionPillOrganizer: "📦 منظم الحبوب",

      // Phase 4: Additional Quick Actions - Arabic
      quickActionLogReading: "📝 سجل القراءة",
      quickActionCheckNow: "📏 افحص الآن",
      quickActionSetReminder: "⏰ ضع تذكير",
      quickActionFeelingGood: "😊 أشعر بالخير",
      quickActionLogMood: "📝 سجل المزاج",
      quickActionTalkToZeina: "🤖 تحدث مع زينة",
      quickActionLogWeight: "📝 سجل الوزن",
      quickActionSkipThisMonth: "⏭️ تخطى هذا الشهر",
      quickActionTakeTemperature: "🌡️ خذ القراءة",
      quickActionFeelingNormal: "😊 أشعر بالطبيعي",
      quickActionEmergencyResponse: "🚑 الرد الآن",
      quickActionCallEmergency: "📞 اتصل بالطوارئ",
      quickActionUpdateCareNotes: "📝 حدث ملاحظات الرعاية",
      quickActionScheduleHandoff: "📅 جدولة التسليم",
      quickActionViewAppointments: "📅 عرض المواعيد",
      quickActionConfirmAttendance: "✅ تأكيد الحضور",
      quickActionShareAchievement: "📤 مشاركة",
      quickActionViewProgress: "📊 عرض التقدم",

      // Phase 3: Family Health Updates - Arabic
      familyHealthSummaryTitle: "👨‍👩‍👧‍👦 تحديث صحة العائلة",
      familyHealthSummaryBody: "{{count}} فرد من العائلة قد يحتاج إلى الانتباه. تحقق من تبويب العائلة للتفاصيل.",
      familyMedicationCoordinationTitle: "💊 وقت أدوية العائلة",
      familyMedicationCoordinationBody: "{{count}} فرد من العائلة لديهم أدوية مستحقة قريباً. ساعد في تنسيق رعايتهم.",
      familyMemberAchievementTitle: "🎉 إنجاز عائلي",
      familyMemberAchievementBody: "{{name}} وصل إلى معلم صحي: {{achievement}}",

      // Phase 3: Caregiver Coordination - Arabic
      emergencyCoordinationTitle: "🚨 يلزم تنسيق طوارئ",
      emergencyCoordinationBody: "{{count}} فرد من العائلة أطلقوا إنذارات طوارئ. يلزم الانتباه الفوري.",
      careHandoffTitle: "🤝 تنسيق الرعاية",
      careHandoffBody: "وقت تسليم الرعاية. حدث أفراد العائلة حول التطورات الصحية الأخيرة.",
      appointmentCoordinationTitle: "📅 تنسيق المواعيد",
      appointmentCoordinationBody: "{{count}} مواعيد قادمة تحتاج إلى تنسيق. راجع وأكد الحضور.",

      // Phase 3: Achievement Celebrations - Arabic
      achievementUnlockedTitle: "🏆 تم إلغاء قفل إنجاز!",
      achievementTypeStreak: "سلسلة",
      achievementTypeCompliance: "الامتثال",
      achievementTypeConsistency: "الاستمرارية",
      achievementTypeMilestone: "معلم",

      // Phase 3: Quick Actions - Arabic
      quickActionViewFamily: "👨‍👩‍👧‍👦 عرض العائلة",
      quickActionCheckAlerts: "🚨 فحص التنبيهات",
      quickActionSendReminders: "📱 إرسال تذكيرات",
      quickActionEmergencyResponse: "🚑 الرد الآن",
      quickActionCallEmergency: "📞 اتصل بالطوارئ",
      quickActionUpdateCareNotes: "📝 تحديث ملاحظات الرعاية",
      quickActionScheduleHandoff: "📅 جدولة التسليم",
      quickActionViewAppointments: "📅 عرض المواعيد",
      quickActionConfirmAttendance: "✅ تأكيد الحضور",
      quickActionShareAchievement: "📤 مشاركة",
      quickActionViewProgress: "📊 عرض التقدم",
      pleaseLogInToViewDashboard: "Please log in to view your dashboard",
      familyAdmin: "مدير العائلة",
      member: "عضو",
      manageFamilyAndSettings: "إدارة العائلة والإعدادات",
      familyMember: "عضو في العائلة",
      man: "رجل",
      woman: "امرأة",
      boy: "صبي",
      girl: "فتاة",
      grandpa: "جد",
      grandma: "جدة",
      darkMode: "المظهر الداكن",
      healthIntegrations: "تكاملات الصحة",
      editAllergy: "تعديل الحساسية",
      addAllergy: "إضافة حساسية",
      // Health Integrations
      availableProviders: "المزودون المتاحون",
      appleHealth: "Apple Health",
      appleHealthDescription: "مزامنة البيانات من تطبيق الصحة الخاص بـ Apple",
      fitbit: "Fitbit",
      fitbitDescription: "مزامنة البيانات من حساب Fitbit الخاص بك",
      recommended: "موصى به",
      connected: "متصل",
      metrics: "مقاييس",
      notAvailableOnPlatform: "غير متاح على هذه المنصة",
      notAvailable: "غير متاح",
      aboutHealthIntegrations: "حول تكاملات الصحة",
      healthDataReadOnly: "• بيانات الصحة للقراءة فقط وتحت سيطرتك الكاملة",
      chooseMetricsToShare: "• تختار بالضبط المقاييس التي تريد مشاركتها",
      dataEncrypted: "• البيانات مشفرة ومزامنة بشكل آمن",
      disconnectAnytime: "• يمكنك قطع الاتصال في أي وقت",
      // Apple Health Intro
      connectAppleHealth: "ربط Apple Health",
      syncHealthDataBetterInsights: "قم بمزامنة بياناتك الصحية لتوفير رؤى رعاية أفضل",
      whatYoullGet: "ما ستحصل عليه",
      completeHealthPicture: "صورة صحية كاملة",
      completeHealthPictureDesc: "اعرض جميع مقاييس صحتك في مكان واحد لتنسيق رعاية أفضل",
      earlyRiskDetection: "الكشف المبكر عن المخاطر",
      earlyRiskDetectionDesc: "تتبع الاتجاهات وتحديد المشاكل الصحية المحتملة مبكراً",
      yourDataYourControl: "بياناتك، سيطرتك",
      yourDataYourControlDesc: "تختار بالضبط المقاييس التي تريد مشاركتها. وصول للقراءة فقط.",
      yourPrivacyPromise: "وعد الخصوصية الخاص بك",
      weOnlyReadWhatYouChoose: "نقرأ فقط ما تختاره",
      weOnlyReadWhatYouChooseDesc: "لديك سيطرة كاملة. اختر بالضبط المقاييس التي تريد مشاركتها، وسنصل فقط إلى تلك.",
      weNeverSellHealthData: "لا نبيع أو نشارك بياناتك الصحية أبداً",
      weNeverSellHealthDataDesc: "بياناتك الصحية ملكك وحدك. لا نبيعها أو نشاركها مع أطراف ثالثة أو نستخدمها للإعلان.",
      changePermissionsAnytime: "يمكنك تغيير الأذونات في أي وقت",
      changePermissionsAnytimeDesc: "قم بتحديث اختياراتك أو قطع الاتصال تماماً في أي وقت من خلال التطبيق أو إعدادات iOS.",
      readOnlyAccess: "• وصول للقراءة فقط - لا نكتب أبداً في بياناتك الصحية",
      dataEncryptedSynced: "• البيانات مشفرة ومزامنة بشكل آمن",
      usedForCaregiving: "• تُستخدم فقط لرؤى الرعاية وتتبع الصحة",
      notNow: "ليس الآن",
      appleHealthOnlyIOS: "Apple Health متاح فقط على أجهزة iOS.",
      // Apple Health Permissions
      selectMetrics: "اختر المقاييس",
      chooseHealthMetricsToSync: "اختر مقاييس الصحة التي تريد مزامنتها من Apple Health",
      selectAll: "تحديد الكل",
      allSelected: "✓ تم تحديد الكل",
      authorizeMetrics: "تفويض",
      metric: "مقياس",
      changePermissionsLater: "يمكنك تغيير هذه الأذونات لاحقاً في إعدادات iOS → الخصوصية والأمان → الصحة",
      appleHealthPermissions: "أذونات Apple Health",
      // Fitbit Intro
      connectFitbit: "ربط Fitbit",
      syncFitbitToMaak: "قم بمزامنة بياناتك الصحية من Fitbit إلى Maak Health",
      yourPrivacy: "خصوصيتك",
      // Fitbit Permissions
      fitbitPermissions: "أذونات Fitbit",
      chooseHealthMetricsToSyncFitbit: "اختر مقاييس الصحة التي تريد مزامنتها من Fitbit",
      // Health Metrics (moved to nested healthMetrics object below)
      restingHeartRate: "معدل ضربات القلب أثناء الراحة",
      heartRateVariability: "تغير معدل ضربات القلب",
      walkingHeartRateAverage: "متوسط معدل ضربات القلب أثناء المشي",
      bloodPressureSystolic: "ضغط الدم (الانقباضي)",
      bloodPressureDiastolic: "ضغط الدم (الانبساطي)",
      respiratoryRate: "معدل التنفس",
      bloodOxygen: "الأكسجين في الدم (SpO2)",
      bodyTemperature: "درجة حرارة الجسم",
      bodyMassIndex: "مؤشر كتلة الجسم",
      bodyFatPercentage: "نسبة الدهون في الجسم",
      activeEnergyBurned: "الطاقة النشطة المحروقة",
      basalEnergyBurned: "الطاقة الأساسية المحروقة",
      distanceWalkingRunning: "المسافة (مشي/جري)",
      flightsClimbed: "الطوابق المتسلقة",
      exerciseMinutes: "دقائق التمرين",
      standTime: "وقت الوقوف",
      workouts: "تمارين",
      sleepAnalysis: "تحليل النوم",
      waterIntake: "استهلاك الماء",
      bloodGlucose: "سكر الدم",
      // Metric Groups
      heartCardiovascular: "القلب والأوعية الدموية",
      respiratory: "الجهاز التنفسي",
      temperature: "درجة الحرارة",
      bodyMeasurements: "قياسات الجسم",
      activityFitness: "النشاط واللياقة",
      nutrition: "التغذية",
      glucose: "الجلوكوز",
      // Health Metrics (nested)
      healthMetrics: {
        // Groups
        heart_cardiovascular: "القلب والأوعية الدموية",
        respiratory: "الجهاز التنفسي",
        temperature: "درجة الحرارة",
        body_measurements: "قياسات الجسم",
        activity_fitness: "النشاط واللياقة",
        sleep: "النوم",
        nutrition: "التغذية",
        glucose: "الجلوكوز",
        // Metrics
        heart_rate: "معدل ضربات القلب",
        resting_heart_rate: "معدل ضربات القلب أثناء الراحة",
        heart_rate_variability: "تغير معدل ضربات القلب",
        walking_heart_rate_average: "متوسط معدل ضربات القلب أثناء المشي",
        blood_pressure_systolic: "ضغط الدم (الانقباضي)",
        blood_pressure_diastolic: "ضغط الدم (الانبساطي)",
        respiratory_rate: "معدل التنفس",
        blood_oxygen: "الأكسجين في الدم (SpO2)",
        body_temperature: "درجة حرارة الجسم",
        weight: "الوزن",
        height: "الطول",
        body_mass_index: "مؤشر كتلة الجسم",
        body_fat_percentage: "نسبة الدهون في الجسم",
        steps: "الخطوات",
        active_energy: "الطاقة النشطة المحروقة",
        basal_energy: "الطاقة الأساسية المحروقة",
        distance_walking_running: "المسافة (مشي/جري)",
        flights_climbed: "الطوابق المتسلقة",
        exercise_minutes: "دقائق التمرين",
        stand_time: "وقت الوقوف",
        workouts: "تمارين",
        sleep_analysis: "تحليل النوم",
        water_intake: "استهلاك الماء",
        blood_glucose: "سكر الدم",
      },
    },
  },
};

// Helper function to set RTL layout direction
const setRTL = (isRTL: boolean) => {
  if (Platform.OS === "android" || Platform.OS === "ios") {
    I18nManager.forceRTL(isRTL);
    I18nManager.allowRTL(isRTL);
    // Note: On Android, you may need to restart the app for changes to take effect
    // On iOS, it should work immediately
  }
};

// Initialize i18n with proper configuration for react-i18next
const initI18n = async () => {
  // Get initial language from storage or default to English
  let initialLang = "en";
  try {
    const AsyncStorage = await import("@react-native-async-storage/async-storage");
    const savedLanguage = await AsyncStorage.default.getItem("app_language");
    if (savedLanguage) {
      initialLang = savedLanguage;
    }
  } catch {
    // Use default
  }

  const isRTL = initialLang === "ar";
  setRTL(isRTL);

  return i18n
    .use(initReactI18next) // Pass the i18n instance to react-i18next
    .init({
      compatibilityJSON: "v3", // Fix Intl.PluralRules compatibility
      resources,
      lng: initialLang,
      fallbackLng: "en",

      interpolation: {
        escapeValue: false, // React already does escaping
      },

      // React Native specific options
      react: {
        useSuspense: false, // Disable suspense for React Native
      },

      // Cache configuration for React Native
      cache: {
        enabled: false, // Disable caching for now to avoid issues
      },
    });
};

// Initialize i18n
initI18n().then(() => {
  // Override changeLanguage to also update RTL direction after initialization
  if (i18n.changeLanguage) {
    const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
    i18n.changeLanguage = async (lng?: string) => {
      const newLang = lng || i18n.language;
      const isRTL = newLang === "ar";
      setRTL(isRTL);
      
      // Save language preference
      try {
        const AsyncStorage = await import("@react-native-async-storage/async-storage");
        await AsyncStorage.default.setItem("app_language", newLang);
      } catch {
        // Silently handle error
      }
      
      return originalChangeLanguage(lng);
    };
  }
}).catch(() => {
  // Silently handle error
});

export default i18n;
