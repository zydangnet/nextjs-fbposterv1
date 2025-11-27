// src/pages/api/post-video-to-facebook.js - Dành riêng cho Video/Reels Upload
import { getToken } from "next-auth/jwt";
import axios from "axios";
import formidable from 'formidable'; 
import fs from 'fs'; 
import FormData from 'form-data'; 
import { splitAndCleanString, shuffleArray } from 'utils/functions';
// Giả định bạn có các hàm tiện ích sau:
// import { getPageAccessToken, updateDraftPostInfo } from 'utils/prisma-utils'; 


const secret = process.env.NEXTAUTH_SECRET;
const API_VERSION = 'v24.0'; 

// CẤU HÌNH BẮT BUỘC: Vô hiệu hóa Body Parser của Next.js cho FormData (video lớn)
export const config = {
  api: {
    bodyParser: false,
  },
};

// Hàm dùng để đăng bình luận
/**
 * Đăng bình luận vào bài viết
 */
const postCommentToPost = async (postId, pageAccessToken, message) => {
    const endpoint = `https://graph.facebook.com/${API_VERSION}/${postId}/comments`;
    const params = {
        message: message,
        access_token: pageAccessToken,
    };
    const response = await axios.post(endpoint, null, { params });
    return response.data; // Trả về { id: 'comment_id' }
};

// Hàm xử lý parse FormData cho Video (có thể rất lớn)
const parseFormData = (req) => {
    return new Promise((resolve, reject) => {
        const form = formidable({ 
            multiples: false, // Chỉ cho 1 video
            maxFileSize: 1024 * 1024 * 1024, // Tăng giới hạn lên 1GB (hoặc tùy chỉnh)
            filename: (name, ext, part) => {
                // Đổi tên file để tránh lỗi trùng lặp
                return `${Date.now()}_${part.originalFilename}`;
            }
        });
        
        form.parse(req, (err, fields, files) => {
            if (err) return reject(err);
            // Hàm hỗ trợ lấy giá trị đầu tiên từ trường
            const getFirstValue = (field) => Array.isArray(field) ? field[0] : field;
            
            const data = {
                caption: getFirstValue(fields.caption),
                pageId: getFirstValue(fields.pageId),
                videoType: getFirstValue(fields.videoType) || 'NORMAL',
                videoFile: Array.isArray(files.video) ? files.video[0] : files.video, // Lấy file video từ trường 'video'
                commentContent: getFirstValue(fields.commentContent),
                // BỔ SUNG: Đọc trường scheduleDate
                scheduleDate: getFirstValue(fields.scheduleDate), 
            };
          
            resolve(data);
        });
    });
};

