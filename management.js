// School Management System - Principal Interface
// Manages Teachers, Subjects, Class Sections, and Teacher-Subject Mappings

// Firebase configuration (same as app.js)
const firebaseConfig = {
    apiKey: "AIzaSyAFpwi3k7Qth9MiqqRGKstY0Zkj_vrcdFY",
    authDomain: "edutrack-admin.firebaseapp.com",
    projectId: "edutrack-admin",
    storageBucket: "edutrack-admin.firebasestorage.com",
    messagingSenderId: "193864081571",
    appId: "1:193864081571:web:7501afde01291f81e61f16"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const firestore = firebase.firestore();

// Global state
let currentUser = null;
let selectedSchool = localStorage.getItem('selectedSchool') || '';
let selectedYear = localStorage.getItem('selectedAcademicYear') || '';
let allTeachers = [];
let allSubjects = [];
let allClassSections = [];
let allStudents = [];
let allMappings = [];
let allHistory = [];
let schoolSections = []; // School-level sections from /schools/{schoolId}.sections
let selectedStudentIds = new Set();
let studentVisibleFields = ['admissionNo', 'name', 'rollNo', 'sectionId', 'phone', 'archived'];
let selectedPeriods = []; // Store selected periods for import
let tempTimetableData = null; // Store timetable data during import
let tempExtractedMappings = null; // Store extracted mappings for import
let currentMappingIndex = 0; // Current mapping being reviewed

// CSV download pending data
let pendingCSVData = null; // Store data for CSV download after column selection
let pendingStudentCSVImport = null; // Store parsed student CSV import actions before confirmation

// Bootstrap modals
let teacherModal, subjectModal, classSectionModal, schoolSectionModal, mappingModal, studentModal, transferModal, periodSelectionModal, csvColumnModal, studentCsvPreviewModal;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals
    teacherModal = new bootstrap.Modal(document.getElementById('teacherModal'));
    subjectModal = new bootstrap.Modal(document.getElementById('subjectModal'));
    classSectionModal = new bootstrap.Modal(document.getElementById('classSectionModal'));
    schoolSectionModal = new bootstrap.Modal(document.getElementById('schoolSectionModal'));
    mappingModal = new bootstrap.Modal(document.getElementById('mappingModal'));
    studentModal = new bootstrap.Modal(document.getElementById('studentModal'));
    transferModal = new bootstrap.Modal(document.getElementById('transferModal'));
    periodSelectionModal = new bootstrap.Modal(document.getElementById('periodSelectionModal'));
    csvColumnModal = new bootstrap.Modal(document.getElementById('csvColumnModal'));
    studentCsvPreviewModal = new bootstrap.Modal(document.getElementById('studentCsvPreviewModal'));

    // Check auth state
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            document.getElementById('user-email').textContent = user.email;
            await initializePage();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Event listeners for navbar dropdowns
    document.getElementById('nav-school-select').addEventListener('change', function() {
        selectedSchool = this.value;
        localStorage.setItem('selectedSchool', selectedSchool);
        onContextChange();
    });

    document.getElementById('nav-year-select').addEventListener('change', function() {
        selectedYear = this.value;
        localStorage.setItem('selectedAcademicYear', selectedYear);
        onContextChange();
    });

    // Filter event listeners
    setupFilterListeners();

    // Sign out
    document.getElementById('signout-btn').addEventListener('click', () => auth.signOut());
});

// Clear local storage and reload page
function clearLocalStorage() {
    const confirmed = confirm(
        'Are you sure you want to clear all local storage data?\n\n' +
        'This will remove:\n' +
        '• Selected school\n' +
        '• Selected academic year\n' +
        '• Cached timetable data\n' +
        '• UI preferences\n\n' +
        'This action cannot be undone. The page will reload after clearing.'
    );
    
    if (!confirmed) return;
    
    try {
        // Clear all app-related localStorage keys
        const keysToClear = [
            'selectedSchool',
            'selectedAcademicYear',
            'schoolTimetable',
            'timetableAcademicYear',
            'lastUploadedFilename',
            'teacherFilters',
            'subjectFilters',
            'classSectionFilters',
            'mappingFilters'
        ];
        
        let clearedCount = 0;
        keysToClear.forEach(key => {
            if (localStorage.getItem(key) !== null) {
                localStorage.removeItem(key);
                clearedCount++;
            }
        });
        
        // Also clear any other keys that start with our app prefixes
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && (
                key.startsWith('school') || 
                key.startsWith('timetable') || 
                key.startsWith('teacher') || 
                key.startsWith('subject') || 
                key.startsWith('mapping') ||
                key.startsWith('classSection')
            )) {
                localStorage.removeItem(key);
                clearedCount++;
            }
        }
        
        alert(`Cleared ${clearedCount} cached items. The page will now reload.`);
        window.location.reload();
        
    } catch (error) {
        console.error('Error clearing local storage:', error);
        alert('Error clearing local storage: ' + error.message);
    }
}

async function initializePage() {
    // Load schools for navbar
    await loadSchoolsForNav();
    
    // Restore selections
    if (selectedSchool) {
        document.getElementById('nav-school-select').value = selectedSchool;
    }
    if (selectedYear) {
        document.getElementById('nav-year-select').value = selectedYear;
    }
    
    // Load data if context is set
    if (selectedSchool && selectedYear) {
        document.getElementById('selectionAlert').style.display = 'none';
        await loadAllData();
        applyURLTabParams();
    }
}

async function loadSchoolsForNav() {
    try {
        const snapshot = await firestore.collection('schools').get();
        const select = document.getElementById('nav-school-select');
        let html = '<option value="">Select School</option>';
        
        // Filter schools where current user is a staff member
        const userSchools = [];
        for (const doc of snapshot.docs) {
            const schoolId = doc.id;
            const schoolData = doc.data();
            
            // Check if user is staff in this school
            const staffSnapshot = await firestore.collection('schools')
                .doc(schoolId)
                .collection('staff')
                .where('email', '==', currentUser.email.toLowerCase())
                .where('status', '==', 'active')
                .get();
            
            if (!staffSnapshot.empty) {
                userSchools.push({
                    id: schoolId,
                    name: schoolData.schoolName || schoolId
                });
            }
        }
        
        // Sort by school name
        userSchools.sort((a, b) => a.name.localeCompare(b.name));
        
        userSchools.forEach(school => {
            html += `<option value="${school.id}">${school.name}</option>`;
        });
        
        select.innerHTML = html;
    } catch (error) {
        console.error('Error loading schools:', error);
    }
}

async function onContextChange() {
    selectedSchool = document.getElementById('nav-school-select').value;
    selectedYear = document.getElementById('nav-year-select').value;
    
    if (selectedSchool && selectedYear) {
        document.getElementById('selectionAlert').style.display = 'none';
        await loadAllData();
        applyURLTabParams();
    } else {
        document.getElementById('selectionAlert').style.display = 'block';
        clearAllTables();
    }
}

async function loadAllData() {
    showLoading();

    await Promise.all([loadTeachers(), loadSubjects()]);
    await loadClassSections();
    await Promise.all([loadStudents(), loadMappings(), loadHistory()]);
    
    updateStats();
    hideLoading();
}

function showLoading() {
    // Could add a loading spinner here
}

function hideLoading() {
    // Hide loading spinner
}

function clearAllTables() {
    document.getElementById('teachersTable').innerHTML = '<tr><td colspan="8" class="text-center text-muted">Select school and year to view teachers</td></tr>';
    document.getElementById('subjectsTable').innerHTML = '<tr><td colspan="6" class="text-center text-muted">Select school and year to view subjects</td></tr>';
    document.getElementById('classSectionsTable').innerHTML = '<tr><td colspan="9" class="text-center text-muted">Select school and year to view class sections</td></tr>';
    document.getElementById('studentsTable').innerHTML = '<tr><td colspan="8" class="text-center text-muted">Select school and year to view students</td></tr>';
    document.getElementById('mappingsGrid').innerHTML = `
        <div class="col-12">
            <div class="empty-state">
                <i class="bi bi-diagram-3" style="font-size: 3rem;"></i>
                <p class="mt-3">Select school and year to view mappings</p>
            </div>
        </div>
    `;
    document.getElementById('historyTimeline').innerHTML = '<div class="text-center text-muted py-4">Select school and year to view change history</div>';
    updateStats();
}

// ============== TEACHERS ==============

async function loadTeachers() {
    if (!selectedSchool) return;
    
    try {
        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('teachers')
            .orderBy('name')
            .get();
        
        allTeachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Save to localStorage for timetable page access
        localStorage.setItem('teachers', JSON.stringify(allTeachers));
        
        renderTeachers();
        updateTeacherFilterOptions();
    } catch (error) {
        console.error('Error loading teachers:', error);
    }
}

