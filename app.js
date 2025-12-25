// Obfuscated configuration
const _0x4a=['edutrack-admin','firebaseapp','AIzaSyAFpwi3k7Qth9MiqqRGKstY0Zkj_vrcdFY','193864081571','1:193864081571:web:7501afde01291f81e61f16','com','storage','app'];
const _c={a:_0x4a[2],b:_0x4a[0]+'.'+_0x4a[1]+'.'+_0x4a[5],c:_0x4a[0],d:_0x4a[0]+'.'+_0x4a[1]+_0x4a[6]+'.'+_0x4a[7],e:_0x4a[3],f:_0x4a[4]};
firebase.initializeApp({apiKey:_c.a,authDomain:_c.b,projectId:_c.c,storageBucket:_c.d,messagingSenderId:_c.e,appId:_c.f});

const _d=firebase.firestore(),_a=firebase.auth();
let _u=null,_s=null;

const _e={a:document.getElementById('auth-screen'),m:document.getElementById('main-app'),g:document.getElementById('google-signin'),o:document.getElementById('signout-btn'),u:document.getElementById('user-email'),s:document.getElementById('section-select'),t:document.getElementById('teacher-email'),b:document.getElementById('assign-btn'),r:document.getElementById('refresh-btn'),tb:document.getElementById('assignments-table')};

_a.onAuthStateChanged(async u=>{if(u){_u=u;_e.a.classList.add('d-none');_e.m.classList.remove('d-none');_e.u.textContent=u.email;await _i()}else{_u=null;_e.m.classList.add('d-none');_e.a.classList.remove('d-none')}});

_e.g.onclick=async()=>{try{const p=new firebase.auth.GoogleAuthProvider();await _a.signInWithPopup(p)}catch(e){alert('Sign in failed: '+e.message)}};

_e.o.onclick=()=>_a.signOut();

async function _i(){await _ls();await _la()}

async function _ls(){try{const snap=await _d.collection('schools').get();if(snap.empty){_e.s.innerHTML='<option value="">No schools found</option>';return}let opts='<option value="">Select a section</option>';for(const doc of snap.docs){const d=doc.data();_s=doc.id;const secs=d.sections||[];secs.forEach(s=>{opts+=`<option value="${s.sectionId}" data-name="${s.sectionName||s.sectionId}">${s.sectionName||s.sectionId} (${s.sectionId})</option>`})}_e.s.innerHTML=opts}catch(e){console.error('Load sections:',e);_e.s.innerHTML='<option value="">Error loading</option>'}}

async function _la(){try{const snap=await _d.collection('teacherAssignments').orderBy('assignedAt','desc').get();if(snap.empty){_e.tb.innerHTML='<tr><td colspan="5" class="text-center text-muted py-4">No assignments yet</td></tr>';return}let h='';snap.docs.forEach(doc=>{const d=doc.data();h+=`<tr><td>${d.sectionName||'N/A'}</td><td><code class="small">${d.sectionId}</code></td><td>${d.teacherEmail}</td><td class="small text-muted">${d.assignedBy||'N/A'}</td><td class="text-center"><button class="btn btn-sm btn-warning btn-sm-action me-1" onclick="_ed('${doc.id}','${d.teacherEmail}')"><i class="bi bi-pencil"></i></button><button class="btn btn-sm btn-danger btn-sm-action" onclick="_dl('${doc.id}')"><i class="bi bi-trash"></i></button></td></tr>`});_e.tb.innerHTML=h}catch(e){console.error('Load assignments:',e);_e.tb.innerHTML='<tr><td colspan="5" class="text-center text-danger py-4">Error loading</td></tr>'}}

_e.b.onclick=async()=>{const sid=_e.s.value,email=_e.t.value.trim();if(!sid||!email){alert('Please select section and enter email');return}if(!email.includes('@')){alert('Invalid email');return}try{const opt=_e.s.options[_e.s.selectedIndex],sname=opt.getAttribute('data-name')||opt.text;await _d.collection('teacherAssignments').add({sectionId:sid,sectionName:sname,teacherEmail:email,schoolId:_s,assignedAt:firebase.firestore.FieldValue.serverTimestamp(),assignedBy:_u.email});_e.t.value='';_e.s.value='';alert('Teacher assigned successfully!');await _la()}catch(e){alert('Failed: '+e.message)}};

_e.r.onclick=()=>_la();

window._ed=async(id,email)=>{const ne=prompt('Enter new teacher email:',email);if(!ne||ne===email)return;try{await _d.collection('teacherAssignments').doc(id).update({teacherEmail:ne,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});alert('Updated!');await _la()}catch(e){alert('Failed: '+e.message)}};

window._dl=async id=>{if(!confirm('Remove this assignment?'))return;try{await _d.collection('teacherAssignments').doc(id).delete();alert('Removed!');await _la()}catch(e){alert('Failed: '+e.message)}};
