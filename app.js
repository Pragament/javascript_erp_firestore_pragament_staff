// Firebase Configuration
const firebaseConfigParts = [
    'edutrack-admin',
    'firebaseapp',
    'AIzaSyAFpwi3k7Qth9MiqqRGKstY0Zkj_vrcdFY',
    '193864081571',
    '1:193864081571:web:7501afde01291f81e61f16',
    'com',
    'storage',
    'app'
];

const firebaseConfig = {
    apiKey: firebaseConfigParts[2],
    authDomain: firebaseConfigParts[0] + '.' + firebaseConfigParts[1] + '.' + firebaseConfigParts[5],
    projectId: firebaseConfigParts[0],
    storageBucket: firebaseConfigParts[0] + '.' + firebaseConfigParts[1] + firebaseConfigParts[6] + '.' + firebaseConfigParts[7],
    messagingSenderId: firebaseConfigParts[3],
    appId: firebaseConfigParts[4]
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Firebase services
const firestore = firebase.firestore();
const auth = firebase.auth();

// Global variables
let currentUser = null;
let currentSchoolId = null;
let editModal = null;
let allAssignments = []; // Store all assignments for filtering/sorting
let currentSort = { field: 'assignedAt', direction: 'desc' };

// DOM elements
const elements = {
    authScreen: document.getElementById('auth-screen'),
    mainApp: document.getElementById('main-app'),
    googleSignin: document.getElementById('google-signin'),
    signoutBtn: document.getElementById('signout-btn'),
    userEmail: document.getElementById('user-email'),
    sectionSelect: document.getElementById('section-select'),
    teacherEmail: document.getElementById('teacher-email'),
    teacherRole: document.getElementById('teacher-role'),
    assignBtn: document.getElementById('assign-btn'),
    refreshBtn: document.getElementById('refresh-btn'),
    assignmentsTable: document.getElementById('assignments-table'),
    editModalEl: document.getElementById('editModal'),
    editAssignmentId: document.getElementById('edit-assignment-id'),
    editTeacherEmail: document.getElementById('edit-teacher-email'),
    editTeacherRole: document.getElementById('edit-teacher-role'),
    saveEditBtn: document.getElementById('save-edit-btn'),
    filterSection: document.getElementById('filter-section'),
    filterTeacher: document.getElementById('filter-teacher'),
    filterRole: document.getElementById('filter-role'),
    filterAssignedBy: document.getElementById('filter-assignedby'),
    clearFilters: document.getElementById('clear-filters'),
    navSchoolSelect: document.getElementById('nav-school-select')
};

// Authentication state listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        elements.authScreen.classList.add('d-none');
        elements.mainApp.classList.remove('d-none');
        elements.userEmail.textContent = user.email;
        await initializeApp();
    } else {
        currentUser = null;
        elements.mainApp.classList.add('d-none');
        elements.authScreen.classList.remove('d-none');
    }
});

// Google Sign-In
elements.googleSignin.onclick = async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
    } catch (error) {
        alert('Sign in failed: ' + error.message);
    }
};

// Sign out
elements.signoutBtn.onclick = () => auth.signOut();

// Initialize app after authentication
async function initializeApp() {
    editModal = new bootstrap.Modal(elements.editModalEl);
    await loadNavSchools();
    await loadSections();
    await loadAssignments();
}

// Load schools for navbar dropdown
async function loadNavSchools() {
    try {
        const snapshot = await firestore.collection('schools').get();
        const select = elements.navSchoolSelect;
        
        let optionsHtml = '<option value="">Select School</option>';
        snapshot.docs.forEach(doc => {
            const schoolData = doc.data();
            const schoolName = schoolData.schoolName || doc.id;
            optionsHtml += `<option value="${doc.id}">${schoolName}</option>`;
        });
        
        select.innerHTML = optionsHtml;
        
        // Restore selected school from localStorage
        const savedSchool = localStorage.getItem('selectedSchool');
        if (savedSchool) {
            select.value = savedSchool;
        }
        
        // Save selection on change
        select.addEventListener('change', function() {
            localStorage.setItem('selectedSchool', this.value);
        });
    } catch (error) {
        console.error('Load schools for nav:', error);
    }
}

