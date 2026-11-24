import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const $ = (id) => document.getElementById(id);
const viewport = $("viewport");
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x091321);
scene.fog = new THREE.Fog(0x091321, 22, 58);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
camera.position.set(10, 10, 12);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
viewport.prepend(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.maxPolarAngle = Math.PI / 2.05;
controls.minDistance = 5;
controls.maxDistance = 28;

scene.add(new THREE.HemisphereLight(0x9dcfff, 0x172338, 2.0));
const keyLight = new THREE.DirectionalLight(0xb6e4ff, 2.2);
keyLight.position.set(7, 12, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
scene.add(keyLight);
const cyanLight = new THREE.PointLight(0x18b8d2, 18, 18);
cyanLight.position.set(-5, 4, -4);
scene.add(cyanLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x0b1727, roughness: 0.9, metalness: 0.1 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.12;
floor.receiveShadow = true;
floor.userData.isFloor = true;
scene.add(floor);

const grid = new THREE.GridHelper(30, 30, 0x23516a, 0x183149);
grid.position.y = -0.105;
scene.add(grid);

const platform = new THREE.Mesh(
  new THREE.BoxGeometry(30, 0.18, 30),
  new THREE.MeshStandardMaterial({ color: 0x101e30, roughness: 0.75, metalness: 0.2 })
);
platform.position.y = -0.23;
platform.receiveShadow = true;
scene.add(platform);

const borderMat = new THREE.MeshStandardMaterial({ color: 0x1a4d62, emissive: 0x0a2532, metalness: 0.5 });
for (const [x,z,sx,sz] of [[0,-15,30,.08],[0,15,30,.08],[-15,0,.08,30],[15,0,.08,30]]) {
  const edge = new THREE.Mesh(new THREE.BoxGeometry(sx,.08,sz), borderMat);
  edge.position.set(x,-.11,z); scene.add(edge);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const deviceMeshes = [];
const linkObjects = [];
const packets = [];
const devices = [];
const links = [];
let selectedId = null;
let currentTool = "select";
let connectFirst = null;
let nextDeviceNumber = 1;
let packetTotal = 0;
let toastTimer = null;
let pointerDown = null;

const TYPES = {
  computer: { label:"Computer", icon:"▣", color:0x43cde4, accent:0x1b8098, width:1.05, height:.72, depth:.8 },
  router: { label:"Router", icon:"⌁", color:0x69a1ff, accent:0x315fba, width:1.15, height:.38, depth:.85 },
  server: { label:"Server", icon:"▤", color:0x61e0a4, accent:0x237c59, width:.85, height:1.25, depth:.8 }
};

function makeLabel(text, color="#d9f6ff") {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0,0,512,128);
  ctx.font = "600 38px Inter, Arial";
  ctx.textAlign = "center";
  ctx.shadowColor = "#000"; ctx.shadowBlur = 8;
  ctx.fillStyle = color; ctx.fillText(text,256,76);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, transparent:true, depthWrite:false }));
  sprite.scale.set(2.3,.58,1);
  return sprite;
}

function createDeviceMesh(device) {
  const t = TYPES[device.type];
  const group = new THREE.Group();
  group.position.set(device.x, 0, device.z);
  group.userData.deviceId = device.id;

  const bodyMat = new THREE.MeshStandardMaterial({ color:t.accent, metalness:.55, roughness:.35 });
  const topMat = new THREE.MeshStandardMaterial({ color:0x1a2c40, metalness:.35, roughness:.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(t.width,t.height,t.depth), bodyMat);
  body.position.y = t.height/2 + .05;
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  const top = new THREE.Mesh(new THREE.BoxGeometry(t.width*.88,.055,t.depth*.86), topMat);
  top.position.set(0,t.height+.08,0); group.add(top);

  if (device.type === "computer") {
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(.52,.36,.055), new THREE.MeshStandardMaterial({color:0x18394c}));
    monitor.position.set(0,t.height+.32,-.13); group.add(monitor);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(.43,.27), new THREE.MeshBasicMaterial({color:0x43d9ed}));
    screen.position.set(0,t.height+.32,-.095); group.add(screen);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(.08,.18,.08), bodyMat);
    stand.position.set(0,t.height+.12,-.13); group.add(stand);
  } else if (device.type === "router") {
    for (let i=0;i<4;i++) {
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,.34,8), topMat);
      antenna.position.set(-.42+i*.28,t.height+.24,-.27);
      group.add(antenna);
    }
    for (let i=0;i<4;i++) {
      const led = new THREE.Mesh(new THREE.SphereGeometry(.035,10,8), new THREE.MeshBasicMaterial({color:0x5af0b0}));
      led.position.set(-.32+i*.2,t.height+.12,.27); group.add(led);
    }
  } else {
    for (let i=0;i<3;i++) {
      const bay = new THREE.Mesh(new THREE.BoxGeometry(.62,.22,.035), new THREE.MeshStandardMaterial({color:0x0b1725,metalness:.2}));
      bay.position.set(0,.25+i*.29,t.depth/2+.018); group.add(bay);
      const led = new THREE.Mesh(new THREE.SphereGeometry(.025,8,8), new THREE.MeshBasicMaterial({color:0x56e0a0}));
      led.position.set(.23,.25+i*.29,t.depth/2+.045); group.add(led);
    }
  }

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(.38,.45,.045,32), new THREE.MeshStandardMaterial({color:0x12273a,emissive:0x07121d}));
  foot.position.y=.015; group.add(foot);
  const label = makeLabel(device.name, "#d8f3ff");
  label.position.set(0,t.height+1.0,0);
  group.add(label);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(t.width+0.2,t.height+1.15,t.depth+0.2), new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
  hit.position.y=(t.height+1.15)/2; hit.userData.deviceId=device.id; group.add(hit);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  scene.add(group);
  deviceMeshes.push(group);
  return group;
}

