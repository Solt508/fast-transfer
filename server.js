const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// عرض ملفات الواجهة من مجلد public
app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('متصفح متصل، المعرف:', socket.id);

    // الانضمام إلى غرفة (الرابط الفريد)
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`المتصفح ${socket.id} انضم للرابط/الغرفة: ${roomId}`);
        
        // إخبار الطرف الآخر
        socket.to(roomId).emit('peer-joined', socket.id);
    });

    // تمرير بيانات الاتصال
    socket.on('signal', (data) => {
        socket.to(data.room).emit('signal', {
            sender: socket.id,
            signalData: data.signalData
        });
    });

    socket.on('disconnect', () => {
        console.log('متصفح قطع الاتصال:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});