# Family Sharing with Premium Features

## Overview

This document explains how family sharing and premium subscriptions work together in the Maak app.

## Current Implementation

### Family Sharing Flow

1. **Family Creation**: When a user signs up, they automatically get a family created for them
2. **Invitation System**: Family admins can generate 6-digit invitation codes to invite family members
3. **Joining Process**: Users can join a family by entering an invitation code
4. **Family Linking**: All family members share the same `familyId` in their user documents

### Premium Subscription Plans

- **Individual Plan**: 
  - 1 admin + 1 family member = 2 total members
  - Monthly or Yearly billing
  
- **Family Plan**:
  - 1 admin + 3 family members = 4 total members
  - Monthly or Yearly billing

## Premium Integration

### How Premium Features Work with Family Sharing

#### 1. **Premium Checks When Inviting Members**

When a family admin tries to invite a new member:

- **No Premium Subscription**: 
  - Can only have 1 member (the admin themselves)
  - If trying to invite, shows paywall modal
  
- **Individual Plan**:
  - Can have up to 2 total members (1 admin + 1 family member)
  - If limit reached, shows upgrade prompt
  
- **Family Plan**:
  - Can have up to 4 total members (1 admin + 3 family members)
  - If limit reached, shows message that limit is reached

#### 2. **Premium Checks When Joining a Family**

When a user tries to join a family using an invitation code:

- Checks if the target family has space available
- If family is full, shows appropriate error message
- The joining user's subscription doesn't affect their ability to join (the family admin's subscription determines limits)

#### 3. **Premium Feature Sharing**

**Important**: Premium features are shared across all family members. If the family admin has a premium subscription, all family members get access to premium features.

**How it works**:
- The app checks the family admin's subscription status
- All family members inherit premium access based on the admin's subscription
- This is checked via the `useSubscription` hook which reads from RevenueCat

### Code Implementation

#### Key Files

1. **`app/(tabs)/family.tsx`**:
   - Main family screen with invitation and joining logic
   - Premium checks before inviting/joining
   - Paywall modal integration

2. **`hooks/useSubscription.ts`**:
   - Hook that checks subscription status
   - Returns `isPremium`, `isFamilyPlan`, `maxTotalMembers`, etc.

3. **`lib/services/revenueCatService.ts`**:
   - RevenueCat integration
   - Subscription status checking
   - Plan limits definition

4. **`lib/services/userService.ts`**:
   - Family member management
   - `joinFamily()` - joins a user to a family
   - `getFamilyMembers()` - gets all members of a family

#### Premium Check Flow

```typescript
// When inviting a member
1. Check current family member count
2. Check user's subscription status (isPremium, maxTotalMembers)
3. If count >= maxTotalMembers:
   - Show paywall modal if no premium
   - Show upgrade prompt if individual plan
   - Show limit reached message if family plan
4. If within limits, proceed with invitation

// When joining a family
1. Validate invitation code
2. Check target family's current member count
3. Check family admin's subscription (ideally server-side)
4. If family is full, show error
5. If space available, proceed with join
```

## Future Enhancements

### Recommended Improvements

1. **Server-Side Subscription Checks**:
   - Currently subscription checks are client-side
   - Should add server-side validation in Cloud Functions
   - Prevents bypassing checks

2. **Family Admin Subscription Tracking**:
   - Store subscription status in Firestore for the family admin
   - Allows server-side validation of family limits
   - Better handling of subscription expiration

3. **Grace Period**:
   - When subscription expires, give grace period before removing access
   - Notify family members when subscription is about to expire

4. **Family Plan Sharing**:
   - Implement proper family sharing via App Store Family Sharing
   - Or use RevenueCat's family sharing features

5. **Member Removal on Limit**:
   - If subscription downgrades, automatically remove excess members
   - Notify affected members

## Testing Scenarios

### Test Cases

1. **Invite Member Without Premium**:
   - User with no subscription tries to invite
   - Should show paywall modal
   
2. **Invite Member with Individual Plan**:
   - User with individual plan invites second member (should work)
   - User with individual plan tries to invite third member (should show upgrade prompt)
   
3. **Join Family**:
   - User joins family with available space (should work)
   - User tries to join full family (should show error)
   
4. **Subscription Changes**:
   - Admin upgrades from Individual to Family plan
   - Admin downgrades from Family to Individual plan
   - Subscription expires

## RevenueCat Configuration

### Product Identifiers

- `Individual_Monthly_Premium`
- `Family_Monthly_Premium`
- `Individual_Yearly_Premium`
- `Family_Yearly_Premium`

### Entitlement Identifiers

- `Individual Plan`
- `Family Plan`

### Plan Limits

Defined in `lib/services/revenueCatService.ts`:

```typescript
PLAN_LIMITS = {
  INDIVIDUAL: {
    adminMembers: 1,
    familyMembers: 1,
    totalMembers: 2,
  },
  FAMILY: {
    adminMembers: 1,
    familyMembers: 3,
    totalMembers: 4,
  },
}
```

## Security Considerations

1. **Client-Side Checks**: Current implementation relies on client-side checks which can be bypassed
2. **Server-Side Validation**: Should implement Firestore security rules and Cloud Functions to enforce limits
3. **Subscription Verification**: Always verify subscription status server-side before allowing family operations

## User Experience

### Error Messages

- **No Premium**: "A premium subscription is required to add additional family members"
- **Limit Reached (Individual)**: "You've reached the maximum number of members for your plan (2 members). Upgrade to Family Plan to add more members."
- **Family Full**: "This family has reached the maximum number of members"

### Paywall Integration

- Paywall modal appears when:
  - User without premium tries to invite member
  - User with individual plan reaches limit and tries to invite more
- After successful purchase, family members list refreshes automatically

