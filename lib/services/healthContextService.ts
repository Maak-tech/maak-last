import { auth, db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

export interface HealthContext {
  profile: {
    name: string;
    age: number;
    gender: string;
    bloodType: string;
    height: string;
    weight: string;
    emergencyContact: string;
    phone?: string;
    email?: string;
  };
  medicalHistory: {
    conditions: Array<{
      condition: string;
      diagnosedDate?: string;
      status?: string;
      notes?: string;
    }>;
    allergies: string[];
    surgeries: string[];
    familyHistory: Array<{
      condition: string;
      relationship?: string;
      notes?: string;
    }>;
  };
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    notes?: string;
    isActive: boolean;
    reminders?: string[];
  }>;
  symptoms: Array<{
    name: string;
    severity: string;
    date: string;
    bodyPart?: string;
    duration?: string;
    notes?: string;
  }>;
  familyMembers: Array<{
    id: string;
    name: string;
    relationship: string;
    age?: number;
    conditions?: string[];
    email?: string;
    phone?: string;
    healthStatus?: string;
  }>;
  recentAlerts: Array<{
    type: string;
    timestamp: Date;
    details: string;
    severity?: string;
  }>;
  vitalSigns: {
    heartRate?: number;
    bloodPressure?: string;
    temperature?: number;
    oxygenLevel?: number;
    glucoseLevel?: number;
    weight?: number;
    lastUpdated?: Date;
  };
}

class HealthContextService {
  async getUserHealthContext(userId?: string): Promise<HealthContext> {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) {
      throw new Error('No user ID provided');
    }

    console.log('Fetching comprehensive health context for user:', uid);

