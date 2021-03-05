
//var app = require('express')();
//var http = require('http').Server(app);
//var io = require('socket.io')(http);
const signalServerConnectURL = 'http://localhost:4545';

(function init() {
    if (signalServerConnectURL) {
        try {
            signalSocketIo = io.connect(signalServerConnectURL, { reconnect: true, 'transports': ['websocket'] });
            console.log(signalSocketIo);
            console.log("접속성공")
        } catch (err) {
            console.warn('signaling server connect error.');
        }
    }
})();

let peers = {};
let streams = {};

const loginBtn = document.getElementById("loginBtn");
const sendBtn = document.getElementById("sendBtn");
const sdpBtn = document.getElementById("sdpBtn");
const inputMsg = document.getElementById('inputMsg');
const videoBox = document.getElementById("videoBox");

let userId= Math.floor(Math.random() * 100);

const deletePeers = async () => {
    for(let key in streams) {
        if (streams[key] && streams[key].getTracks()) {
            streams[key].getTracks().forEach(track => {
                track.stop();
            })

            document.getElementById(key).srcObject = null;
            document.getElementById(key).remove();
        }
    }

    for(let key in peers) {
        if (peers[key]) {
            peers[key].close();
            peers[key] = null;
        }
    }
}
const createSDPOffer = async id => {
    console.log("createSDPOffer: "+id);
    return new Promise(async (resolve, reject) => {
        peers[id] = new RTCPeerConnection();
        streams[id] = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
        let str = 'multiVideo-'+id;
        let multiVideo = document.getElementById(str);
        multiVideo.srcObject = streams[id];

        streams[id].getTracks().forEach(track => {
            peers[id].addTrack(track, streams[id]);
        });

        peers[id].createOffer().then(sdp => {
            peers[id].setLocalDescription(sdp);
            return sdp;
        }).then(sdp => {
            resolve(sdp);
        })
    })
}
const createSDPAnswer = async data => {
    console.log("createSDPAnswer: "+data.userId);
    
    let displayId = data.userId;

    peers[displayId] = new RTCPeerConnection();
    peers[displayId].ontrack = e => {
        streams[displayId] = e.streams[0];

        let multiVideo = document.getElementById(`multiVideo-${displayId}`);
        multiVideo.srcObject = streams[displayId];
    }

    await peers[displayId].setRemoteDescription(data.sdp);
    let answerSdp = await peers[displayId].createAnswer();
    await peers[displayId].setLocalDescription(answerSdp);
    peers[displayId].onicecandidate = e => {
        if(!e.candidate){
            let reqData = {
                "eventOp": "sdpconnect",
                "sdp": peers[displayId].localDescription,
                "userId": userId,
                "event": "answer",
            };
            console.log("이상증상2: "+displayId+", "+userId);
            signalSocketIo.emit('sdpconnect', reqData);
        }
    }
}

//퇴장 시, stream,peer 제거
const leaveParticipant = id => {
    document.getElementById(`multiVideo-${id}`).remove();
    document.getElementById(id).remove();

    if(streams[id]){
        streams[id].getVideoTracks()[0].stop();
        streams[id].getAudioTracks()[0].stop();
        streams[id] = null;
        delete streams[id];
    }

    if(peers[id]){
        peers[id].close();
        peers[id] = null;
        delete peers[id];
    }

}

const createVideoBox = id => {
    console.log("createVideoBox: "+id);
    let videoContainner = document.createElement("div");
    videoContainner.classList = "multi-video";
    videoContainner.id = id;

    let videoLabel = document.createElement("p");
    let videoLabelText = document.createTextNode(id);
    videoLabel.appendChild(videoLabelText);

    videoContainner.appendChild(videoLabel);
    //sunny) 해당 박스 엘리멘트 아이디는 multiVideo-userId로 한다.
    let multiVideo = document.createElement("video");
    multiVideo.autoplay = true;
    multiVideo.id = "multiVideo-" + id;
    videoContainner.appendChild(multiVideo);

    videoBox.appendChild(videoContainner);
}
function createMessageTag(LR_className, senderId, message) {
    // 형식 가져오기
    let chatLi = $('div.chat.format ul li').clone();

    // 값 채우기
    chatLi.addClass(LR_className);
    chatLi.find('.sender span').text(senderId);
    chatLi.find('.message span').text(message);

    return chatLi;
}

function appendMessageTag(LR_className, senderId, message) {
    const chatLi = createMessageTag(LR_className, senderId, message);

    $('div.chat:not(.format) ul').append(chatLi);

    // 스크롤바 아래 고정
    $('div.chat').scrollTop($('div.chat').prop('scrollHeight'));
}
function receiveMsg(data) {
    const LR = (data.userId != userId)? "left" : "right";
    if(LR==="right"){
        appendMessageTag("right", data.userId, data.msg);
    }else{
        appendMessageTag("left", data.userId, data.msg);
    }
    
}
function receiveLogin(data) {
    const LR = (data.userId != userId)? "left" : "right";
    let temp = data.userId+"님이 입장";
    if(LR==="right"){
        appendMessageTag("right", data.userId, temp);
    }else{
        appendMessageTag("left", data.userId, temp);
    }
    
}

loginBtn.addEventListener('click', () => {
    let data = {
        "eventOp":"login",
        "userId":userId,
    }

    signalSocketIo.emit('login', data);
});
sendBtn.addEventListener('click', () => {
    let data = {
        "eventOp":"chatting",
        "userId":userId,
        "msg":inputMsg.value,
    }
    inputMsg.value='';
    signalSocketIo.emit('chatting', data);
});
sdpBtn.addEventListener('click', async () => {
    let sdp = await createSDPOffer(userId);
    let data = {
        "eventOp":"sdpconnect",
        "userId": userId,
        "sdp": sdp,
        "event": "offer",
    }
    signalSocketIo.emit('sdpconnect', data);
});
signalSocketIo.on('login', function (data) {
    receiveLogin(data);
    let user = document.getElementById(data.userId);
    if(!user){
        createVideoBox(data.userId);
    }
    console.log("서버에서 로그인확인완료"+data.userId);
});
signalSocketIo.on('chatting', function (data) {
    receiveMsg(data);
    console.log("서버에서 채팅확인완료"+data.msg);
});
signalSocketIo.on('sdpconnect', async data => {
    console.log("서버에서 sdp확인완료");
    switch(data.eventOp){
        case 'sdpconnect':
            if(data.sdp && data.sdp.type == 'offer'){
                createSDPAnswer(data);
            }else if(data.sdp && data.sdp.type == 'answer'){
                console.log("이상증상1");
                peers[userId].setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
            break;
    }
    
});