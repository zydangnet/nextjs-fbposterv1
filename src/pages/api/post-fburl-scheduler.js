import { getToken } from "next-auth/jwt";
import axios from "axios";
// GIẢ SỬ CÁC HÀM TIỆN ÍCH NẰM TRONG utils/functions.js (hoặc file khác tùy cấu trúc của bạn)
import { splitAndCleanString, shuffleArray } from '../../utils/functions'; 
import { getPageAccessToken } from '../../utils/prisma'; // Giả sử hàm này nằm trong prisma.js

const secret = process.env.NEXTAUTH_SECRET;
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;
const API_VERSION = 'v24.0';

// === Hàm đăng bình luận ===
const postComment = async (postId, pageAccessToken, message) => {
    if (!message || message.trim() === '') return;

    const endpoint = `https://graph.facebook.com/${API_VERSION}/${postId}/comments`;
    const params = {
        message: message.trim(),
        access_token: pageAccessToken,
    };

    const response = await axios.post(endpoint, null, { params });
    return response.data; // Trả về { id: "comment_id" }
};
// ==========================

// Hàm dùng chung để đăng bài lên một Page cụ thể
const postToPage = async (pageId, pageAccessToken, postData) => {
    // NHẬN THÊM scheduleDate
    const { caption, imageUrls, scheduleDate } = postData;
    
    // 1. XỬ LÝ LÊN LỊCH ĐĂNG BÀI
    const scheduledParams = {};
    let postMode = "LIVE"; // Mặc định là đăng ngay

    if (scheduleDate) {
        try {
            const scheduleTime = new Date(scheduleDate);
            const now = new Date();
            // Facebook yêu cầu thời gian phải tối thiểu 10 phút trong tương lai (600000 ms)
            const minFutureTime = new Date(now.getTime() + 10 * 60 * 1000); 

            if (scheduleTime > minFutureTime) {
                // Chuyển sang UNIX Timestamp (giây)
                const unixTimestamp = Math.floor(scheduleTime.getTime() / 1000);
                
                scheduledParams.scheduled_publish_time = unixTimestamp;
                // Đặt published=false để bài viết trở thành draft và đăng theo lịch
                scheduledParams.published = false; 
                postMode = "SCHEDULED";
                
                console.log(`[FACEBOOK POST] Page ${pageId} scheduled at: ${scheduleTime.toISOString()}`);
            } else {
                // Nếu lịch hẹn quá gần hoặc đã qua, đăng ngay
                console.warn(`[SCHEDULER] Schedule time for Page ${pageId} is too soon or invalid. Posting immediately.`);
            }
        } catch (e) {
            console.error('[SCHEDULER] Invalid schedule date format. Posting immediately:', e.message);
        }
    }
    
    // XÁC ĐỊNH NGUỒN ẢNH DỰA TRÊN postMode
    const sources = (imageUrls || []).filter(url => url.trim() !== '');
    
    if (sources.length === 0) {
        // Trường hợp chỉ có text (Post Text)
        const feedEndpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        const feedParams = {
            message: caption,
            access_token: pageAccessToken,
            ...scheduledParams, // Thêm tham số lên lịch
        };
        const feedResponse = await axios.post(feedEndpoint, null, { params: feedParams });
        return { postResponse: feedResponse.data, postMode };
    } 
    // Logic cho nhiều ảnh (Multi-photo Post)
    else if (sources.length > 1) {
        // ... (Logic cũ: Tải ảnh lên trước, tạo attached_media)
        const attachedMedia = [];
        for (const imageUrl of sources) {
            const uploadEndpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
            const uploadParams = {
                url: imageUrl,
                access_token: pageAccessToken,
                published: false, // Ảnh phải được upload dưới dạng unpublished
            };
            const uploadResponse = await axios.post(uploadEndpoint, null, { params: uploadParams });
            attachedMedia.push({ media_fbid: uploadResponse.data.id });
        }

        // Final call to /feed
        const feedEndpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/feed`;
        
        // Final Post Params
        const feedParams = {
            message: caption,
            access_token: pageAccessToken,
            attached_media: attachedMedia, // Gán mảng media
            ...scheduledParams, // Thêm tham số lên lịch
        };
        
        const feedResponse = await axios.post(feedEndpoint, null, { params: feedParams });
        return { postResponse: feedResponse.data, postMode };
    } 
    // Logic cho 1 ảnh (Single Photo Post)
    else {
        // ... (Single photo upload logic, to /photos)
        const postEndpoint = `https://graph.facebook.com/${API_VERSION}/${pageId}/photos`;
        
        const postParams = {
            caption: caption, 
            url: sources[0], 
            access_token: pageAccessToken,
            ...scheduledParams, // Thêm tham số lên lịch
        };
        
        const postResponse = await axios.post(postEndpoint, null, { params: postParams });
        return { postResponse: postResponse.data, postMode };
    }
};