function getDevice(id) { return devices.find(d=>d.id===id); }
function getMesh(id) { return deviceMeshes.find(m=>m.userData.deviceId===id); }
function addDevice(type,x,z,custom={}) {
  const n = nextDeviceNumber++;
  const prefix = type==="computer"?"PC":type==="router"?"RTR":"SRV";
  const device = {
    id: custom.id || `NV-${String(n).padStart(3,"0")}`,
    type, name: custom.name || `${TYPES[type].label} ${String(n).padStart(2,"0")}`,
    ip: custom.ip || `192.168.1.${10+n}`,
    x, z
  };
  devices.push(device);
  createDeviceMesh(device);
  updateCounts();
  addLog(`Added <strong>${device.name}</strong> (${device.ip})`, "good");
  return device;
}

function removeMesh(id) {
  const mesh=getMesh(id);
  if (!mesh) return;
  scene.remove(mesh);
  mesh.traverse(o=>{if(o.geometry)o.geometry.dispose(); if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
  const index=deviceMeshes.indexOf(mesh); if(index>=0)deviceMeshes.splice(index,1);
}
function linkKey(a,b){return [a,b].sort().join("|");}
function addLink(a,b) {
  if(a===b){showToast("Choose two different devices");return;}
  if(!getDevice(a)||!getDevice(b)){return;}
  if(links.some(l=>linkKey(l.a,l.b)===linkKey(a,b))){showToast("Those devices are already connected");return;}
  const link={id:`L${links.length+1}`,a,b};
  links.push(link); drawLink(link); updateCounts();
  addLog(`Connected <strong>${getDevice(a).name}</strong> to <strong>${getDevice(b).name}</strong>`, "good");
}
function deviceAnchor(d) { return new THREE.Vector3(d.x,.32,d.z); }
function drawLink(link) {
  const a=getDevice(link.a), b=getDevice(link.b); if(!a||!b)return;
  const start=deviceAnchor(a), end=deviceAnchor(b);
  const mid=start.clone().add(end).multiplyScalar(.5); mid.y+=.22;
  const curve=new THREE.QuadraticBezierCurve3(start,mid,end);
  const geometry=new THREE.TubeGeometry(curve,32,.025,8,false);
  const material=new THREE.MeshBasicMaterial({color:0x287e9a,transparent:true,opacity:.88});
  const line=new THREE.Mesh(geometry,material); line.userData.linkId=link.id;
  scene.add(line); linkObjects.push(line);
  const glow=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.065,8,false),new THREE.MeshBasicMaterial({color:0x1a718b,transparent:true,opacity:.12}));
  glow.userData.linkId=link.id; scene.add(glow); linkObjects.push(glow);
}
function redrawLinks() {
  for(const obj of [...linkObjects]){scene.remove(obj);obj.geometry.dispose();obj.material.dispose();}
  linkObjects.length=0; links.forEach(drawLink);
}

