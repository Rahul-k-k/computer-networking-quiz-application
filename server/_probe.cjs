const http = require('http');
function req(path, { method='GET', token, body }={}) {
  return new Promise((resolve,reject)=>{
    const data = body?JSON.stringify(body):null;
    const r = http.request({host:'127.0.0.1',port:5000,path,method,headers:{
      'content-type':'application/json',
      ...(token?{authorization:'Bearer '+token}:{}),
      ...(data?{'content-length':Buffer.byteLength(data)}:{})
    }},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>{let j={};try{j=b?JSON.parse(b):{}}catch{j={raw:b}}resolve({status:res.statusCode,body:j})});});
    r.on('error',reject); if(data)r.write(data); r.end();
  });
}
(async()=>{
  const login = await req('/api/auth/login',{method:'POST',body:{email:'student@speednet.dev',password:'learn1234'}});
  console.log('student login:',login.status, login.body.user?login.body.user.role:login.body.error);
  if(!login.body.token){console.log('no token, stopping');return;}
  const cats = await req('/api/categories',{token:login.body.token});
  const list = cats.body.categories||[];
  console.log('categories:',list.length);
  list.forEach(c=>console.log('  -',c.name,'| total',c.questionCount,'| counts',JSON.stringify(c.difficultyCounts)));
})().catch(e=>console.error('ERR',e.message));
