#!/usr/bin/env tsx

import { addDoc, collection, Timestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

async function testCalendarAdd() {
  try {
    console.log("Testing calendar event addition...");

    // Check if user is authenticated
    const currentUser = auth.currentUser;
    console.log("Current user:", currentUser?.uid);

    if (!currentUser) {
      console.log(
        "❌ No user authenticated. Cannot test calendar functionality."
      );
      return;
    }

    // Create a simple test event
    const eventData = {
      userId: currentUser.uid, // Use the actual authenticated user ID
      title: "Test Calendar Event",
      type: "appointment",
      startDate: Timestamp.fromDate(new Date()),
      allDay: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      color: "#10B981",
    };

    console.log("Adding event:", eventData);

    const docRef = await addDoc(collection(db, "calendarEvents"), eventData);

    console.log("✅ Event added successfully with ID:", docRef.id);
  } catch (error) {
    console.error("❌ Error adding calendar event:", error);
    console.error("Error details:", error.message);
  }
}

testCalendarAdd();
