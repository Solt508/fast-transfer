const socket = io();
const statusEl = document.getElementById('status');
const shareSection = document.getElementById('share-section');
const roomLinkEl = document.getElementById('room-link');
const transferSection = document.getElementById('transfer-section');
const fileInput = document.getElementById('file-input');
const progressSection = document.getElementById('progress-section');
const progressBar = document.getElementById('progress-bar');
const progressLabel = document.getElementById('progress-label');

const CHUNK_SIZE = 64 * 1024; // تقسيم الفيلم لأجزاء صغيرة
let receivedBuffers = [];
let receivedSize = 0;
let fileMeta = null;

let roomId = window.location.hash.substring(1);
const isInitiator = !roomId;

if (isInitiator) {
    roomId = Math.random().toString(36).substring(2, 9);
    window.location.hash = roomId;
    shareSection.style.display = 'block';
    roomLinkEl.innerText = window.location.href;
    statusEl.innerText = 'في انتظار فتح الطرف الآخر للرابط...';
} else {
    statusEl.innerText = 'جاري الاتصال بالمرسل...';
}

socket.emit('join-room', roomId);

// إخبار الطرفين بنجاح الاتصال عبر سيرفرك
socket.on('peer-joined', () => {
    statusEl.innerText = 'تم الاتصال بنجاح عبر السيرفر الوسيط!';
    statusEl.style.color = '#4ade80';
    transferSection.style.display = 'block';
    if (!isInitiator) socket.emit('file-transfer', { room: roomId, type: 'ready' });
});

// معالجة البيانات القادمة من السيرفر
socket.on('file-transfer', (data) => {
    if (data.type === 'ready' && isInitiator) {
        statusEl.innerText = 'تم الاتصال بنجاح عبر السيرفر الوسيط!';
        statusEl.style.color = '#4ade80';
        transferSection.style.display = 'block';
    } 
    else if (data.type === 'meta') {
        fileMeta = data.meta;
        receivedBuffers = [];
        receivedSize = 0;
        progressSection.style.display = 'block';
    } 
    else if (data.type === 'chunk') {
        receivedBuffers.push(data.chunk);
        receivedSize += data.chunk.byteLength;
        
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
            progressLabel.innerText = 'اكتمل الاستلام وتم حفظ الفيلم!';
        }
    }
});

// قراءة الفيلم وإرساله كأجزاء عبر السيرفر
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    progressSection.style.display = 'block';
    socket.emit('file-transfer', { room: roomId, type: 'meta', meta: { name: file.name, size: file.size, type: file.type } });

    let offset = 0;
    const fileReader = new FileReader();

    const readSlice = (o) => {
        const slice = file.slice(offset, o + CHUNK_SIZE);
        fileReader.readAsArrayBuffer(slice);
    };

    fileReader.onload = (e) => {
        socket.emit('file-transfer', { room: roomId, type: 'chunk', chunk: e.target.result });
        offset += e.target.result.byteLength;
        
        const percent = Math.round((offset / file.size) * 100);
        progressBar.value = percent;
        progressLabel.innerText = `جاري الإرسال: ${percent}%`;

        if (offset < file.size) {
            setTimeout(() => readSlice(offset), 10); // تأخير بسيط لحماية السيرفر
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