// ===================================
// EXPORT HANDLER
// ===================================

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const token = await getToken({ req, secret });
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated. Please sign in.' });
    }

    // --- LẤY DỮ LIỆU TỪ BODY ---
    const { 
        selectedPageIds, 
        caption, 
        imageUrls, 
        comment, 
        contentId, // Dùng để update DB sau khi đăng thành công
        scheduleDate // <-- LẤY PARAM MỚI
    } = req.body;
    
    if (!selectedPageIds || selectedPageIds.length === 0) {
        return res.status(400).json({ message: 'No target pages selected.' });
    }

    const results = [];
    
    try {
        // Lặp qua từng Page ID để đăng bài
        for (const pageId of selectedPageIds) {
            let pageAccessToken;

            try {
                // 1. Lấy Page Access Token từ DB (sử dụng hàm getPageAccessToken)
                pageAccessToken = await getPageAccessToken(pageId);
                
                if (!pageAccessToken) {
                    throw new Error('Page Access Token not found in database.');
                }

                // 2. Chuẩn bị Post Data
                const postData = {
                    caption,
                    imageUrls,
                    comment,
                    scheduleDate // <-- TRUYỀN PARAM MỚI VÀO postToPage
                };

                // 3. Đăng bài lên Facebook
                const { postResponse, postMode } = await postToPage(pageId, pageAccessToken, postData);
                
                const postId = postResponse.id || postResponse.post_id; 

                if (!postId) {
                    throw new Error(`Facebook did not return a valid Post ID or Schedule ID for Page ${pageId}.`);
                }

                // **********************************************
                // LƯU Ý: Nếu là bài đăng LÊN LỊCH (SCHEDULED), nó sẽ là UNPUBLISHED_POST
                // Chúng ta không thể comment ngay lập tức lên một UNPUBLISHED_POST.
                // Việc đăng comment nên được thực hiện bởi Scheduler sau khi bài viết được đăng.
                // **********************************************

                let postedComments = [];

                if (postMode === "LIVE" && comment && comment.trim() !== '') {
                    // Xử lý đăng Comment (CHỈ KHI ĐĂNG NGAY)
                    const commentsArray = shuffleArray(splitAndCleanString(comment));
                    
                    for (const commentMessage of commentsArray) {
                        try {
                            const commentResult = await postComment(postId, pageAccessToken, commentMessage);
                            postedComments.push({ message: commentMessage, commentId: commentResult.id, status: 'success' });
                        } catch (commentError) {
                            console.error(`Error posting comment for Post ID ${postId}:`, commentError.response?.data || commentError.message);
                            postedComments.push({ message: commentMessage, status: 'failed', error: commentError.response?.data?.error?.message || commentError.message });
                        }
                    }
                } else if (postMode === "SCHEDULED") {
                    // Bổ sung thông tin cho người dùng biết comment sẽ KHÔNG được đăng ngay
                    postedComments.push({ message: `Bài viết đã được lên lịch thành công. Comment sẽ được đăng sau khi bài viết Live.`, status: 'info' });
                }


                // 4. Cập nhật Content Draft (Optional, nếu contentId được cung cấp)
                if (contentId) {
                    // Cập nhật cả Full Post ID và Page ID (thường là Page ID)
                    await updateDraftPostInfo(contentId, pageId, postId); 
                }

                results.push({
                    pageId,
                    postMode, // Thêm thông tin đăng ngay hay lên lịch
                    status: 'success',
                    postId: postId,
                    comments: postedComments, // TRẢ VỀ KẾT QUẢ BÌNH LUẬN (bao gồm thông báo nếu lên lịch)
                });
                
            } catch (pagePostError) {
                // Xử lý lỗi cấp Page
                console.error(`Error posting to Page ID ${pageId}:`, pagePostError.response ? pagePostError.response.data : pagePostError.message);
                results.push({
                    pageId,
                    status: 'failed',
                    message: pagePostError.response ? (pagePostError.response.data.error.message || pagePostError.response.data.message) : pagePostError.message,
                    details: pagePostError.response?.data,
                });
            }
        }

        // 5. Kết quả cuối cùng
        const allSucceeded = results.every(r => r.status === 'success');
        if (allSucceeded) {
            return res.status(200).json({
                message: 'Posts successful on all selected pages!',
                results,
            });
        } else {
            return res.status(207).json({ 
                message: 'Some posts succeeded, others failed. Check results for details.',
                results,
            });
        }

    } catch (apiError) {
        console.error('Error in Facebook post process:', apiError.response ? apiError.response.data : apiError.message);
        return res.status(apiError.response?.status || 500).json({
            message: 'An error occurred during the overall posting process.',
            error: apiError.response?.data?.error?.message || apiError.message,
        });
    }
}