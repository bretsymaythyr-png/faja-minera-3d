(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = (n, digits = 2) => Number(n).toLocaleString('es-PE', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const { ConveyorSimulation, constants: C, targetSpeed } = window.FajaPhysics;
  const compatibleMode = new URLSearchParams(window.location.search).get('compatible') === '1';
  const compatibleButton = $('compatibleMode');
  compatibleButton.textContent = compatibleMode ? 'Modo normal' : 'Modo compatible';
  compatibleButton.addEventListener('click', () => {
    const url = new URL(window.location.href);
    if (compatibleMode) url.searchParams.delete('compatible');
    else url.searchParams.set('compatible', '1');
    window.location.href = url.href;
  });
  const flowRange = $('flowRange');
  const weightInput = $('weightInput'), intervalInput = $('intervalInput');
  let sampleMass = 2000, sampleInterval = 6;
  let flow = Number(flowRange.value), running = true, simulated = 0, lastTime = null, accumulator = 0, historyTimer = 0;
  const fixed = new ConveyorSimulation(false, flow), automatic = new ConveyorSimulation(true, flow);
  let history = [{ t: 0, fixed: 0, auto: 0 }];
  let view = null;

  const displayNumber = n => Number(n).toLocaleString('es-PE', {maximumFractionDigits: 3});
  function updateFlow(syncSample = false) {
    flow = Number(flowRange.value);
    if (syncSample) {
      sampleMass = Number((flow * sampleInterval / 3.6).toFixed(3));
      weightInput.value = sampleMass; intervalInput.value = sampleInterval;
    }
    $('flowValue').textContent = displayNumber(flow);
    $('sensorStatus').textContent = `${displayNumber(sampleMass)} kg`;
    $('sensorPeriod').textContent = `Mineral durante ${displayNumber(sampleInterval)} s`;
    $('readingFeedback').textContent = `${displayNumber(sampleMass)} kg en ${displayNumber(sampleInterval)} s equivalen a ${displayNumber(flow)} t/h.`;
    $('readingFeedback').classList.remove('error');
    $('targetStatus').textContent = `${fmt(targetSpeed(flow))} m/s`;
    const pct = 100 * flow / C.maxFlow;
    flowRange.style.background = `linear-gradient(to right,#62dbc5 0%,#62dbc5 ${pct}%,#435460 ${pct}%,#435460 100%)`;
    document.querySelectorAll('[data-flow]').forEach(b => b.classList.toggle('selected', Number(b.dataset.flow) === flow));
  }
  function readingError(message) {
    $('readingFeedback').textContent = message;
    $('readingFeedback').classList.add('error');
  }
  $('weightForm').addEventListener('submit', e => {
    e.preventDefault();
    const mass = weightInput.valueAsNumber, seconds = intervalInput.valueAsNumber;
    if (!Number.isFinite(mass) || mass < 0) return readingError('Ingresa una cantidad de mineral de 0 kg o más.');
    if (!Number.isFinite(seconds) || seconds <= 0) return readingError('El tiempo debe ser mayor que cero.');
    const rate = mass / seconds * 3.6;
    if (!Number.isFinite(rate) || rate > C.maxFlow + 1e-7) return readingError('Supera la capacidad de 2 400 t/h. Reduce el mineral o aumenta el tiempo.');
    sampleMass = mass; sampleInterval = seconds;
    flowRange.value = Math.min(C.maxFlow, rate);
    updateFlow();
  });
  flowRange.addEventListener('input', () => updateFlow(true));
  document.querySelectorAll('[data-flow]').forEach(b => b.addEventListener('click', () => { flowRange.value = b.dataset.flow; updateFlow(true); }));
  $('toggleRun').addEventListener('click', () => {
    running = !running; lastTime = null;
    $('toggleRun').innerHTML = running ? '<span>Ⅱ</span> Pausar' : '<span>▶</span> Reanudar';
    $('toggleRun').setAttribute('aria-pressed', String(!running));
  });
  $('reset').addEventListener('click', () => {
    fixed.reset(flow); automatic.reset(flow); simulated = 0; accumulator = 0; historyTimer = 0; lastTime = null;
    running = true; $('toggleRun').innerHTML = '<span>Ⅱ</span> Pausar'; $('toggleRun').setAttribute('aria-pressed','false');
    history = [{ t: 0, fixed: 0, auto: 0 }];
    if (view) view.reset();
    updateReadings(); drawChart();
  });
  $('viewReset').addEventListener('click', () => view && view.resetCamera());

  function clock(seconds) {
    const m = Math.floor(seconds / 60), s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function metric(id, value, unit, digits = 2) { $(id).innerHTML = `${fmt(value, digits)} <em>${unit}</em>`; }
  function updateReadings() {
    metric('normalSpeed', fixed.speed, 'm/s'); metric('normalPower', fixed.power, 'kW', 1); metric('normalEnergy', fixed.energy, 'kWh'); metric('normalOutput', fixed.discharged, 't');
    metric('autoSpeed', automatic.speed, 'm/s'); metric('autoPower', automatic.power, 'kW', 1); metric('autoEnergy', automatic.energy, 'kWh'); metric('autoOutput', automatic.discharged, 't');
    $('normalQueue').textContent = `${fmt(fixed.queue)} t`; $('autoQueue').textContent = `${fmt(automatic.queue)} t`;
    $('normalLoad').textContent = `${fmt(fixed.mass)} t`; $('autoLoad').textContent = `${fmt(automatic.mass)} t`;
    $('freqStatus').textContent = `${fmt(60 * automatic.speed / C.maxSpeed, 0)} Hz`;
    $('timeLabel').textContent = clock(simulated);
  }
  function drawChart() {
    const canvas = $('energyChart'), bounds = canvas.getBoundingClientRect();
    if (!bounds.width) return;
    const ratio = Math.min(devicePixelRatio || 1, 2), width = bounds.width, height = bounds.height;
    canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio);
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
    const left = 42, right = 9, top = 6, bottom = 22, w = width - left - right, h = height - top - bottom;
    const data = history.slice();
    if (simulated > data[data.length - 1].t) data.push({ t: simulated, fixed: fixed.energy, auto: automatic.energy });
    const ymax = Math.max(1, ...data.map(p => Math.max(p.fixed, p.auto))) * 1.12;
    const xmax = Math.max(60, simulated);
    ctx.font = '10px system-ui'; ctx.fillStyle = '#91a6ae'; ctx.strokeStyle = '#344650'; ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = top + h * i / 3;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      ctx.fillText(fmt(ymax * (1 - i / 3), 1), 1, y + 3);
    }
    ctx.fillText('00:00', left, height - 3);
    const label = clock(simulated); ctx.fillText(label, width - right - ctx.measureText(label).width, height - 3);
    function line(key, color) {
      ctx.beginPath(); ctx.lineWidth = 2.3; ctx.strokeStyle = color;
      data.forEach((p, i) => { const x = left + w * p.t / xmax, y = top + h * (1 - p[key] / ymax); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
    }
    line('fixed', '#f6c05e'); line('auto', '#62dbc5');
  }

  function setupScene() {
    const host = $('scene3d');
    if (!window.THREE) throw new Error('No se pudo cargar la biblioteca gráfica');
    const T = window.THREE;
    const scene = new T.Scene(); scene.background = new T.Color('#dce3df'); scene.fog = new T.Fog('#dce3df', 27, 52);
    const camera = new T.PerspectiveCamera(37, 1, 0.1, 100);
    let renderer;
    if (compatibleMode) {
      renderer = window.createSoftware3D(T);
    } else {
      try { renderer = new T.WebGLRenderer({ antialias: true, alpha: false }); }
      catch (_) { renderer = window.createSoftware3D(T); }
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    scene.add(new T.HemisphereLight(0xf6fbf4, 0x737c72, 2.2));
    const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(-5, 16, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 13; sun.shadow.camera.bottom = -13; sun.shadow.bias = -0.0004; scene.add(sun);
    const material = (color, extras = {}) => new T.MeshStandardMaterial({ color, roughness: .78, metalness: .14, ...extras });
    const rockTexture = window.FAJA_ROCK_TEXTURE ? new T.TextureLoader().load(window.FAJA_ROCK_TEXTURE) : null;
    if (rockTexture) rockTexture.colorSpace = T.SRGBColorSpace;
    const mats = { floor: material('#b3aa96'), pad: material('#9e9e94'), steel: material('#536267', { metalness: .62, roughness: .43 }), edge: material('#889393', { metalness: .45 }), black: material('#20282a'), rubber: material('#242d2c'), roller: material('#4e5858', { metalness: .4 }), amber: material('#dea949'), teal: material('#3cae9d'), yellow: material('#d7aa42'), cabinet: material('#647472'),
      rock: ['#ffffff','#bfbeb9','#ded9d0','#b1b5b2','#d4cfc5'].map(c => material(c, { map: rockTexture, bumpMap: rockTexture, bumpScale: .12, vertexColors: true, metalness: 0, roughness: 1 })) };
    let activeParent = scene;
    function box(w,h,d,mat,x,y,z, parent = activeParent) { const mesh = new T.Mesh(new T.BoxGeometry(w,h,d), mat); mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; }
    const ground = box(40, .12, 30, mats.floor, 0, -.2, 0); ground.castShadow = false; ground.userData.renderLayer = 0;
    const pad = box(15, .12, 10, mats.pad, 0, -.08, 0); pad.castShadow = false; pad.userData.renderLayer = 1;
    const grid = new T.GridHelper(36, 36, '#918b7e', '#bdb2a0'); grid.position.y = -.125; grid.material.opacity = .16; grid.material.transparent = true; scene.add(grid);

    // Bancos escalonados de una explotación a cielo abierto.
    const earth=['#ad9e85','#a99a83','#b7a88f','#c2b49d'].map(c=>material(c,{roughness:1,metalness:0}));
    for(let i=0;i<4;i++){const shelf=box(36,.58,2.2,earth[i],0,.1+i*.55,-8.1-i*1.35);shelf.castShadow=false;shelf.userData.renderLayer=1;}
    // Instalaciones de proceso: muros, pórticos y señalización industrial.
    const concrete=material('#888f89',{roughness:.96,metalness:0});
    const darkSteel=material('#465256',{roughness:.65,metalness:.48});
    const wall=box(25,6,.24,concrete,0,3,-9.6); wall.castShadow=false;
    for (const x of [-11,-6,-1,4,9]) {box(.24,6.1,.35,darkSteel,x,3,-9.36);box(.38,.22,.6,darkSteel,x,.12,-9.3);}
    box(25,.23,.35,darkSteel,0,5.5,-9.3);
    for (const x of [-8.5,1.5,7]) {box(2.3,2.6,.13,material('#3d4b4c'),x,1.35,-9.36); box(.09,2.4,.1,mats.edge,x+.72,1.35,-9.22);}
    // Juntas del pavimento y marcas de circulación de seguridad.
    const seam=material('#7c817a',{roughness:1});
    for(let x=-7.5;x<=7.5;x+=2.5)box(.025,.008,9.5,seam,x,-.014,0);
    for(let z=-4.5;z<=4.5;z+=2.25)box(15,.008,.025,seam,0,-.012,z);
    for(let x=-6;x<7;x+=1.1)box(.55,.018,.055,mats.yellow,x,-.005,4.65);
    function cylinder(radius, height, mat, x,y,z, rotationX=0, rotationZ=0) { const m = new T.Mesh(new T.CylinderGeometry(radius,radius,height,16),mat); m.position.set(x,y,z); m.rotation.x=rotationX; m.rotation.z=rotationZ; m.castShadow=true; m.receiveShadow=true; activeParent.add(m); return m; }
    function sprite(text, color, x,y,z, width=2.3) {
      const can=document.createElement('canvas');can.width=512;can.height=92;const ctx=can.getContext('2d');
      ctx.fillStyle='rgba(20,34,40,.91)';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(1,4,510,82,17);else ctx.rect(1,4,510,82);ctx.fill();ctx.fillStyle=color;ctx.beginPath();ctx.arc(36,45,11,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f4f7f2';ctx.font='700 32px system-ui';ctx.textBaseline='middle';ctx.fillText(text,61,46);
      const texture=new T.CanvasTexture(can);texture.colorSpace=T.SRGBColorSpace;const s=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthTest:false}));s.position.set(x,y,z);s.scale.set(width,width*92/512,1);s.renderOrder=20;activeParent.add(s);return s;
    }
    // Rocas con geometrías irregulares y textura de piedra CC0.
    const rockGeos = Array.from({length:6},(_,j)=>{
      const geo=new T.IcosahedronGeometry(1,1),pos=geo.attributes.position, colors=[];
      for(let i=0;i<pos.count;i++){
        const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
        const wave=Math.sin(x*5.7+y*4.1+z*6.3+j*2.7)*.10+Math.sin(x*11.3-y*8.2+z*5.1+j)*.06;
        const f=.85+wave;pos.setXYZ(i,x*f*(1.02+j*.03),y*f*(.76+(j%3)*.07),z*f*(.90+(j%2)*.12));
        const grain=.76+.20*(.5+.5*Math.sin(x*12+y*9-z*15+j*4));
        colors.push(grain,grain*.99,grain*.97);
      }
      geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return geo;
    });
    function rockAt(x,y,z,size,parent=activeParent){
      const j=Math.floor(Math.random()*rockGeos.length), r=new T.Mesh(rockGeos[j],mats.rock[Math.floor(Math.random()*mats.rock.length)]);
      r.scale.set(size*(1+Math.random()*.35),size*(.8+Math.random()*.35),size*(.82+Math.random()*.25));
      r.position.set(x,y,z);r.rotation.set(Math.random()*2,Math.random()*6,Math.random()*2);r.castShadow=true;r.receiveShadow=true;
      r.userData.softwareColor=['#7a7064','#655e56','#8b7e70','#5b5a53','#918578'][Math.floor(Math.random()*5)];parent.add(r);return r;
    }
    function brace(x1,y1,x2,y2,z,mat=mats.edge,parent=activeParent){const dx=x2-x1,dy=y2-y1,b=box(Math.hypot(dx,dy),.065,.065,mat,(x1+x2)/2,(y1+y2)/2,z,parent);b.rotation.z=Math.atan2(dy,dx);return b;}
    function makeBelt(z, accent, name, dynamic) {
      const angle=C.inclineDeg*Math.PI/180, lift=.72, beltGroup=new T.Group(), previousParent=activeParent;
      beltGroup.position.y=lift; beltGroup.rotation.z=angle; scene.add(beltGroup); activeParent=beltGroup;
      const topY = 1.59;
      // Chasis, banda y soportes.
      box(10.4,.28,.13,mats.steel,0,1.26,z-.77); box(10.4,.28,.13,mats.steel,0,1.26,z+.77);
      box(9.6,.16,1.35,mats.rubber,0,topY,z); box(9.55,.12,1.24,mats.black,0,.93,z);
      for(const side of [-1,1]){const wing=box(9.35,.09,.31,mats.rubber,0,1.73,z+side*.57);wing.rotation.x=side*.30;}
      const dr1=cylinder(.30,1.43,mats.roller,-4.8,1.4,z,Math.PI/2), dr2=cylinder(.30,1.43,mats.roller,4.8,1.4,z,Math.PI/2);
      for(let i=-4;i<=4;i+=.8){cylinder(.10,.64,mats.edge,i,1.30,z,Math.PI/2);for(const side of [-1,1])cylinder(.10,.43,mats.edge,i,1.37,z+side*.46,Math.PI/2+side*.32);}
      for(const x of [-4,-2,0,2,4]) for(const dz of [-.69,.69]) {
        const beamHeight=.99, worldX=x*Math.cos(angle)-beamHeight*Math.sin(angle), worldY=lift+x*Math.sin(angle)+beamHeight*Math.cos(angle);
        box(.13,worldY,.13,mats.steel,worldX,worldY/2,z+dz,scene); box(.5,.08,.4,mats.steel,worldX,.04,z+dz,scene);
        if(dz>0) brace(worldX-.45,.08,worldX,worldY,z+dz,mats.edge,scene);
      }
      for(const side of [-1,1]){const zz=z+side*.77;box(9.7,.065,.07,mats.edge,0,.93,zz);for(let x=-4.8;x<4.6;x+=1.6){brace(x,.94,x+1.6,1.34,zz);brace(x,1.34,x+1.6,.94,zz);}}
      for(const dz of [-.76,.76]) { box(9.8,.06,.08,accent,0,1.72,z+dz); for(const x of [-4,-2,0,2,4]) box(.06,.38,.07,mats.steel,x,1.53,z+dz); }
      // Lineas de la goma para hacer visible el movimiento de la faja.
      const stripes=[];for(let i=0;i<16;i++){const mesh=box(.035,.012,1.27,mats.edge,-4.5+i*.6,1.681,z);mesh.material=mats.roller;stripes.push(mesh);}
      // Tolva y sensor en la zona de alimentación.
      const hopper=new T.Mesh(new T.ConeGeometry(1.05,1.28,4,1,true),mats.steel.clone());hopper.material.side=T.DoubleSide;hopper.position.set(-4.65,2.48,z);hopper.rotation.x=Math.PI;hopper.rotation.y=Math.PI/4;hopper.castShadow=true;activeParent.add(hopper);
      box(1.75,.09,.1,accent,-4.65,3.11,z-.88);box(1.75,.09,.1,accent,-4.65,3.11,z+.88);
      for(const dz of [-.8,.8])box(.08,.80,.08,mats.steel,-2.75,2.05,z+dz);
      box(.08,.09,1.68,mats.steel,-2.75,2.45,z);
      const lamp=new T.Mesh(new T.SphereGeometry(.1,12,12),new T.MeshStandardMaterial({color:dynamic?'#53ddc7':'#e6bf68',emissive:dynamic?'#13a895':'#c08b31',emissiveIntensity:.65}));lamp.position.set(-2.75,2.36,z);activeParent.add(lamp);
      const hopperRocks=[];for(let i=0;i<7;i++)hopperRocks.push(rockAt(-4.65+(Math.random()-.5)*.9,2.78+Math.random()*.15,z+(Math.random()-.5)*.85,.20+Math.random()*.10));
      // Guardas y detalles de inspección de la instalación.
      for(const side of [-1,1]) for(const x of [-3.8,-2.2,-.6,1,2.6,4.2]){
        box(.10,.10,.10,mats.yellow,x,1.45,z+side*.84);
      }
      box(.9,.52,.04,mats.yellow,4.7,1.45,z+1.02);
      for(let i=0;i<4;i++){const stripe=box(.07,.50,.045,mats.black,4.37+i*.21,1.45,z+1.05);stripe.rotation.z=-.5;}
      // Motor y reductora.
      cylinder(.36,.77,mats.steel,5.13,1.38,z+.42,0,Math.PI/2); box(.72,.11,.57,mats.steel,5.15,1.02,z+.42);
      for(let a=0;a<4;a++)box(.04,.5,.63,mats.edge,4.9+a*.16,1.4,z+.42);
      sprite(name,dynamic?'#62dbc5':'#f6c05e',0,3.03,z-.10,dynamic?3.65:3.1);
      // Pasarela de mantenimiento con barandas de seguridad en el lado visible.
      if(dynamic){box(8.8,.09,.48,mats.steel,0,.97,z+1.10);for(let x=-4.1;x<=4.1;x+=1.35){box(.06,.80,.06,mats.yellow,x,1.39,z+1.35);box(.38,.05,.52,mats.edge,x,.99,z+1.1);}box(8.6,.055,.055,mats.yellow,0,1.78,z+1.35);box(8.6,.05,.05,mats.yellow,0,1.43,z+1.35);}
      for(let i=0;i<10;i++)rockAt(5.15+(Math.random()-.5)*1.1,.12+Math.random()*.14,z+(Math.random()-.5)*1.1,.18+Math.random()*.16,scene);
      const rockMeshes=[];let rockPool=0, stripeOffset=0;
      activeParent=previousParent;
      return { z, stripes, dr1, dr2, rockMeshes, tick(dt,speed,admitted) {
        const shift=speed*dt*9.6/C.length; stripeOffset=(stripeOffset+shift)%9.6;
        stripes.forEach((stripe,i)=>{stripe.position.x=-4.8+((i*.6+stripeOffset)%9.6);});
        dr1.rotation.y+=speed*dt*.05;dr2.rotation.y+=speed*dt*.05;
        hopperRocks.forEach(r=>r.visible=admitted>0);
        rockPool+=admitted; while(rockPool>=1.5){rockPool-=1.5;const size=.23+Math.random()*.13;const rock=rockAt(-4.75,1.84,z+(Math.random()-.5)*.82,size,beltGroup);rock.userData.falling=false;rockMeshes.push(rock);}
        for(let i=rockMeshes.length-1;i>=0;i--){const rock=rockMeshes[i];if(!rock.userData.falling){rock.position.x+=shift;if(rock.position.x>4.77){rock.userData.falling=true;rock.userData.fallTime=0;}}else{rock.userData.fallTime+=dt;rock.position.x+=shift*.28;rock.position.y=1.84-.025*rock.userData.fallTime**2;rock.rotation.z+=dt*.14;const worldY=lift+rock.position.x*Math.sin(angle)+rock.position.y*Math.cos(angle);if(worldY<.25){rock.parent.remove(rock);rockMeshes.splice(i,1);}}}
      }, clear(){rockMeshes.forEach(r=>r.parent.remove(r));rockMeshes.length=0;rockPool=0;stripeOffset=0;} };
    }
    const belts=[makeBelt(-2.35,mats.amber,'CONVENCIONAL',false),makeBelt(2.35,mats.teal,'CONTROL AUTOMÁTICO',true)];
    // Armario del sistema de control y cableado simbólico.
    box(1.35,1.35,.55,mats.cabinet,2.35,.75,4.05);box(1.08,1.05,.04,mats.steel,2.35,.78,4.36);
    box(.58,.34,.05,mats.black,2.35,1.0,4.40);box(.42,.18,.06,mats.teal,2.35,1.01,4.44);box(.32,.23,.07,mats.edge,2.35,.56,4.42);
    sprite('PLC + VARIADOR','#62dbc5',2.35,1.83,4.06,2.35);
    const cableCurve=new T.CatmullRomCurve3([new T.Vector3(2.4,.48,3.8),new T.Vector3(3,.25,3.35),new T.Vector3(4.5,.3,3.3),new T.Vector3(5.0,2.8,2.8)]);
    scene.add(new T.Mesh(new T.TubeGeometry(cableCurve,24,.035,6,false),mats.black));
    let theta=-.32,phi=1.02,radius=17.5;
    function updateCamera(){camera.position.set(radius*Math.sin(phi)*Math.sin(theta),radius*Math.cos(phi),radius*Math.sin(phi)*Math.cos(theta));camera.lookAt(0,1.6,0);}
    function resetCamera(){theta=-.32;phi=1.02;radius=17.5;updateCamera();}
    resetCamera();let dragging=false, px=0,py=0;
    renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);});
    renderer.domElement.addEventListener('pointermove',e=>{if(!dragging)return;theta-=(e.clientX-px)*.007;phi=Math.max(.45,Math.min(1.40,phi+(e.clientY-py)*.007));px=e.clientX;py=e.clientY;updateCamera();});
    renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
    renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();radius=Math.max(10,Math.min(30,radius+e.deltaY*.015));updateCamera();},{passive:false});
    function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
    if (window.ResizeObserver) new ResizeObserver(resize).observe(host.parentElement);
    else window.addEventListener('resize', resize);
    resize();
    return { isSoftware: !!renderer.isSoftware, tick(dt,a,b){belts[0].tick(dt,fixed.speed,a.admitted);belts[1].tick(dt,automatic.speed,b.admitted);}, render(){renderer.render(scene,camera);},reset(){belts.forEach(b=>b.clear());},resetCamera };
  }
  try { view=setupScene(); } catch(error) { console.error(error); $('graphicsError').hidden=false; }
  let lastRender=0,lastReadings=0;
  function frame(now) {
    requestAnimationFrame(frame);
    if(lastTime===null)lastTime=now;
    const realDt=Math.min((now-lastTime)/1000,.12);lastTime=now;
    if(running){
      accumulator+=realDt*10;
      while(accumulator>=.5){
        const a=fixed.step(.5,flow), b=automatic.step(.5,flow);
        simulated+=.5;accumulator-=.5;historyTimer+=.5;
        if(view)view.tick(.5,a,b);
        if(historyTimer>=10){historyTimer=0;history.push({t:simulated,fixed:fixed.energy,auto:automatic.energy});if(history.length>500)history.splice(1,1);}
      }
    }
    if(now-lastReadings>150){updateReadings();drawChart();lastReadings=now;}
    if(view&&(!view.isSoftware||now-lastRender>65)){
      try { view.render(); lastRender=now; }
      catch(error) { console.error(error); view=null; $('graphicsError').hidden=false; }
    }
  }
  updateFlow();updateReadings();drawChart();requestAnimationFrame(frame);
})();
