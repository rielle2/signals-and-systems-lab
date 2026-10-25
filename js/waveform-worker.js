/* Optional local worker. The UI can use the same pure module when local-file
 * policies prevent workers. Images and results never leave this browser. */
'use strict';
importScripts('waveform-vision.js?v=3.0.0-beta.1');
self.onmessage=function(event){
  const message=event.data||{},id=message.id;
  try{
    let result;
    if(message.action==='analyze')result=self.WaveformVision.analyze(message.image,message.options,detail=>self.postMessage({id,type:'progress',...detail}));
    else if(message.action==='axes')result=self.WaveformVision.suggestAxes(message.image);
    else if(message.action==='rectify')result=self.WaveformVision.rectify(message.image,message.options);
    else throw Error('未支持的本地图片处理操作。');
    const transfer=result?.data?.buffer?[result.data.buffer]:[];self.postMessage({id,type:'result',result},transfer);
  }catch(error){self.postMessage({id,type:'error',message:String(error.message||error).slice(0,500)});}
};