function renderTeachers() {
    const filterName = document.getElementById('filterTeacherName').value.toLowerCase();
    const filterEmail = document.getElementById('filterTeacherEmail').value.toLowerCase();
    const filterStatus = document.getElementById('filterTeacherStatus').value;
    
    let filtered = allTeachers.filter(t => {
        if (filterName && !t.name?.toLowerCase().includes(filterName)) return false;
        if (filterEmail && !t.email?.toLowerCase().includes(filterEmail)) return false;
        if (filterStatus && t.status !== filterStatus) return false;
        return true;
    });
    
    const tbody = document.getElementById('teachersTable');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No teachers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(t => `
        <tr>
            <td><small class="text-muted" title="${t.id}">${t.id.substring(0, 8)}...</small></td>
            <td><strong>${t.teacherCode || '-'}</strong></td>
            <td>
                <div class="d-flex align-items-center">
                    <div class="teacher-avatar">${(t.name || 'T').charAt(0).toUpperCase()}</div>
                    <div>${t.name || 'Unnamed'}</div>
                </div>
            </td>
            <td>${t.email || '-'}</td>
            <td>${t.phone || '-'}</td>
            <td>${t.joinDate ? formatDate(t.joinDate) : '-'}</td>
            <td>
                <span class="badge ${t.status === 'active' ? 'badge-active' : 'badge-inactive'}">
                    ${t.status || 'active'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary btn-icon me-1" onclick="editTeacher('${t.id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning btn-icon me-1" onclick="recordChange('${t.id}', '${t.name}')" title="Record Change">
                    <i class="bi bi-arrow-left-right"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteTeacher('${t.id}')" title="Delete">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openTeacherModal(teacherId = null) {
    document.getElementById('teacherForm').reset();
    document.getElementById('teacherId').value = '';
    document.getElementById('teacherJoinDate').value = new Date().toISOString().split('T')[0];
    
    if (teacherId) {
        const teacher = allTeachers.find(t => t.id === teacherId);
        if (teacher) {
            document.getElementById('teacherModalTitle').textContent = 'Edit Teacher';
            document.getElementById('teacherId').value = teacher.id;
            document.getElementById('teacherCode').value = teacher.teacherCode || '';
            document.getElementById('teacherName').value = teacher.name || '';
            document.getElementById('teacherEmail').value = teacher.email || '';
            document.getElementById('teacherPhone').value = teacher.phone || '';
            document.getElementById('teacherJoinDate').value = teacher.joinDate || '';
            document.getElementById('teacherStatus').value = teacher.status || 'active';
            document.getElementById('teacherNotes').value = teacher.notes || '';
        }
    } else {
        document.getElementById('teacherModalTitle').textContent = 'Add Teacher';
    }
    
    teacherModal.show();
}

function editTeacher(teacherId) {
    openTeacherModal(teacherId);
}

async function saveTeacher() {
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }
    
    const id = document.getElementById('teacherId').value;
    const teacherCode = document.getElementById('teacherCode').value.trim().toUpperCase();
    const name = document.getElementById('teacherName').value.trim();
    const email = document.getElementById('teacherEmail').value.trim();
    const phone = document.getElementById('teacherPhone').value.trim();
    const joinDate = document.getElementById('teacherJoinDate').value;
    const status = document.getElementById('teacherStatus').value;
    const notes = document.getElementById('teacherNotes').value.trim();
    
    const data = {
        teacherCode: teacherCode || null,
        name,
        email: email.toLowerCase(),
        phone,
        joinDate,
        status,
        notes,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.email
    };
    
    if (!data.name || !data.email) {
        alert('Name and Email are required');
        return;
    }
    
    try {
        if (id) {
            await firestore.collection('schools').doc(selectedSchool)
                .collection('teachers').doc(id).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await firestore.collection('schools').doc(selectedSchool)
                .collection('teachers').add(data);
        }
        
        teacherModal.hide();
        await loadTeachers();
        
        // Record in history if new teacher
        if (!id) {
            await recordHistory({
                type: 'joined',
                teacherName: data.name,
                teacherEmail: data.email,
                details: `New teacher joined: ${data.name}`
            });
        }
    } catch (error) {
        console.error('Error saving teacher:', error);
        alert('Error saving teacher: ' + error.message);
    }
}

async function deleteTeacher(teacherId) {
    if (!confirm('Are you sure you want to delete this teacher?')) return;
    
    try {
        await firestore.collection('schools').doc(selectedSchool)
            .collection('teachers').doc(teacherId).delete();
        await loadTeachers();
    } catch (error) {
        console.error('Error deleting teacher:', error);
        alert('Error deleting teacher: ' + error.message);
    }
}

function clearTeacherFilters() {
    document.getElementById('filterTeacherName').value = '';
    document.getElementById('filterTeacherEmail').value = '';
    document.getElementById('filterTeacherStatus').value = '';
    renderTeachers();
}

// ============== SUBJECTS ==============

async function loadSubjects() {
    if (!selectedSchool) return;
    
    try {
        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('subjects')
            .orderBy('code')
            .get();
        
        allSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSubjects();
        updateSubjectFilterOptions();
        updateMappingSubjectOptions();
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

function renderSubjects() {
    const filterName = document.getElementById('filterSubjectName').value.toLowerCase();
    const filterCode = document.getElementById('filterSubjectCode').value;
    
    let filtered = allSubjects.filter(s => {
        if (filterName && !s.name?.toLowerCase().includes(filterName)) return false;
        if (filterCode && s.code !== filterCode) return false;
        return true;
    });
    
    const tbody = document.getElementById('subjectsTable');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No subjects found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td><code>${s.code || '-'}</code></td>
            <td>${s.name || '-'}</td>
            <td>${s.description || '-'}</td>
            <td>${s.periodsPerWeek || '-'}</td>
            <td>
                <span class="badge ${s.status === 'active' ? 'badge-active' : 'badge-inactive'}">
                    ${s.status || 'active'}
                </span>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary btn-icon me-1" onclick="editSubject('${s.id}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteSubject('${s.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function openSubjectModal(subjectId = null) {
    document.getElementById('subjectForm').reset();
    document.getElementById('subjectId').value = '';
    
    if (subjectId) {
        const subject = allSubjects.find(s => s.id === subjectId);
        if (subject) {
            document.getElementById('subjectModalTitle').textContent = 'Edit Subject';
            document.getElementById('subjectId').value = subject.id;
            document.getElementById('subjectCode').value = subject.code || '';
            document.getElementById('subjectName').value = subject.name || '';
            document.getElementById('subjectDescription').value = subject.description || '';
            document.getElementById('subjectPeriods').value = subject.periodsPerWeek || 5;
            document.getElementById('subjectStatus').value = subject.status || 'active';
        }
    } else {
        document.getElementById('subjectModalTitle').textContent = 'Add Subject';
    }
    
    subjectModal.show();
}

function editSubject(subjectId) {
    openSubjectModal(subjectId);
}

async function saveSubject() {
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }
    
    const id = document.getElementById('subjectId').value;
    const data = {
        code: document.getElementById('subjectCode').value.trim().toUpperCase(),
        name: document.getElementById('subjectName').value.trim(),
        description: document.getElementById('subjectDescription').value.trim(),
        periodsPerWeek: parseInt(document.getElementById('subjectPeriods').value) || 5,
        status: document.getElementById('subjectStatus').value,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.email
    };
    
    if (!data.code || !data.name) {
        alert('Subject Code and Name are required');
        return;
    }
    
    try {
        if (id) {
            await firestore.collection('schools').doc(selectedSchool)
                .collection('subjects').doc(id).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await firestore.collection('schools').doc(selectedSchool)
                .collection('subjects').add(data);
        }
        
        subjectModal.hide();
        await loadSubjects();
    } catch (error) {
        console.error('Error saving subject:', error);
        alert('Error saving subject: ' + error.message);
    }
}

async function deleteSubject(subjectId) {
    if (!confirm('Are you sure you want to delete this subject?')) return;
    
    try {
        await firestore.collection('schools').doc(selectedSchool)
            .collection('subjects').doc(subjectId).delete();
        await loadSubjects();
    } catch (error) {
        console.error('Error deleting subject:', error);
        alert('Error deleting subject: ' + error.message);
    }
}

function clearSubjectFilters() {
    document.getElementById('filterSubjectName').value = '';
    document.getElementById('filterSubjectCode').value = '';
    renderSubjects();
}

// ============== CLASS SECTIONS ==============

async function loadClassSections() {
    if (!selectedSchool || !selectedYear) return;

    try {
        // Load school sections first (needed for rendering school section names)
        await loadSchoolSections();

        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('classSections')
            .where('academicYear', '==', selectedYear)
            .orderBy('grade')
            .orderBy('section')
            .get();

        allClassSections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Save to localStorage for timetable page access
        localStorage.setItem('classSections', JSON.stringify(allClassSections));

        renderClassSections();
        updateMappingClassOptions();
    } catch (error) {
        console.error('Error loading class sections:', error);
    }
}

function renderClassSections() {
    const filterGrade = document.getElementById('filterClassGrade').value;
    const filterSection = document.getElementById('filterClassSection').value.toLowerCase();

    let filtered = allClassSections.filter(cs => {
        if (filterGrade && cs.grade !== filterGrade) return false;
        if (filterSection && !cs.section?.toLowerCase().includes(filterSection)) return false;
        return true;
    });

    const tbody = document.getElementById('classSectionsTable');
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No class sections found</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(cs => {
        const classTeacher = allTeachers.find(t => t.email === cs.classTeacherEmail);
        // Find school section name from schoolSections array
        const schoolSection = schoolSections.find(s => s.sectionId === cs.schoolSectionId);
        const schoolSectionDisplay = schoolSection
            ? `${schoolSection.sectionId} (${schoolSection.sectionName || '-'})`
            : (cs.schoolSectionId || '-');
        return `
        <tr>
            <td><strong>${cs.grade || '-'}-${cs.section || '-'}</strong></td>
            <td>Grade ${cs.grade || '-'}</td>
            <td>${cs.section || '-'}</td>
            <td><small class="text-muted" title="${cs.id}">${cs.id.substring(0, 8)}...</small></td>
            <td>${schoolSectionDisplay}</td>
            <td>${classTeacher ? classTeacher.name : (cs.classTeacherEmail || '-')}</td>
            <td>${cs.roomNumber || '-'}</td>
            <td>${cs.studentCount || '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-info btn-icon me-1" onclick="showStudentsForSection('${cs.schoolSectionId || cs.id}')" title="View Students">
                    <i class="bi bi-person-lines-fill"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary btn-icon me-1" onclick="editClassSection('${cs.id}')">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteClassSection('${cs.id}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `}).join('');
}

async function loadSchoolSections() {
    if (!selectedSchool) return;
    
    try {
        const schoolDoc = await firestore.collection('schools').doc(selectedSchool).get();
        if (schoolDoc.exists) {
            const schoolData = schoolDoc.data();
            schoolSections = schoolData.sections || [];
        } else {
            schoolSections = [];
        }
    } catch (error) {
        console.error('Error loading school sections:', error);
        schoolSections = [];
    }
}

function populateSchoolSectionDropdown(selectedSectionId = '') {
    const sectionSelect = document.getElementById('schoolSectionSelect');
    let html = '<option value="">Select School Section</option>';
    
    schoolSections.forEach(section => {
        const isSelected = section.sectionId === selectedSectionId ? 'selected' : '';
        html += `<option value="${section.sectionId}" ${isSelected}>${section.sectionName || section.sectionId}</option>`;
    });
    
    sectionSelect.innerHTML = html;
}

function openSchoolSectionModal() {
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }

    document.getElementById('schoolSectionForm').reset();
    schoolSectionModal.show();
}

async function saveSchoolSection() {
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }

    const sectionId = document.getElementById('schoolSectionId').value.trim().toUpperCase();
    const sectionName = document.getElementById('schoolSectionName').value.trim();

    if (!sectionId || !sectionName) {
        alert('Section ID and Section Name are required');
        return;
    }

    try {
        const schoolRef = firestore.collection('schools').doc(selectedSchool);
        const schoolDoc = await schoolRef.get();
        const currentSections = schoolDoc.exists ? (schoolDoc.data().sections || []) : [];
        const duplicate = currentSections.some(section => {
            return String(section.sectionId || '').toUpperCase() === sectionId;
        });

        if (duplicate) {
            alert('A section with this ID already exists in the selected school');
            return;
        }

        const sections = [
            ...currentSections,
            {
                sectionId,
                sectionName
            }
        ].sort((a, b) => {
            return String(a.sectionName || a.sectionId).localeCompare(String(b.sectionName || b.sectionId));
        });

        await schoolRef.update({
            sections,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.email
        });

        schoolSectionModal.hide();
        await loadSchoolSections();
        populateSchoolSectionDropdown(sectionId);
        renderClassSections();
        updateStudentSectionOptions();
        alert('School section created successfully!');
    } catch (error) {
        console.error('Error saving school section:', error);
        alert('Error saving school section: ' + error.message);
    }
}

async function openClassSectionModal(classSectionId = null) {
    if (!selectedYear) {
        alert('Please select an academic year first');
        return;
    }
    
    // Load school sections first
    await loadSchoolSections();
    
    document.getElementById('classSectionForm').reset();
    document.getElementById('classSectionId').value = '';
    document.getElementById('classAcademicYear').value = selectedYear;
    
    // Populate class teacher dropdown
    const teacherSelect = document.getElementById('classTeacher');
    teacherSelect.innerHTML = '<option value="">Select Class Teacher</option>' +
        allTeachers.filter(t => t.status === 'active').map(t => 
            `<option value="${t.email}">${t.name}</option>`
        ).join('');
    
    if (classSectionId) {
        const cs = allClassSections.find(c => c.id === classSectionId);
        if (cs) {
            document.getElementById('classSectionModalTitle').textContent = 'Edit Class Section';
            document.getElementById('classSectionId').value = cs.id;
            document.getElementById('classGrade').value = cs.grade || '';
            document.getElementById('classSection').value = cs.section || '';
            document.getElementById('classTeacher').value = cs.classTeacherEmail || '';
            document.getElementById('classRoom').value = cs.roomNumber || '';
            document.getElementById('classStudents').value = cs.studentCount || '';
            // Populate school section dropdown with selected value
            populateSchoolSectionDropdown(cs.schoolSectionId || '');
        }
    } else {
        document.getElementById('classSectionModalTitle').textContent = 'Add Class Section';
        populateSchoolSectionDropdown();
    }
    
    classSectionModal.show();
}

function editClassSection(classSectionId) {
    openClassSectionModal(classSectionId);
}

async function saveClassSection() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    const id = document.getElementById('classSectionId').value;
    const grade = document.getElementById('classGrade').value;
    const section = document.getElementById('classSection').value.trim();
    const classTeacherEmail = document.getElementById('classTeacher').value;
    const schoolSectionId = document.getElementById('schoolSectionSelect').value;
    
    const data = {
        grade: grade,
        section: section.toUpperCase(),
        schoolSectionId: schoolSectionId,
        classTeacherEmail: classTeacherEmail,
        roomNumber: document.getElementById('classRoom').value.trim(),
        studentCount: parseInt(document.getElementById('classStudents').value) || 0,
        academicYear: selectedYear,
        fullName: `${grade}-${section.toUpperCase()}`,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.email
    };
    
    if (!data.grade || !data.section) {
        alert('Grade and Section are required');
        return;
    }
    
    try {
        if (id) {
            await firestore.collection('schools').doc(selectedSchool)
                .collection('classSections').doc(id).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await firestore.collection('schools').doc(selectedSchool)
                .collection('classSections').add(data);
        }
        
        classSectionModal.hide();
        await loadClassSections();
    } catch (error) {
        console.error('Error saving class section:', error);
        alert('Error saving class section: ' + error.message);
    }
}

async function deleteClassSection(classSectionId) {
    if (!confirm('Are you sure you want to delete this class section?')) return;
    
    try {
        await firestore.collection('schools').doc(selectedSchool)
            .collection('classSections').doc(classSectionId).delete();
        await loadClassSections();
    } catch (error) {
        console.error('Error deleting class section:', error);
        alert('Error deleting class section: ' + error.message);
    }
}

function clearClassSectionFilters() {
    document.getElementById('filterClassGrade').value = '';
    document.getElementById('filterClassSection').value = '';
    renderClassSections();
}

function showStudentsForSection(sectionId) {
    const studentsTab = document.querySelector('a[href="#students"]');
    if (studentsTab) {
        bootstrap.Tab.getOrCreateInstance(studentsTab).show();
    }
    document.getElementById('filterStudentSection').value = sectionId;
    renderStudents();
}

// ============== STUDENTS ==============

const studentFieldDefs = [
    { key: 'admissionNo', label: 'Admission No' },
    { key: 'name', label: 'Name' },
    { key: 'rollNo', label: 'Roll No' },
    { key: 'sectionId', label: 'Section' },
    { key: 'phone', label: 'Phone' },
    { key: 'archived', label: 'Status' },
    { key: 'id', label: 'Database ID' }
];

async function loadStudents() {
    if (!selectedSchool) return;

    selectedStudentIds.clear();
    try {
        const sectionIds = getKnownSectionIds();
        if (sectionIds.length === 0) {
            allStudents = [];
            renderStudents();
            updateStudentSectionOptions();
            updateStudentFieldMenu();
            return;
        }

        const batches = [];
        for (let i = 0; i < sectionIds.length; i += 10) {
            batches.push(sectionIds.slice(i, i + 10));
        }

        const students = [];
        for (const batchIds of batches) {
            const snapshot = await firestore.collection('students')
                .where('sectionId', 'in', batchIds)
                .get();
            snapshot.docs.forEach(doc => students.push({ id: doc.id, ...doc.data() }));
        }

        const uniqueById = new Map();
        students.forEach(student => uniqueById.set(student.id, student));
        allStudents = Array.from(uniqueById.values());

        renderStudents();
        updateStudentSectionOptions();
        updateStudentFieldMenu();
    } catch (error) {
        console.error('Error loading students:', error);
        document.getElementById('studentsTable').innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading students</td></tr>';
    }
}

function getKnownSectionIds() {
    const ids = new Set();
    schoolSections.forEach(section => {
        if (section.sectionId) ids.add(section.sectionId);
    });
    allClassSections.forEach(section => {
        if (section.schoolSectionId) ids.add(section.schoolSectionId);
        if (section.id) ids.add(section.id);
    });
    return Array.from(ids).filter(Boolean);
}

