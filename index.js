const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 4545;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});
//app.use('/', express.static(__dirname + '/build'));
//channel_server = io.of('/channel_server');
io.on('connection', function(socket){
  console.log(socket.id);
  socket.on('login',function(data){
    console.log("로그인확인"+data.userId);
    let senddata ={
      "eventOp":"login",
      "userId":data.userId,
    }
    io.sockets.emit('login', senddata);
  });
  socket.on('chatting',function(data){
    console.log("채팅확인:"+data.msg);
    let senddata ={
      "eventOp":"chatting",
      "userId":data.userId,
      "msg":data.msg,
    }
    io.sockets.emit('chatting', senddata);
  });
  socket.on('sdpconnect', function(data){
    console.log(data.userId+"로부터"+"sdp: "+data.sdp.type+"타입으로옴");
    console.log("데이터이벤트:"+data.event)
    let senddata ={
      "eventOp":"sdpconnect",
      "userId": data.userId,
      "sdp": data.sdp,
    }
    socket.broadcast.emit('sdpconnect', senddata)
  });
    
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});