    try {
      // Fetch user profile
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.data() || {};
      console.log('User data found:', {
        hasName: !!userData.name,
        hasFamilyId: !!userData.familyId,
        familyId: userData.familyId
      });

      // Fetch ALL medications (both active and inactive for context)
      let medications = [];
      try {
        const medicationsQuery = query(
          collection(db, 'medications'),
          where('userId', '==', uid),
          orderBy('startDate', 'desc')
        );
        const medicationsSnapshot = await getDocs(medicationsQuery);
        medications = medicationsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unknown medication',
            dosage: data.dosage || '',
            frequency: data.frequency || '',
            startDate: data.startDate?.toDate?.()?.toLocaleDateString() || '',
            endDate: data.endDate?.toDate?.()?.toLocaleDateString() || '',
            notes: data.notes || '',
            isActive: data.isActive !== false, // Default to true if not specified
            reminders: data.reminders || [],
          };
        });
        console.log(`Found ${medications.length} medications`);
      } catch (error) {
        console.log('Error fetching medications:', error);
      }

      // Fetch ALL symptoms (extended time range)
      let symptoms = [];
      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const symptomsQuery = query(
          collection(db, 'symptoms'),
          where('userId', '==', uid),
          where('timestamp', '>=', ninetyDaysAgo),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const symptomsSnapshot = await getDocs(symptomsQuery);
        symptoms = symptomsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.symptom || 'Unknown symptom',
            severity: data.severity || 'moderate',
            date: data.timestamp?.toDate?.()?.toLocaleDateString() || data.date || '',
            bodyPart: data.bodyPart || data.location || '',
            duration: data.duration || '',
            notes: data.notes || data.description || '',
          };
        });
        console.log(`Found ${symptoms.length} symptoms`);
      } catch (error) {
        console.log('Error fetching symptoms:', error);
      }

      // Fetch medical history
      let medicalHistoryData = [];
      let familyMedicalHistory = [];
      try {
        const historyQuery = query(
          collection(db, 'medicalHistory'),
          where('userId', '==', uid),
          orderBy('diagnosedDate', 'desc')
        );
        const historySnapshot = await getDocs(historyQuery);
        
        historySnapshot.docs.forEach(doc => {
          const data = doc.data();
          const entry = {
            condition: data.condition || data.name || '',
            diagnosedDate: data.diagnosedDate?.toDate?.()?.toLocaleDateString() || '',
            status: data.status || 'ongoing',
            notes: data.notes || '',
            relationship: data.relationship || '',
          };
          
          if (data.isFamily) {
            familyMedicalHistory.push(entry);
          } else {
            medicalHistoryData.push(entry);
          }
        });
        console.log(`Found ${medicalHistoryData.length} medical history entries and ${familyMedicalHistory.length} family history entries`);
      } catch (error) {
        console.log('Error fetching medical history:', error);
      }

      // Fetch family members
      let familyMembers = [];
      try {
        if (userData.familyId) {
          const familyQuery = query(
            collection(db, 'users'),
            where('familyId', '==', userData.familyId)
          );
          const familySnapshot = await getDocs(familyQuery);
          
          for (const familyDoc of familySnapshot.docs) {
            if (familyDoc.id !== uid) {
              const memberData = familyDoc.data();
              
              // Fetch recent symptoms for family member
              let memberSymptoms = [];
              try {
                const memberSymptomsQuery = query(
                  collection(db, 'symptoms'),
                  where('userId', '==', familyDoc.id),
                  orderBy('timestamp', 'desc'),
                  limit(5)
                );
                const memberSymptomsSnapshot = await getDocs(memberSymptomsQuery);
                memberSymptoms = memberSymptomsSnapshot.docs.map(doc => doc.data().name || doc.data().symptom);
              } catch (e) {
                // Silently fail for family member symptoms
              }
              
              familyMembers.push({
                id: familyDoc.id,
                name: memberData.name || memberData.displayName || 'Family Member',
                relationship: memberData.relationship || memberData.relation || memberData.role || 'Family Member',
                age: memberData.age,
                conditions: memberData.conditions || [],
                email: memberData.email,
                phone: memberData.phone || memberData.emergencyPhone,
                healthStatus: memberSymptoms.length > 0 ? 'Has recent symptoms' : 'Good',
                recentSymptoms: memberSymptoms,
              });
            }
          }
        }
        console.log(`Found ${familyMembers.length} family members`);
      } catch (error) {
        console.log('Error fetching family members:', error);
      }

      // Fetch recent alerts
      let recentAlerts = [];
      try {
        const alertsQuery = query(
          collection(db, 'alerts'),
          where('userId', '==', uid),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        const alertsSnapshot = await getDocs(alertsQuery);
        recentAlerts = alertsSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            type: data.type || 'general',
            timestamp: data.timestamp?.toDate() || new Date(),
            details: data.message || data.details || '',
            severity: data.severity || 'info',
          };
        });
        console.log(`Found ${recentAlerts.length} alerts`);
      } catch (error) {
        console.log('Error fetching alerts:', error);
      }

      // Construct comprehensive health context
      const healthContext: HealthContext = {
        profile: {
          name: userData.displayName || userData.name || 'User',
          age: userData.age || 0,
          gender: userData.gender || 'Not specified',
          bloodType: userData.bloodType || 'Unknown',
          height: userData.height || 'Not specified',
          weight: userData.weight || 'Not specified',
          emergencyContact: userData.emergencyContact || userData.emergencyPhone || 'Not set',
          phone: userData.phone,
          email: userData.email || auth.currentUser?.email || '',
        },
        medicalHistory: {
          conditions: medicalHistoryData,
          allergies: userData.allergies || [],
          surgeries: userData.surgeries || [],
          familyHistory: familyMedicalHistory,
        },
        medications: medications,
        symptoms: symptoms,
        familyMembers: familyMembers,
        recentAlerts: recentAlerts,
        vitalSigns: {
          heartRate: userData.lastHeartRate,
          bloodPressure: userData.lastBloodPressure,
          temperature: userData.lastTemperature,
          oxygenLevel: userData.lastOxygenLevel,
          glucoseLevel: userData.lastGlucoseLevel,
          weight: userData.lastWeight,
          lastUpdated: userData.vitalsLastUpdated?.toDate(),
        },
      };

      console.log('Health context built successfully:', {
        profileComplete: !!healthContext.profile.name,
        medicationsCount: medications.length,
        activeMedications: medications.filter(m => m.isActive).length,
        symptomsCount: symptoms.length,
        conditionsCount: medicalHistoryData.length,
        familyHistoryCount: familyMedicalHistory.length,
        familyMembersCount: familyMembers.length,
        alertsCount: recentAlerts.length,
      });

      return healthContext;
    } catch (error) {
      console.error('Error fetching health context:', error);
      throw error;
    }
  }

  generateSystemPrompt(context: HealthContext): string {
    const activeMedications = context.medications.filter(m => m.isActive);
    const inactiveMedications = context.medications.filter(m => !m.isActive);
    
    const prompt = `You are a helpful AI health assistant with access to the user's comprehensive health profile. 
    
PATIENT PROFILE:
- Name: ${context.profile.name}
- Age: ${context.profile.age > 0 ? `${context.profile.age} years old` : 'Not specified'}
- Gender: ${context.profile.gender}
- Blood Type: ${context.profile.bloodType}
- Height: ${context.profile.height}
- Weight: ${context.profile.weight}
- Emergency Contact: ${context.profile.emergencyContact}

MEDICAL HISTORY:
Current Conditions: ${context.medicalHistory.conditions.length > 0 ? 
  context.medicalHistory.conditions.map(c => 
    `\n  • ${c.condition}${c.diagnosedDate ? ` (diagnosed: ${c.diagnosedDate})` : ''}${c.status ? ` - ${c.status}` : ''}${c.notes ? ` - ${c.notes}` : ''}`
  ).join('') : '\n  • No chronic conditions reported'}

Allergies: ${context.medicalHistory.allergies.length > 0 ? 
  context.medicalHistory.allergies.map(a => `\n  • ${a}`).join('') : '\n  • No known allergies'}

Previous Surgeries: ${context.medicalHistory.surgeries.length > 0 ? 
  context.medicalHistory.surgeries.map(s => `\n  • ${s}`).join('') : '\n  • No previous surgeries'}

Family Medical History: ${context.medicalHistory.familyHistory.length > 0 ?
  context.medicalHistory.familyHistory.map(f => 
    `\n  • ${f.condition}${f.relationship ? ` (${f.relationship})` : ''}`
  ).join('') : '\n  • No family history recorded'}

CURRENT MEDICATIONS:
${activeMedications.length > 0 ? activeMedications.map(med => 
  `• ${med.name}: ${med.dosage}, ${med.frequency}
  Started: ${med.startDate}${med.endDate ? `, Ends: ${med.endDate}` : ' (ongoing)'}
  ${med.reminders.length > 0 ? `Reminders: ${med.reminders.join(', ')}` : ''}
  ${med.notes ? `Notes: ${med.notes}` : ''}`
).join('\n') : '• No current medications'}

${inactiveMedications.length > 0 ? `\nPAST MEDICATIONS:\n${inactiveMedications.slice(0, 5).map(med => 
  `• ${med.name}: ${med.dosage} (discontinued)`
).join('\n')}` : ''}

RECENT SYMPTOMS (Last 90 days):
${context.symptoms.length > 0 ? context.symptoms.slice(0, 10).map(symptom => 
  `• ${symptom.date}: ${symptom.name} (Severity: ${symptom.severity})
  ${symptom.bodyPart ? `Location: ${symptom.bodyPart}` : ''}
  ${symptom.duration ? `Duration: ${symptom.duration}` : ''}
  ${symptom.notes ? `Notes: ${symptom.notes}` : ''}`
).join('\n') : '• No recent symptoms reported'}

FAMILY MEMBERS:
${context.familyMembers.length > 0 ? context.familyMembers.map(member => 
  `• ${member.name} (${member.relationship}${member.age ? `, ${member.age} years old` : ''})
  ${member.conditions && member.conditions.length > 0 ? `Conditions: ${member.conditions.join(', ')}` : ''}
  ${member.healthStatus ? `Status: ${member.healthStatus}` : ''}`
).join('\n') : '• No family members connected yet. Family members can be added through the Family tab.'}

${context.recentAlerts.length > 0 ? `\nRECENT HEALTH ALERTS:\n${context.recentAlerts.slice(0, 5).map(alert => 
  `• ${alert.timestamp.toLocaleDateString()}: ${alert.type} - ${alert.details}`
).join('\n')}` : ''}

${context.vitalSigns.lastUpdated ? `
RECENT VITAL SIGNS (${context.vitalSigns.lastUpdated.toLocaleDateString()}):
• Heart Rate: ${context.vitalSigns.heartRate || 'Not recorded'} bpm
• Blood Pressure: ${context.vitalSigns.bloodPressure || 'Not recorded'}
• Temperature: ${context.vitalSigns.temperature || 'Not recorded'}°F
• Oxygen Level: ${context.vitalSigns.oxygenLevel || 'Not recorded'}%
${context.vitalSigns.glucoseLevel ? `• Glucose: ${context.vitalSigns.glucoseLevel} mg/dL` : ''}
${context.vitalSigns.weight ? `• Weight: ${context.vitalSigns.weight}` : ''}
` : ''}

INSTRUCTIONS FOR YOUR RESPONSES:
1. Provide personalized health insights based on the complete medical profile
2. Consider all medications when discussing drug interactions or new treatments
3. Be aware of all allergies and conditions when giving advice
4. Reference recent symptoms to identify patterns or concerns
5. Consider family medical history for hereditary condition risks
6. Always remind users to consult healthcare professionals for medical decisions
7. Be empathetic and supportive while being informative
8. Provide practical, actionable advice when appropriate
9. If you notice concerning patterns in symptoms or vital signs, gently suggest medical consultation

Remember: You are an AI assistant providing information and support, not a replacement for professional medical advice. Always encourage users to seek professional medical help for serious concerns.`;

    return prompt;
  }

  async getContextualPrompt(userId?: string): Promise<string> {
    const context = await this.getUserHealthContext(userId);
    return this.generateSystemPrompt(context);
  }
}

export default new HealthContextService();