function getFilteredStudents() {
    const search = document.getElementById('filterStudentSearch').value.trim().toLowerCase();
    const sectionId = document.getElementById('filterStudentSection').value;
    const archiveFilter = document.getElementById('filterStudentArchive').value;
    const sortField = document.getElementById('studentSortField').value;
    const sortDirection = document.getElementById('studentSortDirection').value;

    const filtered = allStudents.filter(student => {
        const isArchived = Boolean(student.archived);
        if (sectionId && student.sectionId !== sectionId) return false;
        if (archiveFilter === 'active' && isArchived) return false;
        if (archiveFilter === 'archived' && !isArchived) return false;
        if (search) {
            const haystack = [
                student.name,
                student.admissionNo,
                student.rollNo,
                student.phone,
                student.sectionId,
                student.id
            ].map(value => String(value || '').toLowerCase()).join(' ');
            if (!haystack.includes(search)) return false;
        }
        return true;
    });

    filtered.sort((a, b) => {
        let aVal = sortField === 'sectionId' ? getSectionLabel(a.sectionId) : a[sortField];
        let bVal = sortField === 'sectionId' ? getSectionLabel(b.sectionId) : b[sortField];
        if (sortField === 'rollNo') {
            aVal = Number(aVal) || 0;
            bVal = Number(bVal) || 0;
        } else {
            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
        }
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    return filtered;
}

function renderStudents() {
    const students = getFilteredStudents();
    const thead = document.getElementById('studentsTableHead');
    const tbody = document.getElementById('studentsTable');

    thead.innerHTML = `
        <th style="width: 42px;">
            <input type="checkbox" class="form-check-input" id="selectAllStudents" onchange="toggleAllStudents(this.checked)">
        </th>
        ${studentVisibleFields.map(field => `<th>${getStudentFieldLabel(field)}</th>`).join('')}
        <th>Actions</th>
    `;

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${studentVisibleFields.length + 2}" class="text-center text-muted">No students found</td></tr>`;
        updateSelectAllStudentsState();
        return;
    }

    tbody.innerHTML = students.map(student => `
        <tr class="${student.archived ? 'table-light text-muted' : ''}">
            <td>
                <input type="checkbox" class="form-check-input student-select" value="${student.id}" ${selectedStudentIds.has(student.id) ? 'checked' : ''} onchange="toggleStudentSelection('${student.id}', this.checked)">
            </td>
            ${studentVisibleFields.map(field => `<td>${formatStudentField(student, field)}</td>`).join('')}
            <td>
                <button class="btn btn-sm btn-outline-secondary btn-icon me-1" onclick="viewStudent('${student.id}')" title="View">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-primary btn-icon me-1" onclick="editStudent('${student.id}')" title="Edit">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm ${student.archived ? 'btn-outline-success' : 'btn-outline-warning'} btn-icon" onclick="archiveStudent('${student.id}', ${!student.archived})" title="${student.archived ? 'Unarchive' : 'Archive'}">
                    <i class="bi ${student.archived ? 'bi-arrow-counterclockwise' : 'bi-archive'}"></i>
                </button>
            </td>
        </tr>
    `).join('');

    updateSelectAllStudentsState();
}

function getStudentFieldLabel(field) {
    return studentFieldDefs.find(def => def.key === field)?.label || field;
}

function formatStudentField(student, field) {
    if (field === 'sectionId') return escapeHtml(getSectionLabel(student.sectionId));
    if (field === 'archived') {
        return student.archived
            ? '<span class="badge badge-inactive">Archived</span>'
            : '<span class="badge badge-active">Active</span>';
    }
    if (field === 'id') return `<small class="text-muted" title="${escapeHtml(student.id)}">${escapeHtml(student.id.substring(0, 10))}...</small>`;
    return escapeHtml(student[field] ?? '-');
}

function getSectionLabel(sectionId) {
    if (!sectionId) return '-';
    const schoolSection = schoolSections.find(section => section.sectionId === sectionId);
    if (schoolSection) return schoolSection.sectionName ? `${schoolSection.sectionName}` : sectionId;

    const classSection = allClassSections.find(section => section.id === sectionId || section.schoolSectionId === sectionId);
    if (classSection) return `Grade ${classSection.grade}-${classSection.section}`;

    return sectionId;
}

function updateStudentSectionOptions() {
    const sectionSelect = document.getElementById('filterStudentSection');
    const modalSectionSelect = document.getElementById('studentSectionId');
    const currentFilter = sectionSelect.value;
    const currentModal = modalSectionSelect.value;

    const options = getKnownSectionIds()
        .map(id => ({ id, label: getSectionLabel(id) }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const html = options.map(option => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.label)}</option>`).join('');
    sectionSelect.innerHTML = '<option value="">All Sections</option>' + html;
    modalSectionSelect.innerHTML = '<option value="">Select Section</option>' + html;

    if (options.some(option => option.id === currentFilter)) sectionSelect.value = currentFilter;
    if (options.some(option => option.id === currentModal)) modalSectionSelect.value = currentModal;
}

function updateStudentFieldMenu() {
    const container = document.getElementById('studentFieldMenu');
    container.innerHTML = studentFieldDefs.map(def => `
        <div class="form-check">
            <input class="form-check-input student-field-check" type="checkbox" id="student_field_${def.key}" value="${def.key}" ${studentVisibleFields.includes(def.key) ? 'checked' : ''} onchange="updateStudentVisibleFields()">
            <label class="form-check-label" for="student_field_${def.key}">${def.label}</label>
        </div>
    `).join('');
}

function updateStudentVisibleFields() {
    const selected = Array.from(document.querySelectorAll('.student-field-check:checked')).map(cb => cb.value);
    if (selected.length === 0) {
        alert('Please keep at least one field visible.');
        updateStudentFieldMenu();
        return;
    }
    studentVisibleFields = selected;
    renderStudents();
}

function openStudentModal(studentId = null, readOnly = false) {
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }

    updateStudentSectionOptions();
    document.getElementById('studentForm').reset();
    document.getElementById('studentId').value = '';
    document.getElementById('studentArchived').value = 'false';

    const saveBtn = document.querySelector('#studentModal .modal-footer .btn-primary');
    saveBtn.style.display = readOnly ? 'none' : '';
    document.querySelectorAll('#studentForm input, #studentForm select').forEach(input => {
        input.disabled = readOnly;
    });

    if (studentId) {
        const student = allStudents.find(s => s.id === studentId);
        if (!student) return;
        document.getElementById('studentModalTitle').textContent = readOnly ? 'Student Details' : 'Edit Student';
        document.getElementById('studentId').value = student.id;
        document.getElementById('studentAdmissionNo').value = student.admissionNo || '';
        document.getElementById('studentName').value = student.name || '';
        document.getElementById('studentRollNo').value = student.rollNo ?? '';
        document.getElementById('studentSectionId').value = student.sectionId || '';
        document.getElementById('studentPhone').value = student.phone || '';
        document.getElementById('studentArchived').value = String(Boolean(student.archived));
    } else {
        document.getElementById('studentModalTitle').textContent = 'Add Student';
        const filterSection = document.getElementById('filterStudentSection').value;
        if (filterSection) document.getElementById('studentSectionId').value = filterSection;
    }

    studentModal.show();
}

function viewStudent(studentId) {
    openStudentModal(studentId, true);
}

function editStudent(studentId) {
    openStudentModal(studentId, false);
}

async function saveStudent() {
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }

    const id = document.getElementById('studentId').value;
    const archived = document.getElementById('studentArchived').value === 'true';
    const admissionNo = document.getElementById('studentAdmissionNo').value.trim();
    const name = document.getElementById('studentName').value.trim().toUpperCase();
    const sectionId = document.getElementById('studentSectionId').value;
    const rollNoValue = document.getElementById('studentRollNo').value;

    if (!admissionNo || !name || !sectionId) {
        alert('Admission No, Name, and Section are required');
        return;
    }

    const data = {
        admissionNo,
        name,
        rollNo: rollNoValue === '' ? null : parseInt(rollNoValue, 10),
        sectionId,
        phone: document.getElementById('studentPhone').value.trim(),
        archived,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.email,
        schoolId: selectedSchool
    };

    try {
        if (id) {
            await firestore.collection('students').doc(id).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.createdBy = currentUser.email;
            await firestore.collection('students').add(data);
        }
        studentModal.hide();
        await loadStudents();
        updateStats();
    } catch (error) {
        console.error('Error saving student:', error);
        alert('Error saving student: ' + error.message);
    }
}

async function archiveStudent(studentId, shouldArchive) {
    const label = shouldArchive ? 'archive' : 'unarchive';
    if (!confirm(`Are you sure you want to ${label} this student?`)) return;

    try {
        await firestore.collection('students').doc(studentId).update({
            archived: shouldArchive,
            archivedAt: shouldArchive ? firebase.firestore.FieldValue.serverTimestamp() : null,
            archivedBy: shouldArchive ? currentUser.email : null,
            unarchivedAt: shouldArchive ? null : firebase.firestore.FieldValue.serverTimestamp(),
            unarchivedBy: shouldArchive ? null : currentUser.email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.email
        });
        selectedStudentIds.delete(studentId);
        await loadStudents();
        updateStats();
    } catch (error) {
        console.error('Error archiving student:', error);
        alert('Error updating student: ' + error.message);
    }
}

function toggleStudentSelection(studentId, checked) {
    if (checked) {
        selectedStudentIds.add(studentId);
    } else {
        selectedStudentIds.delete(studentId);
    }
    updateSelectAllStudentsState();
}

function toggleAllStudents(checked) {
    getFilteredStudents().forEach(student => {
        if (checked) {
            selectedStudentIds.add(student.id);
        } else {
            selectedStudentIds.delete(student.id);
        }
    });
    renderStudents();
}

function updateSelectAllStudentsState() {
    const selectAll = document.getElementById('selectAllStudents');
    if (!selectAll) return;
    const visible = getFilteredStudents();
    const selectedVisible = visible.filter(student => selectedStudentIds.has(student.id));
    selectAll.checked = visible.length > 0 && selectedVisible.length === visible.length;
    selectAll.indeterminate = selectedVisible.length > 0 && selectedVisible.length < visible.length;
}

async function bulkArchiveStudents(shouldArchive) {
    const ids = Array.from(selectedStudentIds);
    if (ids.length === 0) {
        alert('Select at least one student first');
        return;
    }

    const label = shouldArchive ? 'archive' : 'unarchive';
    if (!confirm(`Are you sure you want to ${label} ${ids.length} selected student(s)?`)) return;

    try {
        for (const id of ids) {
            await firestore.collection('students').doc(id).update({
                archived: shouldArchive,
                archivedAt: shouldArchive ? firebase.firestore.FieldValue.serverTimestamp() : null,
                archivedBy: shouldArchive ? currentUser.email : null,
                unarchivedAt: shouldArchive ? null : firebase.firestore.FieldValue.serverTimestamp(),
                unarchivedBy: shouldArchive ? null : currentUser.email,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.email
            });
        }
        selectedStudentIds.clear();
        await loadStudents();
        updateStats();
    } catch (error) {
        console.error('Error bulk updating students:', error);
        alert('Error updating selected students: ' + error.message);
    }
}

function clearStudentFilters() {
    document.getElementById('filterStudentSearch').value = '';
    document.getElementById('filterStudentSection').value = '';
    document.getElementById('filterStudentArchive').value = 'active';
    document.getElementById('studentSortField').value = 'rollNo';
    document.getElementById('studentSortDirection').value = 'asc';
    selectedStudentIds.clear();
    renderStudents();
}

function downloadStudentsCSV() {
    const students = getFilteredStudents();
    if (students.length === 0) {
        alert('No students to export');
        return;
    }

    const sectionId = document.getElementById('filterStudentSection').value;
    const filename = sectionId
        ? `students_${sanitizeFilenamePart(getSectionLabel(sectionId))}`
        : 'students';

    const columnDefs = studentFieldDefs.map(def => ({
        ...def,
        selected: studentVisibleFields.includes(def.key)
    }));

    showCSVColumnModal('Students', filename, students, columnDefs, (student, col) => {
        if (col === 'sectionId') return getSectionLabel(student.sectionId);
        if (col === 'archived') return student.archived ? 'Archived' : 'Active';
        return student[col] ?? '';
    });
}

async function importStudentsCSV(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }

    try {
        const text = await file.text();
        const rows = parseCSV(text);
        if (rows.length < 2) {
            alert('CSV must include a header row and at least one student row.');
            return;
        }

        const headers = rows[0].map(header => normalizeCSVHeader(header));
        const records = rows.slice(1)
            .filter(row => row.some(cell => String(cell || '').trim()))
            .map(row => {
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = row[index] || '';
                });
                return record;
            });

        if (records.length === 0) {
            alert('No student rows found in CSV.');
            return;
        }

        const preview = await buildStudentCSVImportPreview(records);
        pendingStudentCSVImport = preview;
        renderStudentCSVImportPreview(preview);
        studentCsvPreviewModal.show();
    } catch (error) {
        console.error('Error previewing student import:', error);
        alert('Error previewing student import: ' + error.message);
    }
}

async function buildStudentCSVImportPreview(records) {
    const defaultSectionId = getStudentCSVDefaultSectionId();
    const actions = [];

    for (const record of records) {
        const admissionNo = String(record.admissionNo || '').trim();
        const name = String(record.name || '').trim().toUpperCase();
        const explicitId = String(record.id || '').trim();
        let existing = null;

        if (explicitId) {
            existing = allStudents.find(student => student.id === explicitId);
            if (!existing) {
                const existingDoc = await firestore.collection('students').doc(explicitId).get();
                if (existingDoc.exists) {
                    existing = { id: existingDoc.id, ...existingDoc.data() };
                }
            }
        } else {
            existing = allStudents.find(student => student.admissionNo === admissionNo);
        }

        const sectionId = String(record.sectionId || '').trim() || existing?.sectionId || defaultSectionId;

        if (!admissionNo || !name || !sectionId) {
            actions.push({
                action: 'skip',
                reason: getStudentCSVSkipReason(admissionNo, name, sectionId),
                explicitId,
                data: { admissionNo, name, sectionId, phone: String(record.phone || '').trim() },
                existing
            });
            continue;
        }

        const data = {
            admissionNo,
            name,
            rollNo: hasCSVField(record, 'rollNo')
                ? (record.rollNo === '' || record.rollNo == null ? null : parseInt(record.rollNo, 10))
                : (existing?.rollNo ?? null),
            sectionId,
            phone: hasCSVField(record, 'phone') ? String(record.phone || '').trim() : (existing?.phone || ''),
            archived: hasCSVField(record, 'archived') ? parseBoolean(record.archived) : Boolean(existing?.archived),
            schoolId: selectedSchool
        };

        const action = existing
            ? (hasStudentCSVImportChanges(existing, data) ? 'update' : 'unchanged')
            : 'import';

        actions.push({
            action,
            reason: action === 'unchanged' ? 'No changes' : '',
            explicitId,
            data,
            existing
        });
    }

    return {
        actions,
        counts: {
            import: actions.filter(item => item.action === 'import').length,
            update: actions.filter(item => item.action === 'update').length,
            unchanged: actions.filter(item => item.action === 'unchanged').length,
            skip: actions.filter(item => item.action === 'skip').length
        }
    };
}

async function confirmStudentCSVImport() {
    if (!pendingStudentCSVImport) return;

    const confirmBtn = document.getElementById('confirmStudentCsvImportBtn');
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Importing...';

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let unchanged = 0;

    try {
        for (const item of pendingStudentCSVImport.actions) {
            if (item.action === 'skip') {
                skipped++;
                continue;
            }
            if (item.action === 'unchanged') {
                unchanged++;
                continue;
            }

            const data = {
                ...item.data,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.email
            };

            if (item.action === 'update') {
                await firestore.collection('students').doc(item.existing.id).update(data);
                updated++;
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                data.createdBy = currentUser.email;
                if (item.explicitId) {
                    await firestore.collection('students').doc(item.explicitId).set(data);
                } else {
                    await firestore.collection('students').add(data);
                }
                imported++;
            }
        }

        studentCsvPreviewModal.hide();
        pendingStudentCSVImport = null;
        alert(`Import complete!\n\nImported: ${imported}\nUpdated: ${updated}\nUnchanged: ${unchanged}\nSkipped: ${skipped}`);
        await loadStudents();
        updateStats();
    } catch (error) {
        console.error('Error importing students:', error);
        alert('Error importing students: ' + error.message);
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="bi bi-check2-circle me-2"></i>Confirm Import';
    }
}

function getStudentCSVDefaultSectionId() {
    const selectedFilterSection = document.getElementById('filterStudentSection')?.value || '';
    return selectedFilterSection || passedSectionId || '';
}

function getStudentCSVSkipReason(admissionNo, name, sectionId) {
    const missing = [];
    if (!admissionNo) missing.push('Admission No');
    if (!name) missing.push('Name');
    if (!sectionId) missing.push('Section');
    return `Missing ${missing.join(', ')}`;
}

function hasStudentCSVImportChanges(existing, data) {
    return ['admissionNo', 'name', 'rollNo', 'sectionId', 'phone', 'archived', 'schoolId'].some(field => {
        const existingValue = field === 'rollNo'
            ? (existing[field] == null ? null : Number(existing[field]))
            : existing[field];
        return String(existingValue ?? '') !== String(data[field] ?? '');
    });
}

function hasCSVField(record, field) {
    return Object.prototype.hasOwnProperty.call(record, field);
}

function renderStudentCSVImportPreview(preview) {
    const { import: importCount, update, unchanged, skip } = preview.counts;
    document.getElementById('studentCsvPreviewSummary').innerHTML = `
        <div class="row g-2 text-center">
            <div class="col-6 col-md-3">
                <div class="border rounded p-2">
                    <div class="fw-bold text-success">${importCount}</div>
                    <div class="small text-muted">New</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="border rounded p-2">
                    <div class="fw-bold text-primary">${update}</div>
                    <div class="small text-muted">Updates</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="border rounded p-2">
                    <div class="fw-bold text-secondary">${unchanged}</div>
                    <div class="small text-muted">Unchanged</div>
                </div>
            </div>
            <div class="col-6 col-md-3">
                <div class="border rounded p-2">
                    <div class="fw-bold text-warning">${skip}</div>
                    <div class="small text-muted">Skipped</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('studentCsvPreviewTable').innerHTML = preview.actions.map(item => {
        const badgeClass = {
            import: 'bg-success',
            update: 'bg-primary',
            unchanged: 'bg-secondary',
            skip: 'bg-warning text-dark'
        }[item.action];
        const oldPhone = item.existing?.phone ?? '';
        const newPhone = item.data.phone ?? '';
        const oldSection = item.existing?.sectionId ? getSectionLabel(item.existing.sectionId) : '-';
        const newSection = item.data.sectionId ? getSectionLabel(item.data.sectionId) : '-';
        const oldRollNo = item.existing?.rollNo ?? '';
        const newRollNo = item.data.rollNo ?? '';
        const oldStatus = item.existing ? (item.existing.archived ? 'Archived' : 'Active') : '-';
        const newStatus = item.data.archived ? 'Archived' : 'Active';
        return `
            <tr>
                <td><span class="badge ${badgeClass}">${escapeHtml(item.action)}</span></td>
                <td>${escapeHtml(item.explicitId || item.existing?.id || '-')}</td>
                <td>${escapeHtml(item.data.admissionNo || '-')}</td>
                <td>${escapeHtml(item.data.name || '-')}</td>
                <td>${escapeHtml(oldRollNo || '-')} <i class="bi bi-arrow-right mx-1 text-muted"></i> ${escapeHtml(newRollNo || '-')}</td>
                <td>${escapeHtml(oldSection)} <i class="bi bi-arrow-right mx-1 text-muted"></i> ${escapeHtml(newSection)}</td>
                <td>${escapeHtml(oldPhone || '-')} <i class="bi bi-arrow-right mx-1 text-muted"></i> ${escapeHtml(newPhone || '-')}</td>
                <td>${escapeHtml(oldStatus)} <i class="bi bi-arrow-right mx-1 text-muted"></i> ${escapeHtml(newStatus)}</td>
                <td>${escapeHtml(item.reason || '-')}</td>
            </tr>
        `;
    }).join('');

    document.getElementById('confirmStudentCsvImportBtn').disabled = importCount + update === 0;
}

function normalizeCSVHeader(header) {
    const key = String(header || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const aliases = {
        id: 'id',
        databaseid: 'id',
        studentid: 'id',
        admissionno: 'admissionNo',
        admissionnumber: 'admissionNo',
        name: 'name',
        studentname: 'name',
        rollno: 'rollNo',
        rollnumber: 'rollNo',
        sectionid: 'sectionId',
        section: 'sectionId',
        phone: 'phone',
        phonenumber: 'phone',
        mobile: 'phone',
        archived: 'archived',
        status: 'archived'
    };
    return aliases[key] || key;
}

function parseBoolean(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return ['true', 'yes', 'y', '1', 'archived', 'inactive'].includes(normalized);
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && inQuotes && next === '"') {
            cell += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            row.push(cell);
            cell = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && next === '\n') i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }

    if (cell || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }

    return rows;
}

// ============== MAPPINGS ==============

async function loadMappings() {
    if (!selectedSchool || !selectedYear) return;
    
    try {
        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('teacherSubjectMappings')
            .where('academicYear', '==', selectedYear)
            .where('status', '==', 'active')
            .get();
        
        allMappings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Save to localStorage for timetable page access
        localStorage.setItem('teacherSubjectMappings', JSON.stringify(allMappings));
        
        renderMappings();
    } catch (error) {
        console.error('Error loading mappings:', error);
    }
}

function renderMappings() {
    const filterTeacher = document.getElementById('filterMapTeacher').value;
    const filterSubject = document.getElementById('filterMapSubject').value;
    const filterClass = document.getElementById('filterMapClass').value;
    
    let filtered = allMappings.filter(m => {
        if (filterTeacher && m.teacherEmail !== filterTeacher) return false;
        if (filterSubject && m.subjectCode !== filterSubject) return false;
        if (filterClass && !m.classSections?.includes(filterClass)) return false;
        return true;
    });
    
    const container = document.getElementById('mappingsGrid');
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-12">
                <div class="empty-state">
                    <i class="bi bi-diagram-3" style="font-size: 3rem;"></i>
                    <p class="mt-3">No mappings found for this academic year</p>
                    <button class="btn btn-primary btn-sm mt-2" onclick="openMappingModal()">
                        <i class="bi bi-plus-lg me-2"></i>Create First Mapping
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(m => {
        const teacher = allTeachers.find(t => t.email === m.teacherEmail);
        const subject = allSubjects.find(s => s.code === m.subjectCode);
        
        // Handle class sections - could be IDs, names, or the class name from timetable
        let classDisplay = '-';
        if (m.classSections && m.classSections.length > 0) {
            const classNames = m.classSections.map(cs => {
                if (!cs) return 'Unknown';
                // Try to find by ID first
                let csData = allClassSections.find(c => c.id === cs);
                // If not found by ID, try matching by fullName or grade-section combo
                if (!csData) {
                    csData = allClassSections.find(c => 
                        c.fullName === cs || 
                        `${c.grade}-${c.section}` === cs ||
                        `${c.grade}-${c.section}` === cs.replace('Grade-', '').replace(/(I{1,3}|IV|V|VI{0,3}|IX|X)-/, (match) => {
                            const roman = { 'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5', 'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10' };
                            return roman[match.replace('-', '')] + '-';
                        })
                    );
                }
                return csData ? `${csData.grade}-${csData.section}` : (cs.substring(0, 15) + (cs.length > 15 ? '...' : ''));
            });
            classDisplay = classNames.join(', ');
        }
        
        return `
        <div class="col-md-6 col-lg-4 mb-3">
            <div class="card mapping-card h-100">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">${subject ? subject.name : m.subjectCode}</h6>
                        <span class="badge badge-active">Active</span>
                    </div>
                    <p class="card-text">
                        <i class="bi bi-person me-2 text-primary"></i>${teacher ? teacher.name : m.teacherEmail}<br>
                        <i class="bi bi-grid-3x3 me-2 text-secondary"></i>${classDisplay}<br>
                        <small class="text-muted">${m.academicYear}</small>
                    </p>
                    <div class="d-flex justify-content-end mt-3">
                        <button class="btn btn-sm btn-outline-primary btn-icon me-1" onclick="editMapping('${m.id}')" title="Edit Mapping">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteMapping('${m.id}')" title="Delete Mapping">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `}).join('');
}

function openMappingModal(mappingId = null) {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    // Reset footer to normal mode (in case we were in import mode)
    resetMappingModalFooter();
    
    document.getElementById('mappingForm').reset();
    document.getElementById('mappingId').value = '';
    document.getElementById('mapAcademicYear').value = selectedYear;
    document.getElementById('mapEffectiveFrom').value = new Date().toISOString().split('T')[0];
    
    // Populate dropdowns
    const teacherSelect = document.getElementById('mapTeacher');
    teacherSelect.innerHTML = '<option value="">Select Teacher</option>' +
        allTeachers.filter(t => t.status === 'active').map(t => 
            `<option value="${t.email}">${t.name}</option>`
        ).join('');
    
    const subjectSelect = document.getElementById('mapSubject');
    subjectSelect.innerHTML = '<option value="">Select Subject</option>' +
        allSubjects.filter(s => s.status === 'active').map(s => 
            `<option value="${s.code}">${s.name} (${s.code})</option>`
        ).join('');
    
    // Populate class sections checkboxes
    const classContainer = document.getElementById('mapClassSections');
    if (allClassSections.length === 0) {
        classContainer.innerHTML = '<div class="text-muted small">No class sections available for this year</div>';
    } else {
        classContainer.innerHTML = allClassSections.map(cs => `
            <div class="form-check">
                <input class="form-check-input" type="checkbox" value="${cs.id}" id="class_${cs.id}" name="mappingClasses">
                <label class="form-check-label" for="class_${cs.id}">
                    Grade ${cs.grade}-${cs.section}
                </label>
            </div>
        `).join('');
    }
    
    if (mappingId) {
        const mapping = allMappings.find(m => m.id === mappingId);
        if (mapping) {
            document.getElementById('mappingModalTitle').textContent = 'Edit Mapping';
            document.getElementById('mappingId').value = mapping.id;
            document.getElementById('mapTeacher').value = mapping.teacherEmail || '';
            document.getElementById('mapSubject').value = mapping.subjectCode || '';
            document.getElementById('mapEffectiveFrom').value = mapping.effectiveFrom || '';
            document.getElementById('mapNotes').value = mapping.notes || '';
            
            // Check the class section boxes
            if (mapping.classSections) {
                mapping.classSections.forEach(csId => {
                    const checkbox = document.getElementById(`class_${csId}`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }
    } else {
        document.getElementById('mappingModalTitle').textContent = 'Create Teacher-Subject Mapping';
    }
    
    mappingModal.show();
}

function editMapping(mappingId) {
    openMappingModal(mappingId);
}

async function saveMapping() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    const id = document.getElementById('mappingId').value;
    const teacherEmail = document.getElementById('mapTeacher').value;
    const subjectCode = document.getElementById('mapSubject').value;
    
    // Get selected class sections
    const selectedClasses = Array.from(document.querySelectorAll('input[name="mappingClasses"]:checked'))
        .map(cb => cb.value);
    
    if (!teacherEmail || !subjectCode || selectedClasses.length === 0) {
        alert('Please select teacher, subject, and at least one class section');
        return;
    }
    
    const teacher = allTeachers.find(t => t.email === teacherEmail);
    const subject = allSubjects.find(s => s.code === subjectCode);
    
    const data = {
        teacherEmail: teacherEmail,
        teacherName: teacher ? teacher.name : teacherEmail,
        subjectCode: subjectCode,
        subjectName: subject ? subject.name : subjectCode,
        classSections: selectedClasses,
        academicYear: selectedYear,
        effectiveFrom: document.getElementById('mapEffectiveFrom').value,
        notes: document.getElementById('mapNotes').value.trim(),
        status: 'active',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.email
    };
    
    try {
        if (id) {
            await firestore.collection('schools').doc(selectedSchool)
                .collection('teacherSubjectMappings').doc(id).update(data);
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await firestore.collection('schools').doc(selectedSchool)
                .collection('teacherSubjectMappings').add(data);
        }
        
        mappingModal.hide();
        await loadMappings();
    } catch (error) {
        console.error('Error saving mapping:', error);
        alert('Error saving mapping: ' + error.message);
    }
}

async function deleteMapping(mappingId) {
    if (!confirm('Are you sure you want to delete this mapping?')) return;
    
    try {
        // Soft delete - mark as inactive
        await firestore.collection('schools').doc(selectedSchool)
            .collection('teacherSubjectMappings').doc(mappingId).update({
                status: 'inactive',
                endedAt: firebase.firestore.FieldValue.serverTimestamp(),
                endedBy: currentUser.email
            });
        await loadMappings();
    } catch (error) {
        console.error('Error deleting mapping:', error);
        alert('Error deleting mapping: ' + error.message);
    }
}

function clearMappingFilters() {
    document.getElementById('filterMapTeacher').value = '';
    document.getElementById('filterMapSubject').value = '';
    document.getElementById('filterMapClass').value = '';
    renderMappings();
}

// Import mappings from timetable data
async function importMappingsFromTimetable() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    try {
        // First load timetable data
        const timetableData = await loadTimetableDataForImport();
        if (!timetableData) return;
        
        // Store for later use after period selection
        tempTimetableData = timetableData;
        
        // Extract unique periods from timetable
        const periods = extractPeriodsFromTimetable(timetableData);
        
        if (periods.length === 0) {
            alert('No periods found in timetable data.');
            return;
        }
        
        // Show period selection modal
        showPeriodSelectionModal(periods);
        
    } catch (error) {
        console.error('Error loading timetable for import:', error);
        alert('Error loading timetable: ' + error.message);
    }
}

// Extract unique periods from timetable with their time info
function extractPeriodsFromTimetable(timetableData) {
    const periodMap = new Map();
    
    for (const classData of Object.values(timetableData)) {
        if (!classData || !classData.days) continue;
        
        classData.days.forEach(day => {
            if (!day.periods) return;
            
            day.periods.forEach((period, index) => {
                const periodNum = period.period || period.periodNumber || (index + 1);
                const periodName = period.name || period.label || `P${periodNum}`;
                const startTime = period.startTime || period.start || '';
                const endTime = period.endTime || period.end || '';
                const key = `${periodName}`;
                
                if (!periodMap.has(key)) {
                    periodMap.set(key, {
                        name: periodName,
                        number: periodNum,
                        startTime: startTime,
                        endTime: endTime,
                        selected: true // Default to selected
                    });
                }
            });
        });
    }
    
    // Sort by period number
    return Array.from(periodMap.values()).sort((a, b) => {
        const numA = parseInt(a.number) || 0;
        const numB = parseInt(b.number) || 0;
        return numA - numB;
    });
}

// Show period selection modal
function showPeriodSelectionModal(periods) {
    selectedPeriods = periods;
    
    const container = document.getElementById('periodSelectionList');
    container.innerHTML = periods.map((p, index) => `
        <div class="form-check mb-2">
            <input class="form-check-input" type="checkbox" id="period_${index}" 
                   value="${p.name}" ${p.selected ? 'checked' : ''} 
                   onchange="updatePeriodSelection(${index}, this.checked)">
            <label class="form-check-label d-flex justify-content-between w-100" for="period_${index}">
                <span><strong>${p.name}</strong></span>
                <span class="text-muted small">
                    ${p.startTime && p.endTime ? `${p.startTime} - ${p.endTime}` : ''}
                </span>
            </label>
        </div>
    `).join('');
    
    periodSelectionModal.show();
}

// Update period selection
function updatePeriodSelection(index, checked) {
    if (selectedPeriods[index]) {
        selectedPeriods[index].selected = checked;
    }
}

// Toggle all periods
function toggleAllPeriods(selectAll) {
    selectedPeriods.forEach((p, index) => {
        p.selected = selectAll;
        const checkbox = document.getElementById(`period_${index}`);
        if (checkbox) checkbox.checked = selectAll;
    });
}

// Confirm period selection and proceed with import
async function confirmPeriodSelection() {
    periodSelectionModal.hide();
    
    const selectedPeriodNames = selectedPeriods
        .filter(p => p.selected)
        .map(p => p.name);
    
    if (selectedPeriodNames.length === 0) {
        alert('Please select at least one period to import.');
        return;
    }
    
    // Proceed with import using selected periods
    await proceedWithImport(selectedPeriodNames);
}

// Proceed with import after period selection
async function proceedWithImport(selectedPeriodNames) {
    if (!tempTimetableData) return;
    
    try {
        const timetableData = tempTimetableData;
        let importedClasses = 0;
        
        // Auto-import class sections if missing
        const classNames = Object.keys(timetableData);
        
        for (const className of classNames) {
            const parsed = parseClassName(className);
            if (!parsed.grade || !parsed.section) continue;
            
            const exists = allClassSections.some(cs => 
                cs.grade === parsed.grade && 
                cs.section?.toUpperCase() === parsed.section.toUpperCase()
            );
            
            if (!exists) {
                const classData = {
                    grade: parsed.grade,
                    section: parsed.section.toUpperCase(),
                    fullName: `${parsed.grade}-${parsed.section.toUpperCase()}`,
                    academicYear: selectedYear,
                    roomNumber: '',
                    studentCount: 0,
                    importedFromTimetable: true,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentUser.email
                };
                
                try {
                    await firestore.collection('schools').doc(selectedSchool)
                        .collection('classSections').add(classData);
                    importedClasses++;
                } catch (err) {
                    console.error('Error auto-importing class section:', err);
                }
            }
        }
        
        // Reload class sections if we imported any
        if (importedClasses > 0) {
            await loadClassSections();
        }
        
        // Extract mappings with period filtering (grouped by teacher-subject)
        const extractedMappings = extractMappingsFromTimetableWithPeriods(timetableData, selectedPeriodNames);
        
        if (extractedMappings.length === 0) {
            alert('No teacher-subject mappings found in the timetable data.');
            return;
        }
        
        // Store extracted mappings for import
        tempExtractedMappings = extractedMappings;
        
        // Show confirmation dialog with Save All or Review options
        let confirmMsg = `Found ${extractedMappings.length} teacher-subject combinations in the timetable.`;
        if (importedClasses > 0) {
            confirmMsg += `\nAlso auto-imported ${importedClasses} class sections.`;
        }
        confirmMsg += `\n\nHow would you like to import these mappings?\n\nNote: Existing mappings will not be overwritten.`;
        
        const userChoice = confirm(confirmMsg + '\n\nClick OK to Save All at once,\nClick Cancel to Review one by one.');
        
        if (userChoice) {
            // Save all at once
            await saveAllMappings();
        } else {
            // Review one by one
            currentMappingIndex = 0;
            showMappingConfirmationModal();
        }
        
    } catch (error) {
        console.error('Error importing from timetable:', error);
        alert('Error importing mappings: ' + error.message);
    }
}

// Show mapping confirmation modal with extracted data
function showMappingConfirmationModal() {
    if (!tempExtractedMappings || tempExtractedMappings.length === 0) {
        alert('No mappings to import.');
        return;
    }
    
    const mapping = tempExtractedMappings[currentMappingIndex];
    const totalMappings = tempExtractedMappings.length;
    
    // Set modal title with progress
    document.getElementById('mappingModalTitle').textContent = 
        `Import Mapping (${currentMappingIndex + 1} of ${totalMappings})`;
    
    // Set academic year
    document.getElementById('mapAcademicYear').value = selectedYear;
    document.getElementById('mapEffectiveFrom').value = new Date().toISOString().split('T')[0];
    
    // Populate teacher dropdown and pre-select
    const teacherSelect = document.getElementById('mapTeacher');
    const teacherOptions = allTeachers.filter(t => t.status === 'active').map(t => 
        `<option value="${t.email}" ${t.email === mapping.teacherEmail ? 'selected' : ''}>${t.name}</option>`
    ).join('');
    teacherSelect.innerHTML = '<option value="">Select Teacher</option>' + teacherOptions;
    
    // If teacher not found, add as option
    if (!allTeachers.some(t => t.email === mapping.teacherEmail)) {
        teacherSelect.innerHTML += `<option value="${mapping.teacherEmail}" selected>${mapping.teacherName} (${mapping.teacherEmail})</option>`;
    }
    
    // Populate subject dropdown and pre-select
    const subjectSelect = document.getElementById('mapSubject');
    const subjectOptions = allSubjects.filter(s => s.status === 'active').map(s => 
        `<option value="${s.code}" ${s.code === mapping.subjectCode ? 'selected' : ''}>${s.name} (${s.code})</option>`
    ).join('');
    subjectSelect.innerHTML = '<option value="">Select Subject</option>' + subjectOptions;
    
    // If subject not found, add as option
    if (!allSubjects.some(s => s.code === mapping.subjectCode)) {
        subjectSelect.innerHTML += `<option value="${mapping.subjectCode}" selected>${mapping.subjectName} (${mapping.subjectCode})</option>`;
    }
    
    // Populate class sections checkboxes with pre-selected from timetable
    const classContainer = document.getElementById('mapClassSections');
    const preselectedIds = new Set(mapping.classSectionIds);
    
    if (allClassSections.length === 0) {
        classContainer.innerHTML = '<div class="text-muted small">No class sections available for this year</div>';
    } else {
        classContainer.innerHTML = allClassSections.map(cs => {
            const isSelected = preselectedIds.has(cs.id);
            const isInTimetable = mapping.classSections.some(c => c.id === cs.id);
            const labelClass = isInTimetable ? 'fw-bold' : '';
            return `
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="${cs.id}" 
                           id="class_${cs.id}" name="mappingClasses" 
                           ${isSelected ? 'checked' : ''}>
                    <label class="form-check-label ${labelClass}" for="class_${cs.id}">
                        Grade ${cs.grade}-${cs.section}${isInTimetable ? ' (from timetable)' : ''}
                    </label>
                </div>
            `;
        }).join('');
    }
    
    // Clear mapping ID (this is a new mapping)
    document.getElementById('mappingId').value = '';
    
    // Add navigation buttons to modal footer
    updateMappingModalFooter();
    
    mappingModal.show();
}

// Update modal footer with navigation buttons
function updateMappingModalFooter() {
    const modalFooter = document.querySelector('#mappingModal .modal-footer');
    const totalMappings = tempExtractedMappings ? tempExtractedMappings.length : 0;
    
    // Save the original Save button
    const saveBtn = modalFooter.querySelector('#saveMappingBtn');
    if (!saveBtn) {
        // If no save button exists, create one
        const newSaveBtn = document.createElement('button');
        newSaveBtn.type = 'button';
        newSaveBtn.className = 'btn btn-primary';
        newSaveBtn.id = 'saveMappingBtn';
        newSaveBtn.textContent = 'Save & Next';
        newSaveBtn.onclick = saveMappingFromImport;
        modalFooter.appendChild(newSaveBtn);
    } else {
        saveBtn.textContent = currentMappingIndex < totalMappings - 1 ? 'Save & Next' : 'Save & Finish';
        saveBtn.onclick = saveMappingFromImport;
    }
    
    // Add Skip button if not exists
    let skipBtn = document.getElementById('skipMappingBtn');
    if (!skipBtn) {
        skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'btn btn-outline-secondary';
        skipBtn.id = 'skipMappingBtn';
        skipBtn.textContent = 'Skip';
        skipBtn.onclick = skipMapping;
        modalFooter.insertBefore(skipBtn, saveBtn);
    }
    
    // Add Cancel All button if not exists
    let cancelAllBtn = document.getElementById('cancelAllMappingsBtn');
    if (!cancelAllBtn) {
        cancelAllBtn = document.createElement('button');
        cancelAllBtn.type = 'button';
        cancelAllBtn.className = 'btn btn-outline-danger';
        cancelAllBtn.id = 'cancelAllMappingsBtn';
        cancelAllBtn.textContent = 'Cancel All';
        cancelAllBtn.onclick = cancelAllMappings;
        modalFooter.insertBefore(cancelAllBtn, skipBtn);
    }
}

// Skip current mapping and go to next
function skipMapping() {
    currentMappingIndex++;
    if (currentMappingIndex < tempExtractedMappings.length) {
        showMappingConfirmationModal();
    } else {
        finishImport();
    }
}

// Cancel all remaining mappings
function cancelAllMappings() {
    if (confirm('Are you sure you want to cancel importing the remaining mappings?')) {
        tempExtractedMappings = null;
        currentMappingIndex = 0;
        mappingModal.hide();
        resetMappingModalFooter();
    }
}

// Reset modal footer to original state
function resetMappingModalFooter() {
    const modalFooter = document.querySelector('#mappingModal .modal-footer');
    
    // Remove extra buttons
    const skipBtn = document.getElementById('skipMappingBtn');
    const cancelAllBtn = document.getElementById('cancelAllMappingsBtn');
    if (skipBtn) skipBtn.remove();
    if (cancelAllBtn) cancelAllBtn.remove();
    
    // Reset save button
    const saveBtn = document.getElementById('saveMappingBtn');
    if (saveBtn) {
        saveBtn.textContent = 'Save Mapping';
        saveBtn.onclick = saveMapping;
    }
}

// Save mapping from import flow and proceed to next
async function saveMappingFromImport() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    const teacherEmail = document.getElementById('mapTeacher').value;
    const subjectCode = document.getElementById('mapSubject').value;
    
    // Get selected class sections
    const selectedClasses = Array.from(document.querySelectorAll('input[name="mappingClasses"]:checked'))
        .map(cb => cb.value);
    
    if (!teacherEmail || !subjectCode || selectedClasses.length === 0) {
        alert('Please select teacher, subject, and at least one class section');
        return;
    }
    
    const teacher = allTeachers.find(t => t.email === teacherEmail);
    const subject = allSubjects.find(s => s.code === subjectCode);
    
    const data = {
        teacherEmail: teacherEmail,
        teacherName: teacher ? teacher.name : teacherEmail,
        subjectCode: subjectCode,
        subjectName: subject ? subject.name : subjectCode,
        classSections: selectedClasses,
        academicYear: selectedYear,
        effectiveFrom: document.getElementById('mapEffectiveFrom').value || new Date().toISOString().split('T')[0],
        notes: document.getElementById('mapNotes').value || `Imported from ${selectedYear} timetable`,
        status: 'active',
        importedFromTimetable: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: currentUser.email
    };
    
    try {
        await firestore.collection('schools').doc(selectedSchool)
            .collection('teacherSubjectMappings').add(data);
        
        // Move to next mapping
        currentMappingIndex++;
        
        if (currentMappingIndex < tempExtractedMappings.length) {
            showMappingConfirmationModal();
        } else {
            finishImport();
        }
        
    } catch (error) {
        console.error('Error saving mapping:', error);
        alert('Error saving mapping: ' + error.message);
    }
}

// Finish import and cleanup
async function finishImport() {
    tempExtractedMappings = null;
    currentMappingIndex = 0;
    mappingModal.hide();
    resetMappingModalFooter();
    
    await loadMappings();
    alert('Import completed successfully!');
}

// Save all mappings at once without preview
async function saveAllMappings() {
    if (!tempExtractedMappings || tempExtractedMappings.length === 0) {
        alert('No mappings to import.');
        return;
    }
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const mapping of tempExtractedMappings) {
        // Check if teacher and subject exist in database
        const teacher = allTeachers.find(t => t.email === mapping.teacherEmail);
        const subject = allSubjects.find(s => s.code === mapping.subjectCode);
        
        // Skip if no class sections
        if (!mapping.classSectionIds || mapping.classSectionIds.length === 0) {
            skipped++;
            continue;
        }
        
        // Check if mapping already exists
        const exists = allMappings.some(m => 
            m.teacherEmail === mapping.teacherEmail &&
            m.subjectCode === mapping.subjectCode &&
            arraysHaveCommonElement(m.classSections, mapping.classSectionIds)
        );
        
        if (exists) {
            skipped++;
            continue;
        }
        
        // Create new mapping
        const mappingData = {
            teacherEmail: mapping.teacherEmail,
            teacherName: teacher ? teacher.name : mapping.teacherName,
            subjectCode: mapping.subjectCode,
            subjectName: subject ? subject.name : mapping.subjectName,
            classSections: mapping.classSectionIds,
            academicYear: selectedYear,
            effectiveFrom: new Date().toISOString().split('T')[0],
            notes: `Imported from ${selectedYear} timetable (batch import)`,
            status: 'active',
            importedFromTimetable: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.email
        };
        
        try {
            await firestore.collection('schools').doc(selectedSchool)
                .collection('teacherSubjectMappings').add(mappingData);
            imported++;
        } catch (err) {
            console.error('Error importing mapping:', err);
            errors++;
        }
    }
    
    // Clear temp data
    tempExtractedMappings = null;
    currentMappingIndex = 0;
    
    // Reload mappings
    await loadMappings();
    
    // Show result
    let resultMsg = `Import complete!\n\nMappings imported: ${imported}`;
    if (skipped > 0) resultMsg += `\nMappings skipped (already exist): ${skipped}`;
    if (errors > 0) resultMsg += `\nErrors: ${errors}`;
    alert(resultMsg);
}

// Helper function to check if two arrays have common elements
function arraysHaveCommonElement(arr1, arr2) {
    const set1 = new Set(arr1);
    return arr2.some(item => set1.has(item));
}

// Extract mappings from timetable data
function extractMappingsFromTimetable(timetableData) {
    const mappings = [];
    const mappingSet = new Set(); // To avoid duplicates
    
    // Roman numeral mapping
    const romanToArabic = {
        'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
        'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
    };
    
    // timetableData structure: { "1-A": { className: "1-A", days: [...] } }
    for (const [className, classData] of Object.entries(timetableData)) {
        if (!classData || !classData.days) continue;
        
        // Find class section ID - try multiple matching strategies
        let classSection = allClassSections.find(cs => 
            `${cs.grade}-${cs.section}` === className || cs.fullName === className
        );
        
        // Try matching by parsing the class name (handles "Grade-II-A" -> "2-A")
        if (!classSection) {
            const parsed = parseClassName(className);
            if (parsed.grade && parsed.section) {
                classSection = allClassSections.find(cs => 
                    cs.grade === parsed.grade && 
                    cs.section?.toUpperCase() === parsed.section.toUpperCase()
                );
            }
        }
        
        const classSectionId = classSection ? classSection.id : null;
        
        // Process each day
        classData.days.forEach(day => {
            if (!day.periods) return;
            
            day.periods.forEach(period => {
                if (!period.teacherId && !period.teacherName) return;
                if (!period.subject) return;
                
                // Determine teacher email/name
                let teacherEmail = period.teacherId || period.teacherEmail;
                let teacherName = period.teacherName || period.teacherId;
                
                // Try to find matching teacher in our database
                const teacher = allTeachers.find(t => 
                    t.email === teacherEmail || 
                    t.name === teacherName ||
                    t.email?.toLowerCase() === (teacherEmail || '').toLowerCase()
                );
                
                if (teacher) {
                    teacherEmail = teacher.email;
                    teacherName = teacher.name;
                }
                
                // Try to find matching subject
                const subject = allSubjects.find(s => 
                    s.name?.toLowerCase() === period.subject?.toLowerCase() ||
                    s.code?.toLowerCase() === period.subject?.toLowerCase()
                );
                
                const subjectCode = subject ? subject.code : period.subject;
                const subjectName = subject ? subject.name : period.subject;
                
                // Create unique key for this mapping
                const key = `${teacherEmail}|${subjectCode}|${classSectionId}`;
                
                if (!mappingSet.has(key)) {
                    mappingSet.add(key);
                    mappings.push({
                        teacherEmail: teacherEmail || teacherName,
                        teacherName: teacherName,
                        subjectCode: subjectCode,
                        subjectName: subjectName,
                        classSectionId: classSectionId,
                        className: className
                    });
                }
            });
        });
    }
    
    return mappings;
}

// Extract mappings from timetable with period filtering
// Groups by teacher-subject (1 teacher can teach 1 subject for multiple class-sections)
function extractMappingsFromTimetableWithPeriods(timetableData, selectedPeriodNames) {
    const mappingMap = new Map(); // Group by teacher-subject
    
    // Convert to Set for faster lookup
    const selectedPeriodsSet = new Set(selectedPeriodNames);
    
    for (const [className, classData] of Object.entries(timetableData)) {
        if (!classData || !classData.days) continue;
        
        // Find class section ID
        let classSection = allClassSections.find(cs => 
            `${cs.grade}-${cs.section}` === className || cs.fullName === className
        );
        
        if (!classSection) {
            const parsed = parseClassName(className);
            if (parsed.grade && parsed.section) {
                classSection = allClassSections.find(cs => 
                    cs.grade === parsed.grade && 
                    cs.section?.toUpperCase() === parsed.section.toUpperCase()
                );
            }
        }
        
        const classSectionId = classSection ? classSection.id : null;
        if (!classSectionId) continue; // Skip if no class section found
        
        // Process each day
        classData.days.forEach(day => {
            if (!day.periods) return;
            
            day.periods.forEach((period, index) => {
                // Get period name to check if it should be included
                const periodNum = period.period || period.periodNumber || (index + 1);
                const periodName = period.name || period.label || `P${periodNum}`;
                
                // Skip if this period is not selected
                if (!selectedPeriodsSet.has(periodName)) return;
                
                if (!period.teacherId && !period.teacherName) return;
                if (!period.subject) return;
                
                // Determine teacher email/name
                let teacherEmail = period.teacherId || period.teacherEmail;
                let teacherName = period.teacherName || period.teacherId;
                
                // Try to find matching teacher in our database
                const teacher = allTeachers.find(t => 
                    t.email === teacherEmail || 
                    t.name === teacherName ||
                    t.email?.toLowerCase() === (teacherEmail || '').toLowerCase()
                );
                
                if (teacher) {
                    teacherEmail = teacher.email;
                    teacherName = teacher.name;
                }
                
                // Try to find matching subject
                const subject = allSubjects.find(s => 
                    s.name?.toLowerCase() === period.subject?.toLowerCase() ||
                    s.code?.toLowerCase() === period.subject?.toLowerCase()
                );
                
                const subjectCode = subject ? subject.code : period.subject;
                const subjectName = subject ? subject.name : period.subject;
                
                // Group by teacher-subject
                const key = `${teacherEmail}|${subjectCode}`;
                
                if (!mappingMap.has(key)) {
                    mappingMap.set(key, {
                        teacherEmail: teacherEmail || teacherName,
                        teacherName: teacherName,
                        subjectCode: subjectCode,
                        subjectName: subjectName,
                        classSections: [],
                        classSectionIds: new Set()
                    });
                }
                
                const mapping = mappingMap.get(key);
                // Add class section if not already included
                if (!mapping.classSectionIds.has(classSectionId)) {
                    mapping.classSectionIds.add(classSectionId);
                    mapping.classSections.push({
                        id: classSectionId,
                        name: className,
                        grade: classSection?.grade || '',
                        section: classSection?.section || ''
                    });
                }
            });
        });
    }
    
    // Convert Map to array and convert Sets to arrays
    return Array.from(mappingMap.values()).map(m => ({
        ...m,
        classSectionIds: Array.from(m.classSectionIds)
    }));
}

// Import Teachers from timetable
async function importTeachersFromTimetable() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    try {
        const timetableData = await loadTimetableDataForImport();
        if (!timetableData) return;
        
        // Extract unique teachers
        const teachers = extractTeachersFromTimetable(timetableData);
        
        if (teachers.length === 0) {
            alert('No teachers found in timetable data.');
            return;
        }
        
        const confirmed = confirm(
            `Found ${teachers.length} unique teachers in the timetable.\n\n` +
            `Do you want to add them to the database?\n\n` +
            `Note: Teachers with matching emails will be skipped.`
        );
        
        if (!confirmed) return;
        
        let imported = 0;
        let skipped = 0;
        
        for (const teacher of teachers) {
            // Check if teacher with this email OR teacherCode already exists
            const exists = allTeachers.some(t => 
                t.email?.toLowerCase() === teacher.email?.toLowerCase() ||
                (teacher.teacherCode && t.teacherCode?.toUpperCase() === teacher.teacherCode?.toUpperCase())
            );
            
            if (exists) {
                skipped++;
                continue;
            }
            
            const teacherData = {
                name: teacher.name,
                email: teacher.email,
                teacherCode: teacher.teacherCode,
                status: 'active',
                joinDate: new Date().toISOString().split('T')[0],
                notes: `Imported from ${selectedYear} timetable`,
                importedFromTimetable: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.email
            };
            
            try {
                await firestore.collection('schools').doc(selectedSchool)
                    .collection('teachers').add(teacherData);
                imported++;
            } catch (err) {
                console.error('Error importing teacher:', err);
            }
        }
        
        alert(`Import complete!\n\nImported: ${imported}\nSkipped (already exist): ${skipped}`);
        await loadTeachers();
        
    } catch (error) {
        console.error('Error importing teachers:', error);
        alert('Error importing teachers: ' + error.message);
    }
}

