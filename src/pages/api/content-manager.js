// pages/api/content-manager.js

import { getToken } from "next-auth/jwt";
import { PrismaClient } from '@prisma/client';

// Cấu hình JWT Secret
const secret = process.env.NEXTAUTH_SECRET;

// 1. KHỞI TẠO PRISMA CLIENT
// Sử dụng pattern global để tránh tạo nhiều instance Prisma Client trong quá trình phát triển (Next.js Hot Reload)
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
    // Yêu cầu xác thực (Quan trọng: Đảm bảo người dùng đã đăng nhập)
    const token = await getToken({ req, secret });
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated. Please sign in.' });
    }

    // Lấy User ID từ Token. Đây là ID duy nhất của người dùng đã đăng nhập.
    const currentUserId = token.sub; // Hoặc token.userId, tùy vào cách bạn cấu hình NextAuth.js
    if (!currentUserId) {
         return res.status(401).json({ message: 'User ID missing in session token.' });
    }

    try {
        switch (req.method) {
            
            // --- READ ALL CONTENTS (GET) ---
            case 'GET':
                const { type } = req.query; 
                if(type)
                {
                    const contents = await prisma.content.findMany({
                    where: { userId: currentUserId, Comment:type },
                    orderBy: { CreatedDate: 'desc' },
                    });
                    return res.status(200).json({ contents });
                }
                const contents = await prisma.content.findMany({
                    where: { userId: currentUserId },
                    orderBy: { CreatedDate: 'desc' },
                });
                return res.status(200).json({ contents });

            // --- CREATE NEW CONTENT (POST) ---
            case 'POST':
                // Lấy tất cả các trường, kể cả những trường không bắt buộc (ScheduleDate, IDFbPost, PostedDate, TargetPageIds, PostedIds)
                const { 
                    Name, 
                    MainContent, 
                    VideoPath, 
                    ImageUrls, 
                    LinkAffi, 
                    Comment, 
                    ScheduleDate, 
                    TargetPageIds, 
                    IDFbPost,
                    PostedDate,
                    PostedIds,
                } = req.body;

                if (!Name || !MainContent) {
                    return res.status(400).json({ message: 'Name and MainContent are required.' });
                }

                // Chuyển ScheduleDate và PostedDate sang đối tượng Date nếu có
                const scheduleDateObj = ScheduleDate ? new Date(ScheduleDate) : null;
                const postedDateObj = PostedDate ? new Date(PostedDate) : null;
                
                // Chuẩn bị dữ liệu để tạo
                const newContentData = {
                    userId: currentUserId,
                    Name: Name.trim(),
                    MainContent: MainContent,
                    VideoPath: VideoPath || null,
                    ImageUrls: Array.isArray(ImageUrls) ? ImageUrls.filter(url => url.trim() !== '') : [],
                    LinkAffi: LinkAffi || null,
                    Comment: Comment || null, // Lưu Comment đã được gộp
                    ScheduleDate: scheduleDateObj,
                    TargetPageIds: Array.isArray(TargetPageIds) ? TargetPageIds : [],
                    IDFbPost:  IDFbPost,
                    PostedDate: postedDateObj,
                    PostedIds: Array.isArray(PostedIds) ? PostedIds : [], // Lưu PostedIds
                };
                //console.log('Creating new content with data:', newContentData);
                const newContent = await prisma.content.create({
                    data: newContentData,
                });

                return res.status(201).json({ content: newContent, message: 'Content created successfully.' });

            // --- UPDATE EXISTING CONTENT (PUT) ---
            case 'PUT':
                const { id, ...updateData } = req.body;
                
                if (!id) {
                    return res.status(400).json({ message: 'Content ID is required for update.' });
                }

                // Chuyển PostedDate thành đối tượng Date nếu tồn tại, hoặc null
                // Đây là logic quan trọng để lưu IDFbPost và PostedDate
                if (updateData.PostedDate) {
                    // Nếu PostedDate được gửi lên, chuyển đổi nó thành đối tượng Date
                    updateData.PostedDate = new Date(updateData.PostedDate);
                } else {
                    // Nếu không có, đặt là null (trạng thái bản nháp)
                    updateData.PostedDate = null;
                }
                
                const updatedContent = await prisma.content.update({
                    where: { id },
                    data: updateData,
                });
                return res.status(200).json({ content: updatedContent, message: 'Content updated successfully.' });

            // --- DELETE CONTENT (DELETE) ---
            case 'DELETE':
                const { id: deleteId } = req.body;
                
                if (!deleteId) {
                    return res.status(400).json({ message: 'Content ID is required for deletion.' });
                }
                
                await prisma.content.delete({
                    where: { id: deleteId },
                });
                return res.status(200).json({ message: 'Content deleted successfully.' });

            default:
                res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
                return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error) {
        // Xử lý lỗi từ Database
        console.error('Database Operation Error:', error);
        
        // Kiểm tra lỗi không tìm thấy bản ghi (ví dụ: khi update/delete ID không tồn tại)
        if (error.code === 'P2025') {
             return res.status(404).json({ message: 'Record not found in database.', error: error.message });
        }
        
        return res.status(500).json({ message: 'Database operation failed.', error: error.message });
    }
}