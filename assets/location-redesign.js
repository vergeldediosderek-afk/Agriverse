/* AgriVerse visual location preview: uses existing select values; never infers exact farm coordinates. */
(function(){
  const q=id=>document.getElementById(id);
  const get=id=>{const el=q(id);return el&&el.value&&el.value!=='__other'?el.value.trim():''};
  function updateLocationPreview(){
    if(!q('screen-location'))return;
    const island=(document.querySelector('#screen-location #region-chip')?.textContent||'').split('·')[0].trim();
    const province=get('province');
    const city=get('city');
    const barangay=get('barangay');
    const landmark=get('street');
    const label=[city,province].filter(Boolean).join(', ') || province || island || 'Your location';
    const areaLabel=q('avl-location-live');
    const barangayLabel=q('avl-barangay-live');
    const subtitle=q('avl-preview-subtitle');
    if(areaLabel)areaLabel.textContent=label;
    if(barangayLabel)barangayLabel.textContent=barangay?('Barangay '+barangay):'Choose a barangay to continue';
    if(subtitle)subtitle.textContent=landmark?'Landmark noted · mark your actual farm next':'Illustration only · not your actual farm';
    const coords=q('manual-lat')?.value.trim()&&q('manual-lng')?.value.trim();
    const coordinatePill=q('avl-coordinates-step');
    if(coordinatePill)coordinatePill.classList.toggle('current',!!coords);
  }
  ['province','city','barangay','street','manual-lat','manual-lng'].forEach(id=>{
    const el=q(id);if(el){el.addEventListener('change',()=>queueMicrotask(updateLocationPreview));el.addEventListener('input',()=>queueMicrotask(updateLocationPreview))}
  });
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-island], #custom-ok, #find-address'))requestAnimationFrame(updateLocationPreview);
  });
  const section=q('screen-location');
  if(section){new MutationObserver(()=>{if(section.classList.contains('active'))updateLocationPreview()}).observe(section,{attributes:true,attributeFilter:['class']});}
  updateLocationPreview();
})();
