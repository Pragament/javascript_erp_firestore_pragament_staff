# Firestore Schema

This document describes the Firestore collections used by the staff/admin and timetable pages. Field names are based on the current application code.

## Project

- Firebase project ID: `edutrack-admin`
- Auth: Firebase Authentication with Google Sign-In

## Top-Level Collections

```text
schools/{schoolId}
teacherAssignments/{assignmentId}
students/{studentId}
timetables/{schoolId}/years/{academicYear}
```

## `schools/{schoolId}`

School master document.

| Field | Type | Notes |
| --- | --- | --- |
| `schoolName` | string | Display name used in school selectors. |
| `sections` | array<object> | School-level sections used for assignment permissions. |
| `updatedAt` | timestamp | Server timestamp when school-level sections are changed. |
| `updatedBy` | string | Email of user who last changed school-level sections. |

### `sections[]`

| Field | Type | Notes |
| --- | --- | --- |
| `sectionId` | string | Stable section identifier. |
| `sectionName` | string | Display name. Falls back to `sectionId` when missing. |

## `teacherAssignments/{assignmentId}`

Section-level access assignment for teachers/staff.

| Field | Type | Notes |
| --- | --- | --- |
| `teacherEmail` | string | User email. Used for access checks. |
| `sectionId` | string | Matches `schools/{schoolId}.sections[].sectionId`. |
| `sectionName` | string | Denormalized display name. |
| `role` | string | One of `admin`, `editor`, `viewer`. |
| `schoolId` | string | Parent school ID for the assigned section. |
| `assignedAt` | timestamp | Server timestamp on create. |
| `assignedBy` | string | Email of assigning user. |
| `updatedAt` | timestamp | Server timestamp on edit. |

Common queries:

```js
teacherAssignments
  .where('teacherEmail', '==', currentUser.email)
  .where('role', '==', 'admin')

teacherAssignments
  .orderBy('assignedAt', 'desc')
```

## `schools/{schoolId}/staff/{staffId}`

School-level staff membership and role data.

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | Lowercase staff email. |
| `role` | string \| null | Built-in role, such as `admin`, `editor`, or `viewer`; null when using a custom role. |
| `customRoleId` | string \| null | ID from `customRoles`. |
| `customRoleName` | string \| null | Denormalized custom role name. |
| `status` | string | Usually `active`. |
| `invitedBy` | string | Email of inviting user. |
| `invitedAt` | timestamp | Server timestamp on invite. |
| `updatedAt` | timestamp | Server timestamp on update. |
| `updatedBy` | string | Email of updating user. |

## `schools/{schoolId}/customRoles/{roleId}`

Custom school roles.

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Role name. |
| `description` | string | Role description. |
| `permissions` | array<string> | Permission keys selected in the role form. |
| `createdAt` | timestamp | Server timestamp on create. |
| `createdBy` | string | Email of creating user. |
| `updatedAt` | timestamp | Server timestamp on update. |

## `schools/{schoolId}/teachers/{teacherId}`

Teacher master data for a school.

| Field | Type | Notes |
| --- | --- | --- |
| `teacherCode` | string \| null | Uppercase teacher code. |
| `name` | string | Required. |
| `email` | string | Required, stored lowercase. |
| `phone` | string | Contact number. |
| `joinDate` | string | Date string from form input, usually `YYYY-MM-DD`. |
| `status` | string | `active` or `inactive`. |
| `notes` | string | Free text notes. |
| `createdAt` | timestamp | Server timestamp on create. |
| `updatedAt` | timestamp | Server timestamp on update. |
| `updatedBy` | string | Email of updating user. |

## `schools/{schoolId}/subjects/{subjectId}`

Subject master data for a school.

| Field | Type | Notes |
| --- | --- | --- |
| `code` | string | Required, uppercase subject code. |
| `name` | string | Required subject name. |
| `description` | string | Free text description. |
| `periodsPerWeek` | number | Defaults to `5`. |
| `status` | string | Usually `active` or `inactive`. |
| `createdAt` | timestamp | Server timestamp on create. |
| `updatedAt` | timestamp | Server timestamp on update. |
| `updatedBy` | string | Email of updating user. |

## `schools/{schoolId}/classSections/{classSectionId}`

Academic-year class section data.

