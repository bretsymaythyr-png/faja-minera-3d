(function (root) {
  'use strict';
  // Renderizado por software para equipos en los que WebGL no está disponible.
  root.createSoftware3D = function (T) {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
    let width = 1, height = 1, ratio = 1;
    const viewProjection = new T.Matrix4(), modelProjection = new T.Matrix4(), v = new T.Vector3(), cameraPoint = new T.Vector3();
    const light = new T.Vector3(-.35,.85,.4).normalize();
    const renderer = {
      domElement: canvas, shadowMap: { enabled: false }, isSoftware: true,
      setPixelRatio(value) { ratio = Math.min(value || 1, 1.5); },
      setSize(w,h) { width=w;height=h;canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio)); },
      render(scene,camera) {
        camera.updateMatrixWorld(); scene.updateMatrixWorld(true);
        ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle=scene.background?.getStyle() || '#d5ded9';ctx.fillRect(0,0,width,height);
        viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
        const faces=[], sprites=[];
        scene.traverse(mesh=>{
          if (!mesh.visible) return;
          if (mesh.isSprite && mesh.material.map?.image) { sprites.push(mesh); return; }
          if (!mesh.isMesh || !mesh.geometry?.attributes?.position || !mesh.material) return;
          const geometry=mesh.geometry, pos=geometry.attributes.position, indices=geometry.index?.array;
          const material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
          if (!material.visible) return;
          modelProjection.multiplyMatrices(viewProjection,mesh.matrixWorld);
          const e=modelProjection.elements, projected=new Float32Array(pos.count*4);
          for(let i=0;i<pos.count;i++){
            const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),w=e[3]*x+e[7]*y+e[11]*z+e[15];
            projected[i*4]=(e[0]*x+e[4]*y+e[8]*z+e[12])/w;
            projected[i*4+1]=(e[1]*x+e[5]*y+e[9]*z+e[13])/w;
            projected[i*4+2]=(e[2]*x+e[6]*y+e[10]*z+e[14])/w;
            projected[i*4+3]=w;
          }
          const count=indices?indices.length:pos.count, baseColor=mesh.userData.softwareColor ? new T.Color(mesh.userData.softwareColor) : (material.color || new T.Color('#aaaaaa'));
          const vertexColor = material.vertexColors ? geometry.attributes.color : null;
          for(let k=0;k<count;k+=3){
            const ia=indices?indices[k]:k,ib=indices?indices[k+1]:k+1,ic=indices?indices[k+2]:k+2;
            const a=ia*4,b=ib*4,c=ic*4;
            if(projected[a+3]<=0||projected[b+3]<=0||projected[c+3]<=0)continue;
            const ax=projected[a],ay=projected[a+1],bx=projected[b],by=projected[b+1],cx=projected[c],cy=projected[c+1];
            if(Math.max(ax,bx,cx)<-1.2||Math.min(ax,bx,cx)>1.2||Math.max(ay,by,cy)<-1.2||Math.min(ay,by,cy)>1.2)continue;
            const cross=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);
            if(cross<=0 && material.side!==T.DoubleSide)continue;
            const pa=new T.Vector3(pos.getX(ia),pos.getY(ia),pos.getZ(ia));
            const pb=new T.Vector3(pos.getX(ib),pos.getY(ib),pos.getZ(ib));
            const pc=new T.Vector3(pos.getX(ic),pos.getY(ic),pos.getZ(ic));
            const normal=pb.sub(pa).cross(pc.sub(pa)).transformDirection(mesh.matrixWorld);
            let shade=.57+.39*Math.max(0,normal.dot(light));
            if(material.emissive?.getHex())shade=1;
            const colorValue=baseColor.clone().multiplyScalar(shade);
            if(vertexColor){const rr=(vertexColor.getX(ia)+vertexColor.getX(ib)+vertexColor.getX(ic))/3,gg=(vertexColor.getY(ia)+vertexColor.getY(ib)+vertexColor.getY(ic))/3,bb=(vertexColor.getZ(ia)+vertexColor.getZ(ib)+vertexColor.getZ(ic))/3;colorValue.multiply(new T.Color(rr,gg,bb));}
            const color=colorValue.getStyle();
            faces.push({ax:(ax*.5+.5)*width,ay:(.5-ay*.5)*height,bx:(bx*.5+.5)*width,by:(.5-by*.5)*height,cx:(cx*.5+.5)*width,cy:(.5-cy*.5)*height,z:(projected[a+2]+projected[b+2]+projected[c+2])/3,color,layer:mesh.userData.renderLayer ?? 2});
          }
        });
        faces.sort((a,b)=>(a.layer-b.layer)||(b.z-a.z));
        for(const f of faces){ctx.fillStyle=f.color;ctx.beginPath();ctx.moveTo(f.ax,f.ay);ctx.lineTo(f.bx,f.by);ctx.lineTo(f.cx,f.cy);ctx.closePath();ctx.fill();}
        for(const sprite of sprites){
          v.setFromMatrixPosition(sprite.matrixWorld);cameraPoint.copy(v).applyMatrix4(camera.matrixWorldInverse);
          if(cameraPoint.z>=0)continue;
          v.project(camera);if(Math.abs(v.x)>1.3||Math.abs(v.y)>1.3)continue;
          const pixelsPerUnit=height/(2*Math.tan(camera.fov*Math.PI/360)*(-cameraPoint.z));
          const sw=sprite.scale.x*pixelsPerUnit, sh=sprite.scale.y*pixelsPerUnit;
          ctx.drawImage(sprite.material.map.image,(v.x*.5+.5)*width-sw/2,(.5-v.y*.5)*height-sh/2,sw,sh);
        }
      }
    };
    return renderer;
  };
})(window);