// Load sections from Firestore (filtered by admin role)
async function loadSections() {
    try {
        // Get current user's admin assignments
        const assignmentsSnapshot = await firestore.collection('teacherAssignments')
            .where('teacherEmail', '==', currentUser.email)
            .where('role', '==', 'admin')
            .get();

        const adminSectionIds = new Set();
        assignmentsSnapshot.docs.forEach(doc => {
            adminSectionIds.add(doc.data().sectionId);
        });

        if (adminSectionIds.size === 0) {
            elements.sectionSelect.innerHTML = '<option value="">No admin sections found</option>';
            return;
        }

        // Load schools and filter sections
        const snapshot = await firestore.collection('schools').get();
        
        if (snapshot.empty) {
            elements.sectionSelect.innerHTML = '<option value="">No schools found</option>';
            return;
        }

        let optionsHtml = '<option value="">Select a section</option>';
        let hasSections = false;
        
        for (const doc of snapshot.docs) {
            const schoolData = doc.data();
            currentSchoolId = doc.id;
            const sections = schoolData.sections || [];
            
            sections.forEach(section => {
                if (adminSectionIds.has(section.sectionId)) {
                    optionsHtml += `<option value="${section.sectionId}" data-name="${section.sectionName || section.sectionId}">${section.sectionName || section.sectionId} (${section.sectionId})</option>`;
                    hasSections = true;
                }
            });
        }
        
        elements.sectionSelect.innerHTML = hasSections ? optionsHtml : '<option value="">No admin sections found</option>';
    } catch (error) {
        console.error('Load sections:', error);
        elements.sectionSelect.innerHTML = '<option value="">Error loading</option>';
    }
}

// Load teacher assignments from Firestore (filtered by admin sections)
async function loadAssignments() {
    try {
        // Get current user's admin section IDs
        const adminSnapshot = await firestore.collection('teacherAssignments')
            .where('teacherEmail', '==', currentUser.email)
            .where('role', '==', 'admin')
            .get();

        const adminSectionIds = new Set();
        adminSnapshot.docs.forEach(doc => {
            adminSectionIds.add(doc.data().sectionId);
        });

        if (adminSectionIds.size === 0) {
            elements.assignmentsTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No admin sections found</td></tr>';
            return;
        }

        // Load all assignments and filter by admin sections
        const snapshot = await firestore.collection('teacherAssignments')
            .orderBy('assignedAt', 'desc')
            .get();
        
        // Store assignments for filtering/sorting
        allAssignments = [];
        const sectionsMap = new Map(); // sectionId -> sectionName
        const teachersSet = new Set();
        const assignedBySet = new Set();

        snapshot.docs.forEach(doc => {
            const assignment = doc.data();
            if (adminSectionIds.has(assignment.sectionId)) {
                allAssignments.push({ id: doc.id, ...assignment });
                sectionsMap.set(assignment.sectionId, assignment.sectionName || assignment.sectionId);
                teachersSet.add(assignment.teacherEmail);
                assignedBySet.add(assignment.assignedBy || 'N/A');
            }
        });

        // Populate filter dropdowns
        populateFilterDropdowns(sectionsMap, teachersSet, assignedBySet);
        
        // Render with current filters and sort
        renderAssignments();
    } catch (error) {
        console.error('Load assignments:', error);
        elements.assignmentsTable.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error loading</td></tr>';
    }
}

// Populate filter dropdowns
function populateFilterDropdowns(sectionsMap, teachers, assignedBy) {
    const sectionSelect = elements.filterSection;
    const teacherSelect = elements.filterTeacher;
    const assignedBySelect = elements.filterAssignedBy;
    
    // Save current selections
    const currentSection = sectionSelect.value;
    const currentTeacher = teacherSelect.value;
    const currentAssignedBy = assignedBySelect.value;
    
    // Reset and rebuild
    sectionSelect.innerHTML = '<option value="">All Sections</option>';
    teacherSelect.innerHTML = '<option value="">All Teachers</option>';
    assignedBySelect.innerHTML = '<option value="">All Assigned By</option>';
    
    // Sort by section name for display
    Array.from(sectionsMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .forEach(([sectionId, sectionName]) => {
            sectionSelect.innerHTML += `<option value="${sectionId}">${sectionName}</option>`;
        });
    
    Array.from(teachers).sort().forEach(teacher => {
        teacherSelect.innerHTML += `<option value="${teacher}">${teacher}</option>`;
    });
    
    Array.from(assignedBy).sort().forEach(by => {
        assignedBySelect.innerHTML += `<option value="${by}">${by}</option>`;
    });
    
    // Restore selections if still valid
    if (sectionsMap.has(currentSection)) sectionSelect.value = currentSection;
    if (teachers.has(currentTeacher)) teacherSelect.value = currentTeacher;
    if (assignedBy.has(currentAssignedBy)) assignedBySelect.value = currentAssignedBy;
}

// Filter and sort assignments
function getFilteredAndSortedAssignments() {
    const sectionFilter = elements.filterSection.value;
    const teacherFilter = elements.filterTeacher.value;
    const roleFilter = elements.filterRole.value;
    const assignedByFilter = elements.filterAssignedBy.value;
    
    let filtered = allAssignments.filter(a => {
        if (sectionFilter && a.sectionId !== sectionFilter) return false;
        if (teacherFilter && a.teacherEmail !== teacherFilter) return false;
        if (roleFilter && (a.role || 'viewer') !== roleFilter) return false;
        if (assignedByFilter && (a.assignedBy || 'N/A') !== assignedByFilter) return false;
        return true;
    });
    
    // Sort
    filtered.sort((a, b) => {
        let aVal = a[currentSort.field] || '';
        let bVal = b[currentSort.field] || '';
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    return filtered;
}

// Render assignments table
function renderAssignments() {
    const assignments = getFilteredAndSortedAssignments();
    
    if (assignments.length === 0) {
        elements.assignmentsTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No assignments match the filters</td></tr>';
        return;
    }
    
    let tableHtml = '';
    assignments.forEach(assignment => {
        tableHtml += `<tr><td>${assignment.sectionName || 'N/A'}</td><td><code class="small">${assignment.sectionId}</code></td><td>${assignment.teacherEmail}</td><td><span class="badge bg-${assignment.role === 'admin' ? 'danger' : assignment.role === 'editor' ? 'warning' : 'info'}">${assignment.role || 'viewer'}</span></td><td class="small text-muted">${assignment.assignedBy || 'N/A'}</td><td class="text-center"><button class="btn btn-sm btn-warning btn-sm-action me-1" onclick="editAssignment('${assignment.id}','${assignment.teacherEmail}','${assignment.role || 'viewer'}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger btn-sm-action" onclick="deleteAssignment('${assignment.id}')"><i class="bi bi-trash"></i></button></td></tr>`;
    });
    
    elements.assignmentsTable.innerHTML = tableHtml;
}

// Sort header click handler
document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const field = th.dataset.sort;
        if (currentSort.field === field) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            currentSort.field = field;
            currentSort.direction = 'asc';
        }
        renderAssignments();
    });
});