// Hàm chính đăng video lên Page
const postVideoToPage = async (pageId, pageAccessToken, postData) => {
    const { caption, videoFile, videoType, scheduleDate } = postData; // Đã thêm scheduleDate

    // 1. Tạo FormData cho Facebook API
    const formData = new FormData();
    formData.append('title', caption.substring(0, 100) || videoFile.originalFilename);
    formData.append('description', caption || '');
    formData.append('access_token', pageAccessToken);
    
    // Đính kèm file video dưới dạng stream
    formData.append('file', fs.createReadStream(videoFile.filepath), {
        filename: videoFile.originalFilename,
        contentType: videoFile.mimetype,
        knownLength: videoFile.size 
    });

    // 2. BỔ SUNG LOGIC LÊN LỊCH
    let isScheduled = false;
    if (scheduleDate) {
        const scheduledTimestamp = Math.floor(new Date(scheduleDate).getTime() / 1000);
        
        // Bắt buộc cho lên lịch: Đặt trạng thái là unpublished
        formData.append('published', 'false'); 
        // Gắn Unix Timestamp cho thời gian lên lịch
        formData.append('scheduled_publish_time', scheduledTimestamp); 
        
        isScheduled = true;
        console.log(`[FACEBOOK API] Scheduling post for ${new Date(scheduleDate).toISOString()} (${scheduledTimestamp})`);
    }

    // 3. Thiết lập Endpoint và Tham số
    let endpoint = `https://graph-video.facebook.com/${API_VERSION}/${pageId}/videos`;
    
    if (videoType === 'REELS') {
        formData.append('is_reel', 'true');
    }

    // 4. Gửi yêu cầu POST
    try {
        const response = await axios.post(endpoint, formData, {
            headers: formData.getHeaders(), 
            timeout: 600000, // 10 phút
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });
        
        // Nếu bài đăng được lên lịch, trả về thông tin lịch
        if (isScheduled) {
            return {
                ...response.data,
                scheduled: true,
                scheduledTime: scheduleDate
            };
        }
        
        return response.data;
    } catch (e) {
        console.error("Lỗi chi tiết khi POST video:", e.response?.data?.error || e.message);
        throw e;
    }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // BƯỚC 1: Lấy dữ liệu từ FormData ---
  const postData = await parseFormData(req);
  const {pageId, videoFile, videoType, scheduleDate } = postData; // Đã bao gồm scheduleDate

  if (!pageId) {
    return res.status(400).json({ message: 'No Facebook Fanpage selected.' });
  }
  if (!videoFile) {
    return res.status(400).json({ message: 'Please upload a video file.' });
  }
  
  const token = await getToken({ req, secret });

  if (!token || !token.accessToken) {
    fs.unlinkSync(videoFile.filepath); 
    return res.status(401).json({ message: 'Not authenticated or no user access token.' });
  }

  try {
    // Bước 2: Lấy Page Access Token (Logic giữ nguyên)
    const accountsResponse = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/me/accounts`, 
      {
        params: {
          access_token: token.accessToken,
          fields: 'id,access_token'
        }
      }
    );

    const page = accountsResponse.data.data.find(p => p.id === pageId);
    const pageAccessToken = page?.access_token;

    if (!pageAccessToken) {
        fs.unlinkSync(videoFile.filepath); 
        return res.status(400).json({ message: `Could not find access token for selected page ID: ${pageId}.` });
    }

    // Bước 3: Đăng Video (Đã bao gồm logic lên lịch)
    
    console.log(`**Attempting to post ${videoType} video to Page ID: ${pageId}. Scheduled: ${!!scheduleDate}`);
    
    const responseData = await postVideoToPage(pageId, pageAccessToken, postData);
    const fullPostId = responseData.id || responseData.post_id;
    const rawComment = postData.commentContent || "";
    let commentsToPost = splitAndCleanString(rawComment);
    
    if(commentsToPost.length > 3)
      commentsToPost = shuffleArray(commentsToPost);

    const commentResults = [];
    
    // --- LOGIC ĐĂNG 3 BÌNH LUẬN ---
    // QUAN TRỌNG: Chỉ đăng bình luận nếu bài viết KHÔNG được lên lịch (tức là được đăng ngay)
    if (!responseData.scheduled && fullPostId && commentsToPost.length > 0) {
        console.log(`*==Attempting to post ${commentsToPost.length} comments to Post ID: ${fullPostId}`);

        for (const [index, commentMessage] of commentsToPost.entries()) {
            try {
                const commentResponse = await postCommentToPost(fullPostId, pageAccessToken, commentMessage);
                const commentId = commentResponse.id;

                if (commentId) {
                    commentResults.push({
                        status: 'success',
                        commentId,
                    });
                    console.log(`-----Comment ${index + 1} posted successfully. Comment ID: ${commentId}`);
                }

            } catch (commentError) {
                const cmtErrMsg = commentError.response 
                    ? (commentError.response.data.error.message || 'Facebook API Error') 
                    : commentError.message;

                commentResults.push({
                    status: 'failed',
                    message: `Lỗi Comment ${index + 1}: ${cmtErrMsg}`,
                });
                console.error(`Error posting comment ${index + 1} to Post ID ${fullPostId}:`, cmtErrMsg);
            }
        }
    } else if (responseData.scheduled) {
        console.log("Bài viết được lên lịch, bỏ qua đăng bình luận tự động.");
    }
    // --- KẾT THÚC LOGIC ĐĂNG BÌNH LUẬN ---
    
    // Bước 4: Xóa file tạm thời
    try {
        fs.unlinkSync(videoFile.filepath); 
    } catch (e) {
        console.warn('Warning: Could not delete temporary file:', e.message);
    }
    
    return res.status(200).json({
      message: responseData.scheduled ? `Video scheduled for ${responseData.scheduledTime}!` : `${videoType} post successful!`,
      results: responseData,
      comments: commentResults,
    });

  } catch (apiError) {
    // Xóa file tạm thời khi có lỗi API
    try {
        if (videoFile?.filepath) fs.unlinkSync(videoFile.filepath);
    } catch (e) { /* ignore */ }
    
    console.error('Error in Facebook video post process:', apiError.response ? apiError.response.data : apiError.message);
    return res.status(apiError.response?.status || 500).json({
      message: 'Failed to process video post request.',
      error: apiError.response ? apiError.response.data : apiError.message,
      details: apiError.response?.data,
    });
  }
}