// pages/api/scheduler/pending-posts.js

import { getToken } from "next-auth/jwt";
import { PrismaClient } from '@prisma/client';
const secret = process.env.NEXTAUTH_SECRET;
let prisma;
if (process.env.NODE_ENV === 'production') {
  // Production: Tạo instance mới
  prisma = new PrismaClient();
} else {
  // Development: Sử dụng global instance nếu đã tồn tại
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

export default async function handler(req, res) {
    const token = await getToken({ req, secret });
    if (!token || req.method !== 'GET') {
        return res.status(401).json({ message: 'Not authenticated or invalid method.' });
    }
    
    const currentUserId = token.sub;
    const UTC7_OFFSET_MS = 7 * 60 * 60 * 1000;
    const nowUTC0 = new Date(); //UTC+0
    const nowUTC7Time = nowUTC0.getTime() + UTC7_OFFSET_MS; 
    const nowUTC7 = new Date(nowUTC7Time);

    const startOfToday = new Date(nowUTC7);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

    const nextHourRun = new Date(nowUTC7);
    nextHourRun.setUTCHours(nextHourRun.getUTCHours() + 1, 0, 0, 0);
    
//console.log('----Current time UTC-0:', nowUTC0);
//console.log('----Current time UTC+7:', nowUTC7);
//console.log('----Next hour:', nextHourRun, 'Time range:', startOfToday, 'to', startOfTomorrow);
    try {
        const postsToProcess = await prisma.content.findMany({
            where: {
                userId: currentUserId,
                ScheduleDate: {
                    //lte: nextHour, // Điều kiện lọc: Đã đến hoặc quá thời gian hẹn
                    gte: startOfToday, // Chỉ lấy bài từ đầu ngày hôm nay
                    lt: startOfTomorrow, // Đến trước đầu ngày mai
                    not: null,
                },
            },
            select: {
                id: true,
                Name: true,
                IDFbPost: true,
                ScheduleDate: true,
                TargetPageIds: true,
                PostedIds: true,
                PostedDate: true,
            },
            orderBy: { ScheduleDate: 'asc' },
        });
        //const pendingPosts = postsToProcess;
        // Lọc cuối cùng: chỉ giữ lại các bài chưa hoàn thành việc đăng
        const pendingPosts = postsToProcess.filter(content => 
             content.IDFbPost === null || content.IDFbPost === "" ||
             content.PostedIds.length < 1
        ); 
//console.log('----Fetched pending posts----:', pendingPosts);
        return res.status(200).json({ pendingPosts });

    } catch (error) {
        console.error('Error fetching pending posts:', error);
        return res.status(500).json({ message: 'Lỗi khi lấy dữ liệu bài viết đang chờ.' });
    }
}