function updateCounts(){
  $("deviceCount").textContent=devices.length;
  $("linkCount").textContent=links.length;
  $("packetCount").textContent=packetTotal;
  $("interfaceCount").textContent=selectedId?links.filter(l=>l.a===selectedId||l.b===selectedId).length:0;
}
function addLog(message,kind="") {
  const log=$("eventLog");
  const empty=log.querySelector(".log-empty"); if(empty)empty.remove();
  const row=document.createElement("div"); row.className=`log-entry ${kind}`;
  const time=new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
  row.innerHTML=`<span class="log-bullet">●</span><span class="log-time">${time}</span><span class="log-message">${message}</span>`;
  log.prepend(row);
  while(log.children.length>30)log.lastElementChild.remove();
}
function showToast(message){
  const el=$("toast");el.textContent=message;el.classList.add("show");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2100);
}
function setTool(tool){
  currentTool=tool;connectFirst=null;
  document.querySelectorAll(".device-option").forEach(b=>b.classList.toggle("active",b.dataset.tool===tool));
  const messages={select:"SELECT A DEVICE OR ORBIT THE LAB",computer:"CLICK AN EMPTY GRID SPACE TO PLACE A COMPUTER",router:"CLICK AN EMPTY GRID SPACE TO PLACE A ROUTER",server:"CLICK AN EMPTY GRID SPACE TO PLACE A SERVER",connect:"CLICK TWO DEVICES TO CONNECT THEM"};
  $("canvasHelp").textContent=messages[tool];
  viewport.style.cursor=tool==="select"?"grab":"crosshair";
}
function selectDevice(id){
  selectedId=id;
  const d=getDevice(id);
  $("emptyInspector").classList.toggle("hidden",!!d);
  $("deviceInspector").classList.toggle("hidden",!d);
  if(!d){updateCounts();return;}
  $("selectedType").textContent=TYPES[d.type].label.toUpperCase();
  $("selectedName").textContent=d.name;
  $("selectedIcon").textContent=TYPES[d.type].icon;
  $("deviceName").value=d.name;
  $("deviceIp").value=d.ip;
  $("interfaceCount").textContent=links.filter(l=>l.a===id||l.b===id).length;
  $("deviceId").textContent=d.id;
  populateTargets();
  const mesh=getMesh(id);
  if(mesh){mesh.traverse(o=>{if(o.isMesh && o.material && o.material.emissive){o.material.emissive.setHex(0x12313b);}});}
  updateSelectionGlow();
  updateCounts();
}
function updateSelectionGlow(){
  for(const m of deviceMeshes){
    const d=getDevice(m.userData.deviceId);
    if(!d)continue;
    const selected=d.id===selectedId;
    const foot=m.children.find(c=>c.geometry&&c.geometry.type==="CylinderGeometry");
    if(foot&&foot.material){foot.material.emissive.setHex(selected?0x15566b:0x07121d);foot.material.emissiveIntensity=selected?1.5:.5;}
  }
}
function populateTargets(){
  const select=$("packetTarget");select.innerHTML="";
  devices.filter(d=>d.id!==selectedId).forEach(d=>{
    const opt=document.createElement("option");opt.value=d.id;opt.textContent=`${d.name} (${d.ip})`;select.appendChild(opt);
  });
  if(!select.children.length){const opt=document.createElement("option");opt.textContent="Add another device first";opt.value="";select.appendChild(opt);}
}
function renameDevice(){
  const d=getDevice(selectedId);if(!d)return;
  const newName=$("deviceName").value.trim().slice(0,24);
  if(!newName){$("deviceName").value=d.name;return;}
  d.name=newName;
  const mesh=getMesh(d.id);
  if(mesh){
    const old=mesh.children.find(o=>o.isSprite);
    if(old){mesh.remove(old);old.material.map.dispose();old.material.dispose();}
    const label=makeLabel(d.name);label.position.set(0,TYPES[d.type].height+1,0);mesh.add(label);
  }
  $("selectedName").textContent=d.name;
  addLog(`Renamed device to <strong>${d.name}</strong>`);
}
function changeIp(){
  const d=getDevice(selectedId);if(!d)return;
  const ip=$("deviceIp").value.trim();
  if(!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)||ip.split(".").some(v=>+v>255)){
    showToast("Enter a valid IPv4 address");$("deviceIp").value=d.ip;return;
  }
  if(devices.some(other=>other.id!==d.id&&other.ip===ip)){showToast("That IP address is already in use");$("deviceIp").value=d.ip;return;}
  d.ip=ip;addLog(`Updated <strong>${d.name}</strong> IP to ${ip}`,"good");
}
function deleteSelected(){
  if(!selectedId)return;
  const d=getDevice(selectedId);
  removeMesh(selectedId);
  for(let i=links.length-1;i>=0;i--)if(links[i].a===selectedId||links[i].b===selectedId)links.splice(i,1);
  for(let i=packets.length-1;i>=0;i--)if(packets[i].source===selectedId||packets[i].target===selectedId){scene.remove(packets[i].mesh);packets.splice(i,1);}
  devices.splice(devices.findIndex(x=>x.id===selectedId),1);
  addLog(`Deleted <strong>${d.name}</strong>`,"warn");
  selectedId=null;selectDevice(null);redrawLinks();updateCounts();
}

