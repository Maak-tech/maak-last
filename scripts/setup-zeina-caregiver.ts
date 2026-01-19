import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { userService } from "../lib/services/userService";

async function setupZeinaAsCaregiver() {
  try {
    console.log("🔍 Looking for user named Zeina...");

    // Query for user with firstName "Zeina"
    const usersQuery = query(
      collection(db, "users"),
      where("firstName", ">=", "Zeina"),
      where("firstName", "<=", "Zeina\uf8ff")
    );

    const usersSnapshot = await getDocs(usersQuery);
    const zeinaUsers = usersSnapshot.docs.filter((doc) => {
      const data = doc.data();
      return data.firstName?.toLowerCase() === "zeina";
    });

    if (zeinaUsers.length === 0) {
      console.log("❌ No user named Zeina found in the system.");
      console.log("Please ensure Zeina is registered as a user first.");
      return;
    }

    if (zeinaUsers.length > 1) {
      console.log(
        "⚠️ Multiple users named Zeina found. Please specify which one:"
      );
      zeinaUsers.forEach((doc, index) => {
        const data = doc.data();
        console.log(
          `${index + 1}. ${data.firstName} ${data.lastName || ""} (${data.email})`
        );
      });
      return;
    }

    const zeinaDoc = zeinaUsers[0];
    const zeinaData = zeinaDoc.data();
    const zeinaId = zeinaDoc.id;

    console.log(
      `✅ Found Zeina: ${zeinaData.firstName} ${zeinaData.lastName || ""} (${zeinaData.email})`
    );

    // Check if she already has the caregiver role
    if (zeinaData.role === "caregiver") {
      console.log("ℹ️ Zeina is already set as a caregiver.");
      return;
    }

    // Check if she has a family
    if (!zeinaData.familyId) {
      console.log(
        "❌ Zeina is not part of a family. Please add her to a family first."
      );
      return;
    }

    console.log(`🔍 Checking family: ${zeinaData.familyId}`);

    // Find admin of the family
    const familyMembers = await userService.getFamilyMembers(
      zeinaData.familyId
    );
    const admin = familyMembers.find((member) => member.role === "admin");

    if (!admin) {
      console.log(
        "❌ No admin found in Zeina's family. Cannot assign caregiver role."
      );
      return;
    }

    console.log(
      `👑 Found admin: ${admin.firstName} ${admin.lastName || ""} (${admin.email})`
    );

    // Set Zeina as caregiver
    console.log("🔄 Setting Zeina as caregiver...");
    await userService.setUserAsCaregiver(zeinaId, admin.id);

    console.log("✅ SUCCESS!");
    console.log("Zeina now has access to:");
    console.log(
      "  • Full family medical information (symptoms, medications, moods)"
    );
    console.log("  • Family health reports and analytics");
    console.log(
      "  • Ability to send notifications to admins when something is off"
    );
    console.log("  • Caregiver dashboard functionality");
    console.log("");
    console.log("Admins can now:");
    console.log("  • View caregiver alerts in their dashboard");
    console.log(
      "  • Manage Zeina's caregiver role from family member profiles"
    );
    console.log("  • Receive notifications when Zeina sends alerts");
  } catch (error) {
    console.error("❌ Error setting up Zeina as caregiver:", error);
    process.exit(1);
  }
}

// Run the script
setupZeinaAsCaregiver()
  .then(() => {
    console.log("\n🎉 Setup complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
