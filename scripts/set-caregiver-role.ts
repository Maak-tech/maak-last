import type { User } from "../types";
import { userService } from "../lib/services/userService";

const getAllUsers = async (): Promise<User[]> => {
  const { collection, getDocs } = await import("firebase/firestore");
  const { db } = await import("../lib/firebase");

  const querySnapshot = await getDocs(collection(db, "users"));
  const users: User[] = [];

  querySnapshot.forEach((doc) => {
    const data = doc.data() as Omit<User, "id">;
    const createdAtRaw = (data as { createdAt?: any }).createdAt;
    users.push({
      id: doc.id,
      ...data,
      createdAt:
        createdAtRaw && typeof createdAtRaw.toDate === "function"
          ? createdAtRaw.toDate()
          : (createdAtRaw as Date) || new Date(),
    });
  });

  return users;
};

async function setZeinaAsCaregiver() {
  try {
    // Find user with firstName "Zeina"
    const users = await getAllUsers();
    const zeina = users.find(
      (user) => user.firstName?.toLowerCase() === "zeina"
    );

    if (!zeina) {
      console.log(
        "Zeina not found. Please ensure Zeina is registered in the system."
      );
      return;
    }

    if (!zeina.familyId) {
      console.log(
        "Zeina is not part of a family. Please add her to a family first."
      );
      return;
    }

    // Find admin of the family
    const familyMembers = await userService.getFamilyMembers(zeina.familyId);
    const admin = familyMembers.find((member) => member.role === "admin");

    if (!admin) {
      console.log(
        "No admin found in Zeina's family. Cannot assign caregiver role."
      );
      return;
    }

    // Set Zeina as caregiver (admin can do this)
    await userService.setUserAsCaregiver(zeina.id, admin.id);

    console.log(
      `✅ Zeina has been successfully set as a caregiver for family: ${zeina.familyId}`
    );
    console.log("She now has access to:");
    console.log(
      "- Full family medical information (symptoms, medications, moods)"
    );
    console.log("- Family health reports and analytics");
    console.log("- Ability to send notifications to admins");
    console.log("- Caregiver dashboard functionality");
  } catch (error) {
    console.error("❌ Error setting Zeina as caregiver:", error);
    process.exit(1);
  }
}

// Run the script
setZeinaAsCaregiver()
  .then(() => {
    console.log("Script completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
