document.addEventListener('DOMContentLoaded', () => {
  fetch('/stats').then(r=>r.json()).then(d=>{
    document.querySelectorAll('.stats h2')[0].textContent=d.users+'+';
    document.querySelectorAll('.stats h2')[1].textContent=d.active;
    document.querySelectorAll('.stats h2')[2].textContent=d.projects+'+';
  }).catch(()=>null);
});