// Extract teachers from timetable
function extractTeachersFromTimetable(timetableData) {
    const teacherSet = new Map(); // Use Map to store teacherCode->teacherData pairs
    
    for (const classData of Object.values(timetableData)) {
        if (!classData || !classData.days) continue;
        
        classData.days.forEach(day => {
            if (!day.periods) return;
            
            day.periods.forEach(period => {
                if (!period.teacherId && !period.teacherName) return;
                
                // Parse teacherId which can be: "T001", "T001:Name:Subject", or just a name
                let teacherCode = null;
                let name = period.teacherName;
                
                if (period.teacherId) {
                    // Check if teacherId follows format "T001:Name:Subject" or just "T001"
                    const parts = period.teacherId.split(':');
                    if (parts.length >= 1) {
                        const firstPart = parts[0].trim();
                        // Check if it looks like a teacher code (T followed by numbers)
                        if (/^T\d+$/i.test(firstPart)) {
                            teacherCode = firstPart.toUpperCase();
                            // Extract name from second part if available and no explicit teacherName
                            if (!name && parts.length >= 2) {
                                name = parts[1].trim();
                            }
                        }
                    }
                    
                    // If no code pattern found, use teacherId as name if no name provided
                    if (!name && !teacherCode) {
                        name = period.teacherId;
                    }
                }
                
                // Generate email from name if not provided
                let email = period.teacherEmail;
                if (!email && name) {
                    // Create email from name: lowercase, replace spaces with dots
                    const emailLocal = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
                    email = `${emailLocal}@school.com`;
                }
                
                // Use teacherCode or email as unique key
                const key = teacherCode || email;
                
                if (key && name && !teacherSet.has(key)) {
                    teacherSet.set(key, { name, email, teacherCode });
                }
            });
        });
    }
    
    return Array.from(teacherSet.values());
}

