# School Admin System - User Guide

## Overview
A web-based school administration system for managing teacher assignments, sections, and timetables with Firestore synchronization.

---

## 1. Getting Started

### 1.1 Login
1. Open the application in your browser
2. Click **"Sign in with Google"** on the login page
3. Select your Google account
4. You will be redirected to the main dashboard

### 1.2 Navigation
The navbar at the top provides access to all features:
- **School dropdown**: Select the school you want to work with
- **Year dropdown**: Select the academic year (2024-25, 2025-26, etc.)
- **Timetable button**: Navigate to timetable management
- **User email**: Shows logged-in user
- **Sign Out**: Log out of the application

---

## 2. Teacher Assignments (Main Dashboard)

### 2.1 Viewing Assignments
The dashboard displays a table of teacher assignments with the following information:
- Teacher Email
- Section (Class-Section name)
- Role (Admin, Editor, Viewer)
- Assigned By
- Assigned Date

**Sorting**: Click on table headers to sort by that column.

**Filtering**: Use the dropdown filters above the table to filter by:
- Section
- Teacher Email
- Role
- Assigned By

### 2.2 Assigning a Teacher to a Section
1. In the **"Assign Teacher to Section"** panel on the left:
2. Select a **Section** from the dropdown (only sections where you are admin will appear)
3. Enter the **Teacher Email**
4. Select the **Role**:
   - **Admin**: Full control over the section
   - **Editor**: Can modify timetables
   - **Viewer**: Read-only access
5. Click **"Assign Teacher"**

### 2.3 Editing an Assignment
1. Click the **pencil icon** next to an assignment in the table
2. Modify the email or role in the popup modal
3. Click **"Save Changes"**

### 2.4 Refreshing Data
Click the **"Refresh"** button to reload assignments from Firestore.

---

## 3. Timetable Management

### 3.1 Navigating to Timetable
1. Click the **"Timetable"** button in the navbar
2. Or navigate to `/timetable/index.html`

### 3.2 Selecting School and Year
Before managing timetables:
1. Select a **School** from the school dropdown
2. Select an **Academic Year** from the year dropdown
3. The sync status will show "Synced" if data exists, or "Local only" if working with local data

### 3.3 Uploading a Timetable

#### From Excel File
1. Click on the **"Upload Timetable"** tab
2. Click **"Upload Timetable (Excel)"** area or drag and drop an Excel file
3. The file should contain sheets named with class-section format (e.g., "1-A", "2-B")
4. After upload, you will be prompted to select the **Academic Year**
5. The timetable will be saved to localStorage and can be pushed to Firestore

#### From CSV File
1. Click on the **"Upload Timetable"** tab
2. Click **"Upload Timetable (CSV)"** option
3. Upload a CSV file with format: `Class-Section,Day,P1,P2,P3,...`
4. Set period times in the modal that appears
5. Select the **Academic Year** when prompted

### 3.4 Viewing Timetable
1. Click on the **"View Timetable"** tab
2. Select view type:
   - **Class View**: See timetable for a specific class
   - **Teacher View**: See schedule for a specific teacher
   - **Subject View**: See periods for a specific subject
3. Use filters to narrow down results
4. Click **"Apply Filter"** to view the timetable

### 3.5 Managing Holidays
1. Click on the **"Holidays"** tab
2. Click **"Add Holiday"** to create a new holiday
3. Fill in:
   - Holiday Name
   - Date
   - Type (Public/Optional)
   - Description (optional)
4. Click **"Save Holiday"**
5. Use **"Export Holidays"** to download as CSV

### 3.6 Checking Overlaps
1. In the **"View Timetable"** tab
2. Click **"Check Overlaps"** to detect scheduling conflicts
3. Review any overlaps found in the results table
4. Click **"Export Overlaps"** to download overlap report as CSV