| Field | Type | Notes |
| --- | --- | --- |
| `grade` | string | Required grade/class value. |
| `section` | string | Required uppercase section value. |
| `schoolSectionId` | string | Links to school-level `sections[].sectionId`. |
| `classTeacherEmail` | string | Teacher email for the class. |
| `roomNumber` | string | Room identifier. |
| `studentCount` | number | Defaults to `0`. |
| `academicYear` | string | Selected academic year. |
| `fullName` | string | Generated as `${grade}-${section}`. |
| `createdAt` | timestamp | Server timestamp on create. |
| `updatedAt` | timestamp | Server timestamp on update. |
| `updatedBy` | string | Email of updating user. |

## `students/{studentId}`

Student records are top-level documents keyed by generated or explicit ID.

| Field | Type | Notes |
| --- | --- | --- |
| `admissionNo` | string | Required. |
| `name` | string | Required, stored uppercase. |
| `rollNo` | number \| null | Numeric roll number or null. |
| `sectionId` | string | Required class section ID. |
| `phone` | string | Contact number. |
| `archived` | boolean | Archive flag. |
| `schoolId` | string | Selected school ID. |
| `createdAt` | timestamp | Server timestamp on create. |
| `createdBy` | string | Email of creating user. |
| `updatedAt` | timestamp | Server timestamp on update. |
| `updatedBy` | string | Email of updating user. |
| `archivedAt` | timestamp \| null | Set when archived. |
| `archivedBy` | string \| null | Email of archiving user. |
| `unarchivedAt` | timestamp \| null | Set when unarchived. |
| `unarchivedBy` | string \| null | Email of unarchiving user. |

Common query:

```js
students.where('schoolId', '==', selectedSchool)
```

## `schools/{schoolId}/teacherSubjectMappings/{mappingId}`

Teacher-to-subject-to-class assignments for an academic year.

| Field | Type | Notes |
| --- | --- | --- |
| `teacherEmail` | string | Required. |
| `teacherName` | string | Denormalized from teacher master. |
| `subjectCode` | string | Required. |
| `subjectName` | string | Denormalized from subject master. |
| `classSections` | array<string> | Selected class section IDs/names. |
| `academicYear` | string | Selected academic year. |
| `effectiveFrom` | string | Date string from form input. |
| `notes` | string | Free text notes. |
| `status` | string | `active` or `inactive`. Deletes are soft deletes. |
| `createdAt` | timestamp | Server timestamp on create. |
| `updatedAt` | timestamp | Server timestamp on update. |
| `updatedBy` | string | Email of updating user. |
| `endedAt` | timestamp | Set when marked inactive. |
| `endedBy` | string | Email of user marking inactive. |

## `schools/{schoolId}/teacherHistory/{historyId}`

Teacher change history.

| Field | Type | Notes |
| --- | --- | --- |
| `teacherId` | string | Teacher document ID when available. |
| `teacherName` | string | Teacher display name. |
| `teacherEmail` | string | Used for some auto-created history entries. |
| `type` | string | Examples: `joined`, `left`, `transferred_in`, `transferred_out`, `retired`. |
| `date` | string | Date string from form input. |
| `previousSchool` | string \| null | Used for transfers in. |
| `nextSchool` | string \| null | Used for transfers out. |
| `details` | string | Auto-created detail message. |
| `notes` | string | Free text notes. |
| `academicYear` | string | Selected academic year. |
| `recordedAt` | timestamp | Server timestamp on record. |
| `recordedBy` | string | Email of recording user. |

## `timetables/{schoolId}/years/{academicYear}`

Year-specific timetable document.

| Field | Type | Notes |
| --- | --- | --- |
| `timetableData` | object | Main timetable grid/state. |
| `holidays` | array<object> | Holiday definitions. |
| `periodTimes` | object | Period timing settings. |
| `teacherSubjectMap` | object | Teacher-subject lookup used by timetable page. |
| `currentYear` | string | Current year value from timetable state. |
| `schoolId` | string | School ID. |
| `academicYear` | string | Academic year document ID. |
| `updatedAt` | timestamp | Server timestamp on push/copy. |
| `updatedBy` | string | Email of pushing user. |

## Suggested Indexes

Firestore may prompt for these composite indexes when queries run:

| Collection | Fields |
| --- | --- |
| `teacherAssignments` | `teacherEmail ASC`, `role ASC` |
| `teacherAssignments` | `assignedAt DESC` |
| `schools/{schoolId}/teachers` | `name ASC` |
| `students` | `schoolId ASC` |

## Notes

- Timestamps listed as `timestamp` are written with `firebase.firestore.FieldValue.serverTimestamp()`.
- Several documents store denormalized names alongside IDs/emails for easier rendering.
- Student records are top-level documents and include `schoolId` for filtering.
- Class sections are stored below a school and include `academicYear`, so filtering by year is application-side unless an indexed query is added.