// Import Subjects from timetable
async function importSubjectsFromTimetable() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    try {
        const timetableData = await loadTimetableDataForImport();
        if (!timetableData) return;
        
        // Extract unique subjects
        const subjects = extractSubjectsFromTimetable(timetableData);
        
        if (subjects.length === 0) {
            alert('No subjects found in timetable data.');
            return;
        }
        
        const confirmed = confirm(
            `Found ${subjects.length} unique subjects in the timetable.\n\n` +
            `Do you want to add them to the database?\n\n` +
            `Note: Subjects with matching codes will be skipped.`
        );
        
        if (!confirmed) return;
        
        let imported = 0;
        let skipped = 0;
        
        for (const subject of subjects) {
            // Check if subject with this code already exists
            const exists = allSubjects.some(s => 
                s.code?.toLowerCase() === subject.code?.toLowerCase()
            );
            
            if (exists) {
                skipped++;
                continue;
            }
            
            const subjectData = {
                code: subject.code,
                name: subject.name,
                status: 'active',
                periodsPerWeek: 5,
                description: `Imported from ${selectedYear} timetable`,
                importedFromTimetable: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.email
            };
            
            try {
                await firestore.collection('schools').doc(selectedSchool)
                    .collection('subjects').add(subjectData);
                imported++;
            } catch (err) {
                console.error('Error importing subject:', err);
            }
        }
        
        alert(`Import complete!\n\nImported: ${imported}\nSkipped (already exist): ${skipped}`);
        await loadSubjects();
        
    } catch (error) {
        console.error('Error importing subjects:', error);
        alert('Error importing subjects: ' + error.message);
    }
}

