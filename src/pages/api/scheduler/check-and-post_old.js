// pages/api/check-and-post.js - Được gọi bởi Scheduler để đăng bài viết nháp

import { getToken } from "next-auth/jwt";
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

// 1. Cấu hình Data
const dataFilePath = path.join(process.cwd(), 'data', 'content-drafts.json');
const secret = process.env.NEXTAUTH_SECRET;

// 2. Khởi tạo Prisma Client
let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

// 3. Hàm Đọc/Ghi/Tìm kiếm
const readData = () => {
    try {
        const data = fs.readFileSync(dataFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeData = (data) => {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf-8');
};

const getDraftById = (id) => {
    const data = readData();
    return data.find(c => c.id === id);
};

// 4. Hàm Lấy Page Access Token
const getPageAccessToken = async (pageId) => {
    const page = await prisma.FacebookPage.findUnique({
        where: { pageId: pageId },
        select: { accessToken: true, name: true }
    });
    return page;
};

// 5. Hàm Cập nhật trạng thái Draft sau khi đăng thành công
const updateDraftStatus = (id, fbPostId) => {
    const data = readData();
    const index = data.findIndex(c => c.id === id);
    if (index !== -1) {
        data[index].IDFbPost = fbPostId;
        data[index].PostedDate = new Date().toISOString();
        writeData(data);
    }
};


// 6. Logic chính (Handler)
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const token = await getToken({ req, secret });
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated.' });
    }
    const currentUserId = token.sub;
    const now = new Date();
    // Lấy thông tin bài viết và trang từ request của Scheduler
    const { contentId, pageId } = req.body; 

    if (!contentId || !pageId) {
        return res.status(400).json({ message: 'Missing contentId or pageId in request body.' });
    }

    const draft = getDraftById(contentId);
    if (!draft) {
        return res.status(404).json({ message: 'Content draft not found.' });
    }
    const pageInfo = await getPageAccessToken(pageId);
    if (!pageInfo) {
        return res.status(404).json({ message: 'Fanpage not found in database.' });
    }
    const pageAccessToken = pageInfo.accessToken;
    let apiEndpoint = '';
    let apiPayload = {};
    let postMode = '';

    try {
        if (VideoPath && VideoPath.trim().length > 0) {
            apiEndpoint = '/api/video-upload-processor'; y
            postMode = 'VIDEO/REELS';
            apiPayload = {
                pageId: pageId,
                pageAccessToken: pageAccessToken, // Pass Page Token cho API xử lý
                videoPath: VideoPath, // Đường dẫn file local (D:\AffVideos\...)
                caption: MainContent,
                commentContent: Comment, 
            };
        } else {
            apiEndpoint = '/api/post-to-facebook-url'; // API đã có
            postMode = 'IMAGE/ALBUM';
            const filteredImageUrls = (ImageUrls || []).filter(url => url && url.trim().length > 0);
            // TẠO PAYLOAD CHUẨN BỊ GỌI ĐẾN API PHỤ TRÁCH ĐĂNG ẢNH
            apiPayload = {
                pageId: pageId, // Chỉ đăng lên 1 Page
                pageAccessToken: pageAccessToken, // Pass Page Token cho API xử lý
                postData: {
                    caption: MainContent + (LinkAffi ? `\n\nLink Affiliate: ${LinkAffi}` : ''),
                    imageUrls: filteredImageUrls,
                },
                // Giả định /api/post-to-facebook-url có thể chấp nhận PageAccessToken thay vì user token cho 1 page duy nhất
            };
        }

        // B. THỰC HIỆN GỌI API ĐĂNG BÀI
        console.log(`[POSTING] Content ID ${contentId} to Page ${pageId}. Mode: ${postMode}`);

        // Gửi yêu cầu đến API xử lý đăng bài thích hợp
        const postResponse = await axios.post(
            `http://localhost:3000${apiEndpoint}`, // Đảm bảo URL này chính xác
            apiPayload
        );
        
        const fbPostId = postResponse.data.results?.[0]?.postId || postResponse.data.id; // Tùy thuộc vào response
        
        if (fbPostId) {
            // C. CẬP NHẬT TRẠNG THÁI (Nếu thành công)
            updateDraftStatus(contentId, fbPostId);

            return res.status(200).json({
                success: true,
                message: `${postMode} post successful!`,
                fbPostId: fbPostId,
                postMode: postMode,
            });
        }
        
        // D. Xử lý lỗi từ API gọi nội bộ
        return res.status(500).json({ 
            success: false, 
            message: `Post failed via internal API for ${postMode}.`,
            details: postResponse.data,
        });

    } catch (error) {
        console.error(`Error during ${postMode} process:`, error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            success: false, 
            message: `Lỗi khi đăng bài loại ${postMode} lên Facebook.`, 
            details: error.response?.data?.error?.message || error.message 
        });
    }
}

// *** LƯU Ý QUAN TRỌNG CHO VIỆC TẢI VIDEO ***
// Vì API này chạy trên Server Node.js, nó có thể truy cập ổ đĩa.
// Tuy nhiên, việc đọc file và truyền qua axios.post thông thường cho file upload cần một cấu trúc phức tạp (FormData).
// Để đơn giản hóa, tôi đang giả định bạn sẽ tạo một API phụ trợ:
// pages/api/video-upload-processor.js để xử lý việc đọc file VideoPath và gọi Facebook Graph API cho phiên tải lên.