function findRoute(source,target){
  const queue=[[source]];const visited=new Set([source]);
  while(queue.length){
    const path=queue.shift();const last=path[path.length-1];
    if(last===target)return path;
    for(const link of links){
      const next=link.a===last?link.b:link.b===last?link.a:null;
      if(next&&!visited.has(next)){visited.add(next);queue.push([...path,next]);}
    }
  }
  return null;
}
function sendPacket(source,target){
  const route=findRoute(source,target);
  if(!route){showToast("No route found — connect the devices first");addLog(`Packet failed: no path from <strong>${getDevice(source)?.name||source}</strong> to <strong>${getDevice(target)?.name||target}</strong>`,"warn");return;}
  const points=route.map(id=>deviceAnchor(getDevice(id)));
  const geometry=new THREE.SphereGeometry(.105,14,14);
  const material=new THREE.MeshBasicMaterial({color:0x7df6ff});
  const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  const glow=new THREE.PointLight(0x35dff2,2.5,2.8);scene.add(glow);
  packets.push({mesh,glow,points,segment:0,progress:0,speed:1.35});
  packetTotal++;updateCounts();
  addLog(`Packet sent: <strong>${getDevice(source).name}</strong> → <strong>${getDevice(target).name}</strong> (${route.length-1} hop${route.length===2?"":"s"})`,"good");
}
function sendFromInspector(){
  const target=$("packetTarget").value;
  if(!selectedId||!target){showToast("Select a source and destination");return;}
  sendPacket(selectedId,target);
}
function sendFromSelectedPair(){
  if(!selectedId||devices.length<2){showToast("Select a device and add at least one more");return;}
  populateTargets();sendFromInspector();
}