// Extract subjects from timetable
function extractSubjectsFromTimetable(timetableData) {
    const subjectSet = new Map();
    
    for (const classData of Object.values(timetableData)) {
        if (!classData || !classData.days) continue;
        
        classData.days.forEach(day => {
            if (!day.periods) return;
            
            day.periods.forEach(period => {
                if (!period.subject) return;
                
                // Generate code from subject name (uppercase, first 5 chars + numbers if duplicate)
                let code = period.subject.toUpperCase().replace(/\s+/g, '').substring(0, 6);
                
                // Make unique if needed
                let uniqueCode = code;
                let counter = 1;
                while (subjectSet.has(uniqueCode) && subjectSet.get(uniqueCode).name !== period.subject) {
                    uniqueCode = `${code}${counter}`;
                    counter++;
                }
                
                if (!subjectSet.has(uniqueCode)) {
                    subjectSet.set(uniqueCode, { code: uniqueCode, name: period.subject });
                }
            });
        });
    }
    
    return Array.from(subjectSet.values());
}

// Import Class Sections from timetable
async function importClassSectionsFromTimetable() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    try {
        const timetableData = await loadTimetableDataForImport();
        if (!timetableData) return;
        
        // Extract unique class sections
        const classNames = Object.keys(timetableData);
        
        if (classNames.length === 0) {
            alert('No class sections found in timetable data.');
            return;
        }
        
        const confirmed = confirm(
            `Found ${classNames.length} class sections in the timetable.\n\n` +
            `Do you want to add them to the database?\n\n` +
            `Note: Class sections that already exist for this year will be skipped.`
        );
        
        if (!confirmed) return;
        
        let imported = 0;
        let skipped = 0;
        
        for (const className of classNames) {
            // Parse class name (e.g., "1-A", "2B", "Grade 3-C")
            const parsed = parseClassName(className);
            if (!parsed.grade || !parsed.section) {
                console.warn(`Could not parse class name: ${className}`);
                continue;
            }
            
            // Check if class section already exists for this year
            const exists = allClassSections.some(cs => 
                cs.grade === parsed.grade && 
                cs.section?.toUpperCase() === parsed.section?.toUpperCase() &&
                cs.academicYear === selectedYear
            );
            
            if (exists) {
                skipped++;
                continue;
            }
            
            const classData = {
                grade: parsed.grade,
                section: parsed.section.toUpperCase(),
                fullName: `${parsed.grade}-${parsed.section.toUpperCase()}`,
                academicYear: selectedYear,
                roomNumber: '',
                studentCount: 0,
                importedFromTimetable: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: currentUser.email
            };
            
            try {
                await firestore.collection('schools').doc(selectedSchool)
                    .collection('classSections').add(classData);
                imported++;
            } catch (err) {
                console.error('Error importing class section:', err);
            }
        }
        
        alert(`Import complete!\n\nImported: ${imported}\nSkipped (already exist): ${skipped}`);
        await loadClassSections();
        
    } catch (error) {
        console.error('Error importing class sections:', error);
        alert('Error importing class sections: ' + error.message);
    }
}

