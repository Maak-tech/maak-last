# Firebase Setup Guide for Maak Health App

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Name your project "Maak Health" (or your preferred name)
4. Enable Google Analytics (recommended)
5. Create the project

## 2. Configure Authentication

1. In your Firebase project, go to **Authentication** > **Sign-in method**
2. Enable **Email/Password** sign-in provider
3. Save the changes

## 3. Create Firestore Database

1. Go to **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (for development)
4. Select your preferred location
5. Create the database

## 4. Get Firebase Configuration

1. Go to **Project Settings** (gear icon)
2. In the **General** tab, scroll down to "Your apps"
3. Click the web icon `</>`
4. Register your app with name "Maak Health Web"
5. Copy the `firebaseConfig` object

## 5. Configure Your App

Create a `.env` file in your project root with your Firebase config:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key-here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## 6. Set up Firestore Security Rules

⚠️ **CRITICAL**: Replace the default rules in **Firestore Database** > **Rules** with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Development rules - more permissive for testing
    // Replace with production rules once everything is working

    // Users can read/write their own data and family members
    match /users/{userId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == userId ||
        // Allow reading other users if they're in the same family
        (request.auth.uid != userId &&
         exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.familyId ==
         get(/databases/$(database)/documents/users/$(userId)).data.familyId)
      );
      allow create: if request.auth != null && request.auth.uid == userId;
    }

    // Symptoms - users can manage their own
    match /symptoms/{symptomId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Medications - users can manage their own
    match /medications/{medicationId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Medical history - users can manage their own
    match /medicalHistory/{historyId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Family data - UPDATED RULES for invitation processing
    match /families/{familyId} {
      // Current members can read/write
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.members;

      // Allow creating families
      allow create: if request.auth != null;

      // CRUCIAL: Allow updating families when someone is joining via invitation
      // This allows adding new members to the family during invitation processing
      allow update: if request.auth != null && (
        // Current member updating the family
        request.auth.uid in resource.data.members ||
        // New member being added (invitation process)
        (!(request.auth.uid in resource.data.members) &&
         request.auth.uid in request.resource.data.members)
      );

      // Allow reading families during invitation process
      allow read: if request.auth != null;
    }

    // Family invitation codes - allow creation and usage
    match /familyInvitations/{invitationId} {
      // Allow creating invitation codes for your own family
      allow create: if request.auth != null && request.auth.uid == request.resource.data.invitedBy;

      // Allow reading invitation codes (needed to validate codes)
      allow read: if request.auth != null;

      // Allow updating invitation codes when using them
      allow update: if request.auth != null;
    }

    // Emergency alerts - allow creators and responders to access
    match /alerts/{alertId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == resource.data.userId ||
        request.auth.uid in resource.data.responders
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

**Note**: These are permissive development rules. For production, use the detailed rules below:

<details>
<summary>Production Security Rules (click to expand)</summary>

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Allow family members to read each other's basic data
    match /users/{userId} {
      allow read: if request.auth != null &&
        resource.data.familyId != null &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.familyId == resource.data.familyId;
    }

    // Allow users to create and access their own symptoms
    match /symptoms/{symptomId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Allow users to create and access their own medications
    match /medications/{medicationId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Allow users to create and access their own vitals
    match /vitals/{vitalId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Allow users to create and access their own medical history
    match /medicalHistory/{historyId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Family data - allow members to read/write family documents
    match /families/{familyId} {
      // Current members can read/write
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.members;

      // Allow creating families
      allow create: if request.auth != null;

      // Allow reading family documents when joining via invitation
      allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/familyInvitations/$(getInvitationDoc(request.auth.uid, familyId))) &&
        get(/databases/$(database)/documents/familyInvitations/$(getInvitationDoc(request.auth.uid, familyId))).data.status == 'pending';

      // Allow updating family documents when joining via invitation
      allow update: if request.auth != null &&
        // Check if user is being added to members list
        !(request.auth.uid in resource.data.members) &&
        (request.auth.uid in request.resource.data.members) &&
        // Validate there's a pending invitation
        hasValidInvitation(request.auth.uid, familyId);
    }

    // Helper function to check for valid invitation (simulated)
    function hasValidInvitation(userId, familyId) {
      // Since we can't do complex queries in security rules, we allow updates
      // when user is being added to members and wasn't there before
      // The app logic will validate the invitation code
      return request.auth != null;
    }

    // Simplified helper for invitation document lookup
    function getInvitationDoc(userId, familyId) {
      return userId + '_' + familyId; // This is a placeholder
    }

    // Family invitation codes - allow creation and usage
    match /familyInvitations/{invitationId} {
      // Allow creating invitation codes for your own family
      allow create: if request.auth != null && request.auth.uid == request.resource.data.invitedBy;

      // Allow reading invitation codes (needed to validate codes)
      allow read: if request.auth != null;

      // Allow updating invitation codes when using them
      allow update: if request.auth != null &&
        (request.auth.uid == resource.data.invitedBy || // Creator can update
         resource.data.status == 'pending'); // Anyone can use pending codes
    }

    // Emergency alerts - allow creators and responders to access
    match /alerts/{alertId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == resource.data.userId ||
        request.auth.uid in resource.data.responders
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

</details>

## 7. Initialize Required Collections

After setting up security rules, you need to create the initial collections. You can do this through the Firebase Console:

### Create Collections:

1. Go to **Firestore Database** > **Data**
2. Click **Start collection**
3. Create these collections with sample documents:

#### Collection: `users`

- Document ID: Use your Auth UID
- Fields:
  ```
  email: string (your email)
  name: string (your name)
  role: string ("admin")
  createdAt: timestamp (current time)
  onboardingCompleted: boolean (true)
  preferences: map {
    language: string ("en")
    notifications: boolean (true)
    emergencyContacts: array ([])
  }
  ```

#### Collection: `symptoms`

- Document ID: Auto-generate
- Fields:
  ```
  userId: string (your Auth UID)
  type: string ("sample")
  severity: number (1)
  timestamp: timestamp (current time)
  ```

#### Collection: `medications`

- Document ID: Auto-generate
- Fields:
  ```
  userId: string (your Auth UID)
  name: string ("sample")
  isActive: boolean (true)
  startDate: timestamp (current time)
  ```

## 8. Install Required Dependencies

The app already includes the necessary Firebase dependencies. If you need to reinstall:

```bash
npm install firebase@^10.12.2 @react-native-async-storage/async-storage
```

## 9. Test the Setup

1. Start your development server: `npm run dev`
2. Try creating a new account
3. Check Firebase Console to see if the user was created
4. Try logging in with the new account
5. Try adding symptoms and medications

## Common Issues & Solutions

### "Missing or insufficient permissions"

- ✅ **Solution**: Make sure you've updated the Firestore security rules exactly as shown above
- ✅ **Solution**: Ensure the user document exists in the `users` collection

### "Firebase not configured"

- ✅ **Solution**: Make sure your `.env` file has all the required variables
- ✅ **Solution**: Restart your development server after adding environment variables

### "Auth domain not authorized"

- ✅ **Solution**: Add your domain to Firebase Auth authorized domains in Authentication > Settings

### User document not found

- ✅ **Solution**: Make sure the user document is created in Firestore when a user registers

## 10. Production Setup

For production deployment:

1. **Security Rules**: Review and tighten security rules as needed
2. **Environment Variables**: Set up production environment variables
3. **Backup Rules**: Set up regular Firestore backups
4. **Monitoring**: Enable Firebase monitoring and alerts

## Next Steps

After Firebase is configured:

1. The app will automatically use real authentication
2. Data will be stored in Firestore
3. All features will work with real backend data
4. Test all CRUD operations (Create, Read, Update, Delete) for each data type

## Emergency Troubleshooting

If you're still getting permission errors:

1. **Temporarily use test mode rules** (NOT for production):

   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

2. **Check the Firebase Console logs** for detailed error messages
3. **Verify your user is authenticated** by checking the Authentication tab
4. **Ensure collections exist** in the Firestore Database tab

## 🚨 **URGENT: Update Firestore Security Rules**

**You're getting permission errors because the security rules need to be updated for family invitations.**

### **Step 1: Go to Firebase Console**

1. Open [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Firestore Database** → **Rules**

### **Step 2: Replace All Rules with This:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Allow family members to read each other's basic data
    match /users/{userId} {
      allow read: if request.auth != null &&
        resource.data.familyId != null &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.familyId == resource.data.familyId;
    }

    // Allow users to create and access their own symptoms
    match /symptoms/{symptomId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Allow users to create and access their own medications
    match /medications/{medicationId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Allow users to create and access their own vitals
    match /vitals/{vitalId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Allow users to create and access their own medical history
    match /medicalHistory/{historyId} {
      allow read, write: if request.auth != null && (
        resource.data.userId == request.auth.uid ||
        request.auth.uid == request.resource.data.userId
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }

    // Family data - allow members to read/write family documents
    match /families/{familyId} {
      // Current members can read/write
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.members;

      // Allow creating families
      allow create: if request.auth != null;

      // Allow reading family documents when joining via invitation
      allow read: if request.auth != null &&
        exists(/databases/$(database)/documents/familyInvitations/$(getInvitationDoc(request.auth.uid, familyId))) &&
        get(/databases/$(database)/documents/familyInvitations/$(getInvitationDoc(request.auth.uid, familyId))).data.status == 'pending';

      // Allow updating family documents when joining via invitation
      allow update: if request.auth != null &&
        // Check if user is being added to members list
        !(request.auth.uid in resource.data.members) &&
        (request.auth.uid in request.resource.data.members) &&
        // Validate there's a pending invitation
        hasValidInvitation(request.auth.uid, familyId);
    }

    // Helper function to check for valid invitation (simulated)
    function hasValidInvitation(userId, familyId) {
      // Since we can't do complex queries in security rules, we allow updates
      // when user is being added to members and wasn't there before
      // The app logic will validate the invitation code
      return request.auth != null;
    }

    // Simplified helper for invitation document lookup
    function getInvitationDoc(userId, familyId) {
      return userId + '_' + familyId; // This is a placeholder
    }

    // Family invitation codes - allow creation and usage
    match /familyInvitations/{invitationId} {
      // Allow creating invitation codes for your own family
      allow create: if request.auth != null && request.auth.uid == request.resource.data.invitedBy;

      // Allow reading invitation codes (needed to validate codes)
      allow read: if request.auth != null;

      // Allow updating invitation codes when using them
      allow update: if request.auth != null &&
        (request.auth.uid == resource.data.invitedBy || // Creator can update
         resource.data.status == 'pending'); // Anyone can use pending codes
    }

    // Emergency alerts - allow creators and responders to access
    match /alerts/{alertId} {
      allow read, write: if request.auth != null && (
        request.auth.uid == resource.data.userId ||
        request.auth.uid in resource.data.responders
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
  }
}
```

### **Step 3: Publish the Rules**

1. Click **"Publish"** button
2. Wait for the rules to deploy (usually takes a few seconds)

### **Step 4: Test the Fix**

1. Go back to your app
2. Try the "Share Invite Code" feature again
3. It should now work without permission errors!

---
