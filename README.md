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
The JavaScript code is minified and obfuscated to prevent easy reverse-engineering.