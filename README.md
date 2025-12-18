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

### Development Workflow

**Option 1: Maintain Separate Development File (Recommended)**

1. **Create unobfuscated version**: Save readable code as `app.dev.js`
   - Use descriptive variable names (e.g., `firebaseConfig`, `db`, `auth`, `currentUser`)
   - Add comments and proper formatting
   - Keep Firebase config in plain object format

2. **During development**:
   - Edit `app.dev.js` with readable code
   - Update `index.html` temporarily to use `app.dev.js`:
     ```html
     <script src="app.dev.js"></script>
     ```
   - Test all functionality

3. **Before deployment**:
   - Manually obfuscate or use tools (see below)
   - Update `index.html` back to `app.js`
   - Test obfuscated version

**Option 2: Use Git Branches**

```bash
# Development branch - readable code
git checkout -b development
# Keep app.js readable with full variable names

# Production branch - obfuscated code
git checkout main
# Contains obfuscated app.js
```

### Obfuscation Methods

**Manual Obfuscation (Current Method)**
- Rename variables to short names (`_0x`, `_c`, `_db`, `_el`)
- Split Firebase config into string arrays
- Remove whitespace and comments
- Combine statements on single lines

**Automated Obfuscation Tools**

1. **JavaScript Obfuscator (Online)**: https://obfuscator.io/
   - Paste your readable code
   - Settings: String Array Encoding, Control Flow Flattening
   - Copy output to `app.js`

2. **JavaScript Obfuscator (CLI)**:
   ```bash
   npm install -g javascript-obfuscator
   javascript-obfuscator app.dev.js --output app.js \
     --compact true \
     --control-flow-flattening true \
     --string-array true
   ```

3. **Terser (Minification)**:
   ```bash
   npm install -g terser
   terser app.dev.js -o app.js --compress --mangle
   ```

### Unobfuscating for Development

**To work on existing obfuscated code:**

1. **Restore from backup**: If you have `app.dev.js`, use that
2. **Manual deobfuscation**: 
   - Expand variable names to meaningful ones
   - Add proper indentation and line breaks
   - Add comments explaining logic
   - Reconstruct Firebase config object
3. **Use version control**: Check out development branch with readable code

**Important**: Never edit `app.js` directly if it's obfuscated. Always maintain a readable version for development.