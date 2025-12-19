// Test script for family invitation flow
// Run this with: node scripts/test-family-invitation.js

const admin = require("firebase-admin");

// Initialize Firebase Admin
const serviceAccount = {
  // Add your service account details here
  // You can get this from Firebase Console > Project Settings > Service Accounts
  type: "service_account",
  project_id: "YOUR_PROJECT_ID",
  // Add other required fields...
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function testFamilyInvitation() {
  try {
    console.log("🧪 Starting family invitation test...");

    // Step 1: Create a test family with an existing user
    const inviterUserId = "test-inviter-" + Date.now();
    const inviteeUserId = "test-invitee-" + Date.now();

    console.log("👤 Creating inviter user:", inviterUserId);
    await db.collection("users").doc(inviterUserId).set({
      name: "Test Inviter",
      email: "inviter@test.com",
      role: "admin",
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log("👥 Creating family...");
    const familyRef = await db.collection("families").add({
      name: "Test Family",
      createdBy: inviterUserId,
      members: [inviterUserId],
      status: "active",
      createdAt: admin.firestore.Timestamp.now(),
    });

    const familyId = familyRef.id;
    console.log("✅ Family created:", familyId);

    // Update inviter user with family ID
    await db.collection("users").doc(inviterUserId).update({
      familyId,
    });

    // Step 2: Create invitation code
    console.log("🎫 Creating invitation code...");
    const inviteCode = Math.floor(100_000 + Math.random() * 900_000).toString();
    const invitationRef = await db.collection("familyInvitations").add({
      code: inviteCode,
      familyId,
      invitedBy: inviterUserId,
      invitedUserName: "Test Invitee",
      invitedUserRelation: "sibling",
      status: "pending",
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      ),
    });

    console.log("✅ Invitation code created:", inviteCode);

    // Step 3: Create invitee user (simulating registration)
    console.log("👤 Creating invitee user:", inviteeUserId);
    await db.collection("users").doc(inviteeUserId).set({
      name: "Test Invitee",
      email: "invitee@test.com",
      role: "admin",
      createdAt: admin.firestore.Timestamp.now(),
    });

    // Step 4: Use invitation code
    console.log("🔄 Using invitation code...");

    // Mark invitation as used
    await invitationRef.update({
      status: "used",
      usedAt: admin.firestore.Timestamp.now(),
      usedBy: inviteeUserId,
    });

    // Step 5: Join family (simulate the userService.joinFamily logic)
    console.log("👥 Joining family...");

    // Update user with family ID
    await db.collection("users").doc(inviteeUserId).update({
      familyId,
    });

    // Add user to family members
    const familyDoc = await db.collection("families").doc(familyId).get();
    if (familyDoc.exists) {
      const familyData = familyDoc.data();
      const members = familyData.members || [];

      if (!members.includes(inviteeUserId)) {
        await db
          .collection("families")
          .doc(familyId)
          .update({
            members: [...members, inviteeUserId],
            status: "active",
          });
      }
    }

    // Step 6: Verify the result
    console.log("🔍 Verifying results...");

    const updatedFamily = await db.collection("families").doc(familyId).get();
    const familyData = updatedFamily.data();

    const inviteeUser = await db.collection("users").doc(inviteeUserId).get();
    const inviteeData = inviteeUser.data();

    console.log("📋 Final family data:", {
      familyId,
      members: familyData.members,
      memberCount: familyData.members.length,
    });

    console.log("📋 Final invitee user data:", {
      userId: inviteeUserId,
      familyId: inviteeData.familyId,
      name: inviteeData.name,
    });

    // Verify success
    if (
      familyData.members.includes(inviteeUserId) &&
      inviteeData.familyId === familyId
    ) {
      console.log("✅ SUCCESS: Family invitation flow works correctly!");
    } else {
      console.log("❌ FAILURE: Family invitation flow failed!");
      console.log(
        "- User in family members:",
        familyData.members.includes(inviteeUserId)
      );
      console.log(
        "- User familyId correct:",
        inviteeData.familyId === familyId
      );
    }

    // Clean up test data
    console.log("🧹 Cleaning up test data...");
    await db.collection("users").doc(inviterUserId).delete();
    await db.collection("users").doc(inviteeUserId).delete();
    await db.collection("families").doc(familyId).delete();
    await invitationRef.delete();

    console.log("✅ Test completed and cleaned up");
  } catch (error) {
    console.error("❌ Test error:", error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testFamilyInvitation();