// Filter change handlers
[elements.filterSection, elements.filterTeacher, elements.filterRole, elements.filterAssignedBy].forEach(el => {
    el.addEventListener('change', renderAssignments);
});

// Clear filters
elements.clearFilters.onclick = () => {
    elements.filterSection.value = '';
    elements.filterTeacher.value = '';
    elements.filterRole.value = '';
    elements.filterAssignedBy.value = '';
    renderAssignments();
};

// Assign teacher to section
elements.assignBtn.onclick = async () => {
    const sectionId = elements.sectionSelect.value;
    const teacherEmail = elements.teacherEmail.value.trim();
    const teacherRole = elements.teacherRole.value;
    
    if (!sectionId || !teacherEmail) {
        alert('Please select section and enter email');
        return;
    }
    
    if (!teacherEmail.includes('@')) {
        alert('Invalid email');
        return;
    }
    
    try {
        const selectedOption = elements.sectionSelect.options[elements.sectionSelect.selectedIndex];
        const sectionName = selectedOption.getAttribute('data-name') || selectedOption.text;
        
        await firestore.collection('teacherAssignments').add({
            sectionId: sectionId,
            sectionName: sectionName,
            teacherEmail: teacherEmail,
            role: teacherRole,
            schoolId: currentSchoolId,
            assignedAt: firebase.firestore.FieldValue.serverTimestamp(),
            assignedBy: currentUser.email
        });
        
        elements.teacherEmail.value = '';
        elements.sectionSelect.value = '';
        elements.teacherRole.value = 'viewer';
        alert('Teacher assigned successfully!');
        await loadAssignments();
    } catch (error) {
        alert('Failed: ' + error.message);
    }
};

// Refresh assignments
elements.refreshBtn.onclick = () => loadAssignments();

// Edit assignment function (global scope for onclick)
window.editAssignment = (assignmentId, currentEmail, currentRole) => {
    elements.editAssignmentId.value = assignmentId;
    elements.editTeacherEmail.value = currentEmail;
    elements.editTeacherRole.value = currentRole;
    editModal.show();
};

// Save edited assignment
elements.saveEditBtn.onclick = async () => {
    const assignmentId = elements.editAssignmentId.value;
    const newEmail = elements.editTeacherEmail.value.trim();
    const newRole = elements.editTeacherRole.value;
    
    if (!newEmail || !newEmail.includes('@')) {
        alert('Please enter a valid email');
        return;
    }
    
    try {
        await firestore.collection('teacherAssignments').doc(assignmentId).update({
            teacherEmail: newEmail,
            role: newRole,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        editModal.hide();
        await loadAssignments();
    } catch (error) {
        alert('Failed: ' + error.message);
    }
};

// Delete assignment function (global scope for onclick)
window.deleteAssignment = async (assignmentId) => {
    if (!confirm('Remove this assignment?')) {
        return;
    }
    
    try {
        await firestore.collection('teacherAssignments').doc(assignmentId).delete();
        alert('Removed!');
        await loadAssignments();
    } catch (error) {
        alert('Failed: ' + error.message);
    }
};