function onPointerDown(e){pointerDown={x:e.clientX,y:e.clientY};}
function onPointerUp(e){
  if(!pointerDown)return;
  const moved=Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y);pointerDown=null;
  if(moved>5)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((e.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(deviceMeshes,true);
  if(hits.length){
    let id=hits[0].object.userData.deviceId;
    let parent=hits[0].object;
    while(!id&&parent){id=parent.userData.deviceId;parent=parent.parent;}
    if(!id)return;
    if(currentTool==="connect"){
      if(!connectFirst){connectFirst=id;showToast(`First device: ${getDevice(id).name}. Choose another.`);}
      else{addLink(connectFirst,id);connectFirst=null;}
    }else{selectDevice(id);if(currentTool!=="select")setTool("select");}
    return;
  }
  if(currentTool==="select"){selectDevice(null);return;}
  const floorHits=raycaster.intersectObject(floor);
  if(!floorHits.length)return;
  const point=floorHits[0].point;
  const x=Math.round(point.x),z=Math.round(point.z);
  if(Math.abs(x)>13||Math.abs(z)>13){showToast("Stay inside the lab boundary");return;}
  if(currentTool==="computer"||currentTool==="router"||currentTool==="server"){
    const occupied=devices.some(d=>Math.abs(d.x-x)<1.15&&Math.abs(d.z-z)<1.15);
    if(occupied){showToast("That spot is too close to another device");return;}
    const d=addDevice(currentTool,x,z);selectDevice(d.id);setTool("select");
  }
}
renderer.domElement.addEventListener("pointerdown",onPointerDown);
renderer.domElement.addEventListener("pointerup",onPointerUp);

function addSampleNetwork(){
  if(devices.length){showToast("Reset the lab first to add the sample layout");return;}
  const pc1=addDevice("computer",-5,1,{name:"Workstation A",ip:"192.168.1.10"});
  const router=addDevice("router",0,0,{name:"Core Router",ip:"192.168.1.1"});
  const server=addDevice("server",5,-1,{name:"Web Server",ip:"192.168.1.20"});
  const pc2=addDevice("computer",0,5,{name:"Workstation B",ip:"192.168.1.11"});
  addLink(pc1.id,router.id);addLink(router.id,server.id);addLink(router.id,pc2.id);
  selectDevice(pc1.id);
  showToast("Sample LAN created — try sending a packet");
}
function resetLab(){
  for(const d of [...devices])removeMesh(d.id);
  devices.length=0;links.length=0;
  for(const obj of [...linkObjects]){scene.remove(obj);obj.geometry.dispose();obj.material.dispose();}
  linkObjects.length=0;
  for(const p of packets){scene.remove(p.mesh);scene.remove(p.glow);}
  packets.length=0;packetTotal=0;nextDeviceNumber=1;selectedId=null;connectFirst=null;
  selectDevice(null);updateCounts();
  $("eventLog").innerHTML='<div class="log-empty">Waiting for simulation events…</div>';
  addLog("Lab reset. Ready to build a new network.");
  showToast("Lab cleared");
}
function saveLab(){
  const data={devices,links,packetTotal,nextDeviceNumber};
  localStorage.setItem("netverse-lab-save",JSON.stringify(data));
  showToast("Lab saved in this browser");addLog("Saved current lab to local browser storage","good");
}
function loadLab(){
  const raw=localStorage.getItem("netverse-lab-save");
  if(!raw){showToast("No saved lab found");return;}
  try{
    const data=JSON.parse(raw);resetLab();
    for(const d of data.devices||[]){devices.push(d);createDeviceMesh(d);}
    links.push(...(data.links||[]));redrawLinks();
    packetTotal=data.packetTotal||0;nextDeviceNumber=data.nextDeviceNumber||devices.length+1;
    updateCounts();selectDevice(devices[0]?.id||null);
    addLog("Loaded saved lab from browser storage","good");showToast("Saved lab loaded");
  }catch{showToast("Couldn't load saved lab");}
}

document.querySelectorAll(".device-option").forEach(btn=>btn.addEventListener("click",()=>setTool(btn.dataset.tool)));
$("sendBtn").addEventListener("click",sendFromSelectedPair);
$("inspectSendBtn").addEventListener("click",sendFromInspector);
$("autoBtn").addEventListener("click",addSampleNetwork);
$("resetBtn").addEventListener("click",()=>{if(confirm("Reset the lab and remove all devices?"))resetLab();});
$("saveBtn").addEventListener("click",saveLab);
$("loadBtn").addEventListener("click",loadLab);
$("homeViewBtn").addEventListener("click",()=>{camera.position.set(10,10,12);controls.target.set(0,0,0);controls.update();});
$("deleteDeviceBtn").addEventListener("click",deleteSelected);
$("clearLogBtn").addEventListener("click",()=>$("eventLog").innerHTML='<div class="log-empty">Event log cleared.</div>');
$("deviceName").addEventListener("change",renameDevice);
$("deviceIp").addEventListener("change",changeIp);
window.addEventListener("keydown",e=>{
  if(["INPUT","SELECT","TEXTAREA"].includes(document.activeElement.tagName))return;
  const map={v:"select","1":"computer","2":"router","3":"server",c:"connect"};
  if(map[e.key.toLowerCase()])setTool(map[e.key.toLowerCase()]);
  if(e.key==="Escape"){setTool("select");selectDevice(null);}
});
function resize(){
  const w=viewport.clientWidth,h=viewport.clientHeight;
  if(!w||!h)return;
  camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);
}
window.addEventListener("resize",resize);new ResizeObserver(resize).observe(viewport);resize();

const clockStart=performance.now();
function animate(now){
  requestAnimationFrame(animate);
  const elapsed=(now-clockStart)/1000;
  $("clock").textContent=new Date().toLocaleTimeString([], {hour12:false});
  controls.update();
  for(let i=packets.length-1;i>=0;i--){
    const p=packets[i];
    p.progress+=Math.min(.05,(now-(p.last||now))/1000)*p.speed;
    p.last=now;
    if(p.segment>=p.points.length-1){
      scene.remove(p.mesh);scene.remove(p.glow);packets.splice(i,1);continue;
    }
    if(p.progress>=1){p.segment++;p.progress=0;if(p.segment>=p.points.length-1)continue;}
    const a=p.points[p.segment],b=p.points[p.segment+1];
    p.mesh.position.lerpVectors(a,b,p.progress);
    p.glow.position.copy(p.mesh.position);
  }
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
addLog("NETVERSE LAB 0.1 initialised");
addLog("Build a network or load the sample LAN");
setTool("select");
