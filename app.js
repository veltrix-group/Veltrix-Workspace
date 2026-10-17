(() => {
  'use strict';
  const STORAGE_KEY = 'veltrix.localWorkspace.v1';
  const DEFAULT_CATEGORIES = ['Allgemein', 'Schule', 'Projekte', 'Privat', 'Arbeit'];
  const titles = {home:'Übersicht',files:'Meine Dateien',favorites:'Favoriten',categories:'Kategorien',settings:'Einstellungen'};
  const $ = id => document.getElementById(id);
  let state = loadState();
  let editingId = null;
  const nav = [...document.querySelectorAll('.nav-item')];
  const views = [...document.querySelectorAll('.view')];

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return {items:Array.isArray(parsed.items)?parsed.items:[], categories:Array.isArray(parsed.categories)&&parsed.categories.length?parsed.categories:DEFAULT_CATEGORIES};
    } catch { return {items:[], categories:DEFAULT_CATEGORIES}; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch { alert('Der Browser konnte die Workspace-Daten nicht speichern. Prüfe, ob lokale Website-Daten erlaubt sind.'); }
    renderAll();
  }
  function showView(name) {
    views.forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
    nav.forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('pageTitle').textContent = titles[name] || 'VELTRIX';
    if(name==='files') renderFiles();
    if(name==='favorites') renderFavorites();
    if(name==='categories') renderCategories();
  }
  nav.forEach(b => b.addEventListener('click', () => showView(b.dataset.view)));
  document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => showView(b.dataset.go)));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fileType = name => { const ext=(name.split('.').pop()||'').toLowerCase(); if(['pdf','doc','docx','txt','rtf','odt'].includes(ext))return 'DOC'; if(['xls','xlsx','csv'].includes(ext))return 'XLS'; if(['ppt','pptx'].includes(ext))return 'PPT'; if(['png','jpg','jpeg','gif','webp','svg'].includes(ext))return 'IMG'; if(['zip','7z','rar','tar','gz'].includes(ext))return 'ZIP'; if(['mp3','wav','mp4','mov','mkv'].includes(ext))return 'MED'; return 'FILE'; };
  function fillSelect(select, includeAll=false) {
    const current = select.value;
    select.innerHTML = (includeAll?'<option value="all">Alle Kategorien</option>':'') + state.categories.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if([...select.options].some(o=>o.value===current))select.value=current;
  }
  function addFiles(fileList) {
    const files=[...fileList]; if(!files.length)return;
    const seen=new Set(state.items.map(i=>i.name+'|'+(i.path||'')));
    let added=0;
    for(const file of files){
      const path=file.webkitRelativePath || '';
      const key=file.name+'|'+path;
      if(seen.has(key))continue;
      seen.add(key);
      state.items.unshift({id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2),name:file.name,path,size:file.size,type:file.type||'',category:state.categories[0]||'Allgemein',note:'',favorite:false,addedAt:new Date().toISOString()});
      added++;
    }
    persist(); showView('files');
    $('filePicker').value=''; $('folderPicker').value='';
    if(!added) alert('Diese Einträge sind bereits im Workspace vorhanden.');
  }
  $('addFilesBtn').addEventListener('click',()=>$('filePicker').click());
  $('addFolderBtn').addEventListener('click',()=>$('folderPicker').click());
  $('emptyAddBtn').addEventListener('click',()=>$('filePicker').click());
  $('filePicker').addEventListener('change',e=>addFiles(e.target.files));
  $('folderPicker').addEventListener('change',e=>addFiles(e.target.files));
  function itemRow(item) {
    const path=item.path ? item.path : 'Einzelne Datei';
    return `<article class="file-row"><div class="file-icon">${fileType(item.name)}</div><div class="file-main"><strong title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</strong><small>${escapeHtml(path)} · ${formatSize(item.size)} · ${escapeHtml(item.category)}</small>${item.note?`<div class="file-note">${escapeHtml(item.note)}</div>`:''}</div><div class="file-actions"><button class="icon-button ${item.favorite?'fav':''}" data-fav="${escapeHtml(item.id)}" title="Favorit umschalten" aria-label="Favorit umschalten">${item.favorite?'★':'☆'}</button><button class="icon-button" data-edit="${escapeHtml(item.id)}" title="Bearbeiten" aria-label="Eintrag bearbeiten">✎</button><button class="icon-button" data-remove="${escapeHtml(item.id)}" title="Eintrag entfernen" aria-label="Eintrag entfernen">×</button></div></article>`;
  }
  function formatSize(n){ if(!Number.isFinite(n))return 'Größe unbekannt'; if(n<1024)return n+' B'; if(n<1024*1024)return (n/1024).toFixed(1)+' KB'; if(n<1024*1024*1024)return (n/1024/1024).toFixed(1)+' MB'; return (n/1024/1024/1024).toFixed(2)+' GB'; }
  function wireRows(container) {
    container.querySelectorAll('[data-fav]').forEach(b=>b.addEventListener('click',()=>{const it=state.items.find(i=>i.id===b.dataset.fav);if(it){it.favorite=!it.favorite;persist();}}));
    container.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{const it=state.items.find(i=>i.id===b.dataset.remove);if(it&&confirm(`„${it.name}“ aus dem Workspace entfernen? Die Originaldatei wird nicht gelöscht.`)){state.items=state.items.filter(i=>i.id!==it.id);persist();}}));
    container.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.edit)));
  }
  function renderFiles() {
    fillSelect($('categoryFilter'),true);
    const q=$('searchInput').value.trim().toLocaleLowerCase('de'); const cat=$('categoryFilter').value;
    const filtered=state.items.filter(i=>(cat==='all'||i.category===cat)&&(!q||(i.name+' '+i.path+' '+i.category+' '+i.note).toLocaleLowerCase('de').includes(q)));
    $('fileList').innerHTML=filtered.map(itemRow).join(''); $('fileCount').textContent=`${filtered.length} von ${state.items.length} Einträgen`;
    $('emptyState').classList.toggle('show',state.items.length===0); $('fileList').style.display=state.items.length?'grid':'none'; wireRows($('fileList'));
  }
  function renderFavorites() {
    const list=state.items.filter(i=>i.favorite); $('favoriteList').innerHTML=list.map(itemRow).join('');
    $('favoriteEmpty').classList.toggle('show',list.length===0); $('favoriteList').style.display=list.length?'grid':'none'; wireRows($('favoriteList'));
  }
  function renderCategories() {
    $('categoryGrid').innerHTML=state.categories.map(cat=>{const count=state.items.filter(i=>i.category===cat).length;return `<button class="category-card" data-category="${escapeHtml(cat)}"><div class="cat-symbol">▦</div><h3>${escapeHtml(cat)}</h3><p>${count} ${count===1?'Eintrag':'Einträge'}</p></button>`}).join('');
    $('categoryGrid').querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{showView('files');$('categoryFilter').value=b.dataset.category;renderFiles();}));
  }
  function renderAll(){ $('homeCount').textContent=`${state.items.length} gespeicherte ${state.items.length===1?'Eintrag':'Einträge'}`; renderFiles(); renderFavorites(); renderCategories(); fillSelect($('editCategory')); }
  $('searchInput').addEventListener('input',renderFiles); $('categoryFilter').addEventListener('change',renderFiles);
  $('addCategoryBtn').addEventListener('click',()=>{const input=$('newCategory'),name=input.value.trim();if(!name)return setCategoryMessage('Bitte gib einen Kategorienamen ein.');if(state.categories.some(c=>c.toLocaleLowerCase('de')===name.toLocaleLowerCase('de')))return setCategoryMessage('Diese Kategorie gibt es bereits.');state.categories.push(name);input.value='';setCategoryMessage('Kategorie erstellt.');persist();});
  function setCategoryMessage(text){$('categoryMessage').textContent=text;}
  $('newCategory').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('addCategoryBtn').click();}});
  function openEdit(id){const item=state.items.find(i=>i.id===id);if(!item)return;editingId=id;$('editName').textContent=item.name;fillSelect($('editCategory'));$('editCategory').value=item.category;$('editNote').value=item.note||'';$('editDialog').showModal();}
  $('editForm').addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();const item=state.items.find(i=>i.id===editingId);if(item){item.category=$('editCategory').value;item.note=$('editNote').value.trim();$('editDialog').close();persist();}});
  $('clearDataBtn').addEventListener('click',()=>{if(confirm('Alle Einträge und eigenen Kategorien aus diesem Browser löschen? Die Originaldateien bleiben unverändert.')){state={items:[],categories:[...DEFAULT_CATEGORIES]};persist();showView('settings');}});
  renderAll();
})();