### 3.7 Modifying Timetable
1. Click on the **"Modify Timetable"** sub-tab
2. Click **"Enable Reschedule Mode"**
3. Select two periods to swap by clicking on them
4. Review the swap information in the modal
5. Click **"Confirm Swap"** to execute the swap

---

## 4. Data Synchronization

### 4.1 Understanding Sync Status
The sync status indicator shows:
- **"Synced"** (green): Data is synchronized with Firestore
- **"Local only"** (yellow): Data exists only in localStorage
- **"Syncing"** (blue): Operation in progress
- **"Error"** (red): Synchronization failed

### 4.2 Pushing to Firestore
When you see **"Local only - Push to sync"**:
1. Make sure a **School** and **Academic Year** are selected
2. Click the **"Push"** button (green cloud upload icon)
3. The timetable will be saved to Firestore at:
   `timetables/{schoolId}/years/{academicYear}`
4. Success message will appear when complete

### 4.3 Loading from Firestore
When you select a school and year:
- If data exists in Firestore, it automatically loads and saves to localStorage
- If no data in Firestore but localStorage has data, it shows "Local only"
- If no data anywhere, you can upload a new timetable

---

## 5. Copying Timetable Between Years

### 5.1 Copy Year Feature
To duplicate a timetable from one academic year to another:

1. Select the **School** you want to work with
2. Click the **"Copy Year"** button in the navbar
3. In the modal:
   - **Source Year**: Select the year to copy from (defaults to current selection)
   - **Target Year**: Select the year to copy to
4. Click **"Copy Timetable"**
5. The system will:
   - Copy timetable data, holidays, period times, and teacher mappings
   - Save to the target year in Firestore
   - Automatically switch to the new year
   - Load the copied data

**Note**: This will overwrite any existing data in the target year.

---

## 6. Data Storage Structure

### 6.1 Firestore Collections
```
schools/
  └── {schoolId}/
      └── schoolName: string

teacherAssignments/
  └── {assignmentId}/
      ├── teacherEmail: string
      ├── sectionId: string
      ├── role: string (admin/editor/viewer)
      ├── assignedBy: string
      └── assignedAt: timestamp

timetables/
  └── {schoolId}/
      └── years/
          └── {academicYear}/
              ├── timetableData: object
              ├── holidays: array
              ├── periodTimes: object
              ├── teacherSubjectMap: object
              ├── updatedAt: timestamp
              └── updatedBy: string
```

### 6.2 LocalStorage Keys
- `selectedSchool`: Currently selected school ID
- `selectedAcademicYear`: Currently selected academic year
- `schoolTimetable`: Timetable data (JSON)
- `schoolHolidays`: Holidays array (JSON)
- `periodTimes`: Period time settings (JSON)
- `teacherSubjectMap`: Teacher-subject mappings (JSON)
- `timetableAcademicYear`: Academic year of local timetable

---

## 7. Troubleshooting

### 7.1 Cannot See Sections
- Ensure you have been assigned as **Admin** to at least one section
- Check that sections exist in the Firestore `schools/{schoolId}/sections` collection

### 7.2 Upload Fails
- Verify Excel/CSV file format matches expected structure
- Check browser console for error messages
- Ensure file is not corrupted

### 7.3 Push to Firestore Fails
- Verify you are signed in
- Ensure both School and Academic Year are selected
- Check internet connection
- Verify you have write permissions

### 7.4 Data Not Loading
- Check Firestore security rules allow reads
- Verify school ID and year selection
- Try refreshing the page

---

## 8. Keyboard Shortcuts

- **Tab Navigation**: Use tabs to switch between sections
- **Modal Close**: Press Escape to close modals
- **Form Submit**: Press Enter in forms to submit

---

## 9. Best Practices

1. **Always select school and year** before working with timetables
2. **Push to Firestore regularly** to backup your local changes
3. **Export holidays and overlaps** before making major changes
4. **Use the Copy Year feature** as a template for new academic years
5. **Check overlaps** after uploading new timetables

---

## 10. Support

For technical issues or feature requests, contact the system administrator.
