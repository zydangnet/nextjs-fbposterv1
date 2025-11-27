// pages/api/video-upload-processor.js
// API này nhận đường dẫn file VideoPath LƯU TRONG SERVER (từ content-manager/scheduler)
// và tiến hành tải lên Facebook dưới dạng Reels.

import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Writable } from 'stream';

const API_VERSION = 'v20.0'; 

// Cần cấu hình Next.js để không phân tích cú pháp body (vì chúng ta dùng FormData)
export const config = {
    api: {
        bodyParser: false,
    },
};

// Hàm xử lý chính
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    try {
        // Vì chúng ta dùng bodyParser: false, chúng ta phải tự parse body
        const rawBody = await readBody(req);
        let data;
        try {
            data = JSON.parse(rawBody.toString());
        } catch (e) {
            return res.status(400).json({ message: 'Invalid JSON body format.' });
        }
        
        const { pageId, pageAccessToken, videoPath, caption, commentContent } = data;

        if (!pageId || !pageAccessToken || !videoPath) {
            return res.status(400).json({ message: 'Missing pageId, pageAccessToken, or videoPath.' });
        }

        // 1. KIỂM TRA TỒN TẠI FILE LOCAL
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ 
                message: 'Video file not found on local server path.',
                path: videoPath
            });
        }
        
        // 2. CHUẨN BỊ FORM DATA
        const form = new FormData();
        form.append('description', caption || '');
        form.append('file', fs.createReadStream(videoPath));
        form.append('access_token', pageAccessToken);
        form.append('upload_phase', 'finish'); // Cần thiết cho Reels
        form.append('video_type', 'REELS'); // Chỉ định đây là Reels (Facebook có thể tự động nhận dạng)

        // 3. GỌI FACEBOOK API (Upload Session)
        // Lưu ý: Đây là simplified flow, Facebook thường dùng Resumable Uploads.
        // Tuy nhiên, chúng ta sẽ thử dùng upload đơn giản.

        const endpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/videos`;
        
        const uploadResponse = await axios.post(endpoint, form, {
            headers: {
                ...form.getHeaders(),
                'Accept': 'application/json',
            },
            maxBodyLength: Infinity, // Cho phép tải file lớn
        });

        const postId = uploadResponse.data.id;

        // 4. (Tùy chọn) Đăng comment tự động sau khi đăng bài
        if (postId && commentContent) {
            try {
                const commentEndpoint = `https://graph.facebook.com/${API_VERSION}/${postId}/comments`;
                await axios.post(commentEndpoint, null, {
                    params: {
                        message: commentContent,
                        access_token: pageAccessToken,
                    }
                });
                console.log(`Commented successfully on post ${postId}.`);
            } catch (commentError) {
                console.error('Error posting comment:', commentError.response ? commentError.response.data : commentError.message);
                // Vẫn coi là thành công vì bài viết đã đăng
            }
        }
        
        return res.status(200).json({
            success: true,
            message: 'Video/Reels posted successfully.',
            postId: postId,
        });

    } catch (error) {
        console.error('Error in Video Upload Processor:', error.response ? error.response.data : error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to upload video to Facebook.', 
            details: error.response?.data?.error?.message || error.message 
        });
    }
}

// Hàm đọc body khi bodyParser bị tắt
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => {
            chunks.push(chunk);
        });
        req.on('end', () => {
            resolve(Buffer.concat(chunks));
        });
        req.on('error', reject);
    });
}