// Parse class name to extract grade and section
function parseClassName(className) {
    // Roman numeral mapping
    const romanToArabic = {
        'I': '1', 'II': '2', 'III': '3', 'IV': '4', 'V': '5',
        'VI': '6', 'VII': '7', 'VIII': '8', 'IX': '9', 'X': '10'
    };
    
    // Try different patterns
    const patterns = [
        // Arabic numerals: "1-A", "2B", "3-C"
        { pattern: /^(\d+)[-\s]?(\w)$/i, isRoman: false },
        // "Grade 1-A", "Grade 2B" (with Arabic)
        { pattern: /^Grade\s*(\d+)[-\s]?(\w)$/i, isRoman: false },
        // "Class 1-A", "Class 2B" (with Arabic)
        { pattern: /^Class\s*(\d+)[-\s]?(\w)$/i, isRoman: false },
        // "Grade-I-A", "Grade-II-B" (with Roman numerals)
        { pattern: /^Grade[-\s]*(I{1,3}|IV|V|VI{0,3}|IX|X)[-\s]?(\w)$/i, isRoman: true },
        // "Class-I-A", "Class-II-B" (with Roman numerals)
        { pattern: /^Class[-\s]*(I{1,3}|IV|V|VI{0,3}|IX|X)[-\s]?(\w)$/i, isRoman: true },
        // Just Roman numerals with section: "II-A", "IV-B"
        { pattern: /^(I{1,3}|IV|V|VI{0,3}|IX|X)[-\s]?(\w)$/i, isRoman: true },
    ];
    
    for (const { pattern, isRoman } of patterns) {
        const match = className.match(pattern);
        if (match) {
            const grade = isRoman ? romanToArabic[match[1].toUpperCase()] : match[1];
            const section = match[2].toUpperCase();
            return { grade, section };
        }
    }
    
    // Fallback: split by hyphen and try to identify parts
    const parts = className.split(/[-\s]/).filter(p => p);
    if (parts.length >= 2) {
        // Try to find which part is the grade (number or Roman numeral)
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i].toUpperCase();
            
            // Check if it's a Roman numeral
            if (romanToArabic[part]) {
                const section = parts[i + 1] || parts[parts.length - 1];
                return { grade: romanToArabic[part], section: section.replace(/\d/g, '').toUpperCase() || 'A' };
            }
            
            // Check if it's a number
            const numMatch = part.match(/^(\d+)$/);
            if (numMatch) {
                const section = parts[i + 1] || parts[parts.length - 1];
                return { grade: numMatch[1], section: section.replace(/\d/g, '').toUpperCase() || 'A' };
            }
        }
    }
    
    return { grade: null, section: null };
}

// Helper: Load timetable data for import
async function loadTimetableDataForImport() {
    // Check Firestore first
    const timetableDoc = await firestore.collection('timetables')
        .doc(selectedSchool)
        .collection('years')
        .doc(selectedYear)
        .get();
    
    let timetableData = null;
    
    if (timetableDoc.exists) {
        timetableData = timetableDoc.data().timetableData;
    } else {
        // Try localStorage
        const localTimetable = localStorage.getItem('schoolTimetable');
        const localYear = localStorage.getItem('timetableAcademicYear');
        
        if (localTimetable && localYear === selectedYear) {
            timetableData = JSON.parse(localTimetable);
        }
    }
    
    if (!timetableData) {
        alert('No timetable data found for this academic year. Please upload a timetable first.');
        return null;
    }
    
    return timetableData;
}

// ============== CSV DOWNLOADS ==============

function downloadTeachersCSV() {
    if (allTeachers.length === 0) {
        alert('No teachers to download');
        return;
    }
    
    const columnDefs = [
        { key: 'name', label: 'Name', selected: true },
        { key: 'email', label: 'Email', selected: true },
        { key: 'phone', label: 'Phone', selected: true },
        { key: 'status', label: 'Status', selected: true },
        { key: 'joinDate', label: 'Join Date', selected: true },
        { key: 'notes', label: 'Notes', selected: false }
    ];
    
    showCSVColumnModal('Teachers', 'teachers', allTeachers, columnDefs, (item, col) => {
        if (col === 'notes') return (item[col] || '').replace(/,/g, ';').replace(/\n/g, ' ');
        return item[col] || '';
    });
}

function downloadSubjectsCSV() {
    if (allSubjects.length === 0) {
        alert('No subjects to download');
        return;
    }
    
    const columnDefs = [
        { key: 'code', label: 'Code', selected: true },
        { key: 'name', label: 'Name', selected: true },
        { key: 'periodsPerWeek', label: 'Periods/Week', selected: true },
        { key: 'status', label: 'Status', selected: true },
        { key: 'description', label: 'Description', selected: false }
    ];
    
    showCSVColumnModal('Subjects', 'subjects', allSubjects, columnDefs, (item, col) => {
        if (col === 'description') return (item[col] || '').replace(/,/g, ';').replace(/\n/g, ' ');
        return item[col] || '';
    });
}

function downloadClassSectionsCSV() {
    if (allClassSections.length === 0) {
        alert('No class sections to download');
        return;
    }
    
    const columnDefs = [
        { key: 'grade', label: 'Grade', selected: true },
        { key: 'section', label: 'Section', selected: true },
        { key: 'classTeacherEmail', label: 'Class Teacher Email', selected: true },
        { key: 'roomNumber', label: 'Room Number', selected: true },
        { key: 'studentCount', label: 'Student Count', selected: true },
        { key: 'academicYear', label: 'Academic Year', selected: true }
    ];
    
    showCSVColumnModal('Class Sections', 'class_sections', allClassSections, columnDefs, (item, col) => item[col] || '');
}

function downloadMappingsCSV() {
    if (allMappings.length === 0) {
        alert('No mappings to download');
        return;
    }
    
    const columnDefs = [
        { key: 'teacherName', label: 'Teacher Name', selected: true },
        { key: 'teacherEmail', label: 'Teacher Email', selected: true },
        { key: 'subjectCode', label: 'Subject Code', selected: true },
        { key: 'subjectName', label: 'Subject Name', selected: true },
        { key: 'classSections', label: 'Class Sections', selected: true, transform: (m) => {
            return (m.classSections || []).map(csId => {
                const cs = allClassSections.find(s => s.id === csId);
                return cs ? `Grade ${cs.grade}-${cs.section}` : csId;
            }).join('; ');
        }},
        { key: 'effectiveFrom', label: 'Effective From', selected: true },
        { key: 'effectiveTo', label: 'Effective To', selected: false },
        { key: 'status', label: 'Status', selected: true },
        { key: 'notes', label: 'Notes', selected: false, transform: (m) => (m.notes || '').replace(/,/g, ';').replace(/\n/g, ' ') }
    ];
    
    showCSVColumnModal('Teacher Mappings', 'teacher_mappings', allMappings, columnDefs, (item, col) => {
        const colDef = columnDefs.find(c => c.key === col);
        if (colDef && colDef.transform) {
            return colDef.transform(item);
        }
        return item[col] || '';
    });
}

