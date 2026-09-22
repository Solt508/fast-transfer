const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// سنخبر السيرفر أن يعرض ملفات الواجهة من مجلد اسمه "public" (سننشئه لاحقاً)
app.use(express.static('public'));

// عندما يتصل أي متصفح بالسيرفر
io.on('connection', (socket) => {
    console.log('متصفح متصل، المعرف:', socket.id);

    // الانضمام إلى غرفة (الرابط الفريد الذي سترسله لصديقك)
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`المتصفح ${socket.id} انضم للرابط/الغرفة: ${roomId}`);
        
        // إخبار الطرف الآخر أن صديقه قد فتح الرابط وانضم
        socket.to(roomId).emit('peer-joined', socket.id);
    });

    // تمرير بيانات الاتصال (WebRTC Signals) بين متصفحك ومتصفح صديقك
    socket.on('signal', (data) => {
        // إرسال البيانات للطرف الآخر في نفس الغرفة فقط
        socket.to(data.room).emit('signal', {
            sender: socket.id,
            signalData: data.signalData
        });
    });

    socket.on('disconnect', () => {
        console.log('متصفح قطع الاتصال:', socket.id);
    });
});

// تشغيل السيرفر على المنفذ 3000
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل بنجاح على: http://localhost:${PORT}`);
});