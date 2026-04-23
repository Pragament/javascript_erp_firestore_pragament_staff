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
    saveEditBtn: document.getElementById('save-edit-btn')
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
    await loadSections();
    await loadAssignments();
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

// Load teacher assignments from Firestore
async function loadAssignments() {
    try {
        const snapshot = await firestore.collection('teacherAssignments')
            .orderBy('assignedAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            elements.assignmentsTable.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No assignments yet</td></tr>';
            return;
        }

        let tableHtml = '';
        snapshot.docs.forEach(doc => {
            const assignment = doc.data();
            tableHtml += `<tr><td>${assignment.sectionName || 'N/A'}</td><td><code class="small">${assignment.sectionId}</code></td><td>${assignment.teacherEmail}</td><td><span class="badge bg-${assignment.role === 'admin' ? 'danger' : assignment.role === 'editor' ? 'warning' : 'info'}">${assignment.role || 'viewer'}</span></td><td class="small text-muted">${assignment.assignedBy || 'N/A'}</td><td class="text-center"><button class="btn btn-sm btn-warning btn-sm-action me-1" onclick="editAssignment('${doc.id}','${assignment.teacherEmail}','${assignment.role || 'viewer'}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger btn-sm-action" onclick="deleteAssignment('${doc.id}')"><i class="bi bi-trash"></i></button></td></tr>`;
        });
        
        elements.assignmentsTable.innerHTML = tableHtml;
    } catch (error) {
        console.error('Load assignments:', error);
        elements.assignmentsTable.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error loading</td></tr>';
    }
}

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
