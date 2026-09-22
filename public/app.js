const socket = io();
const statusEl = document.getElementById('status');
const shareSection = document.getElementById('share-section');
const roomLinkEl = document.getElementById('room-link');
const transferSection = document.getElementById('transfer-section');
const fileInput = document.getElementById('file-input');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');

const CHUNK_SIZE = 64 * 1024; // 64KB لكل جزء لضمان استقرار الاتصال
let peerConnection;
let dataChannel;
let receivedBuffers = [];
let receivedSize = 0;
let fileMeta = null;

// تحديد رقم الغرفة من الرابط أو إنشاء رقم جديد
let roomId = window.location.hash.substring(1);
const isInitiator = !roomId;

if (isInitiator) {
    roomId = Math.random().toString(36).substring(2, 9);
    window.location.hash = roomId;
    shareSection.style.display = 'block';
    roomLinkEl.innerText = window.location.href;
    statusEl.innerText = 'في انتظار فتح صديقك للرابط...';
} else {
    statusEl.innerText = 'جاري الاتصال بالمرسل...';
}

socket.emit('join-room', roomId);

const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // سيرفر STUN المجاني من جوجل
};

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit('signal', { room: roomId, signalData: { candidate: e.candidate } });
        }
    };

    if (isInitiator) {
        dataChannel = peerConnection.createDataChannel('fileTransfer');
        setupDataChannel();
    } else {
        peerConnection.ondatachannel = (e) => {
            dataChannel = e.channel;
            setupDataChannel();
        };
    }
}

function setupDataChannel() {
    dataChannel.binaryType = 'arraybuffer';
    
    dataChannel.onopen = () => {
        statusEl.innerText = 'تم الاتصال المباشر بنجاح!';
        statusEl.style.color = '#4ade80';
        transferSection.style.display = 'block';
    };

    dataChannel.onmessage = (e) => {
        if (typeof e.data === 'string') {
            fileMeta = JSON.parse(e.data);
            receivedBuffers = [];
            receivedSize = 0;
            progressSection.style.display = 'block';
            return;
        }

        receivedBuffers.push(e.data);
        receivedSize += e.data.byteLength;
        const percent = Math.round((receivedSize / fileMeta.size) * 100);
        progressBar.value = percent;
        progressLabel.innerText = `جاري الاستلام: ${percent}%`;

        if (receivedSize >= fileMeta.size) {
            const blob = new Blob(receivedBuffers, { type: fileMeta.type });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = fileMeta.name;
            a.click();
            progressLabel.innerText = 'اكتمل الاستلام وتم حفظ الملف!';
        }
    };
}

// بدء الاتصال عند دخول الطرف الآخر
socket.on('peer-joined', async () => {
    createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('signal', { room: roomId, signalData: { offer } });
});

// معالجة إشارات WebRTC
socket.on('signal', async (data) => {
    if (!peerConnection) createPeerConnection();

    if (data.signalData.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signalData.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { room: roomId, signalData: { answer } });
    } else if (data.signalData.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signalData.answer));
    } else if (data.signalData.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signalData.candidate));
    }
});

// إرسال الملف وتقطيعه
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    progressSection.style.display = 'block';
    dataChannel.send(JSON.stringify({ name: file.name, size: file.size, type: file.type }));

    let offset = 0;
    const fileReader = new FileReader();

    const readSlice = (o) => {
        const slice = file.slice(offset, o + CHUNK_SIZE);
        fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = (e) => {
        dataChannel.send(e.target.result);
        offset += e.target.result.byteLength;
        const percent = Math.round((offset / file.size) * 100);
        progressBar.value = percent;
        progressLabel.innerText = `جاري الإرسال: ${percent}%`;

        if (offset < file.size) {
            // التحكم بتدفق البيانات لحماية الذاكرة (Backpressure)
            if (dataChannel.bufferedAmount > 8 * 1024 * 1024) {
                setTimeout(() => readSlice(offset), 50);
            } else {
                readSlice(offset);
            }
        } else {
            progressLabel.innerText = 'اكتمل الإرسال بنجاح!';
        }
    };

    readSlice(0);
});

function copyLink() {
    navigator.clipboard.writeText(roomLinkEl.innerText);
    alert('تم نسخ الرابط!');
}