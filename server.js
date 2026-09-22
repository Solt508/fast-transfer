const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
// زدنا مساحة الاستيعاب لضمان عدم انقطاع الفيلم
const io = new Server(server, { maxHttpBufferSize: 1e8 }); 

app.use(express.static('public'));

io.on('connection', (socket) => {
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        socket.to(roomId).emit('peer-joined');
    });

    // استلام أجزاء الفيلم من المرسل وتمريرها للمستلم فوراً
    socket.on('file-transfer', (data) => {
        socket.to(data.room).emit('file-transfer', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`السيرفر يعمل كوسيط على المنفذ: ${PORT}`));