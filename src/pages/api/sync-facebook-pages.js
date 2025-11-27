// pages/api/sync-facebook-pages.js

import { PrismaClient } from '@prisma/client';
import { getToken } from "next-auth/jwt";
import axios from 'axios';

// 1. KHỞI TẠO PRISMA CLIENT
let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

const secret = process.env.NEXTAUTH_SECRET;
const API_VERSION = 'v24.0'; // Phiên bản Graph API

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 2. Xác thực và lấy User Access Token từ Session
    const token = await getToken({ req, secret });
    if (!token || !token.accessToken) {
        return res.status(401).json({ message: 'Not authenticated or missing access token.' });
    }
    
    const userAccessToken = token.accessToken;
    // Trong NextAuth.js, user ID thường được lưu trong thuộc tính `sub` (subject) của JWT.
    const currentUserId = token.sub;
    const currentUserName = token.name; 
    
    if (!currentUserId) {
        return res.status(401).json({ message: 'User ID missing in session token.' });
    }
    let pagesData = [];
    
    try {
        // 3. Gọi Facebook Graph API để lấy danh sách Fanpage
        // Endpoint: /me/accounts trả về các trang mà người dùng quản lý
        const endpoint = `https://graph.facebook.com/${API_VERSION}/me/accounts`;
        const params = {
            access_token: userAccessToken,
            // Yêu cầu các trường cần thiết, đặc biệt là access_token của Page
            fields: 'id,name,access_token,category,picture.type(large)', 
        };
        
        const response = await axios.get(endpoint, { params });
        pagesData = response.data.data; // Mảng Fanpage
        
        // 4. XÓA TẤT CẢ FANPAGE CŨ TRONG DATABASE (Yêu cầu của bạn)
        await prisma.FacebookPage.deleteMany({
            where: {
                userId: currentUserId, // <-- CHỈ XÓA CÁC TRANG CỦA NGƯỜI DÙNG NÀY
            }
        });
        
        // 5. CHUẨN BỊ VÀ LƯU FANPAGE MỚI VÀO DATABASE
        const pagesToInsert = pagesData.map(page => ({
            userId: currentUserId, 
            userName: currentUserName,
            pageId: page.id,
            name: page.name,
            accessToken: page.access_token, // Page Access Token RẤT QUAN TRỌNG
            category: page.category || 'N/A',
            pictureUrl: page.picture?.data?.url || null,
        }));
        const pageList = pagesToInsert.map(p => p.name).join('; ');
        //console.log(`Syncing Facebook pages for user ${currentUserName} (${currentUserId}): ${pageList}`);
        let count = 0;
        if (pagesToInsert.length > 0) {
            const result = await prisma.FacebookPage.createMany({
                data: pagesToInsert
            });
            count = result.count;
        }

        return res.status(200).json({ 
            success: true, 
            message: `Successfully synced ${count} Facebook pages to database.`,
            count: count,
            apigraph: pageList,
        });

    } catch (error) {
        console.error('Error syncing Facebook pages:', error.response ? error.response.data : error.message);
        
        const errorMessage = error.response?.data?.error?.message || error.message;

        return res.status(500).json({ 
            success: false, 
            message: 'Failed to sync Facebook pages. Please check the `pages_show_list` and `manage_pages` permissions.',
            details: errorMessage,
        });
    }
}