/* Local pixel processing for the reviewed waveform workflow.
 * No expected answer, OCR, remote request, eval, DOM or external model.
 * A candidate is an editable measurement, never a graded student answer.
 */
(function(global){
  'use strict';
  const VERSION='3.0.0-beta.1',MAX_EDGE=1600,MAX_PIXELS=2560000;
  const finite=Number.isFinite,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const median=a=>{if(!a.length)return 0;const b=a.slice().sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2;};
  const percentile=(a,p)=>{if(!a.length)return 0;const b=a.slice().sort((x,y)=>x-y);return b[Math.floor((b.length-1)*p)];};
  function checkImage(image){
    if(!image||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<8||image.height<8||image.width>MAX_EDGE||image.height>MAX_EDGE||image.width*image.height>MAX_PIXELS||!image.data||image.data.length!==image.width*image.height*4)throw Error('图像尺寸无效或过大，请缩小到1600像素以内。');
    return image;
  }
  function point(value,label){if(!value||!finite(value.x)||!finite(value.y)||Math.abs(value.x)>1e7||Math.abs(value.y)>1e7)throw Error(label+'需要有效的图像坐标。');return{x:value.x,y:value.y};}
  function calibrate(c){
    if(!c)throw Error('请先标定原点、横轴刻度点和纵轴刻度点。');
    const origin=point(c.origin,'原点'),xp=point(c.xPoint,'横轴点'),yp=point(c.yPoint,'纵轴点');
    const xv=Number(c.xValue),yv=Number(c.yValue);
    if(!finite(xv)||!finite(yv)||Math.abs(xv)<1e-9||Math.abs(yv)<1e-9||Math.abs(xv)>1e6||Math.abs(yv)>1e6)throw Error('横纵轴刻度值必须为非零有限数，可使用负刻度，绝对值不超过一百万。');
    const ex={x:(xp.x-origin.x)/xv,y:(xp.y-origin.y)/xv},ey={x:(yp.x-origin.x)/yv,y:(yp.y-origin.y)/yv};
    const lx=Math.hypot(ex.x,ex.y),ly=Math.hypot(ey.x,ey.y),det=ex.x*ey.y-ex.y*ey.x;
    if(Math.hypot(xp.x-origin.x,xp.y-origin.y)<4||Math.hypot(yp.x-origin.x,yp.y-origin.y)<4||!finite(det)||Math.abs(det)/(lx*ly)<.18)throw Error('三点几乎共线或图上刻度点间隔过小，请重新校准坐标轴。');
    return{origin,ex,ey,det,pixelToMath(p){const dx=p.x-origin.x,dy=p.y-origin.y;return{x:(dx*ey.y-dy*ey.x)/det,y:(dy*ex.x-dx*ex.y)/det};},mathToPixel(x,y){return{x:origin.x+x*ex.x+y*ey.x,y:origin.y+x*ex.y+y*ey.y};}};
  }
  function sample(image,x,y,target,offset){
    const {width:w,height:h,data}=image;
    if(x<0||y<0||x>w-1||y>h-1){target[offset]=target[offset+1]=target[offset+2]=target[offset+3]=255;return;}
    const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),dx=x-x0,dy=y-y0;
    for(let k=0;k<3;k++){
      const pixel=(px,py)=>{const i=(py*w+px)*4,a=data[i+3]/255;return data[i+k]*a+255*(1-a);};
      target[offset+k]=(pixel(x0,y0)*(1-dx)+pixel(x1,y0)*dx)*(1-dy)+(pixel(x0,y1)*(1-dx)+pixel(x1,y1)*dx)*dy;
    }target[offset+3]=255;
  }
  function rotate(image,quarterTurns=1){
    checkImage(image);if(!Number.isInteger(quarterTurns))throw Error('旋转角度须为90度的整数倍。');const q=((quarterTurns%4)+4)%4,w=q%2?image.height:image.width,h=q%2?image.width:image.height,out=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){let nx=x,ny=y;if(q===1){nx=image.height-1-y;ny=x;}else if(q===2){nx=image.width-1-x;ny=image.height-1-y;}else if(q===3){nx=y;ny=image.width-1-x;}const a=(y*image.width+x)*4,b=(ny*w+nx)*4;out.set(image.data.subarray?image.data.subarray(a,a+4):image.data.slice(a,a+4),b);}
    return{width:w,height:h,data:out};
  }
  function crop(image,box){
    checkImage(image);const x=Math.round(Number(box?.x)),y=Math.round(Number(box?.y)),w=Math.round(Number(box?.width)),h=Math.round(Number(box?.height));
    if(![x,y,w,h].every(finite)||x<0||y<0||w<8||h<8||x+w>image.width||y+h>image.height)throw Error('裁剪范围必须位于图片内，且至少8×8像素。');
    const data=new Uint8ClampedArray(w*h*4);for(let row=0;row<h;row++){const a=((y+row)*image.width+x)*4;data.set(image.data.subarray?image.data.subarray(a,a+w*4):image.data.slice(a,a+w*4),row*w*4);}return{width:w,height:h,data};
  }
  function solve(matrix,vector){
    const a=matrix.map((row,i)=>[...row,vector[i]]),n=vector.length;
    for(let col=0;col<n;col++){let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(a[row][col])>Math.abs(a[pivot][col]))pivot=row;if(Math.abs(a[pivot][col])<1e-9)throw Error('四角标定退化，无法进行透视校正。');[a[pivot],a[col]]=[a[col],a[pivot]];const s=a[col][col];for(let j=col;j<=n;j++)a[col][j]/=s;for(let row=0;row<n;row++)if(row!==col){const f=a[row][col];for(let j=col;j<=n;j++)a[row][j]-=f*a[col][j];}}
    return a.map(row=>row[n]);
  }
  function rectify(image,options={}){
    checkImage(image);if(!Array.isArray(options.corners)||options.corners.length!==4)throw Error('请按左上、右上、右下、左下选择有效绘图区四角。');const p=options.corners.map((v,i)=>point(v,'第'+(i+1)+'角'));
    if(p.some(v=>v.x<0||v.y<0||v.x>image.width-1||v.y>image.height-1))throw Error('四角必须位于原图内。');
    const cross=p.map((v,i)=>{const b=p[(i+1)%4],c=p[(i+2)%4];return(b.x-v.x)*(c.y-b.y)-(b.y-v.y)*(c.x-b.x);});
    if(cross.some(v=>Math.abs(v)<2)||!(cross.every(v=>v>0)||cross.every(v=>v<0)))throw Error('四角顺序交叉或区域过窄，请依次重新选择。');
    const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);let w=Math.round(options.width||((d(p[0],p[1])+d(p[3],p[2]))/2)),h=Math.round(options.height||((d(p[0],p[3])+d(p[1],p[2]))/2));
    if(!finite(w)||!finite(h)||w<16||h<16)throw Error('透视校正后的绘图区至少16×16像素。');const scale=Math.min(1,MAX_EDGE/w,MAX_EDGE/h,Math.sqrt(MAX_PIXELS/(w*h)));w=Math.round(w*scale);h=Math.round(h*scale);
    const dest=[{x:0,y:0},{x:w-1,y:0},{x:w-1,y:h-1},{x:0,y:h-1}],a=[],b=[];
    for(let i=0;i<4;i++){const{x,y}=dest[i],u=p[i].x,v=p[i].y;a.push([x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]);b.push(u,v);}const m=solve(a,b),data=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const den=m[6]*x+m[7]*y+1;sample(image,(m[0]*x+m[1]*y+m[2])/den,(m[3]*x+m[4]*y+m[5])/den,data,(y*w+x)*4);}
    return{width:w,height:h,data};
  }
  function suggestAxes(image){
    checkImage(image);const factor=Math.max(1,image.width/280,image.height/280),w=Math.round(image.width/factor),h=Math.round(image.height/factor),ink=[];
    // Long-line geometry is only a suggestion. A colored zero-level stroke can
    // cover the black axis, so color alone must not exclude an axis candidate.
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(Math.min(image.height-1,Math.round(y*factor))*image.width+Math.min(image.width-1,Math.round(x*factor)))*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2];if(.2126*r+.7152*g+.0722*b<170)ink.push({x,y});}
    if(ink.length<20||ink.length>w*h*.35)return{status:'uncertain',message:'没有找到清楚的深色坐标轴，请手动标定三点。'};
    function strongest(horizontal){let best={votes:0,slope:0,intercept:0};for(let k=-18;k<=18;k++){const slope=k*.02,size=2*(w+h)+10,offset=w+h,bins=new Uint16Array(size);for(const p of ink){const v=(horizontal?p.y:p.x)-slope*(horizontal?p.x:p.y),j=Math.round(v)+offset;if(j>=0&&j<size)bins[j]++;}for(let i=0;i<size;i++)if(bins[i]>best.votes)best={votes:bins[i],slope,intercept:i-offset};}return best;}
    const horizontal=strongest(true),vertical=strongest(false),den=1-horizontal.slope*vertical.slope;
    if(horizontal.votes<Math.max(20,w*.22)||vertical.votes<Math.max(20,h*.22)||Math.abs(den)<.2)return{status:'uncertain',message:'坐标轴候选不够明确，请手动标定。'};
    const oy=(horizontal.slope*vertical.intercept+horizontal.intercept)/den,ox=vertical.slope*oy+vertical.intercept;
    if(ox<0||oy<0||ox>w||oy>h)return{status:'uncertain',message:'候选坐标轴交点不在图内，请手动标定。'};
    const origin={x:ox*factor,y:oy*factor};return{status:'candidate',origin,xDirection:{x:1,y:horizontal.slope},yDirection:{x:-vertical.slope,y:-1},horizontal:{slope:horizontal.slope,intercept:horizontal.intercept*factor,votes:horizontal.votes},vertical:{slope:vertical.slope,intercept:vertical.intercept*factor,votes:vertical.votes},message:'只检测到轴线候选；刻度数字未识别，请确认原点、方向和两个实际刻度值。'};
  }
  function boundsOf(value){
    const b={xmin:Number(value?.xmin),xmax:Number(value?.xmax),ymin:Number(value?.ymin),ymax:Number(value?.ymax)};
    if(!Object.values(b).every(finite)||b.xmin>=b.xmax||b.ymin>=b.ymax||Object.values(b).some(v=>Math.abs(v)>1e6))throw Error('请给出递增的有限横纵轴范围。');return b;
  }
  function mathImage(image,cal,bounds){
    const xr=bounds.xmax-bounds.xmin,yr=bounds.ymax-bounds.ymin;let w=Math.round(xr*Math.hypot(cal.ex.x,cal.ex.y))+1,h=Math.round(yr*Math.hypot(cal.ey.x,cal.ey.y))+1;
    if(!finite(w)||!finite(h)||!finite(w*h)||w<24||h<24)throw Error('数学窗口在照片中的尺寸不足或校准比例无效，请放大绘图区并重新标定。');
    const scale=Math.min(1,1200/Math.max(w,h),Math.sqrt(1200000/(w*h)));w=Math.max(32,Math.round(w*scale));h=Math.max(32,Math.round(h*scale));const data=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=cal.mathToPixel(bounds.xmin+x*xr/(w-1),bounds.ymax-y*yr/(h-1));sample(image,p.x,p.y,data,(y*w+x)*4);}return{width:w,height:h,data};
  }
  function tone(r,g,b){const hi=Math.max(r,g,b),lo=Math.min(r,g,b),sat=hi-lo;return{blue:sat>40&&b>r+24&&b>g-8&&r<210,red:sat>40&&r>g+24&&r>b+24&&g<210,dark:.2126*r+.7152*g+.0722*b<145&&sat<105};}
  function makeMask(image,color,bounds){
    const {width:w,height:h,data}=image,count={blue:0,red:0,dark:0},all=new Uint8Array(w*h);
    for(let i=0;i<all.length;i++){const t=tone(data[i*4],data[i*4+1],data[i*4+2]);for(const k of Object.keys(count))if(t[k])count[k]++;}
    let chosen=color;const minColored=Math.max(24,w*h*.00035);if(color==='auto')chosen=count.blue>=minColored||count.red>=minColored?(count.blue>=count.red?'blue':'red'):'dark';
    let selected=0;const luminance=[],gradients=[];const axisX=(0-bounds.xmin)/(bounds.xmax-bounds.xmin)*(w-1),axisY=(bounds.ymax-0)/(bounds.ymax-bounds.ymin)*(h-1);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,t=tone(data[i*4],data[i*4+1],data[i*4+2]);if(t[chosen]&&(chosen!=='dark'||Math.abs(x-axisX)>2.5&&Math.abs(y-axisY)>2.5)){all[i]=1;selected++;luminance.push(.2126*data[i*4]+.7152*data[i*4+1]+.0722*data[i*4+2]);}}
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++)if(all[y*w+x]){const i=(y*w+x)*4,lum=j=>.2126*data[j]+.7152*data[j+1]+.0722*data[j+2],center=lum(i);gradients.push(Math.max(Math.abs(center-lum(i-4)),Math.abs(center-lum(i+4)),Math.abs(center-lum(i-w*4)),Math.abs(center-lum(i+w*4))));}
    return{mask:all,chosen,counts:count,selected,contrast:255-median(luminance),edgeP90:percentile(gradients,.9),density:selected/(w*h),multipleColors:color==='auto'&&Math.min(count.blue,count.red)>minColored&&Math.min(count.blue,count.red)>.2*Math.max(count.blue,count.red)};
  }
  function runsForColumn(mask,w,h,x){const runs=[];let start=-1,last=-1;for(let y=0;y<h;y++){if(mask[y*w+x]){if(start<0)start=y;last=y;}else if(start>=0&&y-last>2){runs.push({top:start,bottom:last});start=-1;}}if(start>=0)runs.push({top:start,bottom:last});return runs;}
  function simplify(points,tolerance){
    if(points.length<=2)return points;const a=points[0],b=points.at(-1);let best=0,index=-1;for(let i=1;i<points.length-1;i++){const p=points[i],expected=a.y+(b.y-a.y)*(p.x-a.x)/(b.x-a.x||1),distance=Math.abs(p.y-expected);if(distance>best){best=distance;index=i;}}
    if(best<=tolerance)return[a,b];const left=simplify(points.slice(0,index+1),tolerance),right=simplify(points.slice(index),tolerance);return[...left.slice(0,-1),...right];
  }
  function fitEnd(points,left){const rows=left?points.slice(0,Math.min(8,points.length)):points.slice(-8),mx=rows.reduce((n,p)=>n+p.x,0)/rows.length,my=rows.reduce((n,p)=>n+p.y,0)/rows.length,den=rows.reduce((n,p)=>n+(p.x-mx)**2,0),slope=den?rows.reduce((n,p)=>n+(p.x-mx)*(p.y-my),0)/den:0;return x=>my+slope*(x-mx);}
  function extractCT(image,maskInfo,bounds){
    const {width:w,height:h}=image,{mask}=maskInfo,xr=bounds.xmax-bounds.xmin,yr=bounds.ymax-bounds.ymin,yUnit=yr/(h-1),xUnit=xr/(w-1),columns=[];
    for(let x=0;x<w;x++){const runs=runsForColumn(mask,w,h,x);columns.push({runs,span:runs.length?Math.max(...runs.map(r=>r.bottom))-Math.min(...runs.map(r=>r.top))+1:0});}
    const thickness=Math.max(1,median(columns.flatMap(c=>c.runs.map(r=>r.bottom-r.top+1)).filter(n=>n<h*.2))),threshold=Math.max(9,thickness*3),wide=columns.map(c=>c.runs.some(r=>r.bottom-r.top+1>threshold)),groups=[];
    for(let x=0;x<w;x++)if(wide[x]){let end=x;while(end+1<w&&(wide[end+1]||wide[end+2]))end++;groups.push({start:x,end,center:(x+end)/2});x=end;}
    let multi=0,nonempty=0,previous=(bounds.ymax)/(yr)*(h-1);const raw=columns.map((c,x)=>{if(wide[x])return null;if(!c.runs.length)return 0;nonempty++;if(c.runs.length>1)multi++;const candidates=c.runs.map(r=>(r.top+r.bottom)/2);let row=candidates[0];for(const r of candidates)if(Math.abs(r-previous)<Math.abs(row-previous))row=r;previous=row;return bounds.ymax-row*yUnit;});
    const zeroTol=yUnit*1.4;for(let x=0;x<w;x++)if(raw[x]!==null&&Math.abs(raw[x])<zeroTol)raw[x]=0;
    const warnings=[],uncertainties=[];let isolatedVertical=false;
    if(multi>Math.max(4,nonempty*.08))uncertainties.push('同一横坐标发现多条笔迹，无法确定唯一函数。');
    if(groups.some(g=>g.end-g.start>Math.max(12,thickness*3)))uncertainties.push('有过宽竖向笔迹，可能是粗涂、箭头或复杂曲线。');
    for(const g of groups){const margin=Math.max(12,Math.round(thickness*3)),left=raw.slice(Math.max(0,g.start-margin-6),Math.max(0,g.start-margin)).filter(finite),right=raw.slice(Math.min(w,g.end+margin),Math.min(w,g.end+margin+6)).filter(finite);if(left.length&&right.length&&Math.abs(median(left))<zeroTol&&Math.abs(median(right))<zeroTol){isolatedVertical=true;uncertainties.push('孤立竖线无法区分冲激箭头与极窄脉冲；连续冲激不按有限高度波形识别。');}}
    // A small break in a pen stroke is bridged; a broad unexplained interior gap is not hidden.
    for(let x=1;x<w-1;x++)if(raw[x]===0&&raw[x-1]!==null&&Math.abs(raw[x-1])>zeroTol&&!wide[x]){let end=x;while(end+1<w&&raw[end+1]===0&&!wide[end+1])end++;const next=raw[end+1],nearJump=groups.some(g=>Math.abs(g.center-x)<thickness+5||Math.abs(g.center-end)<thickness+5);if(finite(next)&&Math.abs(next)>zeroTol&&!nearJump){if(end-x<Math.max(3,thickness)){const a=raw[x-1],b=next;for(let j=x;j<=end;j++)raw[j]=a+(b-a)*(j-x+1)/(end-x+2);}else uncertainties.push('非零笔迹中间有未解释的断裂，请对照照片补齐或标记间断。');}x=end;}
    const limits=[{center:0,start:-1,end:-1},...groups,{center:w-1,start:w,end:w}],segments=[];
    for(let i=0;i<limits.length-1;i++){
      const a=limits[i],b=limits[i+1],points=[];for(let x=Math.max(0,a.end+1);x<=Math.min(w-1,b.start-1);x++){if(raw[x]===null)continue;const values=[];for(let k=Math.max(a.end+1,x-2);k<=Math.min(b.start-1,x+2);k++)if(finite(raw[k]))values.push(raw[k]);points.push({x:bounds.xmin+x*xUnit,y:median(values)});}
      if(!points.length)continue;const start= bounds.xmin+a.center*xUnit,end=bounds.xmin+b.center*xUnit,left=fitEnd(points,true)(start),right=fitEnd(points,false)(end);if(start<points[0].x)points.unshift({x:start,y:left});if(end>points.at(-1).x)points.push({x:end,y:right});const knots=simplify(points,Math.max(yUnit*2.15,thickness*yUnit*.35));
      for(let k=1;k<knots.length;k++){const p=knots[k-1],q=knots[k];if(q.x-p.x<xUnit*.2)continue;let y0=Math.abs(p.y)<zeroTol?0:p.y,y1=Math.abs(q.y)<zeroTol?0:q.y;if(y0===0&&y1===0)continue;segments.push({start:p.x,end:q.x,y0,y1});}
    }
    if(segments.length>14)uncertainties.push('笔迹包含过多曲率或拐点，首版仅支持少量分段直线，请手工修正。');
    if(!segments.length)uncertainties.push('未提取到可确认的非零普通波形；可能为空白、零信号、轴线重叠或冲激箭头。');
    warnings.push('CT单点开闭端点未自动读取；按题目约定人工确认。','本次只测量标定窗口内的波形，窗外行为不能从照片推断。');
    const unrecoverable=isolatedVertical||segments.length>120;
    return{model:unrecoverable?null:{version:1,domain:'ct',segments,samples:[],impulses:[],endpoints:[],outside:0},unrecoverable,warnings,uncertainties,metrics:{lineThickness:thickness,jumpCandidates:groups.length,multivaluedColumns:multi,observedColumns:nonempty,segments:segments.length,xPixelUnit:xUnit,yPixelUnit:yUnit}};
  }
  function extractDT(image,maskInfo,bounds){
    const {width:w,height:h}=image,{mask}=maskInfo,xr=bounds.xmax-bounds.xmin,yr=bounds.ymax-bounds.ymin,xPixel=xr/(w-1),yPixel=yr/(h-1),indices=[];
    if(Math.ceil(bounds.xmin)>Math.floor(bounds.xmax)||Math.floor(bounds.xmax)-Math.ceil(bounds.xmin)>100)throw Error('离散识别窗口须包含1到101个整数采样位置。');
    const halfWidth=Math.max(2,Math.min(7,Math.round((w-1)/xr*.1))),samples=[],uncertainties=[];let offGrid=0,ink=0,nonzero=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x]){ink++;const n=bounds.xmin+x*xPixel;if(Math.abs(n-Math.round(n))>Math.max(.17,halfWidth*xPixel*1.3))offGrid++;}
    for(let n=Math.ceil(bounds.xmin);n<=Math.floor(bounds.xmax);n++){
      const col=Math.round((n-bounds.xmin)/xr*(w-1)),rows=[],profile=new Uint16Array(h);for(let x=Math.max(0,col-halfWidth);x<=Math.min(w-1,col+halfWidth);x++)for(let y=0;y<h;y++)if(mask[y*w+x]){rows.push(y);profile[y]++;}
      let value=0;if(rows.length){
        const first=Math.min(...rows),last=Math.max(...rows),middle=[];for(let y=Math.ceil(first+(last-first)*.3);y<=Math.floor(first+(last-first)*.7);y++)if(profile[y])middle.push(profile[y]);const stemWidth=Math.max(1,median(middle));
        function tip(fromTop){const band=Math.max(9,Math.min(18,Math.ceil((last-first)*.18))),start=fromTop?first:Math.max(first,last-band),end=fromTop?Math.min(last,first+band):last;let peak=0;for(let y=start;y<=end;y++)peak=Math.max(peak,profile[y]);
          if(peak>=stemWidth+2){const candidates=[];for(let y=start;y<=end;y++)if(profile[y]>=peak-1)candidates.push(y);return median(candidates);}
          // For an unmarked round pen cap, subtract its observed half-width;
          // do not score the outside edge of the ink as the sample amplitude.
          return fromTop?first+(stemWidth-1)/2:last-(stemWidth-1)/2;
        }
        const positive=bounds.ymax-tip(true)*yPixel,negative=bounds.ymax-tip(false)*yPixel;
        if(positive>yPixel*4&&negative<-yPixel*4)uncertainties.push('n='+n+'处同时有正负两端，无法确定唯一序列值。');value=Math.abs(positive)>Math.abs(negative)?positive:negative;if(Math.abs(value)<yPixel*2)value=0;if(value!==0)nonzero++;
      }samples.push({n,value});indices.push(n);
    }
    if(offGrid>Math.max(15,ink*.22))uncertainties.push('较多笔迹不在整数采样位置，可能是连线、非整数标定或坐标比例错误。');
    if(!nonzero)uncertainties.push('没有识别到清楚的非零序列茎；零序列和轴线重叠需要人工确认。');
    return{model:{version:1,domain:'dt',segments:[],samples,impulses:[],endpoints:[],outside:0},warnings:['只读取整数位置的序列值，不把茎状图连接成连续函数。','窗外为零须符合题目约定并由用户确认。'],uncertainties,metrics:{integerSamples:indices.length,nonzeroSamples:nonzero,offGridInk:offGrid,totalInk:ink,xPixelUnit:xPixel,yPixelUnit:yPixel}};
  }
  function analyze(image,options={},onProgress){
    const progress=(stage,value)=>{if(typeof onProgress==='function')onProgress({stage,progress:value});};
    try{
      checkImage(image);progress('检查图像',.03);const axes=suggestAxes(image);
      if(!options.calibration)return{status:'uncertain',model:null,axisSuggestions:axes,quality:{usable:false},warnings:['请先标定三点及实际刻度值，程序不会从像素长度猜测数学比例。'],metrics:{}};
      const cal=calibrate(options.calibration),bounds=boundsOf(options.bounds);if(!['ct','dt'].includes(options.domain))throw Error('请选择连续或离散时间信号。');if(!['auto','blue','red','dark'].includes(options.traceColor||'auto'))throw Error('请选择自动、蓝色、红色或深色笔迹。');
      progress('校准坐标',.18);const warped=mathImage(image,cal,bounds);progress('分离笔迹',.38);const mask=makeMask(warped,options.traceColor||'auto',bounds);
      const quality={usable:true,selectedColor:mask.chosen,inkPixels:mask.selected,inkDensity:mask.density,contrast:mask.contrast,edgeP90:mask.edgeP90};
      if(mask.selected<Math.max(18,warped.width*.06)||mask.density>.22){quality.usable=false;return{status:'rejected',model:null,axisSuggestions:axes,quality,warnings:[mask.density>.22?'选定笔迹占据过大区域，可能有深色背景、阴影或涂抹，请裁剪并改善光照。':'没有找到足够清楚的波形笔迹，请检查颜色选择、拍摄清晰度与标定范围。'],metrics:{}};}
      progress('提取波形',.6);const result=options.domain==='dt'?extractDT(warped,mask,bounds):extractCT(warped,mask,bounds),extra=[];
      if(mask.contrast<45||mask.edgeP90<9)extra.push('笔迹对比度或清晰度不足，请重新拍摄，不要直接据此判分。');
      if(mask.multipleColors)extra.push('存在多种明显颜色的笔迹，请明确选择答案颜色后重新识别。');
      if(mask.chosen==='dark')extra.push('深色波形可能与坐标轴、网格或文字重叠；请逐段核对并人工修正，不能直接确认自动识别。');
      const corners=[[bounds.xmin,bounds.ymin],[bounds.xmin,bounds.ymax],[bounds.xmax,bounds.ymin],[bounds.xmax,bounds.ymax]].map(([x,y])=>cal.mathToPixel(x,y));if(corners.some(p=>p.x<0||p.y<0||p.x>image.width-1||p.y>image.height-1))extra.push('标定数学窗口有部分位于照片外，缺失区域不能按零值判定，请重新裁剪或拍摄。');
      const uncertainties=[...new Set([...result.uncertainties,...extra])];progress('生成待确认结果',1);
      return{status:result.unrecoverable?'rejected':uncertainties.length?'uncertain':'candidate',model:result.model,axisSuggestions:axes,quality,warnings:[...uncertainties,...result.warnings,'识别结果须逐段核对、必要时修改并明确确认后才能提交数学判分。'],metrics:{...result.metrics,processedWidth:warped.width,processedHeight:warped.height,uncertainties:uncertainties.length}};
    }catch(error){return{status:'rejected',model:null,axisSuggestions:null,quality:{usable:false},warnings:[String(error.message||error).slice(0,500)],metrics:{}};}
  }
  global.WaveformVision=Object.freeze({version:VERSION,limits:Object.freeze({maxEdge:MAX_EDGE,maxPixels:MAX_PIXELS}),analyze,suggestAxes,rectify,rotate,crop,calibrate});
})(typeof window!=='undefined'?window:typeof self!=='undefined'?self:globalThis);
