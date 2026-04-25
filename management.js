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
let allMappings = [];
let allHistory = [];
let selectedPeriods = []; // Store selected periods for import
let tempTimetableData = null; // Store timetable data during import

// Bootstrap modals
let teacherModal, subjectModal, classSectionModal, mappingModal, transferModal, periodSelectionModal;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize modals
    teacherModal = new bootstrap.Modal(document.getElementById('teacherModal'));
    subjectModal = new bootstrap.Modal(document.getElementById('subjectModal'));
    classSectionModal = new bootstrap.Modal(document.getElementById('classSectionModal'));
    mappingModal = new bootstrap.Modal(document.getElementById('mappingModal'));
    transferModal = new bootstrap.Modal(document.getElementById('transferModal'));
    periodSelectionModal = new bootstrap.Modal(document.getElementById('periodSelectionModal'));

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
    }
}

async function loadSchoolsForNav() {
    try {
        const snapshot = await firestore.collection('schools').get();
        const select = document.getElementById('nav-school-select');
        let html = '<option value="">Select School</option>';
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            html += `<option value="${doc.id}">${data.schoolName || doc.id}</option>`;
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
    } else {
        document.getElementById('selectionAlert').style.display = 'block';
        clearAllTables();
    }
}

async function loadAllData() {
    showLoading();
    
    await Promise.all([
        loadTeachers(),
        loadSubjects(),
        loadClassSections(),
        loadMappings(),
        loadHistory()
    ]);
    
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
    document.getElementById('teachersTable').innerHTML = '<tr><td colspan="6" class="text-center text-muted">Select school and year to view teachers</td></tr>';
    document.getElementById('subjectsTable').innerHTML = '<tr><td colspan="6" class="text-center text-muted">Select school and year to view subjects</td></tr>';
    document.getElementById('classSectionsTable').innerHTML = '<tr><td colspan="7" class="text-center text-muted">Select school and year to view class sections</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No teachers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(t => `
        <tr>
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
    const data = {
        name: document.getElementById('teacherName').value.trim(),
        email: document.getElementById('teacherEmail').value.trim(),
        phone: document.getElementById('teacherPhone').value.trim(),
        joinDate: document.getElementById('teacherJoinDate').value,
        status: document.getElementById('teacherStatus').value,
        notes: document.getElementById('teacherNotes').value.trim(),
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
        const snapshot = await firestore.collection('schools')
            .doc(selectedSchool)
            .collection('classSections')
            .where('academicYear', '==', selectedYear)
            .orderBy('grade')
            .orderBy('section')
            .get();
        
        allClassSections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No class sections found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(cs => {
        const classTeacher = allTeachers.find(t => t.email === cs.classTeacherEmail);
        return `
        <tr>
            <td><strong>${cs.grade || '-'}-${cs.section || '-'}</strong></td>
            <td>Grade ${cs.grade || '-'}</td>
            <td>${cs.section || '-'}</td>
            <td>${classTeacher ? classTeacher.name : (cs.classTeacherEmail || '-')}</td>
            <td>${cs.roomNumber || '-'}</td>
            <td>${cs.studentCount || '-'}</td>
            <td>
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

function openClassSectionModal(classSectionId = null) {
    if (!selectedYear) {
        alert('Please select an academic year first');
        return;
    }
    
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
        }
    } else {
        document.getElementById('classSectionModalTitle').textContent = 'Add Class Section';
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
    
    const data = {
        grade: grade,
        section: section.toUpperCase(),
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
        
        // Extract mappings with period filtering
        const extractedMappings = extractMappingsFromTimetableWithPeriods(timetableData, selectedPeriodNames);
        
        if (extractedMappings.length === 0) {
            alert('No teacher-subject mappings found in the timetable data.');
            return;
        }
        
        // Confirm import
        let confirmMsg = `Found ${extractedMappings.length} teacher-subject-class combinations in the timetable.`;
        if (importedClasses > 0) {
            confirmMsg += `\nAlso auto-imported ${importedClasses} class sections.`;
        }
        confirmMsg += `\n\nDo you want to import these as formal mappings?\n\nNote: This will not overwrite existing mappings.`;
        
        const confirmed = confirm(confirmMsg);
        
        if (!confirmed) return;
        
        // Import mappings
        let imported = 0;
        let skipped = 0;
        
        for (const mapping of extractedMappings) {
            // Check if mapping already exists
            const exists = allMappings.some(m => 
                m.teacherEmail === mapping.teacherEmail &&
                m.subjectCode === mapping.subjectCode &&
                m.classSections.includes(mapping.classSectionId)
            );
            
            if (exists) {
                skipped++;
                continue;
            }
            
            // Create new mapping
            const mappingData = {
                teacherEmail: mapping.teacherEmail,
                teacherName: mapping.teacherName,
                subjectCode: mapping.subjectCode,
                subjectName: mapping.subjectName,
                classSections: [mapping.classSectionId],
                academicYear: selectedYear,
                effectiveFrom: new Date().toISOString().split('T')[0],
                notes: `Imported from ${selectedYear} timetable`,
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
            }
        }
        
        let alertMsg = `Import complete!\n\nMappings imported: ${imported}\nMappings skipped: ${skipped}`;
        if (importedClasses > 0) {
            alertMsg += `\nClass sections auto-imported: ${importedClasses}`;
        }
        alert(alertMsg);
        
        // Reload mappings and class sections
        await loadMappings();
        if (importedClasses > 0) {
            await loadClassSections();
        }
        
    } catch (error) {
        console.error('Error importing from timetable:', error);
        alert('Error importing mappings: ' + error.message);
    }
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
function extractMappingsFromTimetableWithPeriods(timetableData, selectedPeriodNames) {
    const mappings = [];
    const mappingSet = new Set(); // To avoid duplicates
    
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
            // Check if teacher with this email already exists
            const exists = allTeachers.some(t => 
                t.email?.toLowerCase() === teacher.email?.toLowerCase()
            );
            
            if (exists) {
                skipped++;
                continue;
            }
            
            const teacherData = {
                name: teacher.name,
                email: teacher.email,
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
    const teacherSet = new Map(); // Use Map to store name->email pairs
    
    for (const classData of Object.values(timetableData)) {
        if (!classData || !classData.days) continue;
        
        classData.days.forEach(day => {
            if (!day.periods) return;
            
            day.periods.forEach(period => {
                if (!period.teacherId && !period.teacherName) return;
                
                const name = period.teacherName || period.teacherId;
                const email = period.teacherEmail || period.teacherId;
                
                if (name && !teacherSet.has(email)) {
                    teacherSet.set(email, { name, email });
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
    
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Join Date', 'Notes'];
    const rows = allTeachers.map(t => [
        t.name || '',
        t.email || '',
        t.phone || '',
        t.status || '',
        t.joinDate || '',
        (t.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ]);
    
    downloadCSV('teachers', headers, rows);
}

function downloadSubjectsCSV() {
    if (allSubjects.length === 0) {
        alert('No subjects to download');
        return;
    }
    
    const headers = ['Code', 'Name', 'Periods/Week', 'Status', 'Description'];
    const rows = allSubjects.map(s => [
        s.code || '',
        s.name || '',
        s.periodsPerWeek || '',
        s.status || '',
        (s.description || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ]);
    
    downloadCSV('subjects', headers, rows);
}

function downloadClassSectionsCSV() {
    if (allClassSections.length === 0) {
        alert('No class sections to download');
        return;
    }
    
    const headers = ['Grade', 'Section', 'Class Teacher Email', 'Room Number', 'Student Count', 'Academic Year'];
    const rows = allClassSections.map(cs => [
        cs.grade || '',
        cs.section || '',
        cs.classTeacherEmail || '',
        cs.roomNumber || '',
        cs.studentCount || '',
        cs.academicYear || ''
    ]);
    
    downloadCSV('class_sections', headers, rows);
}

function downloadMappingsCSV() {
    if (allMappings.length === 0) {
        alert('No mappings to download');
        return;
    }
    
    const headers = ['Teacher Name', 'Teacher Email', 'Subject Code', 'Subject Name', 'Class Sections', 'Effective From', 'Effective To', 'Status', 'Notes'];
    const rows = allMappings.map(m => [
        m.teacherName || '',
        m.teacherEmail || '',
        m.subjectCode || '',
        m.subjectName || '',
        (m.classSections || []).join('; '),
        m.effectiveFrom || '',
        m.effectiveTo || '',
        m.status || '',
        (m.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ]);
    
    downloadCSV('teacher_mappings', headers, rows);
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

// ============== NAVIGATION FROM OTHER PAGES ==============

// Check for passed parameters in URL
const urlParams = new URLSearchParams(window.location.search);
const passedSchool = urlParams.get('school');
const passedYear = urlParams.get('year');

if (passedSchool) {
    localStorage.setItem('selectedSchool', passedSchool);
    selectedSchool = passedSchool;
}
if (passedYear) {
    localStorage.setItem('selectedAcademicYear', passedYear);
    selectedYear = passedYear;
}
