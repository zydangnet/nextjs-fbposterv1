// src/pages/api/post-video-to-facebook.js - Dành riêng cho Video/Reels Upload
import { getToken } from "next-auth/jwt";
import axios from "axios";
import formidable from 'formidable'; 
import fs from 'fs'; 
import FormData from 'form-data'; 
import { splitAndCleanString, shuffleArray } from 'utils/functions';

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
 * @param {string} postId ID bài viết Facebook (pageId_postId)
 * @param {string} pageAccessToken Page Access Token
 * @param {string} message Nội dung bình luận
 * @returns {Promise<any>}
 */
const postCommentToPost = async (postId, pageAccessToken, message) => {
    const endpoint = `https://graph.facebook.com/${API_VERSION}/${postId}/comments`;
    const params = {
        message: message,
        access_token: pageAccessToken,
    };
    // Sử dụng axios.post với params
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
            //console.log('DEBUG: Raw fields from Formidable:', fields); 
            // Hàm hỗ trợ lấy giá trị đầu tiên từ trường
            const getFirstValue = (field) => Array.isArray(field) ? field[0] : field;
            
            const data = {
                caption: getFirstValue(fields.caption),
                pageId: getFirstValue(fields.pageId),
                videoType: getFirstValue(fields.videoType) || 'NORMAL',
                videoFile: Array.isArray(files.video) ? files.video[0] : files.video, // Lấy file video từ trường 'video'
                commentContent:getFirstValue(fields.commentContent),
                scheduleDate: getFirstValue(fields.scheduleDate),
            };
          
            resolve(data);
        });
    });
};

const postVideoToPage = async (pageId, pageAccessToken, postData) => {
    const { caption, videoFile, videoType } = postData;

    // 1. Tạo FormData cho Facebook API
    const formData = new FormData();
    formData.append('title', caption.substring(0, 100) || videoFile.originalFilename);
    formData.append('description', caption || '');
    formData.append('access_token', pageAccessToken);
    
    // Đính kèm file video dưới dạng stream
    formData.append('file', fs.createReadStream(videoFile.filepath), {
        filename: videoFile.originalFilename,
        contentType: videoFile.mimetype,
        knownLength: videoFile.size // Rất quan trọng cho stream
    });

    // 2. Thiết lập Endpoint và Tham số
    let endpoint = `https://graph-video.facebook.com/${API_VERSION}/${pageId}/videos`;
    
    // Nếu là REELS, thêm tham số:
    if (videoType === 'REELS') {
        // Facebook khuyên dùng endpoint /feed cho Reels từ API v16.0+, nhưng thường video/reels endpoint vẫn được dùng.
        // Tuy nhiên, việc đăng Reels thường có các yêu cầu đặc biệt về chiều dọc, thời lượng.
        // Để đơn giản, ta chỉ thêm tham số is_reel=true (hoặc published_as_reel=true, tùy phiên bản)
        formData.append('is_reel', 'true');
        // Đối với API mới hơn, có thể dùng published_as_reel=true
        // formData.append('published_as_reel', 'true'); 
    }

    // 3. Gửi yêu cầu POST
    try {
        const response = await axios.post(endpoint, formData, {
            // Cần form.getHeaders() cho Content-Type và boundary
            headers: formData.getHeaders(), 
            // Tăng giới hạn timeout và kích thước
            timeout: 600000, // 10 phút
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });
        return response.data;
    } catch (e) {
        // Log chi tiết lỗi
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
  const {pageId, videoFile, videoType, scheduleDate } = postData;
  if (!pageId) {
    return res.status(400).json({ message: 'No Facebook Fanpage selected.' });
  }
  if (!videoFile) {
    return res.status(400).json({ message: 'Please upload a video file.' });
  }
  
  const token = await getToken({ req, secret });

  if (!token || !token.accessToken) {
    // Xóa file tạm thời nếu người dùng chưa đăng nhập
    fs.unlinkSync(videoFile.filepath); 
    return res.status(401).json({ message: 'Not authenticated or no user access token.' });
  }

  try {
    // Bước 2: Lấy Page Access Token
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
        // Xóa file tạm thời
        fs.unlinkSync(videoFile.filepath); 
        return res.status(400).json({ message: `Could not find access token for selected page ID: ${pageId}.` });
    }

    // Bước 3: Đăng Video
    
    console.log(`**Attempting to post ${videoType} video to Page ID: ${pageId}`);
    
    const responseData = await postVideoToPage(pageId, pageAccessToken, postData);
    const fullPostId = responseData.id || responseData.post_id;
    const rawComment = postData.commentContent || "";
    let commentsToPost = splitAndCleanString(rawComment);
    
    if(commentsToPost.length > 3)
      commentsToPost = shuffleArray(commentsToPost);

    const commentResults = [];
    // --- LOGIC ĐĂNG 3 BÌNH LUẬN ---
    if (fullPostId && commentsToPost.length > 0) {
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
                // Vẫn tiếp tục đăng comment kế tiếp
            }
        }
    }
    // --- KẾT THÚC LOGIC ĐĂNG BÌNH LUẬN ---
    // Bước 4: Xóa file tạm thời sau khi đăng thành công (hoặc thất bại)
    try {
        fs.unlinkSync(videoFile.filepath); 
    } catch (e) {
        console.warn('Warning: Could not delete temporary file:', e.message);
    }
    
    return res.status(200).json({
      message: `${videoType} post successful!`,
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