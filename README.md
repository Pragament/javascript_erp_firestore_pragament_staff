# School Admin Portal

## Overview
Web application for school administrators to assign teachers to sections.

## Features
- Google Sign-In authentication
- View all sections from Firestore (populated by Python Flask app)
- Assign teachers to sections using their Google email
- View all teacher assignments
- Edit teacher email for a section
- Remove teacher assignments

## Setup
1. Open `index.html` in a web browser
2. Sign in with Google
3. Select a section and enter teacher's email
4. Click "Assign Teacher"

## Firebase Collections Used
- `schools` - Contains school data with sections array
- `teacherAssignments` - Stores teacher-section mappings

## Data Structure
```javascript
// teacherAssignments collection
{
  sectionId: "section123",
  sectionName: "Class 10-A",
  teacherEmail: "teacher@school.com",
  schoolId: "school456",
  assignedAt: timestamp,
  assignedBy: "admin@school.com"
}
```

## Code Obfuscation

### Current State
The `app.js` file is currently **manually obfuscated** using:
- Shortened variable names (`_0x`, `_c`, `_d`, `_a`, `_u`, `_e`, etc.)
- String array obfuscation for Firebase configuration
- Minified single-line functions
- Compact code structure

### Unobfuscated Symbol (Development Reference)

**app.js symbols:**
- `_0x` → `firebaseConfigParts` - String array containing Firebase config parts
- `_c` → `firebaseConfig` - Firebase configuration object
- `_d` → `db` or `firestore` - Firestore database instance
- `_a` → `auth` - Firebase authentication instance
- `_u` → `currentUser` - Current authenticated user object
- `_e` → `elements` - DOM elements object (auth, main, signin, signout, email, sections, assignments, etc.)
- `_i()` → `initializeApp()` - Initialize app (load sections and assignments)
- `_ls()` → `loadSections()` - Load sections from Firestore
- `_la()` → `loadAssignments()` - Load teacher assignments from Firestore
- `_as()` → `assignTeacher()` - Assign teacher to section
- `_ea(id, email)` → `editAssignment(assignmentId, currentEmail)` - Edit assignment
- `_da(id)` → `deleteAssignment(assignmentId)` - Delete assignment