function downloadCSV(filename, headers, rows) {
    // Create CSV content
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${selectedYear || 'all'}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Show CSV column selection modal
function showCSVColumnModal(title, filename, data, columnDefs, getValueFn) {
    // Store pending CSV data
    pendingCSVData = {
        filename: filename,
        data: data,
        columnDefs: columnDefs,
        getValue: getValueFn
    };
    
    // Update modal title
    document.getElementById('csvColumnModalTitle').textContent = `Select Columns - ${title}`;
    
    // Populate column checkboxes
    const container = document.getElementById('csvColumnList');
    container.innerHTML = columnDefs.map((col, index) => `
        <div class="form-check mb-2">
            <input class="form-check-input csv-column-check" type="checkbox" 
                   id="csv_col_${index}" value="${col.key}" 
                   ${col.selected ? 'checked' : ''}>
            <label class="form-check-label" for="csv_col_${index}">
                ${col.label}
            </label>
        </div>
    `).join('');
    
    // Hide error message
    document.getElementById('csvColumnError').classList.add('d-none');
    
    // Show modal
    csvColumnModal.show();
}

// Select or deselect all columns
function selectAllCSVColumns(select) {
    document.querySelectorAll('.csv-column-check').forEach(cb => {
        cb.checked = select;
    });
}

// Confirm download after column selection
function confirmCSVDownload() {
    // Get selected columns
    const selectedColumns = Array.from(document.querySelectorAll('.csv-column-check:checked'))
        .map(cb => cb.value);
    
    // Validate at least one column is selected
    if (selectedColumns.length === 0) {
        document.getElementById('csvColumnError').classList.remove('d-none');
        return;
    }
    
    // Hide error
    document.getElementById('csvColumnError').classList.add('d-none');
    
    // Build headers and rows based on selected columns
    const headers = selectedColumns.map(col => {
        const colDef = pendingCSVData.columnDefs.find(c => c.key === col);
        return colDef ? colDef.label : col;
    });
    
    const rows = pendingCSVData.data.map(item => {
        return selectedColumns.map(col => {
            return pendingCSVData.getValue(item, col);
        });
    });
    
    // Close modal
    csvColumnModal.hide();
    
    // Download CSV
    downloadCSV(pendingCSVData.filename, headers, rows);
    
    // Clear pending data
    pendingCSVData = null;
}

// ============== HISTORY ==============

async function loadHistory() {
    if (!selectedSchool) return;
    
    try {
        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('teacherHistory')
            .orderBy('date', 'desc')
            .limit(50)
            .get();
        
        allHistory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderHistory('all');
    } catch (error) {
        console.error('Error loading history:', error);
    }
}

function renderHistory(filter = 'all') {
    const container = document.getElementById('historyTimeline');
    
    let filtered = allHistory;
    if (filter !== 'all') {
        filtered = allHistory.filter(h => h.type === filter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">No history records found</div>';
        return;
    }
    
    const typeIcons = {
        'joined': 'bi-person-plus text-success',
        'left': 'bi-person-x text-danger',
        'transferred_in': 'bi-arrow-right-circle text-primary',
        'transferred_out': 'bi-arrow-left-circle text-warning',
        'promoted': 'bi-arrow-up-circle text-info',
        'retired': 'bi-person-check text-secondary'
    };
    
    container.innerHTML = filtered.map(h => `
        <div class="history-item">
            <div class="d-flex justify-content-between">
                <strong><i class="bi ${typeIcons[h.type] || 'bi-circle'} me-2"></i>${formatType(h.type)}</strong>
                <small class="text-muted">${formatDate(h.date)}</small>
            </div>
            <p class="mb-1"><strong>${h.teacherName}</strong></p>
            ${h.previousSchool ? `<p class="mb-1 small text-muted">From: ${h.previousSchool}</p>` : ''}
            ${h.nextSchool ? `<p class="mb-1 small text-muted">To: ${h.nextSchool}</p>` : ''}
            ${h.notes ? `<p class="mb-0 small">${h.notes}</p>` : ''}
            <small class="text-muted">Year: ${h.academicYear || selectedYear}</small>
        </div>
    `).join('');
}

function filterHistory(type) {
    renderHistory(type);
}

function recordChange(teacherId, teacherName) {
    document.getElementById('transferForm').reset();
    document.getElementById('transferTeacherId').value = teacherId;
    document.getElementById('transferTeacherName').value = teacherName;
    document.getElementById('transferDate').value = new Date().toISOString().split('T')[0];
    transferModal.show();
}

async function saveTransfer() {
    if (!selectedSchool || !selectedYear) {
        alert('Please select a school and academic year first');
        return;
    }
    
    const teacherId = document.getElementById('transferTeacherId').value;
    const type = document.getElementById('transferType').value;
    
    if (!type) {
        alert('Please select a change type');
        return;
    }
    
    const data = {
        teacherId: teacherId,
        teacherName: document.getElementById('transferTeacherName').value,
        type: type,
        date: document.getElementById('transferDate').value,
        previousSchool: type === 'transferred_in' ? document.getElementById('transferSchool').value : null,
        nextSchool: type === 'transferred_out' ? document.getElementById('transferSchool').value : null,
        notes: document.getElementById('transferNotes').value.trim(),
        academicYear: selectedYear,
        recordedAt: firebase.firestore.FieldValue.serverTimestamp(),
        recordedBy: currentUser.email
    };
    
    try {
        await firestore.collection('schools').doc(selectedSchool)
            .collection('teacherHistory').add(data);
        
        // Update teacher status if needed
        const teacherRef = firestore.collection('schools').doc(selectedSchool)
            .collection('teachers').doc(teacherId);
        
        if (type === 'left' || type === 'transferred_out' || type === 'retired') {
            await teacherRef.update({ status: 'inactive' });
        } else if (type === 'joined' || type === 'transferred_in') {
            await teacherRef.update({ status: 'active' });
        }
        
        transferModal.hide();
        await Promise.all([loadHistory(), loadTeachers()]);
    } catch (error) {
        console.error('Error recording change:', error);
        alert('Error recording change: ' + error.message);
    }
}

async function recordHistory(data) {
    if (!selectedSchool) return;
    
    try {
        await firestore.collection('schools').doc(selectedSchool)
            .collection('teacherHistory').add({
                ...data,
                academicYear: selectedYear,
                recordedAt: firebase.firestore.FieldValue.serverTimestamp(),
                recordedBy: currentUser.email
            });
        await loadHistory();
    } catch (error) {
        console.error('Error recording history:', error);
    }
}

// ============== HELPERS ==============

function updateStats() {
    document.getElementById('statTeachers').textContent = allTeachers.filter(t => t.status === 'active').length;
    document.getElementById('statSubjects').textContent = allSubjects.filter(s => s.status === 'active').length;
    document.getElementById('statClassSections').textContent = allClassSections.length;
    document.getElementById('statStudents').textContent = allStudents.filter(s => !s.archived).length;
    document.getElementById('statMappings').textContent = allMappings.length;
}

function updateTeacherFilterOptions() {
    // Update mapping teacher filter
    const filter = document.getElementById('filterMapTeacher');
    filter.innerHTML = '<option value="">Filter by Teacher</option>' +
        allTeachers.filter(t => t.status === 'active').map(t => 
            `<option value="${t.email}">${t.name}</option>`
        ).join('');
}

function updateSubjectFilterOptions() {
    const filter = document.getElementById('filterSubjectCode');
    filter.innerHTML = '<option value="">Filter by code</option>' +
        allSubjects.map(s => `<option value="${s.code}">${s.code}</option>`).join('');
    
    // Update mapping subject filter
    const mapFilter = document.getElementById('filterMapSubject');
    mapFilter.innerHTML = '<option value="">Filter by Subject</option>' +
        allSubjects.filter(s => s.status === 'active').map(s => 
            `<option value="${s.code}">${s.name}</option>`
        ).join('');
}

function updateMappingSubjectOptions() {
    // Handled in updateSubjectFilterOptions
}

function updateMappingClassOptions() {
    const filter = document.getElementById('filterMapClass');
    filter.innerHTML = '<option value="">Filter by Class</option>' +
        allClassSections.map(cs => 
            `<option value="${cs.id}">Grade ${cs.grade}-${cs.section}</option>`
        ).join('');
}

function setupFilterListeners() {
    // Teacher filters
    document.getElementById('filterTeacherName').addEventListener('input', renderTeachers);
    document.getElementById('filterTeacherEmail').addEventListener('input', renderTeachers);
    document.getElementById('filterTeacherStatus').addEventListener('change', renderTeachers);
    
    // Subject filters
    document.getElementById('filterSubjectName').addEventListener('input', renderSubjects);
    document.getElementById('filterSubjectCode').addEventListener('change', renderSubjects);
    
    // Class section filters
    document.getElementById('filterClassGrade').addEventListener('change', renderClassSections);
    document.getElementById('filterClassSection').addEventListener('input', renderClassSections);

    // Student filters
    document.getElementById('filterStudentSearch').addEventListener('input', renderStudents);
    document.getElementById('filterStudentSection').addEventListener('change', renderStudents);
    document.getElementById('filterStudentArchive').addEventListener('change', renderStudents);
    document.getElementById('studentSortField').addEventListener('change', renderStudents);
    document.getElementById('studentSortDirection').addEventListener('change', renderStudents);
    
    // Mapping filters
    document.getElementById('filterMapTeacher').addEventListener('change', renderMappings);
    document.getElementById('filterMapSubject').addEventListener('change', renderMappings);
    document.getElementById('filterMapClass').addEventListener('change', renderMappings);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatType(type) {
    const types = {
        'joined': 'Joined',
        'left': 'Left School',
        'transferred_in': 'Transferred In',
        'transferred_out': 'Transferred Out',
        'promoted': 'Promoted',
        'retired': 'Retired'
    };
    return types[type] || type;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function sanitizeFilenamePart(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'section';
}

// ============== NAVIGATION FROM OTHER PAGES ==============

// Check for passed parameters in URL
const urlParams = new URLSearchParams(window.location.search);
const passedSchool = urlParams.get('school');
const passedYear = urlParams.get('year');
const passedTab = urlParams.get('tab');
const passedSectionId = urlParams.get('sectionId');

if (passedSchool) {
    localStorage.setItem('selectedSchool', passedSchool);
    selectedSchool = passedSchool;
}
if (passedYear) {
    localStorage.setItem('selectedAcademicYear', passedYear);
    selectedYear = passedYear;
}

function applyURLTabParams() {
    if (passedTab) {
        const tabLink = document.querySelector(`a[href="#${passedTab}"]`);
        if (tabLink) bootstrap.Tab.getOrCreateInstance(tabLink).show();
    }
    if (passedSectionId && document.getElementById('filterStudentSection')) {
        document.getElementById('filterStudentSection').value = passedSectionId;
        renderStudents();
    }
}

// ============== SCHOOL STAFF MANAGEMENT ==============

let schoolStaff = [];
let customRoles = [];
let customRoleModal = null;
let editStaffModal = null;

// Initialize staff management when DOM loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize Bootstrap modals
    const customRoleModalEl = document.getElementById('customRoleModal');
    const editStaffModalEl = document.getElementById('editStaffModal');
    
    if (customRoleModalEl) {
        customRoleModal = new bootstrap.Modal(customRoleModalEl);
    }
    if (editStaffModalEl) {
        editStaffModal = new bootstrap.Modal(editStaffModalEl);
    }
    
    // Event listener for invite button
    const inviteBtn = document.getElementById('inviteStaffBtn');
    if (inviteBtn) {
        inviteBtn.addEventListener('click', inviteStaff);
    }
    
    // Load school staff when tab is shown
    const schoolStaffTab = document.querySelector('a[href="#schoolstaff"]');
    if (schoolStaffTab) {
        schoolStaffTab.addEventListener('shown.bs.tab', function() {
            loadSchoolStaff();
            loadCustomRoles();
        });
    }
});

// Load school staff from Firestore
async function loadSchoolStaff() {
    if (!selectedSchool) {
        document.getElementById('schoolStaffTable').innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Select school to view staff</td></tr>';
        return;
    }
    
    try {
        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('staff')
            .orderBy('invitedAt', 'desc')
            .get();
        
        schoolStaff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderSchoolStaff();
    } catch (error) {
        console.error('Error loading school staff:', error);
        document.getElementById('schoolStaffTable').innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error loading staff</td></tr>';
    }
}

// Render school staff table
function renderSchoolStaff() {
    const tbody = document.getElementById('schoolStaffTable');
    
    if (schoolStaff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No staff invited yet</td></tr>';
        return;
    }
    
    tbody.innerHTML = schoolStaff.map(staff => {
        const roleBadge = getRoleBadge(staff.role, staff.customRoleName);
        const statusBadge = staff.status === 'active' 
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-secondary">Inactive</span>';
        
        return `
            <tr>
                <td>${staff.email}</td>
                <td>${roleBadge}</td>
                <td>${statusBadge}</td>
                <td>${staff.invitedBy || '-'}</td>
                <td>${staff.invitedAt ? formatDate(staff.invitedAt.toDate()) : '-'}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary btn-icon me-1" onclick="editStaffRole('${staff.id}')" title="Edit Role">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-icon" onclick="removeStaff('${staff.id}')" title="Remove">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get role badge HTML
function getRoleBadge(role, customRoleName) {
    if (customRoleName) {
        return `<span class="badge" style="background-color: #6c757d;">${customRoleName}</span>`;
    }
    
    const badgeClasses = {
        'admin': 'bg-danger',
        'editor': 'bg-warning text-dark',
        'viewer': 'bg-info'
    };
    
    const roleLabels = {
        'admin': 'Admin',
        'editor': 'Editor',
        'viewer': 'Viewer'
    };
    
    return `<span class="badge ${badgeClasses[role] || 'bg-secondary'}">${roleLabels[role] || role}</span>`;
}

// Invite staff to school
async function inviteStaff() {
    if (!selectedSchool) {
        alert('Please select a school first');
        return;
    }
    
    const email = document.getElementById('inviteStaffEmail').value.trim();
    const role = document.getElementById('inviteStaffRole').value;
    const customRoleId = document.getElementById('inviteCustomRole').value;
    
    if (!email || !email.includes('@')) {
        alert('Please enter a valid email address');
        return;
    }
    
    // Check if staff already exists
    const exists = schoolStaff.some(s => s.email.toLowerCase() === email.toLowerCase());
    if (exists) {
        alert('This email is already invited to the school');
        return;
    }
    
    try {
        const staffData = {
            email: email.toLowerCase(),
            role: customRoleId ? null : role,
            customRoleId: customRoleId || null,
            customRoleName: customRoleId ? getCustomRoleName(customRoleId) : null,
            status: 'active',
            invitedBy: currentUser.email,
            invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('staff')
            .add(staffData);
        
        // Clear form
        document.getElementById('inviteStaffEmail').value = '';
        document.getElementById('inviteStaffRole').value = 'viewer';
        document.getElementById('inviteCustomRole').value = '';
        
        alert('Invitation sent successfully!');
        await loadSchoolStaff();
    } catch (error) {
        console.error('Error inviting staff:', error);
        alert('Failed to send invitation: ' + error.message);
    }
}

// Get custom role name by ID
function getCustomRoleName(roleId) {
    const role = customRoles.find(r => r.id === roleId);
    return role ? role.name : null;
}

// Edit staff role
function editStaffRole(staffId) {
    const staff = schoolStaff.find(s => s.id === staffId);
    if (!staff) return;
    
    document.getElementById('editStaffId').value = staffId;
    document.getElementById('editStaffEmail').value = staff.email;
    document.getElementById('editStaffCurrentRole').value = staff.customRoleName || staff.role || 'viewer';
    document.getElementById('editStaffNewRole').value = staff.role || 'viewer';
    
    // Populate custom roles dropdown
    populateEditStaffCustomRoles(staff.customRoleId);
    
    editStaffModal.show();
}

// Populate custom roles dropdown for edit staff modal
function populateEditStaffCustomRoles(selectedRoleId) {
    const select = document.getElementById('editStaffCustomRole');
    let html = '<option value="">-- No Custom Role --</option>';
    
    customRoles.forEach(role => {
        const selected = role.id === selectedRoleId ? 'selected' : '';
        html += `<option value="${role.id}" ${selected}>${role.name}</option>`;
    });
    
    select.innerHTML = html;
}

// Save staff role change
async function saveStaffRoleChange() {
    const staffId = document.getElementById('editStaffId').value;
    const newRole = document.getElementById('editStaffNewRole').value;
    const customRoleId = document.getElementById('editStaffCustomRole').value;
    
    if (!staffId) return;
    
    try {
        const updateData = {
            role: customRoleId ? null : newRole,
            customRoleId: customRoleId || null,
            customRoleName: customRoleId ? getCustomRoleName(customRoleId) : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: currentUser.email
        };
        
        await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('staff')
            .doc(staffId)
            .update(updateData);
        
        editStaffModal.hide();
        alert('Role updated successfully!');
        await loadSchoolStaff();
    } catch (error) {
        console.error('Error updating staff role:', error);
        alert('Failed to update role: ' + error.message);
    }
}

// Remove staff from school
async function removeStaff(staffId) {
    if (!confirm('Are you sure you want to remove this staff member?')) {
        return;
    }
    
    try {
        await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('staff')
            .doc(staffId)
            .delete();
        
        alert('Staff member removed successfully!');
        await loadSchoolStaff();
    } catch (error) {
        console.error('Error removing staff:', error);
        alert('Failed to remove staff: ' + error.message);
    }
}

// ============== CUSTOM ROLES MANAGEMENT ==============

// Load custom roles from Firestore
async function loadCustomRoles() {
    if (!selectedSchool) {
        document.getElementById('customRolesTable').innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Select school to view roles</td></tr>';
        return;
    }
    
    try {
        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('customRoles')
            .orderBy('createdAt', 'desc')
            .get();
        
        customRoles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Count users per role
        customRoles.forEach(role => {
            role.userCount = schoolStaff.filter(s => s.customRoleId === role.id).length;
        });
        
        renderCustomRoles();
        populateInviteCustomRoles();
    } catch (error) {
        console.error('Error loading custom roles:', error);
        document.getElementById('customRolesTable').innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error loading roles</td></tr>';
    }
}

// Render custom roles table
function renderCustomRoles() {
    const tbody = document.getElementById('customRolesTable');
    
    if (customRoles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No custom roles created yet. Click "Create Role" to add one.</td></tr>';
        return;
    }
    
    tbody.innerHTML = customRoles.map(role => {
        const permCount = role.permissions ? role.permissions.length : 0;
        return `
            <tr>
                <td><strong>${role.name}</strong></td>
                <td>${role.description || '-'}</td>
                <td><span class="badge bg-primary">${permCount} permissions</span></td>
                <td>${role.userCount || 0} users</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary btn-icon me-1" onclick="editCustomRole('${role.id}')" title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-icon" onclick="deleteCustomRole('${role.id}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Populate custom roles dropdown in invite form
function populateInviteCustomRoles() {
    const select = document.getElementById('inviteCustomRole');
    let html = '<option value="">-- Use Standard Role --</option>';
    
    customRoles.forEach(role => {
        html += `<option value="${role.id}">${role.name}</option>`;
    });
    
    select.innerHTML = html;
}

// Open custom role modal (create or edit)
function openRoleModal(roleId = null) {
    document.getElementById('customRoleForm').reset();
    document.getElementById('customRoleId').value = '';
    
    if (roleId) {
        const role = customRoles.find(r => r.id === roleId);
        if (role) {
            document.getElementById('customRoleModalTitle').textContent = 'Edit Custom Role';
            document.getElementById('customRoleId').value = role.id;
            document.getElementById('customRoleName').value = role.name;
            document.getElementById('customRoleDescription').value = role.description || '';
            
            // Check permission checkboxes
            if (role.permissions) {
                role.permissions.forEach(perm => {
                    const checkbox = document.querySelector(`input[value="${perm}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }
        }
    } else {
        document.getElementById('customRoleModalTitle').textContent = 'Create Custom Role';
    }
    
    customRoleModal.show();
}

// Edit custom role
function editCustomRole(roleId) {
    openRoleModal(roleId);
}

// Save custom role (create or update)
async function saveCustomRole() {
    const roleId = document.getElementById('customRoleId').value;
    const name = document.getElementById('customRoleName').value.trim();
    const description = document.getElementById('customRoleDescription').value.trim();
    
    if (!name) {
        alert('Role name is required');
        return;
    }
    
    // Get selected permissions
    const permissions = [];
    document.querySelectorAll('#customRoleForm input[type="checkbox"]:checked').forEach(cb => {
        permissions.push(cb.value);
    });
    
    if (permissions.length === 0) {
        alert('Please select at least one permission');
        return;
    }
    
    const roleData = {
        name,
        description,
        permissions,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        if (roleId) {
            // Update existing role
            await firestore.collection('schools')
                .doc(selectedSchool)
                .collection('customRoles')
                .doc(roleId)
                .update(roleData);
        } else {
            // Create new role
            roleData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            roleData.createdBy = currentUser.email;
            
            await firestore.collection('schools')
                .doc(selectedSchool)
                .collection('customRoles')
                .add(roleData);
        }
        
        customRoleModal.hide();
        alert(roleId ? 'Role updated successfully!' : 'Role created successfully!');
        await loadCustomRoles();
    } catch (error) {
        console.error('Error saving custom role:', error);
        alert('Failed to save role: ' + error.message);
    }
}

// Delete custom role
async function deleteCustomRole(roleId) {
    // Check if role is in use
    const usersWithRole = schoolStaff.filter(s => s.customRoleId === roleId);
    if (usersWithRole.length > 0) {
        alert(`Cannot delete this role. It is assigned to ${usersWithRole.length} staff member(s). Please reassign them first.`);
        return;
    }
    
    if (!confirm('Are you sure you want to delete this custom role?')) {
        return;
    }
    
    try {
        await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('customRoles')
            .doc(roleId)
            .delete();
        
        alert('Role deleted successfully!');
        await loadCustomRoles();
    } catch (error) {
        console.error('Error deleting custom role:', error);
        alert('Failed to delete role: ' + error.message);
    }
}
